package v3adapter

import (
	"context"
	"errors"
	"fmt"
	"github.com/blang/semver/v4"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
)

type ctxType string

var (
	ctxKeyClient  = ctxType("client")
	ctxKeyVersion = ctxType("version")
)

type Connection struct {
	URI    *url.URL
	Client *http.Client
}

func NewConnection(ctx context.Context, uri string) (context.Context, error) {
	_url, err := url.Parse(uri)
	if err != nil {
		return nil, fmt.Errorf("invalid uri: %v", err)
	}

	if !strings.HasPrefix(uri, "unix:///") {
		// autofix unix://path_element vs unix:///path_element
		_url.Path = "/" + _url.Host + "/" + _url.Path
		_url.Host = ""
	}

	ctx = context.WithValue(ctx, ctxKeyClient, &Connection{
		URI: _url,
		Client: &http.Client{
			Transport: &http.Transport{
				DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
					return (&net.Dialer{}).DialContext(ctx, "unix", _url.Path)
				},
				DisableCompression: true,
			},
		},
	})

	ver, err := pingNewConnection(ctx)
	if err != nil {
		return nil, fmt.Errorf("cannot ping server: %v", err)
	}

	ctx = context.WithValue(ctx, ctxKeyVersion, ver)
	return ctx, nil
}

func getClient(ctx context.Context) (*Connection, error) {
	if c, ok := ctx.Value(ctxKeyClient).(*Connection); ok {
		return c, nil
	}
	return nil, errors.New("invalid ctx")
}

func (c *Connection) DoRequest(ctx context.Context, httpBody io.Reader, httpMethod, endpoint string, queryParams url.Values) (*http.Response, error) {
	uri := "http://d/v2.0.0/libpod" + endpoint

	req, err := http.NewRequestWithContext(ctx, httpMethod, uri, httpBody)
	if err != nil {
		return nil, err
	}
	if len(queryParams) > 0 {
		req.URL.RawQuery = queryParams.Encode()
	}

	return c.Client.Do(req)
}

func pingNewConnection(ctx context.Context) (*semver.Version, error) {
	client, err := getClient(ctx)
	if err != nil {
		return nil, err
	}

	resp, err := client.DoRequest(ctx, nil, http.MethodGet, "/_ping", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if err := checkResp(resp); err != nil {
		return nil, err
	}

	verStr := resp.Header.Get("Libpod-API-Version")
	ver, err := semver.ParseTolerant(verStr)
	if err != nil {
		return nil, err
	}

	if ver.Major != 3 {
		return nil, fmt.Errorf("unsupported server version %s, expect major 3", ver)
	}

	return &ver, nil
}

func ServiceVersion(ctx context.Context) *semver.Version {
	if v, ok := ctx.Value(ctxKeyClient).(*semver.Version); ok {
		return v
	}
	return &semver.Version{}
}
