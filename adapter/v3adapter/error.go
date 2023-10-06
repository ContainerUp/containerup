package v3adapter

import (
	"github.com/containers/podman/v4/pkg/errorhandling"
	"io"
	"net/http"
)

func checkResp(resp *http.Response) error {
	if resp.StatusCode < 100 || resp.StatusCode > 299 {
		d, _ := io.ReadAll(resp.Body)
		return &errorhandling.ErrorModel{
			Because:      "",
			Message:      string(d),
			ResponseCode: resp.StatusCode,
		}
	}
	return nil
}
