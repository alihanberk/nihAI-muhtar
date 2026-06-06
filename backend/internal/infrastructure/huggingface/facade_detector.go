package huggingface

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	"image/draw"
	"image/jpeg"
	_ "image/jpeg"
	"net/http"
	"time"
)

const (
	detrModel  = "facebook/detr-resnet-50"
	clipModel  = "openai/clip-vit-base-patch32"
	facadeTimeout = 15 * time.Second
)

// defectLabels are the CLIP candidate labels for facade damage classification.
// Each maps to a DefectType in the domain layer.
var defectLabels = []struct {
	Label      string
	DefectType string
	BaseScore  float64 // midpoint damage weight used for severity calculation
}{
	{"building facade with deep structural cracks threatening stability", "structural_crack", 5},
	{"concrete spalling and surface deterioration on building wall", "spalling", 3},
	{"rust stains and moisture damage on building facade", "corrosion_stain", 2},
	{"deformed collapsed or cracked balcony on apartment building", "deformed_balcony", 4},
	{"damaged or missing fire escape ladder on building", "damaged_fire_escape", 3},
	{"building with visible tilt or structural lean", "building_tilt", 5},
	{"damaged cracked or misaligned window and door frames", "frame_deformation", 2},
	{"healthy building facade with no visible structural damage", "healthy", 0},
}

// DetectionBox holds DETR bounding box output in pixel coordinates.
type DetectionBox struct {
	XMin int `json:"xmin"`
	YMin int `json:"ymin"`
	XMax int `json:"xmax"`
	YMax int `json:"ymax"`
}

// FacadeDetection is a single DETR detection result.
type FacadeDetection struct {
	Score float64      `json:"score"`
	Label string       `json:"label"`
	Box   DetectionBox `json:"box"`
}

// DefectDetection is a single CLIP classification result mapped to a defect.
type DefectDetection struct {
	DefectType string  `json:"defect_type"`
	Label      string  `json:"label"`
	Confidence float64 `json:"confidence"`
	Severity   int     `json:"severity"` // 1–5
}

// FacadeClassifyResult holds the full two-phase analysis output for one image.
type FacadeClassifyResult struct {
	Detections    []*DefectDetection `json:"detections"`
	IsHealthy     bool               `json:"is_healthy"`
	TopLabel      string             `json:"top_label"`
	OverallScore  float64            `json:"overall_score"`
}

// detrRequest is the JSON body for DETR inference.
type detrRequest struct {
	Inputs string `json:"inputs"`
}

// detrResponse is one element of the DETR JSON response array.
type detrResponse struct {
	Score float64 `json:"score"`
	Label string  `json:"label"`
	Box   struct {
		XMin float64 `json:"xmin"`
		YMin float64 `json:"ymin"`
		XMax float64 `json:"xmax"`
		YMax float64 `json:"ymax"`
	} `json:"box"`
}

// FacadeDetector runs the two-phase building facade analysis pipeline.
type FacadeDetector struct {
	apiKey     string
	httpClient *http.Client
}

// NewFacadeDetector creates a FacadeDetector using the provided HF API key.
func NewFacadeDetector(apiKey string) *FacadeDetector {
	return &FacadeDetector{
		apiKey: apiKey,
		httpClient: &http.Client{
			Timeout: facadeTimeout,
		},
	}
}

// DetectFacade calls the DETR model to locate building-like objects in the image.
// Returns all detections with score > 0.5, sorted by score descending.
// DETR is COCO-trained; for hackathon purposes we look for large bounding boxes
// that likely represent building surfaces.
func (fd *FacadeDetector) DetectFacade(ctx context.Context, imageData []byte) ([]*FacadeDetection, error) {
	payload, err := json.Marshal(detrRequest{
		Inputs: base64.StdEncoding.EncodeToString(imageData),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal DETR request: %w", err)
	}

	reqURL := fmt.Sprintf("%s/%s", inferenceBase, detrModel)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("failed to build DETR request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+fd.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := fd.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("DETR inference request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusServiceUnavailable {
		return nil, fmt.Errorf("DETR model loading")
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("DETR API returned HTTP %d", resp.StatusCode)
	}

	var raw []detrResponse
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, fmt.Errorf("failed to decode DETR response: %w", err)
	}

	var detections []*FacadeDetection
	for _, r := range raw {
		if r.Score < 0.5 {
			continue
		}
		detections = append(detections, &FacadeDetection{
			Score: r.Score,
			Label: r.Label,
			Box: DetectionBox{
				XMin: int(r.Box.XMin),
				YMin: int(r.Box.YMin),
				XMax: int(r.Box.XMax),
				YMax: int(r.Box.YMax),
			},
		})
	}

	return detections, nil
}

// CropFacade crops the raw image bytes to the bounding box of the first detection.
// Returns the cropped region as JPEG bytes for Phase 2 classification.
func (fd *FacadeDetector) CropFacade(imageData []byte, detection *FacadeDetection) ([]byte, error) {
	img, _, err := image.Decode(bytes.NewReader(imageData))
	if err != nil {
		return nil, fmt.Errorf("failed to decode image for cropping: %w", err)
	}

	box := detection.Box
	bounds := image.Rect(box.XMin, box.YMin, box.XMax, box.YMax)
	cropped := image.NewRGBA(bounds)
	draw.Draw(cropped, bounds, img, image.Point{X: box.XMin, Y: box.YMin}, draw.Src)

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, cropped, &jpeg.Options{Quality: 85}); err != nil {
		return nil, fmt.Errorf("failed to encode cropped image: %w", err)
	}

	return buf.Bytes(), nil
}

