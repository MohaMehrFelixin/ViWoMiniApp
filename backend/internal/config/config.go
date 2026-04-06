package config

import (
	"fmt"
	"strings"

	"github.com/spf13/viper"
)

type Config struct {
	Server           ServerConfig   `mapstructure:"server"`
	Database         DatabaseConfig `mapstructure:"postgres"`
	Redis            RedisConfig    `mapstructure:"redis"`
	TelegramBotToken string         `mapstructure:"telegram_bot_token"`
	SigningKeyPath   string         `mapstructure:"signing_key_path"`
	Environment      string         `mapstructure:"environment"`
	WorkerID         int64          `mapstructure:"worker_id"`
	LogLevel         string         `mapstructure:"log_level"`
}

type ServerConfig struct {
	Host string `mapstructure:"host"`
	Port int    `mapstructure:"port"`
}

func (s ServerConfig) Address() string {
	return fmt.Sprintf("%s:%d", s.Host, s.Port)
}

type DatabaseConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	User     string `mapstructure:"user"`
	Password string `mapstructure:"password"`
	DBName   string `mapstructure:"db"`
	SSLMode  string `mapstructure:"ssl_mode"`
	MaxConns int32  `mapstructure:"max_conns"`
}

func (d DatabaseConfig) DSN() string {
	return fmt.Sprintf(
		"postgres://%s:%s@%s:%d/%s?sslmode=%s",
		d.User, d.Password, d.Host, d.Port, d.DBName, d.SSLMode,
	)
}

type RedisConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	Password string `mapstructure:"password"`
	DB       int    `mapstructure:"db"`
}

func (r RedisConfig) Address() string {
	return fmt.Sprintf("%s:%d", r.Host, r.Port)
}

func Load() (*Config, error) {
	v := viper.New()

	v.SetConfigFile(".env")
	v.SetConfigType("env")
	_ = v.ReadInConfig()

	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	// Defaults.
	v.SetDefault("server.host", "0.0.0.0")
	v.SetDefault("server.port", 8080)
	v.SetDefault("postgres.host", "localhost")
	v.SetDefault("postgres.port", 5432)
	v.SetDefault("postgres.user", "viwo")
	v.SetDefault("postgres.password", "viwo")
	v.SetDefault("postgres.db", "viwo_coupon")
	v.SetDefault("postgres.ssl_mode", "disable")
	v.SetDefault("postgres.max_conns", 20)
	v.SetDefault("redis.host", "localhost")
	v.SetDefault("redis.port", 6379)
	v.SetDefault("redis.password", "")
	v.SetDefault("redis.db", 0)
	v.SetDefault("telegram_bot_token", "")
	v.SetDefault("signing_key_path", "keys/coupon_signing.pem")
	v.SetDefault("environment", "development")
	v.SetDefault("worker_id", 1)
	v.SetDefault("log_level", "info")

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("config: failed to unmarshal: %w", err)
	}

	return &cfg, nil
}
