package login

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"sync"
	"time"
)

type session struct {
	expire time.Time
}

var (
	pwd string

	sessionMap   = make(map[string]*session)
	sessionMutex sync.Mutex

	randGenerator = rand.NewSource(time.Now().UnixNano())
)

func init() {
	go func() {
		for {
			time.Sleep(time.Minute * 5)
			now := time.Now()
			sessionMutex.Lock()
			for k, s := range sessionMap {
				if s.expire.Before(now) {
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

	key := randString(64)

	sessionMutex.Lock()
	sessionMap[key] = &session{
		expire: time.Now().Add(time.Hour),
	}
	sessionMutex.Unlock()

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(&struct {
		Key string `json:"key"`
	}{
		Key: key,
	})
}

const letterBytes = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

func randString(n int) string {
	b := make([]byte, n)
	for i := range b {
		b[i] = letterBytes[randGenerator.Int63()%int64(len(letterBytes))]
	}
	return string(b)
}