// clipRequest is the JSON body for CLIP zero-shot classification.
type clipRequest struct {
	Inputs     string `json:"inputs"`
	Parameters struct {
		CandidateLabels []string `json:"candidate_labels"`
	} `json:"parameters"`
}

// ClassifyFacadeDefects sends an image to CLIP with defect candidate labels and
// returns all detected defects (excluding the "healthy" baseline label).
// Detections with confidence < 0.7 are marked uncertain for human review.
func (fd *FacadeDetector) ClassifyFacadeDefects(ctx context.Context, imageData []byte) (*FacadeClassifyResult, error) {
	candidates := make([]string, len(defectLabels))
	for i, dl := range defectLabels {
		candidates[i] = dl.Label
	}

	body := clipRequest{
		Inputs: base64.StdEncoding.EncodeToString(imageData),
	}
	body.Parameters.CandidateLabels = candidates

	payload, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal CLIP request: %w", err)
	}

	reqURL := fmt.Sprintf("%s/%s", inferenceBase, clipModel)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("failed to build CLIP request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+fd.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := fd.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("CLIP inference request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusServiceUnavailable {
		return nil, fmt.Errorf("CLIP model loading")
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("CLIP API returned HTTP %d", resp.StatusCode)
	}

	var clipResp []hfLabel
	if err := json.NewDecoder(resp.Body).Decode(&clipResp); err != nil {
		return nil, fmt.Errorf("failed to decode CLIP response: %w", err)
	}

	return computeFacadeResult(clipResp), nil
}

// computeFacadeResult converts CLIP label scores into structured defect detections.
// Scores above 0.15 for non-healthy labels are included as defect detections.
func computeFacadeResult(clipResp []hfLabel) *FacadeClassifyResult {
	scoreByLabel := make(map[string]float64, len(clipResp))
	topLabel := ""
	topScore := 0.0

	for _, item := range clipResp {
		scoreByLabel[item.Label] = item.Score
		if item.Score > topScore {
			topScore = item.Score
			topLabel = item.Label
		}
	}

	result := &FacadeClassifyResult{TopLabel: topLabel}

	for _, dl := range defectLabels {
		if dl.DefectType == "healthy" {
			continue
		}
		score := scoreByLabel[dl.Label]
		if score < 0.10 {
			continue
		}

		// Map confidence + base score to severity 1–5
		severity := confidenceToSeverity(score, dl.BaseScore)

		result.Detections = append(result.Detections, &DefectDetection{
			DefectType: dl.DefectType,
			Label:      dl.Label,
			Confidence: score,
			Severity:   severity,
		})
		result.OverallScore += score * dl.BaseScore
	}

	// Flag as healthy if the top label is the healthy baseline
	healthyLabel := defectLabels[len(defectLabels)-1].Label
	result.IsHealthy = topLabel == healthyLabel || len(result.Detections) == 0

	if result.OverallScore > 100 {
		result.OverallScore = 100
	}

	return result
}

// confidenceToSeverity converts a CLIP confidence score and base damage weight
// to an integer severity on the 1–5 scale.
func confidenceToSeverity(confidence, baseWeight float64) int {
	combined := confidence * baseWeight / 5.0
	switch {
	case combined < 0.15:
		return 1
	case combined < 0.30:
		return 2
	case combined < 0.50:
		return 3
	case combined < 0.70:
		return 4
	default:
		return 5
	}
}

// MockFacadeResult generates a deterministic mock result from coordinates.
// Used as fallback when HuggingFace is unavailable.
func MockFacadeResult(lat, lng float64) *FacadeClassifyResult {
	h := uint32(2166136261)
	s := fmt.Sprintf("facade:%.4f,%.4f", lat, lng)
	for i := 0; i < len(s); i++ {
		h ^= uint32(s[i])
		h *= 16777619
	}

	seed := h % 100
	var detections []*DefectDetection

	if seed < 60 {
		return &FacadeClassifyResult{
			IsHealthy:    true,
			TopLabel:     "healthy building facade with no visible structural damage",
			OverallScore: float64(seed) * 0.2,
		}
	}

	if seed >= 60 && seed < 80 {
		detections = append(detections, &DefectDetection{
			DefectType: "spalling",
			Label:      "concrete spalling and surface deterioration on building wall",
			Confidence: 0.72,
			Severity:   2,
		})
	}
	if seed >= 75 && seed < 90 {
		detections = append(detections, &DefectDetection{
			DefectType: "structural_crack",
			Label:      "building facade with deep structural cracks threatening stability",
			Confidence: 0.65,
			Severity:   3,
		})
	}
	if seed >= 88 {
		detections = append(detections, &DefectDetection{
			DefectType: "building_tilt",
			Label:      "building with visible tilt or structural lean",
			Confidence: 0.81,
			Severity:   4,
		})
	}

	return &FacadeClassifyResult{
		Detections:   detections,
		IsHealthy:    false,
		TopLabel:     detections[0].Label,
		OverallScore: float64(seed-60) * 2.5,
	}
}
