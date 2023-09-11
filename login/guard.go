package login

import (
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

	s.expire = now.Add(time.Hour)
	return true
}

func Guard(next func(http.ResponseWriter, *http.Request)) func(http.ResponseWriter, *http.Request) {
	return func(w http.ResponseWriter, req *http.Request) {
		key := getKeyFromHeaders(req.Header)

		if !checkKey(key) {
			http.Error(w, http.StatusText(http.StatusUnauthorized), http.StatusUnauthorized)
			return
		}

		next(w, req)
	}
}

func WebsocketAuth(conn *websocket.Conn) bool {
	_, key, err := conn.ReadMessage()
	if err != nil {
		return false
	}

	if !checkKey(string(key)) {
		conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(4001, "invalid key"))
		return false
	}

	return true
}
