package main

import (
	"fmt"
	"os"
)

var (
	Version            = "dev"
	CommitHash         = "dev"
	FrontendCommitHash = "dev"
	BuildNum           = "dev"
)

func showVersion() {
	fmt.Printf("ContainerUp version %s commit %s frontend_commit %s build %s\n", Version, CommitHash, FrontendCommitHash, BuildNum)
	os.Exit(0)
}
