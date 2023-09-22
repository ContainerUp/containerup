package container

import (
	"containerup/wsrouter/wstypes"
	"context"
	"encoding/json"
	"errors"
	"github.com/containers/podman/v4/pkg/bindings/containers"
	"github.com/containers/podman/v4/pkg/bindings/system"
	"github.com/containers/podman/v4/pkg/domain/entities"
	"sync"
	"time"
)

var (
	subListMap   = map[uint]func(){}
	subListMutex sync.Mutex

	subMap   = map[uint]func(){}
	subMutex sync.Mutex
)

func SubscribeToContainersList(ctx context.Context, msg *wstypes.WsReqMessage, writer chan<- *wstypes.WsRespMessage) {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	subListMutex.Lock()
	subListMap[msg.Index] = cancel
	subListMutex.Unlock()

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
		subListMutex.Lock()
		delete(subListMap, msg.Index)
		subListMutex.Unlock()
	}

	var wg sync.WaitGroup
	ch := make(chan entities.Event)

	wg.Add(1)
	go func() {
		defer wg.Done()
		defer cancel()

		err := system.Events(ctx, ch, nil, &system.EventsOptions{
			Filters: map[string][]string{
				"type": {"container"},
			},
		})
		if err != nil {
			onError(err)
			return
		}
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()

		var err error
		var graceCancel func()
		for event := range ch {
			switch event.Action {
			case "create":
				graceCancel = graceSend(ctx, msg.Index, writer, onError)

			case "start", "died", "pause", "unpause", "remove":
				if graceCancel != nil {
					graceCancel()
					graceCancel = nil
				}
				err = sendList(ctx, msg.Index, writer)
			}
			if err != nil {
				onError(err)
			}
		}
	}()

	err := sendList(ctx, msg.Index, writer)
	if err != nil {
		onError(err)
	}

	wg.Wait()
}

func sendList(ctx context.Context, index uint, writer chan<- *wstypes.WsRespMessage) error {
	yes := true
	listOpts := &containers.ListOptions{
		All: &yes,
	}
	ret, err := containers.List(ctx, listOpts)
	if err != nil {
		return err
	}

	writer <- &wstypes.WsRespMessage{
		Index: index,
		Data:  ret,
	}
	return nil
}

func graceSend(ctx context.Context, index uint, writer chan<- *wstypes.WsRespMessage, onError func(error)) func() {
	ctx, cancel := context.WithCancel(ctx)

	go func() {
		select {
		case <-ctx.Done():
			// cancelled
		case <-time.After(300 * time.Millisecond):
			err := sendList(ctx, index, writer)
			if err != nil {
				if !errors.Is(err, context.Canceled) {
					onError(err)
				}
			}
		}
	}()

	return cancel
}

func UnsubscribeToContainersList(ctx context.Context, msg *wstypes.WsReqMessage, writer chan<- *wstypes.WsRespMessage) {
	var unsubId uint
	err := json.Unmarshal(msg.Data, &unsubId)
	if err != nil {
		writer <- &wstypes.WsRespMessage{
			Index: msg.Index,
			Data:  false,
		}
		return
	}

	subListMutex.Lock()
	if c, ok := subListMap[unsubId]; ok {
		c()
		delete(subListMap, unsubId)
	}
	subListMutex.Unlock()

	writer <- &wstypes.WsRespMessage{
		Index: msg.Index,
		Data:  true,
	}
}

func SubscribeToContainer(ctx context.Context, msg *wstypes.WsReqMessage, writer chan<- *wstypes.WsRespMessage) {
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

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	subMutex.Lock()
	subMap[msg.Index] = cancel
	subMutex.Unlock()

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
		subMutex.Lock()
		delete(subMap, msg.Index)
		subMutex.Unlock()
	}

	var wg sync.WaitGroup
	ch := make(chan entities.Event)

	wg.Add(1)
	go func() {
		defer wg.Done()
		defer cancel()

		err := system.Events(ctx, ch, nil, &system.EventsOptions{
			Filters: map[string][]string{
				"type": {"container"},
			},
		})
		if err != nil {
			onError(err)
			return
		}
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()

		var err error
		var graceCancel func()
		for event := range ch {
			if event.Actor.ID[0:12] != containerShortId {
				continue
			}

			switch event.Action {
			case "create", "start", "died", "pause", "unpause", "remove":
				if graceCancel != nil {
					graceCancel()
					graceCancel = nil
				}
				err = sendSingle(ctx, msg.Index, writer, containerShortId)
			}
			if err != nil {
				onError(err)
			}
		}
	}()

	err = sendSingle(ctx, msg.Index, writer, containerShortId)
	if err != nil {
		onError(err)
	}

	wg.Wait()
}

func sendSingle(ctx context.Context, index uint, writer chan<- *wstypes.WsRespMessage, id string) error {
	ret, err := containers.Inspect(ctx, id, nil)
	if err != nil {
		return err
	}

	writer <- &wstypes.WsRespMessage{
		Index: index,
		Data:  ret,
	}
	return nil
}

func UnsubscribeToContainer(ctx context.Context, msg *wstypes.WsReqMessage, writer chan<- *wstypes.WsRespMessage) {
	var unsubId uint
	err := json.Unmarshal(msg.Data, &unsubId)
	if err != nil {
		writer <- &wstypes.WsRespMessage{
			Index: msg.Index,
			Data:  false,
		}
		return
	}

	subMutex.Lock()
	if c, ok := subMap[unsubId]; ok {
		c()
		delete(subMap, unsubId)
	}
	subMutex.Unlock()

	writer <- &wstypes.WsRespMessage{
		Index: msg.Index,
		Data:  true,
	}
}
