package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"go.uber.org/zap"

	appErrors "github.com/viwo-app/mini-coupon/internal/errors"
	"github.com/viwo-app/mini-coupon/internal/coupon/model"
	"github.com/viwo-app/mini-coupon/internal/coupon/repository"
	"github.com/viwo-app/mini-coupon/internal/idgen"
)

type HouseholdService struct {
	householdRepo repository.HouseholdRepository
	allocationSvc *AllocationService
	idGen         *idgen.Generator
	logger        *zap.Logger
}

func NewHouseholdService(householdRepo repository.HouseholdRepository, allocationSvc *AllocationService, idGen *idgen.Generator, logger *zap.Logger) *HouseholdService {
	return &HouseholdService{householdRepo: householdRepo, allocationSvc: allocationSvc, idGen: idGen, logger: logger}
}

func (s *HouseholdService) RegisterHousehold(ctx context.Context, telegramUserID int64, req model.RegisterHouseholdRequest) (*model.Household, error) {
	existing, err := s.householdRepo.GetByTelegramUserID(ctx, telegramUserID)
	if err != nil {
		return nil, fmt.Errorf("household_service: check existing: %w", err)
	}
	if existing != nil {
		// Update head member with real KYC data if any field still has dummy values
		if req.FullName != "" || req.BirthDate != "" || req.Gender != "" {
			members, _ := s.householdRepo.GetMembers(ctx, existing.ID)
			for _, m := range members {
				if m.Relationship != "head" {
					continue
				}
				dummyName := m.FullName == "Head of Household" || m.FullName == "سرپرست"
				dummyBirth := m.BirthDate.Format("2006-01-02") == "1990-01-01"
				dummyGender := m.Gender == "other"

				if dummyName || dummyBirth || dummyGender {
					fullName := req.FullName
					if fullName == "" {
						fullName = m.FullName
					}
					birthDate := req.BirthDate
					if birthDate == "" {
						birthDate = m.BirthDate.Format("2006-01-02")
					}
					gender := req.Gender
					if gender == "" {
						gender = m.Gender
					}
					s.logger.Info("updating head member with real KYC data",
						zap.Int64("household_id", existing.ID),
						zap.Bool("dummy_name", dummyName),
						zap.Bool("dummy_birth", dummyBirth),
						zap.Bool("dummy_gender", dummyGender),
					)
					updateReq := model.AddMemberRequest{
						NationalCode: m.NationalCode,
						FullName:     fullName,
						BirthDate:    birthDate,
						Gender:       gender,
						Relationship: "head",
					}
					_ = s.householdRepo.UpdateMember(ctx, m.ID, updateReq)
				}
				break
			}
		}
		return existing, nil
	}
	householdID, err := s.idGen.Generate()
	if err != nil {
		return nil, fmt.Errorf("household_service: generate id: %w", err)
	}
	householdCode := fmt.Sprintf("HH-%d", householdID%10000000000)
	locationSegment := "urban"
	provinceCode := "XX"
	if req.Lat > 35.5 && req.Lat < 35.9 && req.Lng > 51.1 && req.Lng < 51.6 {
		locationSegment = "tehran"
		provinceCode = "TH"
	}
	household := &model.Household{
		ID: householdID, TelegramUserID: telegramUserID,
		HouseholdCode: householdCode, KYCTier: model.KYCTierDigital,
		PhoneNumber: req.Mobile, Address: req.Address,
		Lat: req.Lat, Lng: req.Lng,
		ProvinceCode: provinceCode, LocationSegment: locationSegment,
		Status: model.HouseholdStatusActive,
	}
	if err := s.householdRepo.Create(ctx, household); err != nil {
		if strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "duplicate") {
			existing, _ := s.householdRepo.GetByTelegramUserID(ctx, telegramUserID)
			if existing != nil {
				return existing, nil
			}
			return nil, appErrors.ErrDuplicateEntry.WithMessage("Household already exists")
		}
		return nil, fmt.Errorf("household_service: create: %w", err)
	}
	s.logger.Info("household registered", zap.Int64("id", householdID), zap.Int64("tg_user", telegramUserID))

	// Use real personal data from KYC flow (no more dummy values)
	fullName := req.FullName
	if fullName == "" {
		fullName = "Head of Household"
	}
	birthDate := req.BirthDate
	if birthDate == "" {
		birthDate = "1990-01-01"
	}
	gender := req.Gender
	if gender == "" {
		gender = "other"
	}
	kycVerified := req.KYCTrackID != ""

	headMemberReq := model.AddMemberRequest{
		NationalCode: req.NationalCode, FullName: fullName,
		BirthDate: birthDate, Gender: gender, Relationship: "head",
	}
	headMember, err := s.AddMember(ctx, householdID, headMemberReq)
	if err != nil {
		s.logger.Warn("failed to auto-add head member", zap.Error(err))
	} else if kycVerified && headMember != nil {
		// Persist KYC verified status to database (not just in-memory)
		if err := s.householdRepo.SetMemberKYCVerified(ctx, headMember.ID, true); err != nil {
			s.logger.Warn("failed to set kyc_verified", zap.Error(err))
		}
	}
	return household, nil
}

