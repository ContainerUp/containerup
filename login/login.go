package login

import (
	"containerup/utils"
	"encoding/json"
	"golang.org/x/crypto/bcrypt"
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
	username     string
	passwordHash []byte

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

func InitLogin(u, p string) {
	if u == "" {
		log.Fatalf("Invalid username")
	}
	username = u
	passwordHash = []byte(p)

	if _, err := bcrypt.Cost(passwordHash); err != nil {
		log.Fatalf("Invalid password hash: %v", err)
	}
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

	pass := true
	if d.Username != username {
		pass = false
		log.Printf("username mismatch: %s", d.Username)
	}
	if pass {
		if err := bcrypt.CompareHashAndPassword(passwordHash, []byte(d.Password)); err != nil {
			pass = false
			log.Printf("password mismatch")
		}
	}

	if !pass {
		time.Sleep(time.Second)
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
