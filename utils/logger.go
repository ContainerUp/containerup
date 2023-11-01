package utils

import (
	"bufio"
	"errors"
	"log"
	"net"
	"net/http"
	"time"
)

type loggerWriter struct {
	w          http.ResponseWriter
	statusCode int
}

func (lw *loggerWriter) Header() http.Header {
	return lw.w.Header()
}

func (lw *loggerWriter) Write(d []byte) (int, error) {
	if lw.statusCode == 0 {
		lw.statusCode = http.StatusOK
	}
	return lw.w.Write(d)
}

func (lw *loggerWriter) WriteHeader(statusCode int) {
	lw.statusCode = statusCode
	lw.w.WriteHeader(statusCode)
}

func (lw *loggerWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	if wrapped, ok := lw.w.(http.Hijacker); ok {
		return wrapped.Hijack()
	}

	return nil, nil, errors.New("ResponseWriter does not support hijacking")
}

func ChainLogger(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		startTime := time.Now()
		lw := &loggerWriter{w: w}
		next(lw, req)

		endTime := time.Now()
		dur := float64(endTime.Sub(startTime).Milliseconds()) / 1000
		ip, _, _ := net.SplitHostPort(req.RemoteAddr)
		log.Printf("%s %s %d %.3fs\n", ip, req.URL.Path, lw.statusCode, dur)
	}
}

func MiddlewareLogger(next http.Handler) http.Handler {
	return ChainLogger(next.ServeHTTP)
}
