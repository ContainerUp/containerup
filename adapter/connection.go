package adapter

import (
	"containerup/adapter/v3adapter"
	"context"
	"github.com/blang/semver/v4"
	"github.com/containers/podman/v4/pkg/bindings"
)

func NewConnection(ctx context.Context, uri string) (context.Context, error) {
	if legacy {
		return v3adapter.NewConnection(ctx, uri)
	}

	return bindings.NewConnection(ctx, uri)
}

func ServiceVersion(ctx context.Context) *semver.Version {
	if legacy {
		return v3adapter.ServiceVersion(ctx)
	}
	return bindings.ServiceVersion(ctx)
}
