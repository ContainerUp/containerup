package wstypes

import "encoding/json"

type WsReqMessage struct {
	Index  uint            `json:"index"`
	Action string          `json:"action"`
	Data   json.RawMessage `json:"data"`
}

type WsRespMessage struct {
	Index uint `json:"index"`
	Error bool `json:"error,omitempty"`
	Data  any  `json:"data"`
}
