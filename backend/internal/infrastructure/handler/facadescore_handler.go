package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	appFacade "github.com/nihai-muhtar/backend/internal/application/facadescore"
	"github.com/nihai-muhtar/backend/internal/domain/facadescore"
)

// FacadeScoreHandler handles HTTP requests for the FacadeScore module.
type FacadeScoreHandler struct {
	analyzeUC *appFacade.AnalyzeBuildingUseCase
	repo      facadescore.Repository
}

// NewFacadeScoreHandler creates a FacadeScoreHandler.
func NewFacadeScoreHandler(
	analyzeUC *appFacade.AnalyzeBuildingUseCase,
	repo facadescore.Repository,
) *FacadeScoreHandler {
	return &FacadeScoreHandler{
		analyzeUC: analyzeUC,
		repo:      repo,
	}
}

// AnalyzeDistrict POST /facade-score/analyze
// Queues a district-level building facade analysis job and returns the job ID.
func (h *FacadeScoreHandler) AnalyzeDistrict(w http.ResponseWriter, r *http.Request) {
	var req struct {
		District  string  `json:"district"`
		CenterLat float64 `json:"center_lat"`
		CenterLng float64 `json:"center_lng"`
		RadiusM   int     `json:"radius_m"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "invalid_request", "Invalid JSON body")
		return
	}

	if req.District == "" {
		respondWithError(w, http.StatusBadRequest, "missing_district", "district is required")
		return
	}
	if req.CenterLat == 0 || req.CenterLng == 0 {
		respondWithError(w, http.StatusBadRequest, "missing_coordinates", "center_lat and center_lng are required")
		return
	}
	if req.RadiusM <= 0 {
		req.RadiusM = 500
	}

	domainReq := facadescore.AnalyzeRequest{
		District:  req.District,
		CenterLat: req.CenterLat,
		CenterLng: req.CenterLng,
		RadiusM:   req.RadiusM,
	}

	result, err := h.analyzeUC.Execute(r.Context(), domainReq)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "analysis_failed", err.Error())
		return
	}

	respondWithJSON(w, http.StatusAccepted, SuccessResponse{
		Data:    result,
		Message: "Analysis job queued successfully",
	})
}

// GetJob GET /facade-score/jobs/{jobId}
// Returns the current status and progress of an analysis job.
func (h *FacadeScoreHandler) GetJob(w http.ResponseWriter, r *http.Request) {
	jobID := chi.URLParam(r, "jobId")
	if jobID == "" {
		respondWithError(w, http.StatusBadRequest, "missing_id", "jobId is required")
		return
	}

	job, err := h.repo.GetJob(r.Context(), jobID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "not_found", err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, SuccessResponse{Data: job})
}

// GetBuilding GET /facade-score/buildings/{buildingId}
// Returns full building analysis with defects and bounding boxes.
func (h *FacadeScoreHandler) GetBuilding(w http.ResponseWriter, r *http.Request) {
	buildingID := chi.URLParam(r, "buildingId")
	if buildingID == "" {
		respondWithError(w, http.StatusBadRequest, "missing_id", "buildingId is required")
		return
	}

	building, err := h.repo.GetBuilding(r.Context(), buildingID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "not_found", err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, SuccessResponse{Data: building})
}

// ListBuildingsByDistrict GET /facade-score/districts/{district}/buildings
// Returns all analyzed buildings in the given district, ordered by health score.
func (h *FacadeScoreHandler) ListBuildingsByDistrict(w http.ResponseWriter, r *http.Request) {
	district := chi.URLParam(r, "district")
	if district == "" {
		respondWithError(w, http.StatusBadRequest, "missing_district", "district is required")
		return
	}

	buildings, err := h.repo.ListBuildingsByDistrict(r.Context(), district)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "query_failed", err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, SuccessResponse{Data: buildings})
}

// GetPriorityBuildings GET /facade-score/priority?limit=20
// Returns the top N most critical buildings across all districts.
func (h *FacadeScoreHandler) GetPriorityBuildings(w http.ResponseWriter, r *http.Request) {
	limit := 20
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	buildings, err := h.repo.GetPriorityBuildings(r.Context(), limit)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "query_failed", err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, SuccessResponse{Data: buildings})
}

// GetDistrictHeatmap GET /facade-score/heatmap/{district}
// Returns risk aggregation statistics for a specific district.
func (h *FacadeScoreHandler) GetDistrictHeatmap(w http.ResponseWriter, r *http.Request) {
	district := chi.URLParam(r, "district")
	if district == "" {
		respondWithError(w, http.StatusBadRequest, "missing_district", "district is required")
		return
	}

	heatmap, err := h.repo.GetDistrictHeatmap(r.Context(), district)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "query_failed", err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, SuccessResponse{Data: heatmap})
}

// ListAllHeatmaps GET /facade-score/heatmap
// Returns risk aggregation for every district that has been analyzed.
func (h *FacadeScoreHandler) ListAllHeatmaps(w http.ResponseWriter, r *http.Request) {
	heatmaps, err := h.repo.ListAllDistrictHeatmaps(r.Context())
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "query_failed", err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, SuccessResponse{Data: heatmaps})
}

// SubmitCitizenReport POST /facade-score/citizen-report
// Accepts a mobile-submitted damage report with location and description.
func (h *FacadeScoreHandler) SubmitCitizenReport(w http.ResponseWriter, r *http.Request) {
	var req struct {
		BuildingID  string  `json:"building_id"`
		Lat         float64 `json:"lat"`
		Lng         float64 `json:"lng"`
		Description string  `json:"description"`
		PhotoURL    string  `json:"photo_url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "invalid_request", "Invalid JSON body")
		return
	}

	if req.Lat == 0 || req.Lng == 0 {
		respondWithError(w, http.StatusBadRequest, "missing_coordinates", "lat and lng are required")
		return
	}
	if req.Description == "" {
		respondWithError(w, http.StatusBadRequest, "missing_description", "description is required")
		return
	}

	cr := &facadescore.CitizenReport{
		BuildingID:  req.BuildingID,
		Lat:         req.Lat,
		Lng:         req.Lng,
		Description: req.Description,
		PhotoURL:    req.PhotoURL,
		Status:      "pending",
	}

	if err := h.repo.CreateCitizenReport(r.Context(), cr); err != nil {
		respondWithError(w, http.StatusInternalServerError, "save_failed", err.Error())
		return
	}

	respondWithJSON(w, http.StatusCreated, SuccessResponse{
		Data:    cr,
		Message: "Citizen report submitted. Thank you for contributing to public safety.",
	})
}

