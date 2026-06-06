// Package directions provides a client for the Google Directions API.
// It fetches up to 3 alternative routes between an origin and destination,
// decodes the encoded polyline, and samples coordinates every 150 m.
package directions

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"time"
)

const (
	directionsBaseURL  = "https://maps.googleapis.com/maps/api/directions/json"
	sampleIntervalMeters = 150.0
)

// Coordinate is a geographic point.
type Coordinate struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}

// Route represents one route alternative from the Directions API.
type Route struct {
	Index           int
	DurationSeconds int
	DistanceMeters  int
	EncodedPolyline string
	// Waypoints are coordinates sampled every 150 m along the route.
	Waypoints []Coordinate
}

// Client calls the Google Directions API.
type Client struct {
	apiKey     string
	httpClient *http.Client
}

// NewClient creates a Directions API client with the provided API key.
func NewClient(apiKey string) *Client {
	return &Client{
		apiKey: apiKey,
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

// FetchRoutes retrieves up to 3 alternative routes from origin to destination.
func (c *Client) FetchRoutes(ctx context.Context, origin, destination Coordinate) ([]Route, error) {
	params := url.Values{}
	params.Set("origin", fmt.Sprintf("%f,%f", origin.Lat, origin.Lng))
	params.Set("destination", fmt.Sprintf("%f,%f", destination.Lat, destination.Lng))
	params.Set("alternatives", "true")
	params.Set("key", c.apiKey)

	reqURL := fmt.Sprintf("%s?%s", directionsBaseURL, params.Encode())

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to build directions request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("directions API request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("directions API returned HTTP %d", resp.StatusCode)
	}

	var apiResp directionsAPIResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, fmt.Errorf("failed to decode directions response: %w", err)
	}

	if apiResp.Status != "OK" {
		return nil, fmt.Errorf("directions API error: %s", apiResp.Status)
	}

	routes := make([]Route, 0, len(apiResp.Routes))
	for i, r := range apiResp.Routes {
		if len(r.Legs) == 0 {
			continue
		}

		encoded := r.OverviewPolyline.Points
		coords := decodePolyline(encoded)
		sampled := sampleEvery150m(coords)

		routes = append(routes, Route{
			Index:           i,
			DurationSeconds: r.Legs[0].Duration.Value,
			DistanceMeters:  r.Legs[0].Distance.Value,
			EncodedPolyline: encoded,
			Waypoints:       sampled,
		})
	}

	if len(routes) == 0 {
		return nil, fmt.Errorf("no routes found between the given coordinates")
	}

	return routes, nil
}

// ─── Internal API response structs ───────────────────────────────────────────

type directionsAPIResponse struct {
	Status string             `json:"status"`
	Routes []directionsRoute  `json:"routes"`
}

type directionsRoute struct {
	Legs             []directionsLeg      `json:"legs"`
	OverviewPolyline directionsPolyline   `json:"overview_polyline"`
}

type directionsLeg struct {
	Duration directionsValue `json:"duration"`
	Distance directionsValue `json:"distance"`
}

type directionsValue struct {
	Text  string `json:"text"`
	Value int    `json:"value"`
}

type directionsPolyline struct {
	Points string `json:"points"`
}

// ─── Polyline decode ─────────────────────────────────────────────────────────

// decodePolyline decodes a Google-encoded polyline string into a coordinate slice.
func decodePolyline(encoded string) []Coordinate {
	coords := make([]Coordinate, 0)
	index, lat, lng := 0, 0, 0

	for index < len(encoded) {
		lat += decodeChunk(encoded, &index)
		lng += decodeChunk(encoded, &index)
		coords = append(coords, Coordinate{
			Lat: float64(lat) / 1e5,
			Lng: float64(lng) / 1e5,
		})
	}
	return coords
}

func decodeChunk(encoded string, index *int) int {
	result, shift := 0, 0
	for {
		if *index >= len(encoded) {
			break
		}
		b := int(encoded[*index]) - 63
		*index++
		result |= (b & 0x1F) << shift
		shift += 5
		if b < 0x20 {
			break
		}
	}
	if result&1 != 0 {
		return ^(result >> 1)
	}
	return result >> 1
}

// ─── Coordinate sampling ─────────────────────────────────────────────────────

// sampleEvery150m returns waypoints spaced ~150 m apart along the route.
func sampleEvery150m(coords []Coordinate) []Coordinate {
	if len(coords) == 0 {
		return coords
	}

	sampled := []Coordinate{coords[0]}
	accumulated := 0.0

	for i := 1; i < len(coords); i++ {
		d := haversine(coords[i-1], coords[i])
		accumulated += d
		if accumulated >= sampleIntervalMeters {
			sampled = append(sampled, coords[i])
			accumulated = 0
		}
	}

	// Always include the final destination coordinate
	last := coords[len(coords)-1]
	if sampled[len(sampled)-1] != last {
		sampled = append(sampled, last)
	}

	return sampled
}

// haversine returns the great-circle distance in meters between two coordinates.
func haversine(a, b Coordinate) float64 {
	const earthRadius = 6_371_000.0
	lat1 := a.Lat * math.Pi / 180
	lat2 := b.Lat * math.Pi / 180
	dLat := (b.Lat - a.Lat) * math.Pi / 180
	dLng := (b.Lng - a.Lng) * math.Pi / 180

	sinLat := math.Sin(dLat / 2)
	sinLng := math.Sin(dLng / 2)
	aVal := sinLat*sinLat + math.Cos(lat1)*math.Cos(lat2)*sinLng*sinLng
	return earthRadius * 2 * math.Atan2(math.Sqrt(aVal), math.Sqrt(1-aVal))
}

// BearingTo calculates the compass bearing (0–360°) from coordinate a toward b.
// Used to set the Street View camera heading.
func BearingTo(a, b Coordinate) float64 {
	lat1 := a.Lat * math.Pi / 180
	lat2 := b.Lat * math.Pi / 180
	dLng := (b.Lng - a.Lng) * math.Pi / 180

	y := math.Sin(dLng) * math.Cos(lat2)
	x := math.Cos(lat1)*math.Sin(lat2) - math.Sin(lat1)*math.Cos(lat2)*math.Cos(dLng)

	bearing := math.Atan2(y, x) * 180 / math.Pi
	return math.Mod(bearing+360, 360)
}
