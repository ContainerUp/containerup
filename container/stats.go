package container

import (
	"containerup/conn"
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
		subStatsMutex.Lock()
		delete(subStatsMap, msg.Index)
		subStatsMutex.Unlock()
	}

	yes := true
	interval := 5
	statsOpt := &containers.StatsOptions{
		Stream:   &yes,
		Interval: &interval,
	}
	ch, err := containers.Stats(ctx, ctns, statsOpt)
	if err != nil {
		onError(err)
		return
	}

	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		defer wg.Done()

		reversed := conn.BugReversedStatsNetwork(ctx)
		for event := range ch {
			for i, s := range event.Stats {
				netIn, netOut := s.NetInput, s.NetOutput
				if reversed {
					netIn, netOut = netOut, netIn
				}
				blockIn, blockOut := s.BlockInput, s.BlockOutput
				event.Stats[i].NetOutput = netOut / uint64(interval)
				event.Stats[i].NetInput = netIn / uint64(interval)
				event.Stats[i].BlockOutput = blockOut / uint64(interval)
				event.Stats[i].BlockInput = blockIn / uint64(interval)
			}
			writer <- &wstypes.WsRespMessage{
				Index: msg.Index,
				Data:  event,
			}
		}
	}()

	wg.Wait()
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
