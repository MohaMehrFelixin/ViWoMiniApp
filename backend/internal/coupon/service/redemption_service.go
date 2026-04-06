package service

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"fmt"
	"math/big"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"

	appErrors "github.com/viwo-app/mini-coupon/internal/errors"
	"github.com/viwo-app/mini-coupon/internal/coupon/model"
	"github.com/viwo-app/mini-coupon/internal/coupon/repository"
	"github.com/viwo-app/mini-coupon/internal/idgen"
)

const qrCodeTTL = 10 * time.Minute

type RedemptionService struct {
	allocationRepo repository.AllocationRepository
	redemptionRepo repository.RedemptionRepository
	householdRepo  repository.HouseholdRepository
	pool           *pgxpool.Pool
	idGen          *idgen.Generator
	signingKey     *ecdsa.PrivateKey
	logger         *zap.Logger
}

func NewRedemptionService(allocationRepo repository.AllocationRepository, redemptionRepo repository.RedemptionRepository, householdRepo repository.HouseholdRepository, pool *pgxpool.Pool, idGen *idgen.Generator, keyPath string, logger *zap.Logger) *RedemptionService {
	signingKey, err := loadOrGenerateSigningKey(keyPath, logger)
	if err != nil {
		logger.Fatal("failed to init ECDSA signing key", zap.Error(err))
	}
	return &RedemptionService{allocationRepo: allocationRepo, redemptionRepo: redemptionRepo, householdRepo: householdRepo, pool: pool, idGen: idGen, signingKey: signingKey, logger: logger}
}

func loadOrGenerateSigningKey(keyPath string, logger *zap.Logger) (*ecdsa.PrivateKey, error) {
	if keyPath != "" {
		if keyData, err := os.ReadFile(keyPath); err == nil {
			if block, _ := pem.Decode(keyData); block != nil {
				if key, err := x509.ParseECPrivateKey(block.Bytes); err == nil {
					return key, nil
				}
			}
		}
	}
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, err
	}
	if keyPath != "" {
		if keyBytes, err := x509.MarshalECPrivateKey(key); err == nil {
			block := &pem.Block{Type: "EC PRIVATE KEY", Bytes: keyBytes}
			_ = os.MkdirAll("keys", 0755)
			_ = os.WriteFile(keyPath, pem.EncodeToMemory(block), 0600)
		}
	}
	return key, nil
}

func (s *RedemptionService) GenerateQR(ctx context.Context, householdID int64, category model.CouponCategory, amount string) (*model.QRPayload, error) {
	amountVal, ok := new(big.Float).SetPrec(128).SetString(amount)
	if !ok || amountVal.Sign() <= 0 {
		return nil, appErrors.ErrBadRequest.WithMessage("Invalid amount")
	}
	alloc, err := s.allocationRepo.GetByHouseholdAndCategory(ctx, householdID, category)
	if err != nil {
		return nil, fmt.Errorf("redemption_service: get allocation: %w", err)
	}
	if alloc == nil {
		return nil, appErrors.ErrNotFound.WithMessage("No active allocation")
	}
	availableStr := GetAvailableAmount(alloc)
	available, _ := new(big.Float).SetString(availableStr)
	if available == nil || amountVal.Cmp(available) > 0 {
		return nil, appErrors.ErrInsufficientBalance.WithMessage("Insufficient coupon balance")
	}
	household, err := s.householdRepo.GetByID(ctx, householdID)
	if err != nil || household == nil {
		return nil, appErrors.ErrNotFound.WithMessage("Household not found")
	}
	nonceBytes := make([]byte, 16)
	if _, err := rand.Read(nonceBytes); err != nil {
		return nil, fmt.Errorf("generate nonce: %w", err)
	}
	nonce := base64.URLEncoding.EncodeToString(nonceBytes)
	couponID, _ := s.idGen.Generate()
	now := time.Now().UTC()
	payload := &model.QRPayload{
		HouseholdID: householdID, Category: category, Amount: amount,
		CouponCode: fmt.Sprintf("VC-%d", couponID),
		IssuedAt: now, ExpiresAt: now.Add(qrCodeTTL),
		Tier: household.KYCTier, Nonce: nonce,
	}
	sig, err := s.signPayload(payload)
	if err != nil {
		return nil, err
	}
	payload.Signature = sig
	return payload, nil
}

