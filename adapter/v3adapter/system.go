package v3adapter

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/containers/podman/v4/libpod/define"
	"github.com/containers/podman/v4/pkg/bindings/system"
	"github.com/containers/podman/v4/pkg/domain/entities"
	"io"
	"log"
	"net/http"
)

func SystemInfo(ctx context.Context, _ *system.InfoOptions) (*define.Info, error) {
	conn, err := getClient(ctx)
	if err != nil {
		return nil, err
	}
	resp, err := conn.DoRequest(ctx, nil, http.MethodGet, "/info", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if err := checkResp(resp); err != nil {
		return nil, err
	}

	var result define.Info
	err = json.NewDecoder(resp.Body).Decode(&result)
	if err != nil {
		return nil, err
	}

	return &result, nil
}

func SystemEvents(ctx context.Context, eventChan chan entities.Event, cancelChan chan bool, options *system.EventsOptions) error {
	conn, err := getClient(ctx)
	if err != nil {
		return err
	}
	params, err := options.ToParams()
	if err != nil {
		return err
	}
	resp, err := conn.DoRequest(ctx, nil, http.MethodGet, "/events", params)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if err := checkResp(resp); err != nil {
		return err
	}

	if cancelChan != nil {
		go func() {
			<-cancelChan
			if err := resp.Body.Close(); err != nil {
				log.Printf("Event, unable to close event response body: %v", err)
			}
		}()
	}

	dec := json.NewDecoder(resp.Body)
	for err = (error)(nil); err == nil; {
		var e = entities.Event{}
		err = dec.Decode(&e)
		if err == nil {
			eventChan <- e
		}
	}
	close(eventChan)
	switch {
	case err == nil:
		return nil
	case errors.Is(err, io.EOF):
		return nil
	default:
		return fmt.Errorf("unable to decode event response: %w", err)
	}
}
