package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	appRoadscore "github.com/nihai-muhtar/backend/internal/application/roadscore"
	"github.com/nihai-muhtar/backend/internal/domain/roadscore"
)

// RoadScoreHandler handles HTTP requests for the RoadScore module.
type RoadScoreHandler struct {
	analyzeUC *appRoadscore.AnalyzeRouteUseCase
	scanUC    *appRoadscore.ScanAreaUseCase
	repo      roadscore.Repository
}

// NewRoadScoreHandler creates a RoadScoreHandler.
func NewRoadScoreHandler(
	analyzeUC *appRoadscore.AnalyzeRouteUseCase,
	scanUC *appRoadscore.ScanAreaUseCase,
	repo roadscore.Repository,
) *RoadScoreHandler {
	return &RoadScoreHandler{
		analyzeUC: analyzeUC,
		scanUC:    scanUC,
		repo:      repo,
	}
}

// AnalyzeRouteRequest is the JSON body accepted by POST /road-score/analyze.
type AnalyzeRouteRequest struct {
	OriginLat      float64 `json:"origin_lat"`
	OriginLng      float64 `json:"origin_lng"`
	DestinationLat float64 `json:"destination_lat"`
	DestinationLng float64 `json:"destination_lng"`
}

// AnalyzeRoute runs the full RoadScore pipeline synchronously and returns
// three scored route alternatives with segment-level damage data.
func (h *RoadScoreHandler) AnalyzeRoute(w http.ResponseWriter, r *http.Request) {
	var req AnalyzeRouteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "invalid_request", "Invalid JSON body")
		return
	}

	if req.OriginLat == 0 || req.OriginLng == 0 || req.DestinationLat == 0 || req.DestinationLng == 0 {
		respondWithError(w, http.StatusBadRequest, "missing_coordinates", "origin and destination coordinates are required")
		return
	}

	// Enforce a generous timeout for the full pipeline
	ctx := r.Context()

	domainReq := roadscore.AnalyzeRequest{
		OriginLat:      req.OriginLat,
		OriginLng:      req.OriginLng,
		DestinationLat: req.DestinationLat,
		DestinationLng: req.DestinationLng,
	}

	result, err := h.analyzeUC.Execute(ctx, domainReq)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "analysis_failed", err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, SuccessResponse{
		Data:    result,
		Message: "Route analysis completed",
	})
}

// GetAnalysis retrieves a previously completed analysis by ID.
func (h *RoadScoreHandler) GetAnalysis(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "analysisId")
	if id == "" {
		respondWithError(w, http.StatusBadRequest, "missing_id", "analysisId is required")
		return
	}

	analysis, err := h.repo.GetAnalysis(r.Context(), id)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "not_found", err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, SuccessResponse{Data: analysis})
}

// GetSegments returns all scored segments for a specific route.
func (h *RoadScoreHandler) GetSegments(w http.ResponseWriter, r *http.Request) {
	routeID := chi.URLParam(r, "routeId")
	if routeID == "" {
		respondWithError(w, http.StatusBadRequest, "missing_id", "routeId is required")
		return
	}

	segments, err := h.repo.GetSegmentsByRoute(r.Context(), routeID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "query_failed", err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, SuccessResponse{Data: segments})
}

// GenerateReport returns a structured JSON report suitable for PDF generation
// by the frontend (municipality report).
func (h *RoadScoreHandler) GenerateReport(w http.ResponseWriter, r *http.Request) {
	analysisID := chi.URLParam(r, "analysisId")
	if analysisID == "" {
		respondWithError(w, http.StatusBadRequest, "missing_id", "analysisId is required")
		return
	}

	analysis, err := h.repo.GetAnalysis(r.Context(), analysisID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "not_found", err.Error())
		return
	}

	report := buildReport(analysis)
	respondWithJSON(w, http.StatusOK, SuccessResponse{Data: report})
}

