// Package huggingface provides a client for the Hugging Face Inference API.
// It uses CLIP zero-shot image classification to score road surface damage.
// Timeout is enforced at 10 seconds per the RoadScore spec.
package huggingface

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

const (
	// DefaultModel is the CLIP model used for zero-shot road damage classification.
	DefaultModel   = "openai/clip-vit-base-patch32"
	inferenceBase  = "https://api-inference.huggingface.co/models"
	requestTimeout = 10 * time.Second
)

// damageLabels are the candidate labels sent to the CLIP model.
// Their order corresponds to the four DamageCategory bands.
var damageLabels = []string{
	"good quality road surface with no visible damage",
	"road surface with minor cracks and light wear",
	"road surface with significant potholes and broken pavement",
	"severely damaged road with critical structural failure and deep holes",
}

// labelScoreMidpoints maps label index → midpoint of the damage band (0–100).
// Used to compute the numeric damage score from classification confidence.
var labelScoreMidpoints = [4]float64{12.5, 37.5, 62.5, 87.5}

// hfLabel is the element shape returned by the HF Inference API.
type hfLabel struct {
	Label string  `json:"label"`
	Score float64 `json:"score"`
}

// ClassifyResult holds the damage classification output for one image.
type ClassifyResult struct {
	DamageScore float64 `json:"damage_score"` // 0–100
	Category    string  `json:"category"`     // GOOD / FAIR / POOR / CRITICAL
	Confidence  float64 `json:"confidence"`   // 0–1 probability of top label
}

// Client calls the Hugging Face Inference API.
type Client struct {
	apiKey     string
	modelID    string
	httpClient *http.Client
}

// NewClient creates a Hugging Face client.
// If modelID is empty, DefaultModel is used.
func NewClient(apiKey, modelID string) *Client {
	if modelID == "" {
		modelID = DefaultModel
	}
	return &Client{
		apiKey:  apiKey,
		modelID: modelID,
		httpClient: &http.Client{
			Timeout: requestTimeout,
		},
	}
}

// ClassifyRoadDamage sends a JPEG image (raw bytes) to the Hugging Face zero-shot
// image classification endpoint and returns a structured damage result.
// Raw image data is never persisted beyond this call.
func (c *Client) ClassifyRoadDamage(ctx context.Context, imageData []byte) (*ClassifyResult, error) {
	// CLIP zero-shot classification expects base64-encoded image + candidate labels
	type requestBody struct {
		Inputs     string   `json:"inputs"`
		Parameters struct {
			CandidateLabels []string `json:"candidate_labels"`
		} `json:"parameters"`
	}

	body := requestBody{
		Inputs: base64.StdEncoding.EncodeToString(imageData),
	}
	body.Parameters.CandidateLabels = damageLabels

	payload, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal HF request: %w", err)
	}

	reqURL := fmt.Sprintf("%s/%s", inferenceBase, c.modelID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("failed to build HF request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("HF inference request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusServiceUnavailable {
		// Model is loading — return a default score rather than blocking the pipeline
		return defaultResult(), nil
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HF API returned HTTP %d", resp.StatusCode)
	}

	// HF returns an array sorted by score descending: [{label, score}, ...]
	var hfResp []hfLabel
	if err := json.NewDecoder(resp.Body).Decode(&hfResp); err != nil {
		return nil, fmt.Errorf("failed to decode HF response: %w", err)
	}

	return computeResult(hfResp), nil
}

// computeResult converts HF label scores to a DamageScore and category.
// The numeric damage score is the weighted sum: Σ(score_i × midpoint_i).
func computeResult(hfResp []hfLabel) *ClassifyResult {
	// Build a score-by-label map
	scoreByLabel := make(map[string]float64, len(damageLabels))
	for _, item := range hfResp {
		scoreByLabel[item.Label] = item.Score
	}

	damageScore := 0.0
	topScore := 0.0
	topLabel := ""

	for i, label := range damageLabels {
		s := scoreByLabel[label]
		damageScore += s * labelScoreMidpoints[i]
		if s > topScore {
			topScore = s
			topLabel = label
		}
	}

	return &ClassifyResult{
		DamageScore: clamp(damageScore, 0, 100),
		Category:    labelToCategory(topLabel),
		Confidence:  topScore,
	}
}

// defaultResult is returned when the HF model is still loading.
func defaultResult() *ClassifyResult {
	return &ClassifyResult{
		DamageScore: 12.5,
		Category:    "GOOD",
		Confidence:  0.5,
	}
}

func labelToCategory(label string) string {
	switch label {
	case damageLabels[0]:
		return "GOOD"
	case damageLabels[1]:
		return "FAIR"
	case damageLabels[2]:
		return "POOR"
	default:
		return "CRITICAL"
	}
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
