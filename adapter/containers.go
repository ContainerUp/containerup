package adapter

import (
	"containerup/adapter/v3adapter"
	"context"
	"github.com/containers/podman/v4/libpod/define"
	"github.com/containers/podman/v4/pkg/api/handlers"
	"github.com/containers/podman/v4/pkg/bindings/containers"
	"github.com/containers/podman/v4/pkg/domain/entities"
	"github.com/containers/podman/v4/pkg/domain/entities/reports"
	"github.com/containers/podman/v4/pkg/specgen"
)

func ContainerCreateWithSpec(ctx context.Context, s *specgen.SpecGenerator, options *containers.CreateOptions) (entities.ContainerCreateResponse, error) {
	if legacy {
		return v3adapter.ContainerCreateWithSpec(ctx, s, options)
	}
	return containers.CreateWithSpec(ctx, s, options)
}

func ContainerList(ctx context.Context, options *containers.ListOptions) ([]entities.ListContainer, error) {
	if legacy {
		return v3adapter.ContainerList(ctx, options)
	}
	return containers.List(ctx, options)
}

func ContainerStop(ctx context.Context, nameOrID string, options *containers.StopOptions) error {
	if legacy {
		return v3adapter.ContainerStop(ctx, nameOrID, options)
	}
	return containers.Stop(ctx, nameOrID, options)
}

func ContainerStart(ctx context.Context, nameOrID string, options *containers.StartOptions) error {
	if legacy {
		return v3adapter.ContainerStart(ctx, nameOrID, options)
	}
	return containers.Start(ctx, nameOrID, options)
}

func ContainerRemove(ctx context.Context, nameOrID string, options *containers.RemoveOptions) ([]*reports.RmReport, error) {
	if legacy {
		return v3adapter.ContainerRemove(ctx, nameOrID, options)
	}
	return containers.Remove(ctx, nameOrID, options)
}

func ContainerCommit(ctx context.Context, nameOrID string, options *containers.CommitOptions) (entities.IDResponse, error) {
	if legacy {
		return v3adapter.ContainerCommit(ctx, nameOrID, options)
	}
	return containers.Commit(ctx, nameOrID, options)
}

func ContainerInspect(ctx context.Context, nameOrID string, options *containers.InspectOptions) (*define.InspectContainerData, error) {
	if legacy {
		return v3adapter.ContainerInspect(ctx, nameOrID, options)
	}
	return containers.Inspect(ctx, nameOrID, options)
}

func ContainerLogs(ctx context.Context, nameOrID string, options *containers.LogOptions, stdoutChan, stderrChan chan string) error {
	if legacy {
		return v3adapter.ContainerLogs(ctx, nameOrID, options, stdoutChan, stderrChan)
	}
	return containers.Logs(ctx, nameOrID, options, stdoutChan, stderrChan)
}

func ContainerStats(ctx context.Context, ctns []string, options *containers.StatsOptions) (chan entities.ContainerStatsReport, error) {
	if legacy {
		return v3adapter.ContainerStats(ctx, ctns, options)
	}
	return containers.Stats(ctx, ctns, options)
}

func ContainerExecCreate(ctx context.Context, nameOrID string, options *handlers.ExecCreateConfig) (string, error) {
	if legacy {
		return v3adapter.ContainerExecCreate(ctx, nameOrID, options)
	}
	return containers.ExecCreate(ctx, nameOrID, options)
}

func ContainerExecStart(ctx context.Context, sessionID string, options *containers.ExecStartOptions) error {
	if legacy {
		return v3adapter.ContainerExecStart(ctx, sessionID, options)
	}
	return containers.ExecStart(ctx, sessionID, options)
}

func ContainerExecStartAndAttach(ctx context.Context, sessionID string, options *containers.ExecStartAndAttachOptions) error {
	if legacy {
		return v3adapter.ContainerExecStartAndAttach(ctx, sessionID, options)
	}
	return containers.ExecStartAndAttach(ctx, sessionID, options)
}

func ContainerExecInspect(ctx context.Context, sessionID string, options *containers.ExecInspectOptions) (*define.InspectExecSession, error) {
	if legacy {
		return v3adapter.ContainerExecInspect(ctx, sessionID, options)
	}
	return containers.ExecInspect(ctx, sessionID, options)
}

func ContainerResizeExecTTY(ctx context.Context, sessionId string, options *containers.ResizeExecTTYOptions) error {
	if legacy {
		return v3adapter.ContainerResizeExecTTY(ctx, sessionId, options)
	}
	return containers.ResizeExecTTY(ctx, sessionId, options)
}
