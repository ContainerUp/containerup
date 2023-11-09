package login

import (
	"containerup/utils"
	"net/http"
)

func Logout(w http.ResponseWriter, req *http.Request) {
	key := getKeyFromHeaders(req.Header)

	sessionMutex.Lock()
	delete(sessionMap, key)
	sessionMutex.Unlock()
	utils.Return(w, true)
}
