package conn

import (
	"context"
	"github.com/containers/podman/v4/pkg/bindings"
)

func BugReversedStatsNetwork(ctx context.Context) bool {
	v := bindings.ServiceVersion(ctx)
	if v.Major == 0 {
		// empty
		return false
	}
	if v.Major <= 4 && v.Minor < 4 {
		return true
	}
	return false
}
