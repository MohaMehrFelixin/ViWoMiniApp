package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"

	"github.com/viwo-app/mini-coupon/internal/config"
	"github.com/viwo-app/mini-coupon/internal/database"
	couponHandler "github.com/viwo-app/mini-coupon/internal/coupon/handler"
	"github.com/viwo-app/mini-coupon/internal/coupon/repository"
	"github.com/viwo-app/mini-coupon/internal/coupon/service"
	"github.com/viwo-app/mini-coupon/internal/finnotech"
	"github.com/viwo-app/mini-coupon/internal/idgen"
	"github.com/viwo-app/mini-coupon/internal/middleware"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "config: %v\n", err)
		os.Exit(1)
	}

	var logger *zap.Logger
	if cfg.Environment == "production" {
		logger, _ = zap.NewProduction()
	} else {
		logger, _ = zap.NewDevelopment()
	}
	defer func() { _ = logger.Sync() }()

	ctx := context.Background()

	pgPool, err := database.NewPostgresPool(ctx, cfg.Database)
	if err != nil {
		logger.Fatal("postgres failed", zap.Error(err))
	}
	defer database.ClosePostgres(pgPool)
	logger.Info("connected to PostgreSQL")

	rdb, err := database.NewRedisClient(ctx, cfg.Redis)
	if err != nil {
		logger.Fatal("redis failed", zap.Error(err))
	}
	defer func() { _ = database.CloseRedis(rdb) }()
	logger.Info("connected to Redis")

	idGen, err := idgen.NewGenerator(cfg.WorkerID)
	if err != nil {
		logger.Fatal("idgen failed", zap.Error(err))
	}

	// Repos.
	householdRepo := repository.NewPostgresHouseholdRepo(pgPool)
	allocationRepo := repository.NewPostgresAllocationRepo(pgPool)
	redemptionRepo := repository.NewPostgresRedemptionRepo(pgPool)
	distributionRepo := repository.NewPostgresDistributionRepo(pgPool)
	powerBankRepo := repository.NewPostgresPowerBankRepo(pgPool)

	// Services.
	allocationSvc := service.NewAllocationService(allocationRepo, idGen, logger)
	householdSvc := service.NewHouseholdService(householdRepo, allocationSvc, idGen, logger)
	redemptionSvc := service.NewRedemptionService(allocationRepo, redemptionRepo, householdRepo, pgPool, idGen, cfg.SigningKeyPath, logger)
	distributionSvc := service.NewDistributionService(distributionRepo, logger)
	powerBankSvc := service.NewPowerBankService(powerBankRepo, householdRepo, idGen, logger)

	// Finnotech + KYC.
	var fnClient *finnotech.Client
	if cfg.Finnotech.Enabled {
		fnClient = finnotech.NewClient(
			cfg.Finnotech.BaseURL, cfg.Finnotech.ClientID,
			cfg.Finnotech.ClientSecret, cfg.Finnotech.RedirectURI, logger,
		)
		logger.Info("finnotech KYC enabled")
	} else {
		logger.Info("finnotech KYC disabled (development mode)")
	}
	kycSvc := service.NewKYCService(fnClient, rdb, logger, cfg.Finnotech.Enabled)

	handler := couponHandler.NewCouponHandler(householdSvc, allocationSvc, redemptionSvc, distributionSvc, powerBankSvc, kycSvc, rdb, logger)
	tgAuth := middleware.TelegramAuth(cfg.TelegramBotToken)

	r := chi.NewRouter()
	r.Use(middleware.CORS())
	r.Use(middleware.Recovery(logger))
	r.Use(middleware.RequestLogging(logger))

	r.Get("/health", healthCheck(pgPool, rdb))

	r.Route("/api/v1/coupon", func(r chi.Router) {
		couponHandler.RegisterRoutes(r, handler, tgAuth, rdb)
	})

	srv := &http.Server{
		Addr: cfg.Server.Address(), Handler: r,
		ReadTimeout: 15 * time.Second, WriteTimeout: 15 * time.Second, IdleTimeout: 60 * time.Second,
	}

	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGTERM)

	go func() {
		logger.Info("server starting", zap.String("addr", cfg.Server.Address()))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("server failed", zap.Error(err))
		}
	}()

	<-done
	logger.Info("shutting down...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("shutdown error", zap.Error(err))
	}
	logger.Info("stopped")
}

func healthCheck(pgPool *pgxpool.Pool, rdb *redis.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()
		pgOK, redisOK := "up", "up"
		if err := pgPool.Ping(ctx); err != nil {
			pgOK = "down"
		}
		if err := rdb.Ping(ctx).Err(); err != nil {
			redisOK = "down"
		}
		status := http.StatusOK
		if pgOK == "down" || redisOK == "down" {
			status = http.StatusServiceUnavailable
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(map[string]string{"postgres": pgOK, "redis": redisOK})
	}
}
