package utils

import (
	"encoding/json"
	"net/http"
)

func Return(w http.ResponseWriter, ret any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(ret)
}