func (s *RedemptionService) VerifyAndRedeem(ctx context.Context, payload model.QRPayload, distributionPointID int64) (*model.CouponRedemption, error) {
	if err := s.verifySignature(&payload); err != nil {
		return nil, appErrors.ErrBadRequest.WithMessage("Invalid QR signature")
	}
	if !time.Now().UTC().Before(payload.ExpiresAt) {
		return nil, appErrors.ErrBadRequest.WithMessage("QR expired")
	}
	alloc, err := s.allocationRepo.GetByHouseholdAndCategory(ctx, payload.HouseholdID, payload.Category)
	if err != nil || alloc == nil {
		return nil, appErrors.ErrNotFound.WithMessage("Allocation not found")
	}
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.Serializable})
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err := s.allocationRepo.DeductBalance(ctx, tx, alloc.ID, payload.Amount); err != nil {
		return nil, appErrors.ErrBadRequest.WithMessage("Insufficient balance")
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}
	redemptionID, _ := s.idGen.Generate()
	redemption := &model.CouponRedemption{
		ID: redemptionID, HouseholdID: payload.HouseholdID, AllocationID: alloc.ID,
		Category: payload.Category, Amount: payload.Amount, CouponCode: payload.CouponCode,
		DistributionPointID: distributionPointID, QRNonce: payload.Nonce,
		Status: model.RedemptionStatusCompleted, CreatedAt: time.Now().UTC(),
	}
	if err := s.redemptionRepo.Create(ctx, redemption); err != nil {
		if strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "duplicate") {
			return nil, appErrors.ErrDuplicateEntry.WithMessage("Already redeemed")
		}
		return nil, fmt.Errorf("create redemption: %w", err)
	}
	return redemption, nil
}

func (s *RedemptionService) GetHistory(ctx context.Context, householdID int64, category *model.CouponCategory, cursor string, limit int) ([]model.CouponRedemption, string, error) {
	if limit <= 0 { limit = 20 }
	if category != nil {
		return s.redemptionRepo.GetByHouseholdAndCategory(ctx, householdID, *category, cursor, limit)
	}
	return s.redemptionRepo.GetByHousehold(ctx, householdID, cursor, limit)
}

func (s *RedemptionService) DisputeRedemption(ctx context.Context, redemptionID, householdID int64, reason string) error {
	redemption, err := s.redemptionRepo.GetByID(ctx, redemptionID)
	if err != nil || redemption == nil {
		return appErrors.ErrNotFound.WithMessage("Redemption not found")
	}
	if redemption.HouseholdID != householdID {
		return appErrors.ErrForbidden.WithMessage("Not your redemption")
	}
	if redemption.Status != model.RedemptionStatusCompleted {
		return appErrors.ErrBadRequest.WithMessage("Only completed redemptions can be disputed")
	}
	return s.redemptionRepo.UpdateStatus(ctx, redemptionID, model.RedemptionStatusDisputed)
}

func (s *RedemptionService) signPayload(payload *model.QRPayload) (string, error) {
	data := fmt.Sprintf("%d:%s:%s:%s:%s:%s:%d:%s", payload.HouseholdID, payload.Category, payload.Amount, payload.CouponCode, payload.IssuedAt.Format(time.RFC3339), payload.ExpiresAt.Format(time.RFC3339), payload.Tier, payload.Nonce)
	hash := sha256.Sum256([]byte(data))
	r, ss, err := ecdsa.Sign(rand.Reader, s.signingKey, hash[:])
	if err != nil { return "", err }
	curveOrder := s.signingKey.PublicKey.Curve.Params().N
	halfOrder := new(big.Int).Rsh(curveOrder, 1)
	if ss.Cmp(halfOrder) > 0 { ss.Sub(curveOrder, ss) }
	sig := make([]byte, 64)
	copy(sig[32-len(r.Bytes()):32], r.Bytes())
	copy(sig[64-len(ss.Bytes()):64], ss.Bytes())
	return base64.URLEncoding.EncodeToString(sig), nil
}

func (s *RedemptionService) verifySignature(payload *model.QRPayload) error {
	data := fmt.Sprintf("%d:%s:%s:%s:%s:%s:%d:%s", payload.HouseholdID, payload.Category, payload.Amount, payload.CouponCode, payload.IssuedAt.Format(time.RFC3339), payload.ExpiresAt.Format(time.RFC3339), payload.Tier, payload.Nonce)
	hash := sha256.Sum256([]byte(data))
	sigBytes, err := base64.URLEncoding.DecodeString(payload.Signature)
	if err != nil || len(sigBytes) != 64 { return fmt.Errorf("invalid signature") }
	r := new(big.Int).SetBytes(sigBytes[:32])
	ss := new(big.Int).SetBytes(sigBytes[32:])
	if !ecdsa.Verify(&s.signingKey.PublicKey, hash[:], r, ss) { return fmt.Errorf("verification failed") }
	return nil
}
