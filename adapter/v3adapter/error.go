package v3adapter

import (
	"encoding/json"
	"github.com/containers/podman/v4/pkg/errorhandling"
	"net/http"
)

func checkResp(resp *http.Response) error {
	if resp.StatusCode < 100 || resp.StatusCode > 299 {
		var ret errorhandling.ErrorModel
		err := json.NewDecoder(resp.Body).Decode(&ret)
		if err != nil {
			ret.ResponseCode = resp.StatusCode
			ret.Message = err.Error()
		}
		return &ret
	}
	return nil
}
