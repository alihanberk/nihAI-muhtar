// Package segmentation provides a client for the Hugging Face semantic segmentation
// inference API. It uses nvidia/segformer-b0-finetuned-ade-512-512, trained on the
// ADE20K dataset (150 urban classes), to compute pixel-level class distributions
// from Street View imagery.
//
// Only aggregated pixel percentages are returned — no imagery is stored.
package segmentation

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	_ "image/png" // register PNG decoder
	"net/http"
	"strings"
	"time"
)

const (
	// DefaultSegModel is the ADE20K semantic segmentation model.
	DefaultSegModel = "nvidia/segformer-b0-finetuned-ade-512-512"
	inferenceBase   = "https://api-inference.huggingface.co/models"
	segTimeout      = 30 * time.Second
)

// ─── ADE20K label → category mapping ─────────────────────────────────────────
//
// ADE20K has 150 classes. We bucket them into 5 urban categories that matter
// for the green-score / heat-risk calculation.

var vegetationLabels = map[string]bool{
	"tree": true, "plant": true, "grass": true, "field": true,
	"flower": true, "palm": true, "bush": true, "shrub": true,
	"land": true, "dirt": true, "earth": true, "sand": true,
	"mountain": true, "hill": true, "rock": true,
}

var skyLabels = map[string]bool{
	"sky": true, "clouds": true,
}

var buildingLabels = map[string]bool{
	"building": true, "house": true, "skyscraper": true, "tower": true,
	"wall": true, "ceiling": true, "floor": true, "pillar": true,
	"column": true, "fence": true, "railing": true, "stairs": true,
	"balcony": true, "door": true, "window": true, "roof": true,
	"awning": true, "hovel": true, "booth": true,
}

var roadLabels = map[string]bool{
	"road": true, "street": true, "runway": true, "dirt track": true,
	"path": true, "bridge": true,
}

var sidewalkLabels = map[string]bool{
	"sidewalk": true, "pavement": true, "pedestrian area": true,
}

// ─── Types ────────────────────────────────────────────────────────────────────

// SegmentResult is the pixel-percentage breakdown returned for one image.
type SegmentResult struct {
	VegetationPct float64
	SkyPct        float64
	BuildingPct   float64
	RoadPct       float64
	SidewalkPct   float64
	GreenScore    float64 // == VegetationPct (convenience alias)
}

// hfSegment is one item in the HF segmentation API response.
type hfSegment struct {
	Score float64 `json:"score"`
	Label string  `json:"label"`
	Mask  string  `json:"mask"` // base64-encoded grayscale PNG
}

// Client calls the Hugging Face segmentation inference API.
type Client struct {
	apiKey     string
	modelID    string
	httpClient *http.Client
}

// NewClient creates a segmentation client.
// If modelID is empty, DefaultSegModel is used.
func NewClient(apiKey, modelID string) *Client {
	if modelID == "" {
		modelID = DefaultSegModel
	}
	return &Client{
		apiKey:  apiKey,
		modelID: modelID,
		httpClient: &http.Client{
			Timeout: segTimeout,
		},
	}
}

