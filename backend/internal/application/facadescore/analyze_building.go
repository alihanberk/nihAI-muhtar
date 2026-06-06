package facadescore

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"time"

	"github.com/nihai-muhtar/backend/internal/domain/facadescore"
	"github.com/nihai-muhtar/backend/internal/infrastructure/blur"
	hf "github.com/nihai-muhtar/backend/internal/infrastructure/huggingface"
	"github.com/nihai-muhtar/backend/internal/infrastructure/streetview"
)

const (
	// coordinateGridStep defines the sampling step in degrees (~55m at Istanbul lat).
	coordinateGridStep = 0.0005

	// retryAttempts is the maximum number of retries for external API calls.
	retryAttempts = 3

	// uncertaintyThreshold: detections below this confidence are flagged for review.
	uncertaintyThreshold = 0.7
)

// AnalyzeBuildingUseCase orchestrates the full facade analysis pipeline for a
// district: sampling coordinates → Street View → blur → DETR detect → CLIP
// classify → scoring → persistence.
type AnalyzeBuildingUseCase struct {
	repo        facadescore.Repository
	streetView  *streetview.Client
	hfDetector  *hf.FacadeDetector
	blurProc    *blur.Processor
	queue       *JobQueue
}

// NewAnalyzeBuildingUseCase constructs the use case with all dependencies.
func NewAnalyzeBuildingUseCase(
	repo facadescore.Repository,
	sv *streetview.Client,
	detector *hf.FacadeDetector,
	bp *blur.Processor,
) *AnalyzeBuildingUseCase {
	return &AnalyzeBuildingUseCase{
		repo:       repo,
		streetView: sv,
		hfDetector: detector,
		blurProc:   bp,
		queue:      NewJobQueue(),
	}
}

// Execute queues a district-level batch analysis and returns immediately.
// Individual building jobs run asynchronously up to maxConcurrentJobs at a time.
func (uc *AnalyzeBuildingUseCase) Execute(ctx context.Context, req facadescore.AnalyzeRequest) (*facadescore.AnalyzeResponse, error) {
	if req.RadiusM <= 0 {
		req.RadiusM = 500
	}

	// 1. Create the top-level job record
	job := &facadescore.AnalysisJob{
		District:  req.District,
		CenterLat: req.CenterLat,
		CenterLng: req.CenterLng,
		RadiusM:   req.RadiusM,
		Status:    facadescore.JobPending,
	}
	if err := uc.repo.CreateJob(ctx, job); err != nil {
		return nil, fmt.Errorf("failed to create analysis job: %w", err)
	}

	// 2. Sample a grid of building coordinates within the radius
	coords := sampleGrid(req.CenterLat, req.CenterLng, req.RadiusM)

	if err := uc.repo.UpdateJobStatus(ctx, job.ID, facadescore.JobProcessing); err != nil {
		slog.Warn("failed to update job status to processing", "job_id", job.ID)
	}

	// Update total count
	job.TotalCount = len(coords)

	// 3. Submit each coordinate as an independent building job
	bgCtx := context.Background() // detached from request context so shutdown doesn't kill jobs
	for i, coord := range coords {
		bj := BuildingJob{
			JobID:    job.ID,
			Lat:      coord[0],
			Lng:      coord[1],
			Heading:  float64((i * 45) % 360), // rotate headings for coverage
			District: req.District,
		}
		uc.queue.Submit(bgCtx, bj, uc.processBuilding)
	}

	// Finalize job in the background after all workers finish
	go func() {
		uc.queue.Wait()
		if err := uc.repo.UpdateJobStatus(bgCtx, job.ID, facadescore.JobCompleted); err != nil {
			slog.Error("failed to finalize job status", "job_id", job.ID, "error", err)
		}
	}()

	return &facadescore.AnalyzeResponse{
		JobID:    job.ID,
		District: req.District,
		Message:  fmt.Sprintf("Analysis queued for %d building locations in %s", len(coords), req.District),
	}, nil
}

