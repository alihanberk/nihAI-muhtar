package roadscore

import "context"

// Repository defines the persistence contract for road score data.
// All implementations must be multi-tenant safe and include PostGIS geometry storage.
type Repository interface {
	// CreateAnalysis persists a new route analysis record and returns its ID.
	CreateAnalysis(ctx context.Context, analysis *RouteAnalysis) error

	// UpdateAnalysisStatus updates the lifecycle status of an analysis.
	UpdateAnalysisStatus(ctx context.Context, id string, status AnalysisStatus) error

	// GetAnalysis retrieves a full analysis including all routes and segments.
	GetAnalysis(ctx context.Context, id string) (*RouteAnalysis, error)

	// CreateRoute persists a scored route under an analysis.
	CreateRoute(ctx context.Context, route *ScoreRoute) error

	// CreateSegment persists a single segment score with PostGIS geometry.
	CreateSegment(ctx context.Context, segment *SegmentScore) error

	// GetSegmentsByRoute returns all segments for a given route, ordered by segment_order.
	GetSegmentsByRoute(ctx context.Context, routeID string) ([]SegmentScore, error)
}
