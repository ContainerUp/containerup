package system

import (
	"bytes"
	"containerup/adapter"
	"containerup/container"
	"containerup/wsrouter/wstypes"
	"context"
	"encoding/json"
	"errors"
	"github.com/containers/podman/v4/pkg/bindings/containers"
	"os"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
)

var (
	subMap   = map[uint]func(){}
	subMutex sync.Mutex
)

func SubscribeToSystemStats(ctx context.Context, msg *wstypes.WsReqMessage, writer chan<- *wstypes.WsRespMessage) {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	subMutex.Lock()
	subMap[msg.Index] = cancel
	subMutex.Unlock()
	defer func() {
		subMutex.Lock()
		defer subMutex.Unlock()
		delete(subMap, msg.Index)
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

	interval := 5
	ctnStatCh, err := container.TotalStatsStream(ctx, interval)
	if err != nil {
		onError(err)
		return
	}

	listOpts := (&containers.ListOptions{}).WithAll(true)

	var wg sync.WaitGroup

	type sysStat struct {
		CpuPodman         float64 `json:"cpu_podman"`
		CpuOther          float64 `json:"cpu_other"`
		CpuTotal          uint64  `json:"cpu_total"`
		MemPodman         uint64  `json:"mem_podman"`
		MemOther          uint64  `json:"mem_other"`
		MemTotal          uint64  `json:"mem_total"`
		ContainersTotal   int     `json:"containers_total"`
		ContainersRunning int     `json:"containers_running"`
		ImagesTotal       int     `json:"images_total"`
		ImagesInUse       int     `json:"images_in_use"`
	}

	cpuCount := runtime.NumCPU()

	wg.Add(1)
	go func() {
		defer wg.Done()
		first := true
		lastIdleCpuNano := uint64(0)

		for ctnStat := range ctnStatCh {
			idleCpuNano, err := systemCpuIdle()
			if err != nil {
				onError(err)
				emptyStatsConsumer(ctnStatCh)
				break
			}
			deltaIdleCpuNano := idleCpuNano - lastIdleCpuNano

			cpuTotal := float64(cpuCount)
			cpuPodman := float64(ctnStat.CpuNano) / float64(time.Second/time.Nanosecond) / float64(interval)
			cpuIdle := float64(deltaIdleCpuNano) / float64(time.Second/time.Nanosecond) / float64(interval)
			cpuOther := cpuTotal - cpuIdle - cpuPodman

			if first {
				cpuPodman = 0
				cpuOther = 0
				first = false
			}

			memTotalKB, memAvailableKB, err := systemMemInfo()
			if err != nil {
				onError(err)
				emptyStatsConsumer(ctnStatCh)
				break
			}

			ctnList, err := adapter.ContainerList(ctx, listOpts)
			if err != nil {
				onError(err)
				emptyStatsConsumer(ctnStatCh)
				break
			}
			ctnTotal := len(ctnList)
			ctnRunning := 0
			for _, ctn := range ctnList {
				if ctn.State == "running" {
					ctnRunning += 1
				}
			}

			imgs, err := adapter.ImageList(ctx, nil)
			if err != nil {
				onError(err)
				emptyStatsConsumer(ctnStatCh)
				break
			}
			imgTotal := len(imgs)
			imgInUse := 0
			for _, img := range imgs {
				if img.Containers > 0 {
					imgInUse += 1
				}
			}

			writer <- &wstypes.WsRespMessage{
				Index: msg.Index,
				Data: &sysStat{
					CpuPodman:         cpuPodman,
					CpuOther:          cpuOther,
					CpuTotal:          uint64(cpuCount),
					MemPodman:         ctnStat.Memory,
					MemOther:          (memTotalKB-memAvailableKB)*1024 - ctnStat.Memory,
					MemTotal:          memTotalKB * 1024,
					ContainersTotal:   ctnTotal,
					ContainersRunning: ctnRunning,
					ImagesTotal:       imgTotal,
					ImagesInUse:       imgInUse,
				},
			}
			lastIdleCpuNano = idleCpuNano
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

func emptyStatsConsumer(ch <-chan *container.TotalStats) {
	go func() {
		for range ch {
		}
	}()
}

func UnsubscribeToSystemStats(ctx context.Context, msg *wstypes.WsReqMessage, writer chan<- *wstypes.WsRespMessage) {
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

func systemCpuIdle() (uint64, error) {
	d, err := os.ReadFile("/proc/stat")
	if err != nil {
		return 0, err
	}

	lines := bytes.Split(d, []byte("\n"))
	for _, line := range lines {
		parts := strings.Fields(string(line))
		if len(parts) > 0 && parts[0] == "cpu" {
			idle, err := strconv.ParseUint(parts[4], 10, 64)
			if err != nil {
				return 0, err
			}
			// SC_CLK_TCK = 100
			return idle * uint64(time.Second/time.Nanosecond) / 100, nil
		}
	}

	return 0, errors.New("cpu usage not found")
}

var (
	cpuRegexAll       = regexp.MustCompile("^cpu\\s+\\d+$")
	memRegexTotal     = regexp.MustCompile("^MemTotal:\\s+(\\d+)\\skB$")
	memRegexAvailable = regexp.MustCompile("^MemAvailable:\\s+(\\d+)\\skB$")
)

func systemMemInfo() (uint64, uint64, error) {
	d, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return 0, 0, err
	}

	total := uint64(0)
	available := uint64(0)

	lines := bytes.Split(d, []byte("\n"))
	for _, line := range lines {
		match := memRegexTotal.FindStringSubmatch(string(line))
		if len(match) == 2 {
			total, err = strconv.ParseUint(match[1], 10, 64)
			if err != nil {
				return 0, 0, err
			}
			continue
		}

		match = memRegexAvailable.FindStringSubmatch(string(line))
		if len(match) == 2 {
			available, err = strconv.ParseUint(match[1], 10, 64)
			if err != nil {
				return 0, 0, err
			}

			if total > 0 && available > 0 {
				break
			}

			continue
		}
	}

	return total, available, nil
}
