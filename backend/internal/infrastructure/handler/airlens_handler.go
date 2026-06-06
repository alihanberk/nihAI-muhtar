package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	appAirlens "github.com/nihai-muhtar/backend/internal/application/airlens"
	"github.com/nihai-muhtar/backend/internal/domain/airlens"
)

// AirlensHandler exposes the AirLens green-score endpoints.
type AirlensHandler struct {
	scanUC  *appAirlens.ScanDistrictUseCase
	routeUC *appAirlens.CoolRouteUseCase
	repo    airlens.Repository
}

// NewAirlensHandler creates an AirlensHandler with all required dependencies.
func NewAirlensHandler(
	scanUC *appAirlens.ScanDistrictUseCase,
	routeUC *appAirlens.CoolRouteUseCase,
	repo airlens.Repository,
) *AirlensHandler {
	return &AirlensHandler{
		scanUC:  scanUC,
		routeUC: routeUC,
		repo:    repo,
	}
}

// ScanDistrict handles POST /api/v1/airlens/scan.
// Body: { district_name, center_lat, center_lng, radius_meters }
func (h *AirlensHandler) ScanDistrict(w http.ResponseWriter, r *http.Request) {
	var req airlens.ScanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Bad Request", "invalid request body")
		return
	}

	if req.DistrictName == "" {
		respondWithError(w, http.StatusBadRequest, "Bad Request", "district_name is required")
		return
	}
	if req.CenterLat == 0 || req.CenterLng == 0 {
		respondWithError(w, http.StatusBadRequest, "Bad Request", "center_lat and center_lng are required")
		return
	}
	if req.RadiusMeters <= 0 {
		req.RadiusMeters = 1000
	}

	scan, err := h.scanUC.Execute(r.Context(), req)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Internal Server Error", err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, scan)
}

// GetScan handles GET /api/v1/airlens/scans/{scanId}.
func (h *AirlensHandler) GetScan(w http.ResponseWriter, r *http.Request) {
	scanID := chi.URLParam(r, "scanId")
	if scanID == "" {
		respondWithError(w, http.StatusBadRequest, "Bad Request", "scanId is required")
		return
	}

	scan, err := h.repo.GetScan(r.Context(), scanID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Not Found", err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, scan)
}

// ListScans handles GET /api/v1/airlens/scans?district=Kadıköy.
func (h *AirlensHandler) ListScans(w http.ResponseWriter, r *http.Request) {
	district := r.URL.Query().Get("district")
	if district == "" {
		respondWithError(w, http.StatusBadRequest, "Bad Request", "district query parameter is required")
		return
	}

	scans, err := h.repo.ListScans(r.Context(), district, 10)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Internal Server Error", err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]any{
		"district": district,
		"scans":    scans,
		"count":    len(scans),
	})
}

// GetScanReport handles GET /api/v1/airlens/scans/{scanId}/report.
// Returns top-10 green cells, top-10 heat hotspots, and summary statistics.
func (h *AirlensHandler) GetScanReport(w http.ResponseWriter, r *http.Request) {
	scanID := chi.URLParam(r, "scanId")

	scan, err := h.repo.GetScan(r.Context(), scanID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Not Found", err.Error())
		return
	}

	topGreen, err := h.repo.GetTopGreenCells(r.Context(), scanID, 10)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Internal Server Error", err.Error())
		return
	}

	hotspots, err := h.repo.GetHotspotCells(r.Context(), scanID, 10)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Internal Server Error", err.Error())
		return
	}

	dist := map[string]int{"LOW": 0, "MODERATE": 0, "HIGH": 0, "CRITICAL": 0}
	for _, c := range scan.Cells {
		dist[string(c.HeatRisk)]++
	}

	// topGreen / hotspots come from the repo; guarantee non-null slices for JSON.
	if topGreen == nil {
		topGreen = []airlens.GridCell{}
	}
	if hotspots == nil {
		hotspots = []airlens.GridCell{}
	}

	respondWithJSON(w, http.StatusOK, map[string]any{
		"scan_id":      scanID,
		"district":     scan.DistrictName,
		"avg_green":    scan.AvgGreenScore,
		"heat_risk":    scan.HeatRiskLevel,
		"scored_cells": scan.ScoredCells,
		"duration_ms":  scan.DurationMs,
		"distribution": dist,
		"top_green":    topGreen,
		"hotspots":     hotspots,
	})
}

// GetCoolRoute handles GET /api/v1/airlens/scans/{scanId}/cool-route.
func (h *AirlensHandler) GetCoolRoute(w http.ResponseWriter, r *http.Request) {
	scanID := chi.URLParam(r, "scanId")
	if scanID == "" {
		respondWithError(w, http.StatusBadRequest, "Bad Request", "scanId is required")
		return
	}

	route, err := h.routeUC.Execute(r.Context(), scanID)
	if err != nil {
		respondWithError(w, http.StatusUnprocessableEntity, "Unprocessable Entity", err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, route)
}