func (s *HouseholdService) AddMember(ctx context.Context, householdID int64, req model.AddMemberRequest) (*model.HouseholdMember, error) {
	for _, r := range req.NationalCode {
		if r < '0' || r > '9' {
			return nil, appErrors.ErrBadRequest.WithMessage("National code must contain only digits")
		}
	}
	existing, err := s.householdRepo.GetMemberByNationalCode(ctx, req.NationalCode)
	if err != nil {
		return nil, fmt.Errorf("household_service: check member: %w", err)
	}
	if existing != nil {
		return nil, appErrors.ErrDuplicateEntry.WithMessage("National code already registered")
	}
	birthDate, err := time.Parse("2006-01-02", req.BirthDate)
	if err != nil {
		return nil, appErrors.ErrBadRequest.WithMessage("Invalid birth date, expected YYYY-MM-DD")
	}
	if birthDate.After(time.Now().UTC()) {
		return nil, appErrors.ErrBadRequest.WithMessage("Birth date cannot be in the future")
	}
	memberID, err := s.idGen.Generate()
	if err != nil {
		return nil, fmt.Errorf("household_service: generate member id: %w", err)
	}
	specialFlags := req.SpecialFlags
	if specialFlags == nil {
		specialFlags = []string{}
	}
	member := &model.HouseholdMember{
		ID: memberID, HouseholdID: householdID,
		NationalCode: req.NationalCode, FullName: req.FullName,
		BirthDate: birthDate, Gender: req.Gender,
		Relationship: req.Relationship, AgeGroup: calculateAgeGroup(birthDate),
		SpecialFlags: specialFlags, KYCVerified: false,
	}
	if err := s.householdRepo.AddMember(ctx, member); err != nil {
		if strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "duplicate") {
			return nil, appErrors.ErrDuplicateEntry.WithMessage("National code already registered")
		}
		return nil, fmt.Errorf("household_service: add member: %w", err)
	}
	household, err := s.householdRepo.GetByID(ctx, householdID)
	if err == nil && household != nil {
		members, err := s.householdRepo.GetMembers(ctx, householdID)
		if err == nil {
			_ = s.allocationSvc.CalculateAndIssue(ctx, household, members)
		}
	}
	return member, nil
}

func (s *HouseholdService) GetHouseholdSummary(ctx context.Context, telegramUserID int64) (*model.HouseholdSummaryResponse, error) {
	household, err := s.householdRepo.GetByTelegramUserID(ctx, telegramUserID)
	if err != nil {
		return nil, fmt.Errorf("household_service: get household: %w", err)
	}
	if household == nil {
		return nil, appErrors.ErrNotFound.WithMessage("Household not found")
	}
	members, err := s.householdRepo.GetMembers(ctx, household.ID)
	if err != nil {
		return nil, fmt.Errorf("household_service: get members: %w", err)
	}
	return &model.HouseholdSummaryResponse{Household: household, MemberCount: len(members), Members: members}, nil
}

func (s *HouseholdService) GetMembers(ctx context.Context, telegramUserID int64) ([]model.HouseholdMember, error) {
	household, err := s.householdRepo.GetByTelegramUserID(ctx, telegramUserID)
	if err != nil {
		return nil, fmt.Errorf("household_service: get household: %w", err)
	}
	if household == nil {
		return nil, appErrors.ErrNotFound.WithMessage("Household not found")
	}
	return s.householdRepo.GetMembers(ctx, household.ID)
}

func calculateAgeGroup(birthDate time.Time) string {
	days := int(time.Now().UTC().Sub(birthDate).Hours() / 24)
	switch {
	case days < 182:
		return model.AgeGroupInfant0to6m
	case days < 730:
		return model.AgeGroupInfant6to23m
	case days < 1825:
		return model.AgeGroupChild2to4
	case days < 4015:
		return model.AgeGroupChild5to11
	case days < 6570:
		return model.AgeGroupTeen12to17
	case days < 21900:
		return model.AgeGroupAdult18to59
	case days < 23725:
		return model.AgeGroupSenior60to64
	default:
		return model.AgeGroupElderly65p
	}
}