// ─── Area scan ────────────────────────────────────────────────────────────────

// AreaScanRequest is the JSON body accepted by POST /road-score/scan-area.
type AreaScanHTTPRequest struct {
	CenterLat        float64 `json:"center_lat"`
	CenterLng        float64 `json:"center_lng"`
	RadiusMeters     float64 `json:"radius_meters"`
	NeighborhoodName string  `json:"neighborhood_name"`
}

// ScanArea scores every sampled point within the given circular neighborhood zone.
// The response includes per-point damage scores and aggregate summary statistics.
func (h *RoadScoreHandler) ScanArea(w http.ResponseWriter, r *http.Request) {
	var req AreaScanHTTPRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "invalid_request", "Invalid JSON body")
		return
	}

	if req.CenterLat == 0 || req.CenterLng == 0 {
		respondWithError(w, http.StatusBadRequest, "missing_coordinates", "center_lat and center_lng are required")
		return
	}
	if req.RadiusMeters <= 0 {
		req.RadiusMeters = 600
	}

	// Use a generous timeout — area scans can involve many Street View calls
	ctx := r.Context()

	domainReq := roadscore.AreaScanRequest{
		CenterLat:        req.CenterLat,
		CenterLng:        req.CenterLng,
		RadiusMeters:     req.RadiusMeters,
		NeighborhoodName: req.NeighborhoodName,
	}

	result, err := h.scanUC.Execute(ctx, domainReq)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "scan_failed", err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, SuccessResponse{
		Data:    result,
		Message: "Area scan completed",
	})
}

// ─── Report model ─────────────────────────────────────────────────────────────

// MunicipalityReport is a structured report for belediye (municipality) use.
type MunicipalityReport struct {
	GeneratedAt    time.Time       `json:"generated_at"`
	AnalysisID     string          `json:"analysis_id"`
	Origin         string          `json:"origin"`
	Destination    string          `json:"destination"`
	Routes         []RouteReportSection `json:"routes"`
	Summary        string          `json:"summary"`
}

// RouteReportSection summarises one route alternative for the report.
type RouteReportSection struct {
	RouteType       string  `json:"route_type"`
	DurationMin     float64 `json:"duration_min"`
	DistanceKm      float64 `json:"distance_km"`
	DamageScore     float64 `json:"damage_score"`
	DamageCategory  string  `json:"damage_category"`
	CriticalCount   int     `json:"critical_count"`
	PoorCount       int     `json:"poor_count"`
	FairCount       int     `json:"fair_count"`
	GoodCount       int     `json:"good_count"`
}

func buildReport(analysis *roadscore.RouteAnalysis) MunicipalityReport {
	sections := make([]RouteReportSection, 0, len(analysis.Routes))
	for _, route := range analysis.Routes {
		var crit, poor, fair, good int
		for _, seg := range route.Segments {
			switch seg.DamageCategory {
			case roadscore.CategoryCritical:
				crit++
			case roadscore.CategoryPoor:
				poor++
			case roadscore.CategoryFair:
				fair++
			default:
				good++
			}
		}
		sections = append(sections, RouteReportSection{
			RouteType:      string(route.RouteType),
			DurationMin:    float64(route.DurationSeconds) / 60,
			DistanceKm:     float64(route.DistanceMeters) / 1000,
			DamageScore:    route.DamageScore,
			DamageCategory: string(roadscore.ScoreToDamageCategory(route.DamageScore)),
			CriticalCount:  crit,
			PoorCount:      poor,
			FairCount:      fair,
			GoodCount:      good,
		})
	}

	return MunicipalityReport{
		GeneratedAt: time.Now().UTC(),
		AnalysisID:  analysis.ID,
		Origin:      analysis.OriginAddress,
		Destination: analysis.DestinationAddress,
		Routes:      sections,
		Summary:     "Automated road surface quality report — nihAI Muhtar v1",
	}
}
