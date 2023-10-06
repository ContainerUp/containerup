package conn

import (
	"containerup/adapter"
	"context"
)

// BugReversedStatsNetwork checks if the server version is below 4.4.0 https://github.com/containers/podman/pull/16628
func BugReversedStatsNetwork(ctx context.Context) bool {
	v := adapter.ServiceVersion(ctx)
	if v.Major == 0 {
		// empty
		return false
	}
	if v.Major <= 4 && v.Minor < 4 {
		return true
	}
	return false
}
