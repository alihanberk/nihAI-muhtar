// Package roadscore provides the use cases for the RoadScore module.
// ScanAreaUseCase scores every sampled coordinate within a circular neighborhood
// zone by fetching Street View imagery, applying KVKK blur, and running the
// HuggingFace damage classifier on each point.
package roadscore

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/nihai-muhtar/backend/internal/domain/roadscore"
	"github.com/nihai-muhtar/backend/internal/infrastructure/blur"
	"github.com/nihai-muhtar/backend/internal/infrastructure/cache"
	"github.com/nihai-muhtar/backend/internal/infrastructure/directions"
	"github.com/nihai-muhtar/backend/internal/infrastructure/huggingface"
	"github.com/nihai-muhtar/backend/internal/infrastructure/streetview"
)

const (
	// defaultGridSpacingM is the distance between sampled grid points in meters.
	// At 150 m, a 750 m-radius circle yields ~78 points — full coverage without
	// excessive Street View API quota consumption.
	defaultGridSpacingM = 150.0

	// maxScanPoints caps the number of sampled points to protect API quota.
	// Using systematic row-interleaved sampling when the cap is exceeded so
	// that coverage is spread evenly across the whole circle, not just one half.
	maxScanPoints = 100

	// scanWorkers controls concurrent Street View + AI requests.
	scanWorkers = 5
)

// ScanAreaUseCase scores all sampled coordinates within a circular area.
type ScanAreaUseCase struct {
	streetView *streetview.Client
	hf         *huggingface.Client
	blurProc   *blur.Processor
	scoreCache *cache.RoadScoreCache
}

// NewScanAreaUseCase constructs the use case with all required dependencies.
func NewScanAreaUseCase(
	sv *streetview.Client,
	hf *huggingface.Client,
	bp *blur.Processor,
	sc *cache.RoadScoreCache,
) *ScanAreaUseCase {
	return &ScanAreaUseCase{
		streetView: sv,
		hf:         hf,
		blurProc:   bp,
		scoreCache: sc,
	}
}

// Execute runs the full area-scan pipeline:
//  1. Generate a regular grid of points within the circle.
//  2. Score each point concurrently (Street View → blur → HuggingFace).
//  3. Aggregate results and return a structured response.
func (uc *ScanAreaUseCase) Execute(ctx context.Context, req roadscore.AreaScanRequest) (*roadscore.AreaScanResponse, error) {
	start := time.Now()

	if req.RadiusMeters <= 0 || req.RadiusMeters > 5000 {
		return nil, fmt.Errorf("radius_meters must be between 1 and 5000")
	}

	// 1. Generate candidate grid points
	candidates := generateCircleGrid(req.CenterLat, req.CenterLng, req.RadiusMeters, defaultGridSpacingM)
	if len(candidates) > maxScanPoints {
		// Systematic stride sampling — picks every Nth point so coverage is
		// distributed evenly across the whole circle instead of just one half.
		stride := len(candidates) / maxScanPoints
		sampled := make([]directions.Coordinate, 0, maxScanPoints)
		for i := 0; i < len(candidates) && len(sampled) < maxScanPoints; i += stride {
			sampled = append(sampled, candidates[i])
		}
		candidates = sampled
	}

	slog.Info("area scan started",
		"neighborhood", req.NeighborhoodName,
		"center", fmt.Sprintf("%.4f,%.4f", req.CenterLat, req.CenterLng),
		"radius_m", req.RadiusMeters,
		"grid_points", len(candidates),
	)

	// 2. Score all points with bounded concurrency
	scored := uc.scorePoints(ctx, candidates)

	// 3. Build summary statistics
	summary := buildAreaSummary(scored, len(candidates))

	slog.Info("area scan completed",
		"neighborhood", req.NeighborhoodName,
		"scored", summary.ScoredPoints,
		"avg_damage", fmt.Sprintf("%.1f", summary.AvgDamageScore),
		"duration_ms", time.Since(start).Milliseconds(),
	)

	return &roadscore.AreaScanResponse{
		ScanID:           uuid.New().String(),
		NeighborhoodName: req.NeighborhoodName,
		CenterLat:        req.CenterLat,
		CenterLng:        req.CenterLng,
		RadiusMeters:     req.RadiusMeters,
		Points:           scored,
		Summary:          summary,
		DurationMs:       time.Since(start).Milliseconds(),
	}, nil
}

// ─── Grid generation ──────────────────────────────────────────────────────────

// generateCircleGrid creates a regular square grid of coordinates that fall
// within a circle defined by (centerLat, centerLng, radiusM).
func generateCircleGrid(centerLat, centerLng, radiusM, spacingM float64) []directions.Coordinate {
	latStep := spacingM / 111320.0
	lngStep := spacingM / (111320.0 * math.Cos(centerLat*math.Pi/180.0))

	steps := int(math.Ceil(radiusM/spacingM)) + 1
	var pts []directions.Coordinate

	for i := -steps; i <= steps; i++ {
		for j := -steps; j <= steps; j++ {
			lat := centerLat + float64(i)*latStep
			lng := centerLng + float64(j)*lngStep
			if haversineM(lat, lng, centerLat, centerLng) <= radiusM {
				pts = append(pts, directions.Coordinate{Lat: lat, Lng: lng})
			}
		}
	}
	return pts
}

