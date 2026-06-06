// Package middleware provides HTTP middleware for the nihAI Muhtar API.
package middleware

import (
	"context"
	"net/http"
	"sync"

	"golang.org/x/time/rate"
)

const (
	// streetViewRPS is the permitted requests per second for Street View API calls.
	// 10 000 daily quota ÷ 86 400 seconds ≈ 0.12 RPS; we allow bursts of 10.
	streetViewRPS   = rate.Limit(2) // 2 RPS in dev/test; lower in production
	streetViewBurst = 10
)

// StreetViewRateLimiter wraps a token-bucket rate limiter for Street View requests.
// A single global limiter is used (not per-IP) since the quota is server-side.
type StreetViewRateLimiter struct {
	limiter *rate.Limiter
	mu      sync.Mutex
}

// NewStreetViewRateLimiter creates a middleware-ready rate limiter.
func NewStreetViewRateLimiter() *StreetViewRateLimiter {
	return &StreetViewRateLimiter{
		limiter: rate.NewLimiter(streetViewRPS, streetViewBurst),
	}
}

// RateLimit returns an HTTP middleware that enforces the Street View quota.
// Requests that exceed the limit receive 429 Too Many Requests.
func (rl *StreetViewRateLimiter) RateLimit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rl.mu.Lock()
		allow := rl.limiter.Allow()
		rl.mu.Unlock()

		if !allow {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Retry-After", "1")
			w.WriteHeader(http.StatusTooManyRequests)
			w.Write([]byte(`{"error":"rate_limit_exceeded","message":"Street View API quota exhausted — please retry in 1 second"}`))
			return
		}

		next.ServeHTTP(w, r)
	})
}

// Wait blocks until a Street View token is available.
// Use this in goroutines rather than as HTTP middleware.
func (rl *StreetViewRateLimiter) Wait(r *http.Request) error {
	return rl.limiter.Wait(r.Context())
}

// WaitCtx blocks until a Street View token is available or ctx is cancelled.
// Use this inside background goroutines (e.g. batch analysis workers) where
// no *http.Request is available.
func (rl *StreetViewRateLimiter) WaitCtx(ctx context.Context) error {
	return rl.limiter.Wait(ctx)
}
