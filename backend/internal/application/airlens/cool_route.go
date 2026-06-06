package airlens

import (
	"context"
	"fmt"
	"math"
	"sort"

	"github.com/nihai-muhtar/backend/internal/domain/airlens"
)

const (
	// minGreenScoreForRoute is the threshold below which a cell is too hot
	// to include in a cool walking route.
	minGreenScoreForRoute = 15.0

	// maxRouteWaypoints caps the number of stops in a generated route.
	maxRouteWaypoints = 20
)

// CoolRouteUseCase builds a "serin yürüyüş" (cool walking) route through
// the highest-greenery cells of a completed scan.
type CoolRouteUseCase struct {
	repo airlens.Repository
}

// NewCoolRouteUseCase creates a CoolRouteUseCase backed by the given repository.
func NewCoolRouteUseCase(repo airlens.Repository) *CoolRouteUseCase {
	return &CoolRouteUseCase{repo: repo}
}

// Execute builds a greedy nearest-neighbour route through the top-green cells
// in a scan, starting from the cell with the highest green score.
func (uc *CoolRouteUseCase) Execute(ctx context.Context, scanID string) (*airlens.CoolRoute, error) {
	cells, err := uc.repo.GetCellsByScan(ctx, scanID)
	if err != nil {
		return nil, fmt.Errorf("failed to get cells for cool route: %w", err)
	}

	// Filter to only cells that are "cool enough"
	var candidates []airlens.GridCell
	for _, c := range cells {
		if c.GreenScore >= minGreenScoreForRoute {
			candidates = append(candidates, c)
		}
	}

	if len(candidates) == 0 {
		return nil, fmt.Errorf("no green cells found in scan %s — district may need urgent planting", scanID)
	}

	// Sort descending by green score; limit to maxRouteWaypoints
	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].GreenScore > candidates[j].GreenScore
	})
	if len(candidates) > maxRouteWaypoints {
		candidates = candidates[:maxRouteWaypoints]
	}

	// Build route with greedy nearest-neighbour heuristic starting at greenest cell
	route := buildNearestNeighbourRoute(candidates)

	return route, nil
}

// buildNearestNeighbourRoute constructs a path that visits all candidate cells
// exactly once by always moving to the closest unvisited cell.
func buildNearestNeighbourRoute(cells []airlens.GridCell) *airlens.CoolRoute {
	n := len(cells)
	visited := make([]bool, n)
	waypoints := make([]airlens.Waypoint, 0, n)

	// Start at the greenest cell (index 0, already sorted)
	current := 0
	visited[0] = true
	waypoints = append(waypoints, airlens.Waypoint{
		Lat:        cells[0].Lat,
		Lng:        cells[0].Lng,
		GreenScore: cells[0].GreenScore,
		Order:      1,
	})

	for step := 1; step < n; step++ {
		nearest := -1
		nearestDist := math.MaxFloat64

		for j := 0; j < n; j++ {
			if visited[j] {
				continue
			}
			dist := haversineM(cells[current].Lat, cells[current].Lng,
				cells[j].Lat, cells[j].Lng)
			if dist < nearestDist {
				nearestDist = dist
				nearest = j
			}
		}

		if nearest < 0 {
			break
		}
		visited[nearest] = true
		current = nearest
		waypoints = append(waypoints, airlens.Waypoint{
			Lat:        cells[nearest].Lat,
			Lng:        cells[nearest].Lng,
			GreenScore: cells[nearest].GreenScore,
			Order:      step + 1,
		})
	}

	// Compute route statistics
	totalDist := 0.0
	for i := 1; i < len(waypoints); i++ {
		totalDist += haversineM(
			waypoints[i-1].Lat, waypoints[i-1].Lng,
			waypoints[i].Lat, waypoints[i].Lng,
		)
	}

	avgGreen := 0.0
	for _, wp := range waypoints {
		avgGreen += wp.GreenScore
	}
	avgGreen /= float64(len(waypoints))

	return &airlens.CoolRoute{
		Waypoints:     waypoints,
		TotalDistance: totalDist,
		AvgGreenScore: avgGreen,
		Description:   buildRouteDescription(avgGreen, totalDist, len(waypoints)),
	}
}

// buildRouteDescription creates a human-readable summary for the cool route.
func buildRouteDescription(avgGreen, distM float64, stops int) string {
	distKm := distM / 1000.0
	qualifier := "hafif yeşil"
	switch {
	case avgGreen >= 40:
		qualifier = "çok serin ve gölgeli"
	case avgGreen >= 25:
		qualifier = "serin ve yeşil"
	case avgGreen >= 15:
		qualifier = "görece yeşil"
	}
	return fmt.Sprintf("%.1f km uzunluğunda, %d durak noktalı, %s yürüyüş rotası (ortalama yeşillik: %.0f%%)",
		distKm, stops, qualifier, avgGreen)
}