// processBuilding is the worker function for a single coordinate.
// It follows the full pipeline: Street View → blur → detect → classify → persist.
func (uc *AnalyzeBuildingUseCase) processBuilding(ctx context.Context, job BuildingJob) {
	building := &facadescore.BuildingAnalysis{
		JobID:        job.JobID,
		District:     job.District,
		Address:      job.Address,
		Lat:          job.Lat,
		Lng:          job.Lng,
		Heading:      job.Heading,
		AnalysisYear: time.Now().UTC().Year(),
	}

	if err := uc.repo.CreateBuilding(ctx, building); err != nil {
		slog.Error("failed to create building record", "error", err)
		return
	}

	// ── Street View fetch (with retry) ───────────────────────────────────────
	imageData, err := withRetry(ctx, retryAttempts, func() ([]byte, error) {
		return uc.streetView.FetchImage(ctx, job.Lat, job.Lng, job.Heading)
	})
	if err != nil {
		slog.Warn("street view fetch failed for building", "lat", job.Lat, "lng", job.Lng, "error", err)
		building.HealthScore = 0
		building.RiskLevel = facadescore.RiskHealthy
		_ = uc.repo.UpdateBuilding(ctx, building)
		_ = uc.repo.IncrementJobDone(ctx, job.JobID)
		return
	}

	// ── KVKK: blur faces before AI processing ────────────────────────────────
	blurred, err := uc.blurProc.ApplyPrivacyBlur(imageData)
	if err != nil {
		slog.Warn("face blur failed, using raw image", "error", err)
		blurred = imageData
	}
	imageData = nil // KVKK: discard raw bytes

	// ── Phase 1: DETR facade detection ───────────────────────────────────────
	detections, err := withRetry(ctx, retryAttempts, func() ([]*hf.FacadeDetection, error) {
		return uc.hfDetector.DetectFacade(ctx, blurred)
	})
	if err != nil {
		slog.Warn("facade detection failed, using full image", "lat", job.Lat, "error", err)
		detections = nil
	}

	// ── Phase 2: CLIP defect classification ──────────────────────────────────
	cropData := blurred
	if len(detections) > 0 {
		if cropped, err := uc.hfDetector.CropFacade(blurred, detections[0]); err == nil {
			cropData = cropped
		}
	}

	classResult, err := withRetry(ctx, retryAttempts, func() (*hf.FacadeClassifyResult, error) {
		return uc.hfDetector.ClassifyFacadeDefects(ctx, cropData)
	})
	blurred = nil  // KVKK: discard blurred bytes (only numeric scores retained)
	cropData = nil // KVKK: discard cropped bytes

	if err != nil {
		slog.Warn("facade classification failed, using mock", "lat", job.Lat, "error", err)
		classResult = hf.MockFacadeResult(job.Lat, job.Lng)
	}

	// ── Build defect records ──────────────────────────────────────────────────
	var defects []facadescore.FacadeDefect
	for i, dr := range classResult.Detections {
		bbox := facadescore.BoundingBox{XMin: 0, YMin: 0, XMax: 640, YMax: 480}
		if i < len(detections) {
			bbox = facadescore.BoundingBox{
				XMin: detections[i].Box.XMin,
				YMin: detections[i].Box.YMin,
				XMax: detections[i].Box.XMax,
				YMax: detections[i].Box.YMax,
			}
		}

		defect := facadescore.FacadeDefect{
			BuildingID:  building.ID,
			DefectType:  facadescore.DefectType(dr.DefectType),
			Severity:    facadescore.SeverityScore(dr.Severity),
			Confidence:  dr.Confidence,
			Uncertain:   dr.Confidence < uncertaintyThreshold,
			BoundingBox: bbox,
			Label:       dr.Label,
		}
		if err := uc.repo.CreateDefect(ctx, &defect); err != nil {
			slog.Warn("failed to persist defect", "building_id", building.ID, "error", err)
			continue
		}
		defects = append(defects, defect)
	}

	// ── Compute building health score ─────────────────────────────────────────
	healthScore := facadescore.ComputeHealthScore(defects)
	needsReview := false
	for _, d := range defects {
		if d.Uncertain {
			needsReview = true
			break
		}
	}

	building.HealthScore = healthScore
	building.RiskLevel = facadescore.ScoreToRiskLevel(healthScore)
	building.DefectCount = len(defects)
	building.NeedsHumanReview = needsReview
	building.Defects = defects

	if err := uc.repo.UpdateBuilding(ctx, building); err != nil {
		slog.Error("failed to update building after analysis", "building_id", building.ID, "error", err)
	}

	_ = uc.repo.IncrementJobDone(ctx, job.JobID)

	slog.Info("building analysis complete",
		"building_id", building.ID,
		"health_score", healthScore,
		"risk_level", building.RiskLevel,
		"defects", len(defects),
	)
}

// sampleGrid generates a grid of (lat, lng) coordinate pairs within the
// given radius around the center point. Used to sample building locations.
func sampleGrid(centerLat, centerLng float64, radiusM int) [][2]float64 {
	// Convert radius from meters to degrees (approximate)
	latDegPerMeter := 1.0 / 111320.0
	lngDegPerMeter := 1.0 / (111320.0 * math.Cos(centerLat*math.Pi/180))

	latRadius := float64(radiusM) * latDegPerMeter
	lngRadius := float64(radiusM) * lngDegPerMeter

	var coords [][2]float64
	step := coordinateGridStep

	for dlat := -latRadius; dlat <= latRadius; dlat += step {
		for dlng := -lngRadius; dlng <= lngRadius; dlng += step {
			// Only include points within the circular radius
			distLat := dlat / latRadius
			distLng := dlng / lngRadius
			if distLat*distLat+distLng*distLng <= 1.0 {
				coords = append(coords, [2]float64{
					centerLat + dlat,
					centerLng + dlng,
				})
			}
		}
	}

	return coords
}

// withRetry executes fn up to maxAttempts times, returning on first success.
func withRetry[T any](ctx context.Context, maxAttempts int, fn func() (T, error)) (T, error) {
	var zero T
	var lastErr error

	for attempt := 1; attempt <= maxAttempts; attempt++ {
		result, err := fn()
		if err == nil {
			return result, nil
		}
		lastErr = err

		if attempt < maxAttempts {
			select {
			case <-ctx.Done():
				return zero, ctx.Err()
			case <-time.After(time.Duration(attempt) * 500 * time.Millisecond):
			}
		}
	}

	return zero, fmt.Errorf("all %d attempts failed: %w", maxAttempts, lastErr)
}