// GetBuildingReport GET /facade-score/buildings/{buildingId}/report
// Returns a structured report suitable for PDF generation.
func (h *FacadeScoreHandler) GetBuildingReport(w http.ResponseWriter, r *http.Request) {
	buildingID := chi.URLParam(r, "buildingId")
	if buildingID == "" {
		respondWithError(w, http.StatusBadRequest, "missing_id", "buildingId is required")
		return
	}

	building, err := h.repo.GetBuilding(r.Context(), buildingID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "not_found", err.Error())
		return
	}

	citizenReports, _ := h.repo.ListCitizenReports(r.Context(), buildingID)

	report := buildFacadeReport(building, citizenReports)
	respondWithJSON(w, http.StatusOK, SuccessResponse{Data: report})
}

// ─── Report builder ──────────────────────────────────────────────────────────

// FacadeBuildingReport is the structured output for PDF generation.
type FacadeBuildingReport struct {
	GeneratedAt     time.Time                      `json:"generated_at"`
	BuildingID      string                         `json:"building_id"`
	District        string                         `json:"district"`
	Address         string                         `json:"address"`
	Lat             float64                        `json:"lat"`
	Lng             float64                        `json:"lng"`
	HealthScore     float64                        `json:"health_score"`
	RiskLevel       facadescore.RiskLevel          `json:"risk_level"`
	RiskColor       string                         `json:"risk_color"`
	Defects         []facadescore.FacadeDefect     `json:"defects"`
	DefectSummary   map[string]int                 `json:"defect_summary"`
	CitizenReports  []*facadescore.CitizenReport   `json:"citizen_reports"`
	Recommendation  string                         `json:"recommendation"`
	AnalysisYear    int                            `json:"analysis_year"`
	Source          string                         `json:"source"`
}

func buildFacadeReport(b *facadescore.BuildingAnalysis, cr []*facadescore.CitizenReport) FacadeBuildingReport {
	summary := make(map[string]int)
	for _, d := range b.Defects {
		summary[string(d.DefectType)]++
	}

	var recommendation string
	switch b.RiskLevel {
	case facadescore.RiskEmergency:
		recommendation = "ACİL: Bina derhal tahliye edilmeli ve yetkili kurumlara bildirilmelidir."
	case facadescore.RiskRisky:
		recommendation = "RİSKLİ: Kısa vadede yapısal denetim yapılması gerekmektedir."
	case facadescore.RiskAttention:
		recommendation = "DİKKAT: Birincil bakım ve önleyici onarım önerilir."
	default:
		recommendation = "SAĞLIKLI: Rutin periyodik denetim yeterlidir."
	}

	return FacadeBuildingReport{
		GeneratedAt:    time.Now().UTC(),
		BuildingID:     b.ID,
		District:       b.District,
		Address:        b.Address,
		Lat:            b.Lat,
		Lng:            b.Lng,
		HealthScore:    b.HealthScore,
		RiskLevel:      b.RiskLevel,
		RiskColor:      facadescore.RiskLevelToColor(b.RiskLevel),
		Defects:        b.Defects,
		DefectSummary:  summary,
		CitizenReports: cr,
		Recommendation: recommendation,
		AnalysisYear:   b.AnalysisYear,
		Source:         "nihAI Muhtar — FacadeScore v1.0",
	}
}