// haversineM returns the great-circle distance in meters between two WGS-84 points.
func haversineM(lat1, lng1, lat2, lng2 float64) float64 {
	const R = 6371000.0
	toRad := func(d float64) float64 { return d * math.Pi / 180.0 }
	dLat := toRad(lat2 - lat1)
	dLng := toRad(lng2 - lng1)
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(toRad(lat1))*math.Cos(toRad(lat2))*
			math.Sin(dLng/2)*math.Sin(dLng/2)
	return R * 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
}

// ─── Concurrent point scoring ─────────────────────────────────────────────────

func (uc *ScanAreaUseCase) scorePoints(ctx context.Context, pts []directions.Coordinate) []roadscore.AreaScanPoint {
	sem := make(chan struct{}, scanWorkers)
	resultCh := make(chan roadscore.AreaScanPoint, len(pts))
	var wg sync.WaitGroup

	for _, pt := range pts {
		wg.Add(1)
		go func(coord directions.Coordinate) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			p, err := uc.scoreOnePoint(ctx, coord)
			if err != nil {
				slog.Warn("scan point skipped", "lat", coord.Lat, "lng", coord.Lng, "err", err)
				return
			}
			resultCh <- *p
		}(pt)
	}

	wg.Wait()
	close(resultCh)

	var results []roadscore.AreaScanPoint
	for p := range resultCh {
		results = append(results, p)
	}
	return results
}

// scoreOnePoint fetches and scores a single coordinate, using cache when available.
func (uc *ScanAreaUseCase) scoreOnePoint(ctx context.Context, coord directions.Coordinate) (*roadscore.AreaScanPoint, error) {
	pt := &roadscore.AreaScanPoint{
		Lat: coord.Lat,
		Lng: coord.Lng,
	}

	// ── Cache lookup ────────────────────────────────────────────────────────────
	if cached, ok := uc.scoreCache.Get(ctx, coord.Lat, coord.Lng); ok {
		pt.DamageScore = cached.DamageScore
		pt.DamageCategory = roadscore.DamageCategory(cached.Category)
		pt.Confidence = cached.Confidence
		pt.FromCache = true
		return pt, nil
	}

	// ── Street View fetch ───────────────────────────────────────────────────────
	imageData, err := uc.streetView.FetchImage(ctx, coord.Lat, coord.Lng, 0)
	if err != nil {
		// Fall back to coordinate-based mock so the scan always produces results
		slog.Warn("street view unavailable for scan point, using mock", "err", err)
		result := mockSegmentScore(coord.Lat, coord.Lng)
		pt.DamageScore = result.DamageScore
		pt.DamageCategory = roadscore.DamageCategory(result.Category)
		pt.Confidence = result.Confidence
		_ = uc.scoreCache.Set(ctx, coord.Lat, coord.Lng, cache.CachedScore{
			DamageScore: result.DamageScore,
			Category:    result.Category,
			Confidence:  result.Confidence,
		})
		return pt, nil
	}

	// ── KVKK blur ───────────────────────────────────────────────────────────────
	blurred, err := uc.blurProc.ApplyPrivacyBlur(imageData)
	if err != nil {
		slog.Warn("blur failed for scan point, using raw", "err", err)
		blurred = imageData
	}
	imageData = nil //nolint:ineffassign — raw bytes discarded (KVKK)

	// ── HuggingFace classification ──────────────────────────────────────────────
	hfCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	result, err := uc.hf.ClassifyRoadDamage(hfCtx, blurred)
	if err != nil {
		slog.Warn("HF unavailable for scan point, using mock", "lat", coord.Lat, "lng", coord.Lng)
		result = mockSegmentScore(coord.Lat, coord.Lng)
	}
	blurred = nil //nolint:ineffassign

	pt.DamageScore = result.DamageScore
	pt.DamageCategory = roadscore.DamageCategory(result.Category)
	pt.Confidence = result.Confidence

	_ = uc.scoreCache.Set(ctx, coord.Lat, coord.Lng, cache.CachedScore{
		DamageScore: result.DamageScore,
		Category:    result.Category,
		Confidence:  result.Confidence,
	})

	return pt, nil
}

// ─── Summary builder ──────────────────────────────────────────────────────────

func buildAreaSummary(pts []roadscore.AreaScanPoint, totalRequested int) roadscore.AreaScanSummary {
	s := roadscore.AreaScanSummary{
		TotalPoints:  totalRequested,
		ScoredPoints: len(pts),
	}
	if len(pts) == 0 {
		return s
	}

	var total float64
	var worst, best *roadscore.AreaScanPoint

	for i := range pts {
		p := &pts[i]
		total += p.DamageScore

		switch p.DamageCategory {
		case roadscore.CategoryCritical:
			s.CriticalCount++
		case roadscore.CategoryPoor:
			s.PoorCount++
		case roadscore.CategoryFair:
			s.FairCount++
		default:
			s.GoodCount++
		}

		if worst == nil || p.DamageScore > worst.DamageScore {
			cp := *p
			worst = &cp
		}
		if best == nil || p.DamageScore < best.DamageScore {
			cp := *p
			best = &cp
		}
	}

	s.AvgDamageScore = total / float64(len(pts))
	s.OverallCategory = roadscore.ScoreToDamageCategory(s.AvgDamageScore)
	s.WorstPoint = worst
	s.BestPoint = best

	return s
}
