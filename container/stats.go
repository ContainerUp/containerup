package container

import (
	"containerup/adapter"
	"containerup/conn"
	"containerup/wsrouter/wstypes"
	"context"
	"encoding/json"
	"errors"
	"github.com/containers/podman/v4/libpod/define"
	"github.com/containers/podman/v4/pkg/bindings/containers"
	"github.com/containers/podman/v4/pkg/domain/entities"
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

		firstSent := false
		previousStats := make([][]define.ContainerStats, 0, interval)

		reversed := conn.BugReversedContainerStatsNetwork(ctx)
		for event := range ch {
			if reversed {
				for i := range event.Stats {
					event.Stats[i].NetInput, event.Stats[i].NetOutput = event.Stats[i].NetOutput, event.Stats[i].NetInput
				}
			}

			if conn.FeatureContainerStatsInterval(ctx) {
				writer <- &wstypes.WsRespMessage{
					Index: msg.Index,
					Data:  event,
				}
			} else {
				// interval is omitted by server, the actual interval is 1

				// cache the stats
				previousStats = append(previousStats, event.Stats)

				if !firstSent || len(previousStats) == interval {
					firstSent = true

					writer <- &wstypes.WsRespMessage{
						Index: msg.Index,
						Data: entities.ContainerStatsReport{
							Error: event.Error,
							Stats: calcStats(previousStats),
						},
					}

					previousStats = make([][]define.ContainerStats, 0, interval)
				}
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

// calcStats finds the latest stats of each container and calculates the CPU
func calcStats(previousStats [][]define.ContainerStats) []define.ContainerStats {
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
		item.CPU = sumCpu[item.ContainerID]
		ret = append(ret, item)
	}
	return ret
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