// Segment sends a JPEG image to the HF segmentation endpoint and returns
// per-class pixel percentages. The raw image bytes are never stored.
func (c *Client) Segment(ctx context.Context, imageData []byte) (*SegmentResult, error) {
	type requestBody struct {
		Inputs string `json:"inputs"`
	}
	body := requestBody{
		Inputs: base64.StdEncoding.EncodeToString(imageData),
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal segmentation request: %w", err)
	}

	reqURL := fmt.Sprintf("%s/%s", inferenceBase, c.modelID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("failed to build segmentation request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("segmentation request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusServiceUnavailable {
		// Model is loading — return a conservative default so the scan continues
		return defaultResult(), nil
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("segmentation API returned HTTP %d", resp.StatusCode)
	}

	var segments []hfSegment
	if err := json.NewDecoder(resp.Body).Decode(&segments); err != nil {
		return nil, fmt.Errorf("failed to decode segmentation response: %w", err)
	}

	return computePixelBreakdown(segments)
}

// ─── Pixel breakdown ──────────────────────────────────────────────────────────

// computePixelBreakdown decodes each segment mask PNG and counts pixels per category.
func computePixelBreakdown(segments []hfSegment) (*SegmentResult, error) {
	if len(segments) == 0 {
		return defaultResult(), nil
	}

	// We need total pixels — decode the first mask to get image dimensions.
	firstImg, err := decodeMask(segments[0].Mask)
	if err != nil {
		// If we can't decode masks, fall back to the confidence-score approximation.
		return approximateFromScores(segments), nil
	}
	bounds := firstImg.Bounds()
	total := float64(bounds.Dx() * bounds.Dy())
	if total == 0 {
		return defaultResult(), nil
	}

	var vegPx, skyPx, buildPx, roadPx, sidesPx float64

	for _, seg := range segments {
		img, err := decodeMask(seg.Mask)
		if err != nil {
			continue
		}
		px := float64(countWhitePixels(img))
		cat := classifyLabel(seg.Label)
		switch cat {
		case "vegetation":
			vegPx += px
		case "sky":
			skyPx += px
		case "building":
			buildPx += px
		case "road":
			roadPx += px
		case "sidewalk":
			sidesPx += px
		}
	}

	res := &SegmentResult{
		VegetationPct: clamp(vegPx/total*100, 0, 100),
		SkyPct:        clamp(skyPx/total*100, 0, 100),
		BuildingPct:   clamp(buildPx/total*100, 0, 100),
		RoadPct:       clamp(roadPx/total*100, 0, 100),
		SidewalkPct:   clamp(sidesPx/total*100, 0, 100),
	}
	res.GreenScore = res.VegetationPct
	return res, nil
}

// approximateFromScores uses segment confidence scores as a proxy when mask
// decoding fails. This is a graceful fallback — it trades precision for resilience.
func approximateFromScores(segments []hfSegment) *SegmentResult {
	var vegScore, skyScore, buildScore, roadScore, sidesScore float64
	for _, seg := range segments {
		cat := classifyLabel(seg.Label)
		switch cat {
		case "vegetation":
			vegScore += seg.Score
		case "sky":
			skyScore += seg.Score
		case "building":
			buildScore += seg.Score
		case "road":
			roadScore += seg.Score
		case "sidewalk":
			sidesScore += seg.Score
		}
	}
	scale := 100.0 // confidence sum heuristic
	res := &SegmentResult{
		VegetationPct: clamp(vegScore*scale, 0, 100),
		SkyPct:        clamp(skyScore*scale, 0, 100),
		BuildingPct:   clamp(buildScore*scale, 0, 100),
		RoadPct:       clamp(roadScore*scale, 0, 100),
		SidewalkPct:   clamp(sidesScore*scale, 0, 100),
	}
	res.GreenScore = res.VegetationPct
	return res
}

// defaultResult returns a neutral conservative score used when the API is unavailable.
func defaultResult() *SegmentResult {
	return &SegmentResult{
		VegetationPct: 10.0,
		SkyPct:        25.0,
		BuildingPct:   35.0,
		RoadPct:       20.0,
		SidewalkPct:   10.0,
		GreenScore:    10.0,
	}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// classifyLabel maps an ADE20K label string to our 5-category taxonomy.
func classifyLabel(label string) string {
	lower := strings.ToLower(strings.TrimSpace(label))
	if vegetationLabels[lower] {
		return "vegetation"
	}
	if skyLabels[lower] {
		return "sky"
	}
	if buildingLabels[lower] {
		return "building"
	}
	if roadLabels[lower] {
		return "road"
	}
	if sidewalkLabels[lower] {
		return "sidewalk"
	}
	// Check for partial matches (e.g. "tree branch", "grass field")
	for key := range vegetationLabels {
		if strings.Contains(lower, key) {
			return "vegetation"
		}
	}
	for key := range buildingLabels {
		if strings.Contains(lower, key) {
			return "building"
		}
	}
	return "other"
}

// decodeMask decodes a base64-encoded PNG mask returned by the HF API.
func decodeMask(b64 string) (image.Image, error) {
	data, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		return nil, fmt.Errorf("base64 decode: %w", err)
	}
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("image decode: %w", err)
	}
	return img, nil
}

// countWhitePixels counts pixels where the red channel is above the midpoint
// (i.e. the segment mask is "on" at that position).
func countWhitePixels(img image.Image) int {
	bounds := img.Bounds()
	count := 0
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			r, _, _, _ := img.At(x, y).RGBA()
			// RGBA values are 0–65535; threshold at 50%
			if r > 32767 {
				count++
			}
		}
	}
	return count
}

func clamp(v, min, max float64) float64 {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}
