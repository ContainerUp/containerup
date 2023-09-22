package utils

import (
	"context"
	"net/http"
	"time"
)

func ChainTimeoutCtx(next http.HandlerFunc, timeout time.Duration) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		ctx, cancel := context.WithTimeout(req.Context(), timeout)
		defer cancel()

		next(w, req.WithContext(ctx))
	}
}
