package utils

import (
	"github.com/containers/podman/v4/pkg/errorhandling"
	"net/http"
)

func IsErr404(err error) bool {
	if ne, ok := err.(*errorhandling.ErrorModel); ok {
		return ne.ResponseCode == http.StatusNotFound
	}
	return false
}

func IsWsCloseMsgTooLong(err error) bool {
	return err.Error() == "websocket: invalid control frame"
}
