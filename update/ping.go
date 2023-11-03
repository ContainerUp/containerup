package update

import (
	"containerup/system"
	"containerup/utils"
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

func Ping() {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://127.0.0.1:3876/api/ping", nil)
	if err != nil {
		fmt.Printf("Cannot create http request: %v\n", err)
		os.Exit(1)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Printf("Cannot do http request: %v\n", err)
		os.Exit(1)
	}

	if resp.StatusCode != http.StatusOK {
		fmt.Printf("Unexpected status: %s\n", resp.Status)
		os.Exit(1)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("Cannot read response: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("%s", data)
	os.Exit(0)
}

func Pong(writer http.ResponseWriter, req *http.Request) {
	utils.Return(writer, map[string]any{
		"version": system.Version,
	})
}
