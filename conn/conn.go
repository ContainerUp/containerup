package conn

import (
	"containerup/adapter"
	"context"
	"net/http"
)

type ctxKeyT struct{}

var (
	ctxKey = &ctxKeyT{}
)

func ConnectionChainer(uri string) (func(http.HandlerFunc) http.HandlerFunc, error) {
	conn, err := adapter.NewConnection(context.Background(), uri)
	if err != nil {
		return nil, err
	}

	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, req *http.Request) {
			next(w, req.WithContext(context.WithValue(req.Context(), ctxKey, conn)))
		}
	}, nil
}

func GetConn(ctx context.Context) context.Context {
	if c := ctx.Value(ctxKey); c != nil {
		return c.(context.Context)
	}
	return nil
}
