// Package airlens contains the domain model for the AirLens green-score module.
// AirLens analyses Street View imagery to measure vegetation coverage and heat-island
// risk at street level across an entire district.
package airlens

import "time"

// HeatRiskLevel classifies a grid cell's urban heat-island risk.
type HeatRiskLevel string

const (
	HeatRiskLow      HeatRiskLevel = "LOW"
	HeatRiskModerate HeatRiskLevel = "MODERATE"
	HeatRiskHigh     HeatRiskLevel = "HIGH"
	HeatRiskCritical HeatRiskLevel = "CRITICAL"
)

// ScanStatus tracks the lifecycle of a district scan.
type ScanStatus string

const (
	ScanStatusPending    ScanStatus = "pending"
	ScanStatusProcessing ScanStatus = "processing"
	ScanStatusCompleted  ScanStatus = "completed"
	ScanStatusFailed     ScanStatus = "failed"
)

// PixelBreakdown holds the percentage of each urban class detected in a Street View
// image. Values are in the range [0, 100]; they need not sum to 100 because minor
// classes (vehicles, people, furniture) are grouped into "other".
type PixelBreakdown struct {
	VegetationPct float64 `json:"vegetation_pct"`
	SkyPct        float64 `json:"sky_pct"`
	BuildingPct   float64 `json:"building_pct"`
	RoadPct       float64 `json:"road_pct"`
	SidewalkPct   float64 `json:"sidewalk_pct"`
}

// GridCell represents a single 200 m × 200 m sample point in a district scan.
// Scores are the average of four cardinal-direction Street View images (0°/90°/180°/270°).
type GridCell struct {
	ID            string         `json:"id"`
	ScanID        string         `json:"scan_id"`
	Lat           float64        `json:"lat"`
	Lng           float64        `json:"lng"`
	GreenScore    float64        `json:"green_score"`    // 0–100
	VegetationPct float64        `json:"vegetation_pct"` // avg across 4 headings
	SkyPct        float64        `json:"sky_pct"`
	BuildingPct   float64        `json:"building_pct"`
	RoadPct       float64        `json:"road_pct"`
	SidewalkPct   float64        `json:"sidewalk_pct"`
	ConcreteRatio float64        `json:"concrete_ratio"` // building + road + sidewalk
	HeatRisk      HeatRiskLevel  `json:"heat_risk"`
	FromCache     bool           `json:"from_cache"`
	ProcessedAt   time.Time      `json:"processed_at"`
}

// Scan is the top-level record for one district greenery analysis.
type Scan struct {
	ID             string         `json:"id"`
	DistrictName   string         `json:"district_name"`
	CenterLat      float64        `json:"center_lat"`
	CenterLng      float64        `json:"center_lng"`
	RadiusMeters   int            `json:"radius_meters"`
	TotalCells     int            `json:"total_cells"`
	ScoredCells    int            `json:"scored_cells"`
	AvgGreenScore  float64        `json:"avg_green_score"`
	HeatRiskLevel  HeatRiskLevel  `json:"heat_risk_level"`
	Status         ScanStatus     `json:"status"`
	DurationMs     int64          `json:"duration_ms"`
	CreatedAt      time.Time      `json:"created_at"`
	CompletedAt    *time.Time     `json:"completed_at,omitempty"`
	Cells          []GridCell     `json:"cells,omitempty"`
}

// ScanRequest is the DTO for starting a district scan.
type ScanRequest struct {
	DistrictName string  `json:"district_name"`
	CenterLat    float64 `json:"center_lat"`
	CenterLng    float64 `json:"center_lng"`
	RadiusMeters int     `json:"radius_meters"`
}

// ScanSummary provides aggregate statistics for a completed scan.
type ScanSummary struct {
	TotalCells    int            `json:"total_cells"`
	ScoredCells   int            `json:"scored_cells"`
	AvgGreenScore float64        `json:"avg_green_score"`
	HeatRiskLevel HeatRiskLevel  `json:"heat_risk_level"`
	TopGreenCells []GridCell     `json:"top_green_cells"`   // 10 most vegetated
	HotspotCells  []GridCell     `json:"hotspot_cells"`     // 10 most critical heat
	Distribution  map[string]int `json:"distribution"`      // heat risk level → count
}

// CoolRoute represents a recommended "serin yürüyüş" walking route through
// high-greenery cells in a district.
type CoolRoute struct {
	Waypoints     []Waypoint `json:"waypoints"`
	TotalDistance float64    `json:"total_distance_m"`
	AvgGreenScore float64    `json:"avg_green_score"`
	Description   string     `json:"description"`
}

// Waypoint is a single step in a CoolRoute.
type Waypoint struct {
	Lat        float64 `json:"lat"`
	Lng        float64 `json:"lng"`
	GreenScore float64 `json:"green_score"`
	Order      int     `json:"order"`
}

// GreenScoreToHeatRisk derives the heat-risk level from green coverage and
// concrete ratio. Low vegetation + high concrete = high risk.
func GreenScoreToHeatRisk(greenScore, concreteRatio float64) HeatRiskLevel {
	// Risk is a combined score: more concrete and less green = higher risk.
	// Both factors contribute equally.
	risk := (concreteRatio * 0.6) + ((100 - greenScore) * 0.4)
	switch {
	case risk < 30:
		return HeatRiskLow
	case risk < 50:
		return HeatRiskModerate
	case risk < 70:
		return HeatRiskHigh
	default:
		return HeatRiskCritical
	}
}

// HeatRiskColor returns a hex colour for choropleth rendering.
func HeatRiskColor(level HeatRiskLevel) string {
	switch level {
	case HeatRiskLow:
		return "#1a9850"
	case HeatRiskModerate:
		return "#fee08b"
	case HeatRiskHigh:
		return "#f46d43"
	default:
		return "#d73027"
	}
}
