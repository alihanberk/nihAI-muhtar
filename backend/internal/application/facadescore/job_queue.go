// Package facadescore provides the use cases for the FacadeScore module.
// The job queue enforces a maximum of 10 concurrent building analyses.
package facadescore

import (
	"context"
	"log/slog"
	"sync"
)

const maxConcurrentJobs = 10

// BuildingJob is the unit of work submitted to the queue.
type BuildingJob struct {
	JobID   string
	Lat     float64
	Lng     float64
	Heading float64
	Address string
	District string
}

// JobQueue manages bounded-concurrency execution of building analysis jobs.
// It uses a semaphore channel to cap parallel Street View + AI calls at 10.
type JobQueue struct {
	sem     chan struct{}
	wg      sync.WaitGroup
}

// NewJobQueue creates a queue with maxConcurrentJobs slots.
func NewJobQueue() *JobQueue {
	return &JobQueue{
		sem: make(chan struct{}, maxConcurrentJobs),
	}
}

// Submit enqueues a building job for async execution.
// The provided worker function is called once a concurrency slot is available.
func (q *JobQueue) Submit(ctx context.Context, job BuildingJob, worker func(ctx context.Context, job BuildingJob)) {
	q.wg.Add(1)
	go func() {
		defer q.wg.Done()

		// Acquire semaphore slot
		select {
		case q.sem <- struct{}{}:
		case <-ctx.Done():
			slog.Warn("job cancelled before slot acquired", "job_id", job.JobID, "lat", job.Lat)
			return
		}
		defer func() { <-q.sem }()

		worker(ctx, job)
	}()
}

// Wait blocks until all submitted jobs have completed.
func (q *JobQueue) Wait() {
	q.wg.Wait()
}

// ActiveCount returns the number of currently executing jobs.
func (q *JobQueue) ActiveCount() int {
	return len(q.sem)
}
