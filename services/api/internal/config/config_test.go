package config

import (
	"log/slog"
	"os"
	"path/filepath"
	"testing"
)

func TestEnvironment(t *testing.T) {
	t.Setenv("VISITOR_ANALYTICS_SECRET_FILE", "")
	t.Setenv("VISITOR_ANALYTICS_SECRET", "test-secret")
	for _, key := range []string{"MUYU_ADDR", "MUYU_DB_PATH", "MUYU_ANALYTICS_DB_PATH", "IMAGE_ROOT", "CORS_ALLOWED_ORIGINS", "LOG_LEVEL"} {
		t.Setenv(key, "")
	}
	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Addr != "127.0.0.1:8080" || !filepath.IsAbs(cfg.DBPath) || cfg.DBPath == cfg.AnalyticsDBPath {
		t.Fatalf("defaults: %+v", cfg)
	}
	t.Setenv("LOG_LEVEL", "debug")
	t.Setenv("CORS_ALLOWED_ORIGINS", " https://blog.woodfish.site, ,https://img.woodfish.site ")
	t.Setenv("MUYU_ADDR", "127.0.0.1:18080")
	cfg, err = Load()
	if err != nil || cfg.LogLevel != slog.LevelDebug || len(cfg.AllowedOrigins) != 2 || cfg.AllowedOrigins[0] != "https://blog.woodfish.site" {
		t.Fatalf("config: %+v %v", cfg, err)
	}
	t.Setenv("LOG_LEVEL", "not-a-level")
	if _, err = Load(); err == nil {
		t.Fatal("invalid log level accepted")
	}
	t.Setenv("LOG_LEVEL", "info")
	t.Setenv("MUYU_DB_PATH", "data/muyu.db")
	t.Setenv("MUYU_ANALYTICS_DB_PATH", "data/./muyu.db")
	if _, err = Load(); err == nil {
		t.Fatal("same database path accepted")
	}
}

func TestAnalyticsSecret(t *testing.T) {
	t.Setenv("VISITOR_ANALYTICS_SECRET_FILE", "")
	t.Setenv("VISITOR_ANALYTICS_SECRET", "")
	if _, err := Load(); err == nil {
		t.Fatal("accepted missing secret")
	}
	path := filepath.Join(t.TempDir(), "secret")
	t.Setenv("VISITOR_ANALYTICS_SECRET_FILE", path)
	t.Setenv("VISITOR_ANALYTICS_SECRET", "fallback-must-not-hide-file-error")
	if _, err := Load(); err == nil {
		t.Fatal("ignored missing secret file")
	}
	if err := os.WriteFile(path, []byte("  original-secret\n"), 0600); err != nil {
		t.Fatal(err)
	}
	cfg, err := Load()
	if err != nil || string(cfg.AnalyticsSecret) != "original-secret" {
		t.Fatal("secret file precedence/trim failed", err)
	}
	if err := os.WriteFile(path, []byte(" \n"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := Load(); err == nil {
		t.Fatal("accepted empty secret file")
	}
}
