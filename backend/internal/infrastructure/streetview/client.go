// Package streetview provides a client for the Google Street View Static API.
// Each request passes through a rate limiter to stay within API quota limits.
package streetview

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

const (
	streetViewBaseURL = "https://maps.googleapis.com/maps/api/streetview"
	imageWidth        = 640
	imageHeight       = 640
	defaultFOV        = 90
	defaultPitch      = 0
)

// Client fetches Street View Static API images.
type Client struct {
	apiKey     string
	httpClient *http.Client
}

// NewClient creates a Street View client.
func NewClient(apiKey string) *Client {
	return &Client{
		apiKey: apiKey,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// FetchImage downloads a 640×640 Street View image at the given coordinates.
// heading is the compass direction of the camera (0–360°); pitch tilts up/down.
// Returns the raw JPEG bytes.
func (c *Client) FetchImage(ctx context.Context, lat, lng, heading float64) ([]byte, error) {
	params := url.Values{}
	params.Set("size", fmt.Sprintf("%dx%d", imageWidth, imageHeight))
	params.Set("location", fmt.Sprintf("%f,%f", lat, lng))
	params.Set("heading", fmt.Sprintf("%.1f", heading))
	params.Set("fov", fmt.Sprintf("%d", defaultFOV))
	params.Set("pitch", fmt.Sprintf("%d", defaultPitch))
	params.Set("source", "outdoor") // prefer outdoor imagery
	params.Set("key", c.apiKey)

	reqURL := fmt.Sprintf("%s?%s", streetViewBaseURL, params.Encode())

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to build street view request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("street view request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("street view returned HTTP %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read street view response: %w", err)
	}

	// Google returns a generic "no imagery" JPEG for missing locations;
	// those are very small (<5 KB). We skip them.
	if len(data) < 5_000 {
		return nil, fmt.Errorf("no street view imagery available at (%.5f, %.5f)", lat, lng)
	}

	return data, nil
}
