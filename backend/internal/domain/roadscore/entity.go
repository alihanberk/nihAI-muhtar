// Package roadscore defines the domain model for road surface quality analysis.
// It supports route-level analysis by sampling coordinates, fetching Street View
// imagery, and scoring road damage via an AI classifier.
package roadscore

import (
	"time"
)

// DamageCategory classifies road surface condition into four bands.
type DamageCategory string

const (
	// CategoryGood represents 0–25% damage — smooth surface.
	CategoryGood DamageCategory = "GOOD"
	// CategoryFair represents 25–50% damage — minor wear/cracks.
	CategoryFair DamageCategory = "FAIR"
	// CategoryPoor represents 50–75% damage — significant potholes.
	CategoryPoor DamageCategory = "POOR"
	// CategoryCritical represents 75–100% damage — structural failure.
	CategoryCritical DamageCategory = "CRITICAL"
)

// RouteType identifies the purpose of a route alternative.
type RouteType string

const (
	RouteTypeFastest    RouteType = "fastest"
	RouteTypeHealthiest RouteType = "healthiest"
	RouteTypeBalanced   RouteType = "balanced"
)

// AnalysisStatus tracks the lifecycle of a route analysis job.
type AnalysisStatus string

const (
	StatusPending    AnalysisStatus = "pending"
	StatusProcessing AnalysisStatus = "processing"
	StatusCompleted  AnalysisStatus = "completed"
	StatusFailed     AnalysisStatus = "failed"
)

// Coordinate is a WGS-84 geographic point.
type Coordinate struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}

// SegmentScore holds the AI damage result for a single sampled coordinate.
type SegmentScore struct {
	ID             string         `json:"id"              db:"id"`
	RouteID        string         `json:"route_id"        db:"route_id"`
	Lat            float64        `json:"lat"             db:"lat"`
	Lng            float64        `json:"lng"             db:"lng"`
	DamageScore    float64        `json:"damage_score"    db:"damage_score"`    // 0–100
	DamageCategory DamageCategory `json:"damage_category" db:"damage_category"`
	Heading        float64        `json:"heading"         db:"heading"`
	Confidence     float64        `json:"confidence"      db:"confidence"`
	SegmentOrder   int            `json:"segment_order"   db:"segment_order"`
	FromCache      bool           `json:"from_cache"      db:"cached"`
	CreatedAt      time.Time      `json:"created_at"      db:"created_at"`
}

// ScoreRoute represents one of the three route alternatives with aggregated scores.
type ScoreRoute struct {
	ID              string         `json:"id"               db:"id"`
	AnalysisID      string         `json:"analysis_id"      db:"analysis_id"`
	RouteIndex      int            `json:"route_index"      db:"route_index"`
	RouteType       RouteType      `json:"route_type"       db:"route_type"`
	DurationSeconds int            `json:"duration_seconds" db:"duration_seconds"`
	DistanceMeters  int            `json:"distance_meters"  db:"distance_meters"`
	DamageScore     float64        `json:"damage_score"     db:"damage_score"` // 0–100 average
	SegmentCount    int            `json:"segment_count"    db:"segment_count"`
	EncodedPolyline string         `json:"encoded_polyline" db:"encoded_polyline"`
	Segments        []SegmentScore `json:"segments,omitempty"`
	CreatedAt       time.Time      `json:"created_at"       db:"created_at"`
}

// RouteAnalysis is the top-level result for an origin→destination analysis request.
type RouteAnalysis struct {
	ID                 string         `json:"id"                  db:"id"`
	OriginLat          float64        `json:"origin_lat"          db:"origin_lat"`
	OriginLng          float64        `json:"origin_lng"          db:"origin_lng"`
	DestinationLat     float64        `json:"destination_lat"     db:"destination_lat"`
	DestinationLng     float64        `json:"destination_lng"     db:"destination_lng"`
	OriginAddress      string         `json:"origin_address"      db:"origin_address"`
	DestinationAddress string         `json:"destination_address" db:"destination_address"`
	Status             AnalysisStatus `json:"status"              db:"status"`
	Routes             []ScoreRoute   `json:"routes,omitempty"`
	CreatedAt          time.Time      `json:"created_at"          db:"created_at"`
	UpdatedAt          time.Time      `json:"updated_at"          db:"updated_at"`
}

// AnalyzeRequest is the input DTO for the AnalyzeRoute use case.
type AnalyzeRequest struct {
	OriginLat      float64 `json:"origin_lat"`
	OriginLng      float64 `json:"origin_lng"`
	DestinationLat float64 `json:"destination_lat"`
	DestinationLng float64 `json:"destination_lng"`
}

// AnalyzeResponse is the output DTO returned to the HTTP handler after full analysis.
type AnalyzeResponse struct {
	AnalysisID string       `json:"analysis_id"`
	Routes     []ScoreRoute `json:"routes"`
	// RecommendedRouteID points to the "balanced" route suggestion.
	RecommendedRouteID string `json:"recommended_route_id"`
}

// ScoreToDamageCategory maps a 0–100 numeric score to the matching category.
func ScoreToDamageCategory(score float64) DamageCategory {
	switch {
	case score < 25:
		return CategoryGood
	case score < 50:
		return CategoryFair
	case score < 75:
		return CategoryPoor
	default:
		return CategoryCritical
	}
}

// CategoryToColor returns a Mapbox-compatible hex color for map rendering.
func CategoryToColor(cat DamageCategory) string {
	switch cat {
	case CategoryGood:
		return "#22c55e" // green-500
	case CategoryFair:
		return "#eab308" // yellow-500
	case CategoryPoor:
		return "#f97316" // orange-500
	default:
		return "#ef4444" // red-500
	}
}
