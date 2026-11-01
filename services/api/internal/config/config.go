package config

import (
	"bytes"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
)

type Config struct {
	Addr            string
	DBPath          string
	AnalyticsDBPath string
	ImageRoot       string
	AllowedOrigins  []string
	LogLevel        slog.Level
	AnalyticsSecret []byte
}

// Load validates configuration consumed by the implemented service routes.
// Authentication and media settings become required when those routes land.
func Load() (Config, error) {
	c := Config{
		Addr:            value("MUYU_ADDR", "127.0.0.1:8080"),
		DBPath:          value("MUYU_DB_PATH", "data/muyu.db"),
		AnalyticsDBPath: value("MUYU_ANALYTICS_DB_PATH", "data/analytics.db"),
		ImageRoot:       value("IMAGE_ROOT", "data/images"),
	}
	var err error
	if path := os.Getenv("VISITOR_ANALYTICS_SECRET_FILE"); path != "" {
		secret, readErr := os.ReadFile(path)
		if readErr != nil {
			return c, fmt.Errorf("VISITOR_ANALYTICS_SECRET_FILE: %w", readErr)
		}
		c.AnalyticsSecret = bytes.TrimSpace(secret)
	} else {
		c.AnalyticsSecret = []byte(os.Getenv("VISITOR_ANALYTICS_SECRET"))
	}
	if len(c.AnalyticsSecret) == 0 {
		return c, fmt.Errorf("set VISITOR_ANALYTICS_SECRET_FILE or VISITOR_ANALYTICS_SECRET")
	}
	c.DBPath, err = filepath.Abs(c.DBPath)
	if err != nil {
		return c, fmt.Errorf("MUYU_DB_PATH: %w", err)
	}
	c.AnalyticsDBPath, err = filepath.Abs(c.AnalyticsDBPath)
	if err != nil {
		return c, fmt.Errorf("MUYU_ANALYTICS_DB_PATH: %w", err)
	}
	if c.DBPath == c.AnalyticsDBPath {
		return c, fmt.Errorf("MUYU_DB_PATH and MUYU_ANALYTICS_DB_PATH must be different")
	}
	if err := c.LogLevel.UnmarshalText([]byte(value("LOG_LEVEL", "info"))); err != nil {
		return c, fmt.Errorf("LOG_LEVEL: %w", err)
	}
	for _, origin := range strings.Split(os.Getenv("CORS_ALLOWED_ORIGINS"), ",") {
		if origin = strings.TrimSpace(origin); origin != "" {
			c.AllowedOrigins = append(c.AllowedOrigins, origin)
		}
	}
	return c, nil
}

func value(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
