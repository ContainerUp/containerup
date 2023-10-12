package login

import (
	"context"
	"github.com/gorilla/websocket"
	"net/http"
	"strings"
	"time"
)

func getKeyFromHeaders(h http.Header) string {
	val := h.Get("Authorization")
	splitToken := strings.Split(val, "Bearer ")
	if len(splitToken) != 2 {
		return ""
	}
	return splitToken[1]
}

func checkKey(key string) bool {
	sessionMutex.Lock()
	defer sessionMutex.Unlock()

	now := time.Now()
	s := sessionMap[key]
	if s == nil || s.expire.Before(now) {
		return false
	}

	s.use += 1
	return true
}

func unuseKey(key string) {
	sessionMutex.Lock()
	defer sessionMutex.Unlock()

	s := sessionMap[key]
	if s == nil {
		return
	}

	s.expire = time.Now().Add(time.Hour)
	s.use -= 1
}

func Guard(next func(http.ResponseWriter, *http.Request)) func(http.ResponseWriter, *http.Request) {
	return func(w http.ResponseWriter, req *http.Request) {
		key := getKeyFromHeaders(req.Header)

		if !checkKey(key) {
			http.Error(w, http.StatusText(http.StatusUnauthorized), http.StatusUnauthorized)
			return
		}
		defer unuseKey(key)

		next(w, req)
	}
}

func WebsocketAuth(conn *websocket.Conn, ctx context.Context) bool {
	_, key, err := conn.ReadMessage()
	if err != nil {
		return false
	}

	if !checkKey(string(key)) {
		conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(4001, "invalid key"))
		return false
	}

	go func() {
		<-ctx.Done()
		unuseKey(string(key))
	}()

	return true
}
