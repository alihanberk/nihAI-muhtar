// Package facadescore defines the domain model for building facade structural
// damage analysis. It supports earthquake-risk-focused assessment of building
// health by processing Street View imagery through a two-phase AI pipeline.
package facadescore

import "time"

// DefectType identifies the category of structural or surface damage.
type DefectType string

const (
	DefectStructuralCrack    DefectType = "structural_crack"
	DefectSpalling           DefectType = "spalling"
	DefectCorrosionStain     DefectType = "corrosion_stain"
	DefectDeformedBalcony    DefectType = "deformed_balcony"
	DefectDamagedFireEscape  DefectType = "damaged_fire_escape"
	DefectBuildingTilt       DefectType = "building_tilt"
	DefectFrameDeformation   DefectType = "frame_deformation"
)

// SeverityScore maps to a 1–5 Likert scale of defect severity.
type SeverityScore int

const (
	SeverityMinor    SeverityScore = 1
	SeverityMild     SeverityScore = 2
	SeverityModerate SeverityScore = 3
	SeveritySevere   SeverityScore = 4
	SeverityCritical SeverityScore = 5
)

// RiskLevel represents the overall building health classification.
type RiskLevel string

const (
	RiskHealthy   RiskLevel = "HEALTHY"   // 0–20
	RiskAttention RiskLevel = "ATTENTION" // 20–50
	RiskRisky     RiskLevel = "RISKY"     // 50–80
	RiskEmergency RiskLevel = "EMERGENCY" // 80–100
)

// JobStatus tracks the lifecycle of a building analysis job.
type JobStatus string

const (
	JobPending    JobStatus = "pending"
	JobProcessing JobStatus = "processing"
	JobCompleted  JobStatus = "completed"
	JobFailed     JobStatus = "failed"
)

// BoundingBox is a relative bounding box in pixel coordinates.
type BoundingBox struct {
	XMin int `json:"xmin" db:"bbox_xmin"`
	YMin int `json:"ymin" db:"bbox_ymin"`
	XMax int `json:"xmax" db:"bbox_xmax"`
	YMax int `json:"ymax" db:"bbox_ymax"`
}

// FacadeDefect represents a single structural defect identified on a facade.
// Confidence < 0.7 results in the uncertain flag being set for human review.
type FacadeDefect struct {
	ID           string       `json:"id"           db:"id"`
	BuildingID   string       `json:"building_id"  db:"building_id"`
	DefectType   DefectType   `json:"defect_type"  db:"defect_type"`
	Severity     SeverityScore `json:"severity"    db:"severity"`
	Confidence   float64      `json:"confidence"   db:"confidence"`
	Uncertain    bool         `json:"uncertain"    db:"uncertain"`
	BoundingBox  BoundingBox  `json:"bounding_box"`
	Label        string       `json:"label"        db:"label"`
	CreatedAt    time.Time    `json:"created_at"   db:"created_at"`
}

// BuildingAnalysis is the top-level result for a single building facade assessment.
type BuildingAnalysis struct {
	ID              string      `json:"id"               db:"id"`
	JobID           string      `json:"job_id"           db:"job_id"`
	District        string      `json:"district"         db:"district"`
	Address         string      `json:"address"          db:"address"`
	Lat             float64     `json:"lat"              db:"lat"`
	Lng             float64     `json:"lng"              db:"lng"`
	Heading         float64     `json:"heading"          db:"heading"`
	StreetViewURL   string      `json:"street_view_url"  db:"street_view_url"`
	HealthScore     float64     `json:"health_score"     db:"health_score"`   // 0–100 (higher = worse)
	RiskLevel       RiskLevel   `json:"risk_level"       db:"risk_level"`
	DefectCount     int         `json:"defect_count"     db:"defect_count"`
	Defects         []FacadeDefect `json:"defects,omitempty"`
	NeedsHumanReview bool       `json:"needs_human_review" db:"needs_human_review"`
	AnalysisYear    int         `json:"analysis_year"    db:"analysis_year"`
	CreatedAt       time.Time   `json:"created_at"       db:"created_at"`
	UpdatedAt       time.Time   `json:"updated_at"       db:"updated_at"`
}

