package image

import (
	"containerup/wsrouter/wstypes"
	"context"
	"encoding/json"
	"errors"
	"github.com/containers/podman/v4/pkg/bindings/images"
	"github.com/containers/podman/v4/pkg/bindings/system"
	"github.com/containers/podman/v4/pkg/domain/entities"
	"sort"
	"sync"
	"time"
)

var (
	subListMap   = map[uint]func(){}
	subListMutex sync.Mutex
)

func SubscribeToImagesList(ctx context.Context, msg *wstypes.WsReqMessage, writer chan<- *wstypes.WsRespMessage) {
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

		err := system.Events(ctx, ch, nil, nil)
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
			switch event.Type {
			case "image":
				switch event.Action {
				case "untag":
					graceCancel = graceSend(ctx, msg.Index, writer, onError)

				case "tag", "pull", "remove":
					if graceCancel != nil {
						graceCancel()
						graceCancel = nil
					}
					err = sendList(ctx, msg.Index, writer)
				}
			case "container":
				switch event.Action {
				case "commit", "create", "remove":
					// the numbers will change
					if graceCancel != nil {
						graceCancel()
						graceCancel = nil
					}
					err = sendList(ctx, msg.Index, writer)
				}
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
	listOpts := &images.ListOptions{
		All: &yes,
	}
	ret, err := images.List(ctx, listOpts)
	if err != nil {
		return err
	}

	sort.Slice(ret, func(i, j int) bool {
		return ret[i].Created > ret[j].Created
	})

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

func UnsubscribeToImagesList(ctx context.Context, msg *wstypes.WsReqMessage, writer chan<- *wstypes.WsRespMessage) {
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
