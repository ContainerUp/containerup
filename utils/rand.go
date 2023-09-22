package utils

import (
	"math/rand"
	"sync"
	"time"
)

const letterBytes = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

var (
	randGenerator = rand.NewSource(time.Now().UnixNano())
	randMutex     sync.Mutex
)

func RandString(n int) string {
	randMutex.Lock()
	defer randMutex.Unlock()

	b := make([]byte, n)
	for i := range b {
		b[i] = letterBytes[randGenerator.Int63()%int64(len(letterBytes))]
	}
	return string(b)
}
