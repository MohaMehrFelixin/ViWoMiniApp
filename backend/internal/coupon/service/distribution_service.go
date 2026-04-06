package service

import (
	"context"
	"fmt"

	"go.uber.org/zap"

	appErrors "github.com/viwo-app/mini-coupon/internal/errors"
	"github.com/viwo-app/mini-coupon/internal/coupon/model"
	"github.com/viwo-app/mini-coupon/internal/coupon/repository"
)

const defaultSearchRadiusKm = 50.0

type DistributionService struct {
	distributionRepo repository.DistributionRepository
	logger           *zap.Logger
}

func NewDistributionService(distributionRepo repository.DistributionRepository, logger *zap.Logger) *DistributionService {
	return &DistributionService{distributionRepo: distributionRepo, logger: logger}
}

func (s *DistributionService) GetNearbyWithStock(ctx context.Context, lat, lng float64, category *model.CouponCategory) ([]model.DistributionCenter, error) {
	var catStr *string
	if category != nil {
		c := string(*category)
		catStr = &c
	}
	centers, err := s.distributionRepo.GetNearby(ctx, lat, lng, defaultSearchRadiusKm, catStr)
	if err != nil {
		return nil, fmt.Errorf("distribution_service: get nearby: %w", err)
	}
	if centers == nil {
		centers = make([]model.DistributionCenter, 0)
	}
	return centers, nil
}

func (s *DistributionService) GetDetail(ctx context.Context, centerID int64) (*model.DistributionCenter, error) {
	center, err := s.distributionRepo.GetByID(ctx, centerID)
	if err != nil {
		return nil, fmt.Errorf("distribution_service: get detail: %w", err)
	}
	if center == nil {
		return nil, appErrors.ErrNotFound.WithMessage("Distribution center not found")
	}
	return center, nil
}
