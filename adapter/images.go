package adapter

import (
	"containerup/adapter/v3adapter"
	"context"
	"github.com/containers/podman/v4/pkg/bindings/images"
	"github.com/containers/podman/v4/pkg/domain/entities"
)

func ImageList(ctx context.Context, options *images.ListOptions) ([]*entities.ImageSummary, error) {
	if legacy {
		return v3adapter.ImageList(ctx, options)
	}
	return images.List(ctx, options)
}

func ImageRemove(ctx context.Context, imgs []string, options *images.RemoveOptions) (*entities.ImageRemoveReport, []error) {
	if legacy {
		return v3adapter.ImageRemove(ctx, imgs, options)
	}
	return images.Remove(ctx, imgs, options)
}

func ImageTag(ctx context.Context, nameOrID, tag, repo string, options *images.TagOptions) error {
	if legacy {
		return v3adapter.ImageTag(ctx, nameOrID, tag, repo, options)
	}
	return images.Tag(ctx, nameOrID, tag, repo, options)
}

func ImagePull(ctx context.Context, rawImage string, options *images.PullOptions) ([]string, error) {
	if legacy {
		return v3adapter.ImagePull(ctx, rawImage, options)
	}
	return images.Pull(ctx, rawImage, options)
}

func ImageGet(ctx context.Context, nameOrID string, options *images.GetOptions) (*entities.ImageInspectReport, error) {
	if legacy {
		return v3adapter.ImageGet(ctx, nameOrID, options)
	}
	return images.GetImage(ctx, nameOrID, options)
}
