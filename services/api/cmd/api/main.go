package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/woodfishhhh/MuYuNest/services/api/internal/config"
	"github.com/woodfishhhh/MuYuNest/services/api/internal/db"
	"github.com/woodfishhhh/MuYuNest/services/api/internal/httpx"
)

var version = "dev"
var commit = "unknown"

func main() {
	if err := run(); err != nil {
		slog.Error("api stopped", "error", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: cfg.LogLevel}))
	slog.SetDefault(logger)
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	mainDB, err := db.Open(ctx, cfg.DBPath, "muyu")
	if err != nil {
		return err
	}
	defer mainDB.Close()
	analyticsDB, err := db.Open(ctx, cfg.AnalyticsDBPath, "analytics")
	if err != nil {
		return err
	}
	defer analyticsDB.Close()
	if err := os.MkdirAll(cfg.ImageRoot, 0750); err != nil {
		return err
	}
	server := &http.Server{
		Addr:              cfg.Addr,
		Handler:           httpx.New(logger, cfg.AllowedOrigins, mainDB, analyticsDB, cfg.ImageRoot, version, commit, cfg.AnalyticsSecret),
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	done := make(chan error, 1)
	go func() { done <- server.ListenAndServe() }()
	logger.Info("api listening", "addr", cfg.Addr, "version", version, "commit", commit)
	select {
	case err := <-done:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			return errors.Join(err, server.Close())
		}
		return nil
	}
}