// AnalysisJob represents a district-level batch analysis request.
type AnalysisJob struct {
	ID          string    `json:"id"           db:"id"`
	District    string    `json:"district"     db:"district"`
	CenterLat   float64   `json:"center_lat"   db:"center_lat"`
	CenterLng   float64   `json:"center_lng"   db:"center_lng"`
	RadiusM     int       `json:"radius_m"     db:"radius_m"`
	Status      JobStatus `json:"status"       db:"status"`
	TotalCount  int       `json:"total_count"  db:"total_count"`
	DoneCount   int       `json:"done_count"   db:"done_count"`
	ErrorMsg    string    `json:"error_msg,omitempty" db:"error_msg"`
	CreatedAt   time.Time `json:"created_at"   db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"   db:"updated_at"`
}

// CitizenReport is a crowdsourced damage report submitted via the mobile app.
type CitizenReport struct {
	ID          string    `json:"id"           db:"id"`
	BuildingID  string    `json:"building_id"  db:"building_id"`
	Lat         float64   `json:"lat"          db:"lat"`
	Lng         float64   `json:"lng"          db:"lng"`
	Description string    `json:"description"  db:"description"`
	PhotoURL    string    `json:"photo_url"    db:"photo_url"`
	Status      string    `json:"status"       db:"status"` // pending / reviewed / dismissed
	CreatedAt   time.Time `json:"created_at"   db:"created_at"`
}

// AnalyzeRequest is the input DTO for the AnalyzeBuildingUseCase.
type AnalyzeRequest struct {
	District  string  `json:"district"`
	CenterLat float64 `json:"center_lat"`
	CenterLng float64 `json:"center_lng"`
	RadiusM   int     `json:"radius_m"`
}

// AnalyzeResponse is the output returned after the job is queued.
type AnalyzeResponse struct {
	JobID    string `json:"job_id"`
	District string `json:"district"`
	Message  string `json:"message"`
}

// DistrictHeatmap is the district-level risk aggregation for the map overlay.
type DistrictHeatmap struct {
	District       string    `json:"district"         db:"district"`
	TotalBuildings int       `json:"total_buildings"  db:"total_buildings"`
	HealthyCount   int       `json:"healthy_count"    db:"healthy_count"`
	AttentionCount int       `json:"attention_count"  db:"attention_count"`
	RiskyCount     int       `json:"risky_count"      db:"risky_count"`
	EmergencyCount int       `json:"emergency_count"  db:"emergency_count"`
	AvgHealthScore float64   `json:"avg_health_score" db:"avg_health_score"`
	UpdatedAt      time.Time `json:"updated_at"       db:"updated_at"`
}

// ScoreToRiskLevel maps a 0–100 health score to the matching risk category.
func ScoreToRiskLevel(score float64) RiskLevel {
	switch {
	case score < 20:
		return RiskHealthy
	case score < 50:
		return RiskAttention
	case score < 80:
		return RiskRisky
	default:
		return RiskEmergency
	}
}

// RiskLevelToColor returns a Mapbox-compatible hex color for map rendering.
func RiskLevelToColor(level RiskLevel) string {
	switch level {
	case RiskHealthy:
		return "#22c55e" // green-500
	case RiskAttention:
		return "#eab308" // yellow-500
	case RiskRisky:
		return "#f97316" // orange-500
	default:
		return "#ef4444" // red-500
	}
}

// DefectTypeToSeverityWeight returns a base weight factor for computing
// the composite health score from individual defect severities.
func DefectTypeToSeverityWeight(dt DefectType) float64 {
	switch dt {
	case DefectStructuralCrack:
		return 3.0
	case DefectBuildingTilt:
		return 4.0
	case DefectDeformedBalcony:
		return 2.5
	case DefectDamagedFireEscape:
		return 2.0
	case DefectSpalling:
		return 1.5
	case DefectCorrosionStain:
		return 1.0
	case DefectFrameDeformation:
		return 1.5
	default:
		return 1.0
	}
}

// ComputeHealthScore calculates the building health score (0–100) from defects.
// Higher score means more damage. Weights each defect by type × severity.
func ComputeHealthScore(defects []FacadeDefect) float64 {
	if len(defects) == 0 {
		return 0
	}
	var weighted float64
	maxPossible := float64(len(defects)) * 4.0 * 5.0 // max weight × max severity

	for _, d := range defects {
		if d.Uncertain {
			continue
		}
		w := DefectTypeToSeverityWeight(d.DefectType)
		weighted += w * float64(d.Severity)
	}

	if maxPossible == 0 {
		return 0
	}
	score := (weighted / maxPossible) * 100
	if score > 100 {
		return 100
	}
	return score
}
