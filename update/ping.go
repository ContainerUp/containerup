package update

import (
	"containerup/system"
	"containerup/utils"
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

func Ping(isTls bool) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	pingUrl := "http://127.0.0.1:3876/api/ping"
	if isTls {
		pingUrl = "https://127.0.0.1:3876/api/ping"
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, pingUrl, nil)
	if err != nil {
		fmt.Printf("Cannot create http request: %v\n", err)
		os.Exit(1)
	}

	httpClient := http.Client{}
	if isTls {
		tr := http.DefaultTransport.(*http.Transport).Clone()
		tr.TLSClientConfig = &tls.Config{
			InsecureSkipVerify: true,
		}
		httpClient.Transport = tr
	}

	resp, err := httpClient.Do(req)
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
