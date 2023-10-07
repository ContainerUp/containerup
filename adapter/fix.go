package adapter

import (
	"context"
	"github.com/blang/semver/v4"
	"github.com/containers/podman/v4/libpod/define"
	"github.com/containers/podman/v4/pkg/bindings/containers"
	"github.com/containers/podman/v4/pkg/domain/entities"
)

type fixer struct {
	ctx     context.Context
	options any
}

func (f fixer) fixContainerStats(input chan entities.ContainerStatsReport, err error) (chan entities.ContainerStatsReport, error) {
	// reversed network in and out https://github.com/containers/podman/pull/16628
	if ServiceVersion(f.ctx).GE(semver.Version{Major: 4, Minor: 4}) {
		return input, err
	}

	if err != nil {
		return input, err
	}

	// has interval feature
	intervalGood := ServiceVersion(f.ctx).GE(semver.Version{Major: 3, Minor: 4})
	interval := 5
	if opts, ok := f.options.(*containers.StatsOptions); ok {
		if opts.Interval != nil {
			interval = *opts.Interval
		}
	}

	output := make(chan entities.ContainerStatsReport)
	go func() {
		defer close(output)

		firstSent := false
		previousStats := make([][]define.ContainerStats, 0, interval)
		var reportErr error

		for report := range input {
			for i := range report.Stats {
				stats := report.Stats[i]
				stats.NetInput, stats.NetOutput = stats.NetOutput, stats.NetInput
				report.Stats[i] = stats
			}

			if intervalGood {
				output <- report
				continue
			}

			// cache the stats
			previousStats = append(previousStats, report.Stats)
			if report.Error != nil {
				reportErr = report.Error
			}

			if !firstSent || len(previousStats) == interval {
				firstSent = true

				output <- entities.ContainerStatsReport{
					Error: reportErr,
					Stats: calcStats(previousStats, interval),
				}

				previousStats = make([][]define.ContainerStats, 0, interval)
				reportErr = nil
			}
		}
	}()

	return output, err
}

// calcStats finds the latest stats of each container and calculates the CPU
func calcStats(previousStats [][]define.ContainerStats, interval int) []define.ContainerStats {
	// latest stats of every container
	latest := map[string]define.ContainerStats{}

	sumCpu := map[string]float64{}
	for _, st := range previousStats {
		for _, item := range st {
			sumCpu[item.ContainerID] += item.CPU
			latest[item.ContainerID] = item
		}
	}

	ret := make([]define.ContainerStats, 0, len(latest))
	for _, item := range latest {
		item.CPU = sumCpu[item.ContainerID] / float64(interval)
		ret = append(ret, item)
	}
	return ret
}
