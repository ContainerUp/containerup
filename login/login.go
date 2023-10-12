package login

import (
	"containerup/utils"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"
)

type session struct {
	expire time.Time
	use    uint
}

var (
	pwd string

	sessionMap   = make(map[string]*session)
	sessionMutex sync.Mutex
)

func init() {
	go func() {
		for {
			time.Sleep(time.Minute * 5)
			now := time.Now()
			sessionMutex.Lock()
			for k, s := range sessionMap {
				if s.use == 0 && s.expire.Before(now) {
					delete(sessionMap, k)
				}
			}
			sessionMutex.Unlock()
		}
	}()
}

func InitPassword(p string) {
	if len(p) != 64 {
		log.Fatalf("invalid sha256 hashed password")
	}
	pwd = p
}

type loginReq struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func Login(w http.ResponseWriter, req *http.Request) {
	var d loginReq
	err := json.NewDecoder(req.Body).Decode(&d)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	str := fmt.Sprintf("%s:%s", d.Username, d.Password)
	result := fmt.Sprintf("%x", sha256.Sum256([]byte(str)))

	if result != pwd {
		time.Sleep(time.Second * 3)
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	key := utils.RandString(64)

	sessionMutex.Lock()
	sessionMap[key] = &session{
		expire: time.Now().Add(time.Hour),
	}
	sessionMutex.Unlock()

	utils.Return(w, map[string]any{"key": key})
}
