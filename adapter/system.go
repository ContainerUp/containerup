package adapter

import (
	"containerup/adapter/v3adapter"
	"context"
	"github.com/containers/podman/v4/libpod/define"
	"github.com/containers/podman/v4/pkg/bindings/system"
	"github.com/containers/podman/v4/pkg/domain/entities"
)

func SystemInfo(ctx context.Context, options *system.InfoOptions) (*define.Info, error) {
	if legacy {
		return v3adapter.SystemInfo(ctx, options)
	}
	return system.Info(ctx, options)
}

func SystemEvents(ctx context.Context, eventChan chan entities.Event, cancelChan chan bool, options *system.EventsOptions) error {
	if legacy {
		return v3adapter.SystemEvents(ctx, eventChan, cancelChan, options)
	}
	return system.Events(ctx, eventChan, cancelChan, options)
}
