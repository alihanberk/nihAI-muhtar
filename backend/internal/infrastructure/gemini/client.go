// Package gemini provides a client for Google Gemini Vision API.
// It sends Street View images to gemini-1.5-flash with an explicit prompt
// that instructs the model to evaluate only the road/asphalt surface and
// ignore vegetation, sky, buildings, and other non-road elements.
package gemini

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

const (
	apiBase        = "https://generativelanguage.googleapis.com/v1beta/models"
	defaultModel   = "gemini-2.0-flash"
	requestTimeout = 15 * time.Second

	// roadPrompt instructs the model to evaluate ONLY the road surface.
	roadPrompt = `You are a road surface quality inspector.

Analyze this Street View image. Look ONLY at the road/asphalt/pavement surface visible in the image. 
Completely IGNORE: vegetation, trees, grass, sky, buildings, bridges, guardrails, vehicles, sidewalks, and anything that is not the actual road surface.

Focus exclusively on the road pavement quality:
- Cracks, potholes, broken asphalt = damage
- Smooth uniform asphalt = good condition

Rate the road surface damage from 0 to 100:
- 0-24 = GOOD (smooth, well-maintained)
- 25-49 = FAIR (minor cracks or wear)
- 50-74 = POOR (significant damage, potholes)
- 75-100 = CRITICAL (severe structural failure)

If the road surface is not clearly visible (only a small portion), rate based only on what IS visible.

Respond with ONLY valid JSON, nothing else:
{"score": <0-100>, "category": "<GOOD|FAIR|POOR|CRITICAL>", "reason": "<one sentence>"}`
)

// RoadScoreResult holds Gemini's road surface assessment.
type RoadScoreResult struct {
	DamageScore float64
	Category    string
	Reason      string
	Confidence  float64
}

// Client calls the Gemini Vision API.
type Client struct {
	apiKey     string
	model      string
	httpClient *http.Client
}

// NewClient creates a Gemini client. Optionally pass a model name via
// GEMINI_MODEL env var; defaults to gemini-2.0-flash.
func NewClient(apiKey string) *Client {
	model := os.Getenv("GEMINI_MODEL")
	if model == "" {
		model = defaultModel
	}
	return &Client{
		apiKey: apiKey,
		model:  model,
		httpClient: &http.Client{
			Timeout: requestTimeout,
		},
	}
}

// AnalyzeRoadDamage sends a JPEG image to Gemini and returns a road surface
// damage assessment. Retries up to 3 times on 429 (rate limit) responses.
func (c *Client) AnalyzeRoadDamage(ctx context.Context, imageData []byte) (*RoadScoreResult, error) {
	if c.apiKey == "" {
		return nil, fmt.Errorf("gemini API key not configured")
	}

	b64 := base64.StdEncoding.EncodeToString(imageData)

	reqBody := map[string]any{
		"contents": []map[string]any{
			{
				"parts": []map[string]any{
					{
						"inline_data": map[string]any{
							"mime_type": "image/jpeg",
							"data":      b64,
						},
					},
					{
						"text": roadPrompt,
					},
				},
			},
		},
		"generationConfig": map[string]any{
			"temperature":     0.1,
			"maxOutputTokens": 150,
		},
	}

	payload, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal gemini request: %w", err)
	}

	reqURL := fmt.Sprintf("%s/%s:generateContent?key=%s", apiBase, c.model, c.apiKey)

	// Retry up to 3 times on rate-limit (429) with exponential back-off.
	backoff := 5 * time.Second
	for attempt := 0; attempt <= 3; attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(backoff):
			}
			backoff *= 2
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(payload))
		if err != nil {
			return nil, fmt.Errorf("failed to build gemini request: %w", err)
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := c.httpClient.Do(req)
		if err != nil {
			return nil, fmt.Errorf("gemini request failed: %w", err)
		}

		if resp.StatusCode == http.StatusTooManyRequests {
			resp.Body.Close()
			if attempt == 3 {
				return nil, fmt.Errorf("gemini rate limit exceeded after %d retries", attempt)
			}
			continue
		}

		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			return nil, fmt.Errorf("gemini returned HTTP %d", resp.StatusCode)
		}

		var geminiResp struct {
			Candidates []struct {
				Content struct {
					Parts []struct {
						Text string `json:"text"`
					} `json:"parts"`
				} `json:"content"`
			} `json:"candidates"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&geminiResp); err != nil {
			resp.Body.Close()
			return nil, fmt.Errorf("failed to decode gemini response: %w", err)
		}
		resp.Body.Close()

		if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
			return nil, fmt.Errorf("empty response from gemini")
		}

		raw := strings.TrimSpace(geminiResp.Candidates[0].Content.Parts[0].Text)
		return parseGeminiOutput(raw)
	}

	return nil, fmt.Errorf("gemini: all retries exhausted")
}

// parseGeminiOutput extracts the JSON from Gemini's text response.
func parseGeminiOutput(raw string) (*RoadScoreResult, error) {
	// Strip markdown code fences if present
	raw = strings.TrimPrefix(raw, "```json")
	raw = strings.TrimPrefix(raw, "```")
	raw = strings.TrimSuffix(raw, "```")
	raw = strings.TrimSpace(raw)

	// Find the JSON object
	start := strings.Index(raw, "{")
	end := strings.LastIndex(raw, "}")
	if start == -1 || end == -1 || end <= start {
		return nil, fmt.Errorf("no JSON found in gemini response: %q", raw)
	}
	raw = raw[start : end+1]

	var out struct {
		Score    float64 `json:"score"`
		Category string  `json:"category"`
		Reason   string  `json:"reason"`
	}
	if err := json.Unmarshal([]byte(raw), &out); err != nil {
		return nil, fmt.Errorf("failed to parse gemini JSON: %w", err)
	}

	// Clamp and validate
	if out.Score < 0 {
		out.Score = 0
	}
	if out.Score > 100 {
		out.Score = 100
	}
	if out.Category == "" {
		out.Category = scoreToCategory(out.Score)
	}

	return &RoadScoreResult{
		DamageScore: out.Score,
		Category:    out.Category,
		Reason:      out.Reason,
		Confidence:  0.88, // Gemini vision is high-confidence
	}, nil
}

func scoreToCategory(score float64) string {
	switch {
	case score < 25:
		return "GOOD"
	case score < 50:
		return "FAIR"
	case score < 75:
		return "POOR"
	default:
		return "CRITICAL"
	}
}
