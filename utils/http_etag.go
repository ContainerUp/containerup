package utils

import (
	"bytes"
	"encoding/hex"
	"fmt"
	"hash"
	"hash/fnv"
	"net/http"
	"sync"
)

var (
	eTagStore = map[string]string{}
	eTagMutex sync.RWMutex
)

type eTagWriter struct {
	w          http.ResponseWriter
	inm        string
	buf        *bytes.Buffer
	hash       hash.Hash
	statusCode int
}

func (etw *eTagWriter) Header() http.Header {
	return etw.w.Header()
}

func (etw *eTagWriter) Write(d []byte) (int, error) {
	if etw.statusCode == 0 {
		etw.statusCode = http.StatusOK
	}
	n, err := etw.hash.Write(d)
	etw.buf.Write(d[0:n])
	return n, err
}

func (etw *eTagWriter) WriteHeader(statusCode int) {
	etw.statusCode = statusCode
}

func (etw *eTagWriter) flush(key string) {
	if etw.statusCode != http.StatusOK {
		etw.w.WriteHeader(etw.statusCode)
		etw.w.Write(etw.buf.Bytes())
		return
	}

	eTagVal := fmt.Sprintf("\"%s\"", hex.EncodeToString(etw.hash.Sum(nil)))
	etw.w.Header().Set("ETag", eTagVal)

	eTagMutex.Lock()
	eTagStore[key] = eTagVal
	eTagMutex.Unlock()

	if etw.inm != "" && etw.inm == eTagVal {
		etw.w.WriteHeader(http.StatusNotModified)
		return
	}

	etw.w.Write(etw.buf.Bytes())
}

func ChainETag(next func(http.ResponseWriter, *http.Request), key string) func(http.ResponseWriter, *http.Request) {
	return func(w http.ResponseWriter, req *http.Request) {
		if key == "" {
			key = req.URL.Path
		}

		inm := req.Header.Get("If-None-Match")
		eTagMutex.RLock()
		eTag := eTagStore[key]
		eTagMutex.RUnlock()

		if inm != "" && inm == eTag {
			w.Header().Set("ETag", inm)
			w.WriteHeader(http.StatusNotModified)
			return
		}

		etw := &eTagWriter{w: w, inm: inm, buf: bytes.NewBuffer(nil), hash: fnv.New128()}
		next(etw, req)
		etw.flush(key)
	}
}
