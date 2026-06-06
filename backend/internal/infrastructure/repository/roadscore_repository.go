package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"

	"github.com/nihai-muhtar/backend/internal/domain/roadscore"
)

// RoadScoreRepo implements roadscore.Repository using PostgreSQL + PostGIS.
type RoadScoreRepo struct {
	db *sqlx.DB
}

// NewRoadScoreRepository creates a RoadScoreRepo backed by the given database pool.
func NewRoadScoreRepository(db *sqlx.DB) *RoadScoreRepo {
	return &RoadScoreRepo{db: db}
}

// CreateAnalysis persists a new RouteAnalysis record.
func (r *RoadScoreRepo) CreateAnalysis(ctx context.Context, analysis *roadscore.RouteAnalysis) error {
	query := `
		INSERT INTO route_analyses
			(id, origin_lat, origin_lng, destination_lat, destination_lng,
			 origin_address, destination_address, status, created_at, updated_at)
		VALUES
			(gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id`

	now := time.Now().UTC()
	return r.db.QueryRowContext(ctx, query,
		analysis.OriginLat, analysis.OriginLng,
		analysis.DestinationLat, analysis.DestinationLng,
		analysis.OriginAddress, analysis.DestinationAddress,
		string(roadscore.StatusPending), now, now,
	).Scan(&analysis.ID)
}

// UpdateAnalysisStatus changes the lifecycle status of an existing analysis.
func (r *RoadScoreRepo) UpdateAnalysisStatus(ctx context.Context, id string, status roadscore.AnalysisStatus) error {
	query := `UPDATE route_analyses SET status = $1 WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, string(status), id)
	if err != nil {
		return fmt.Errorf("failed to update analysis status: %w", err)
	}
	return nil
}

// GetAnalysis retrieves a full analysis with all child routes and segments.
func (r *RoadScoreRepo) GetAnalysis(ctx context.Context, id string) (*roadscore.RouteAnalysis, error) {
	analysis := &roadscore.RouteAnalysis{}

	analysisQuery := `
		SELECT id, origin_lat, origin_lng, destination_lat, destination_lng,
		       origin_address, destination_address, status, created_at, updated_at
		FROM route_analyses
		WHERE id = $1`

	var statusStr string
	err := r.db.QueryRowContext(ctx, analysisQuery, id).Scan(
		&analysis.ID, &analysis.OriginLat, &analysis.OriginLng,
		&analysis.DestinationLat, &analysis.DestinationLng,
		&analysis.OriginAddress, &analysis.DestinationAddress,
		&statusStr, &analysis.CreatedAt, &analysis.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("analysis not found: %s", id)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get analysis: %w", err)
	}
	analysis.Status = roadscore.AnalysisStatus(statusStr)

	routes, err := r.getRoutesByAnalysis(ctx, id)
	if err != nil {
		return nil, err
	}
	analysis.Routes = routes

	return analysis, nil
}

func (r *RoadScoreRepo) getRoutesByAnalysis(ctx context.Context, analysisID string) ([]roadscore.ScoreRoute, error) {
	routeQuery := `
		SELECT id, analysis_id, route_index, route_type, duration_seconds,
		       distance_meters, damage_score, segment_count, encoded_polyline, created_at
		FROM road_score_routes
		WHERE analysis_id = $1
		ORDER BY route_index`

	rows, err := r.db.QueryContext(ctx, routeQuery, analysisID)
	if err != nil {
		return nil, fmt.Errorf("failed to get routes: %w", err)
	}
	defer rows.Close()

	var routes []roadscore.ScoreRoute
	for rows.Next() {
		var route roadscore.ScoreRoute
		var routeTypeStr string
		if err := rows.Scan(
			&route.ID, &route.AnalysisID, &route.RouteIndex, &routeTypeStr,
			&route.DurationSeconds, &route.DistanceMeters, &route.DamageScore,
			&route.SegmentCount, &route.EncodedPolyline, &route.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan route: %w", err)
		}
		route.RouteType = roadscore.RouteType(routeTypeStr)

		segments, err := r.GetSegmentsByRoute(ctx, route.ID)
		if err != nil {
			return nil, err
		}
		route.Segments = segments
		routes = append(routes, route)
	}
	return routes, rows.Err()
}

// CreateRoute persists a ScoreRoute under an existing analysis.
func (r *RoadScoreRepo) CreateRoute(ctx context.Context, route *roadscore.ScoreRoute) error {
	query := `
		INSERT INTO road_score_routes
			(analysis_id, route_index, route_type, duration_seconds,
			 distance_meters, damage_score, segment_count, encoded_polyline)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at`

	return r.db.QueryRowContext(ctx, query,
		route.AnalysisID, route.RouteIndex, string(route.RouteType),
		route.DurationSeconds, route.DistanceMeters, route.DamageScore,
		route.SegmentCount, route.EncodedPolyline,
	).Scan(&route.ID, &route.CreatedAt)
}

// CreateSegment persists a SegmentScore with lat/lng coordinates.
func (r *RoadScoreRepo) CreateSegment(ctx context.Context, seg *roadscore.SegmentScore) error {
	query := `
		INSERT INTO road_score_segments
			(route_id, lat, lng, damage_score, damage_category,
			 heading, confidence, segment_order, cached)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at`

	return r.db.QueryRowContext(ctx, query,
		seg.RouteID,
		seg.Lat, seg.Lng,
		seg.DamageScore, string(seg.DamageCategory),
		seg.Heading, seg.Confidence,
		seg.SegmentOrder, seg.FromCache,
	).Scan(&seg.ID, &seg.CreatedAt)
}

// GetSegmentsByRoute returns all segments for a route ordered by segment_order.
func (r *RoadScoreRepo) GetSegmentsByRoute(ctx context.Context, routeID string) ([]roadscore.SegmentScore, error) {
	query := `
		SELECT id, route_id, lat, lng, damage_score, damage_category,
		       heading, confidence, segment_order, cached, created_at
		FROM road_score_segments
		WHERE route_id = $1
		ORDER BY segment_order`

	rows, err := r.db.QueryContext(ctx, query, routeID)
	if err != nil {
		return nil, fmt.Errorf("failed to get segments: %w", err)
	}
	defer rows.Close()

	var segments []roadscore.SegmentScore
	for rows.Next() {
		var seg roadscore.SegmentScore
		var catStr string
		if err := rows.Scan(
			&seg.ID, &seg.RouteID, &seg.Lat, &seg.Lng,
			&seg.DamageScore, &catStr, &seg.Heading,
			&seg.Confidence, &seg.SegmentOrder, &seg.FromCache, &seg.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan segment: %w", err)
		}
		seg.DamageCategory = roadscore.DamageCategory(catStr)
		segments = append(segments, seg)
	}
	return segments, rows.Err()
}
