package conn

import (
	"context"
	"github.com/containers/podman/v4/pkg/bindings"
	"net/http"
	"time"
)

type ctxKeyT struct{}

var (
	uri    string
	ctxKey = &ctxKeyT{}
)

func InitUri(s string) {
	uri = s
}

func Connection(next func(http.ResponseWriter, *http.Request), timeout time.Duration) func(http.ResponseWriter, *http.Request) {
	return func(w http.ResponseWriter, req *http.Request) {
		ctx, cancel := context.WithTimeout(context.Background(), timeout)
		defer cancel()

		conn, err := bindings.NewConnection(ctx, uri)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		next(w, req.WithContext(context.WithValue(req.Context(), ctxKey, conn)))
	}
}

func GetConn(ctx context.Context) context.Context {
	if c := ctx.Value(ctxKey); c != nil {
		return c.(context.Context)
	}
	return nil
}
