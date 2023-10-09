package container

import (
	"containerup/adapter"
	"containerup/wsrouter/wstypes"
	"context"
	"encoding/json"
	"errors"
	"github.com/containers/podman/v4/pkg/bindings/containers"
	"sync"
)

var (
	subStatsMap   = map[uint]func(){}
	subStatsMutex sync.Mutex
)

func SubscribeToContainerStats(ctx context.Context, msg *wstypes.WsReqMessage, writer chan<- *wstypes.WsRespMessage) {
	ctns := []string(nil)

	if len(msg.Data) != 0 {
		var containerShortId string
		err := json.Unmarshal(msg.Data, &containerShortId)
		if err != nil {
			writer <- &wstypes.WsRespMessage{
				Index: msg.Index,
				Error: true,
				Data:  err.Error(),
			}
			return
		}
		ctns = []string{containerShortId}
	}

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	subStatsMutex.Lock()
	subStatsMap[msg.Index] = cancel
	subStatsMutex.Unlock()
	defer func() {
		subStatsMutex.Lock()
		defer subStatsMutex.Unlock()
		delete(subStatsMap, msg.Index)
	}()

	onError := func(err error) {
		cancelled := errors.Is(ctx.Err(), context.Canceled)
		if cancelled {
			return
		}
		cancel()
		writer <- &wstypes.WsRespMessage{
			Index: msg.Index,
			Error: true,
			Data:  err.Error(),
		}
	}

	yes := true
	interval := 5
	statsOpt := &containers.StatsOptions{
		Stream:   &yes,
		Interval: &interval,
	}
	ch, err := adapter.ContainerStats(ctx, ctns, statsOpt)
	if err != nil {
		onError(err)
		return
	}

	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		defer wg.Done()

		for report := range ch {
			writer <- &wstypes.WsRespMessage{
				Index: msg.Index,
				Data:  report,
			}
		}
	}()

	wg.Wait()
	if ctx.Err() == nil {
		writer <- &wstypes.WsRespMessage{
			Index: msg.Index,
			Error: false,
			Data:  nil,
		}
	}
}

func UnsubscribeToContainerStats(ctx context.Context, msg *wstypes.WsReqMessage, writer chan<- *wstypes.WsRespMessage) {
	var unsubId uint
	err := json.Unmarshal(msg.Data, &unsubId)
	if err != nil {
		writer <- &wstypes.WsRespMessage{
			Index: msg.Index,
			Data:  false,
		}
		return
	}

	subStatsMutex.Lock()
	if c, ok := subStatsMap[unsubId]; ok {
		c()
		delete(subStatsMap, unsubId)
	}
	subStatsMutex.Unlock()

	writer <- &wstypes.WsRespMessage{
		Index: msg.Index,
		Data:  true,
	}
}

type TotalStats struct {
	CpuNano uint64
	Memory  uint64
}

func TotalStatsStream(ctx context.Context, interval int) (<-chan *TotalStats, error) {
	yes := true
	statsOpt := &containers.StatsOptions{
		Stream:   &yes,
		Interval: &interval,
	}
	ch, err := adapter.ContainerStats(ctx, nil, statsOpt)
	if err != nil {
		return nil, err
	}

	output := make(chan *TotalStats)

	go func() {
		defer close(output)
		prevCpu := map[string]uint64{}
		first := true

		for report := range ch {
			totalCpu := uint64(0)
			totalMem := uint64(0)
			currentCpu := map[string]uint64{}

			for _, rpt := range report.Stats {
				currentCpu[rpt.ContainerID] = rpt.CPUNano

				if p, ok := prevCpu[rpt.ContainerID]; ok {
					totalCpu += rpt.CPUNano - p
				} else {
					totalCpu += rpt.CPUNano
				}
				totalMem += rpt.MemUsage
			}
			prevCpu = currentCpu

			if first {
				totalCpu = 0
				first = false
			}

			output <- &TotalStats{
				CpuNano: totalCpu,
				Memory:  totalMem,
			}
		}
	}()

	return output, nil
}
