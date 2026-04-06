package idgen

import (
	"fmt"
	"sync"
	"time"
)

const (
	customEpoch    int64 = 1767225600000 // Jan 1 2026 UTC in ms
	workerIDBits         = 10
	sequenceBits         = 12
	maxWorkerID          = (1 << workerIDBits) - 1
	maxSequence          = (1 << sequenceBits) - 1
	workerIDShift        = sequenceBits
	timestampShift       = sequenceBits + workerIDBits
)

type Generator struct {
	mu            sync.Mutex
	workerID      int64
	sequence      int64
	lastTimestamp int64
}

func NewGenerator(workerID int64) (*Generator, error) {
	if workerID < 0 || workerID > maxWorkerID {
		return nil, fmt.Errorf("idgen: workerID must be between 0 and %d", maxWorkerID)
	}
	return &Generator{workerID: workerID, lastTimestamp: -1}, nil
}

func (g *Generator) Generate() (int64, error) {
	g.mu.Lock()
	defer g.mu.Unlock()

	now := time.Now().UnixMilli()
	if now < g.lastTimestamp {
		return 0, fmt.Errorf("idgen: clock moved backwards by %d ms", g.lastTimestamp-now)
	}

	if now == g.lastTimestamp {
		g.sequence = (g.sequence + 1) & maxSequence
		if g.sequence == 0 {
			for now <= g.lastTimestamp {
				time.Sleep(100 * time.Microsecond)
				now = time.Now().UnixMilli()
			}
		}
	} else {
		g.sequence = 0
	}

	g.lastTimestamp = now
	return ((now - customEpoch) << timestampShift) | (g.workerID << workerIDShift) | g.sequence, nil
}
