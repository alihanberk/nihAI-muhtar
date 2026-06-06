// Package cache is extended with AirlensCache for green-score coordinate lookups.
// Scores are valid for 30 days — vegetation changes slowly enough that monthly
// refreshes are sufficient for heat-risk mapping purposes.
package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	airlensGeoKey      = "airlens:geo"
	airlensScorePrefix = "airlens:score:"
	// airlensProximity is the cache-hit radius for green scores.
	// 200 m matches the grid spacing so any re-query of the same cell hits.
	airlensProximity = 200.0
	// airlensTTL is 30 days — adequate for seasonal vegetation stability.
	airlensTTL = 30 * 24 * time.Hour
)

// CachedGreenScore is the payload stored per AirLens coordinate.
type CachedGreenScore struct {
	GreenScore    float64 `json:"green_score"`
	VegetationPct float64 `json:"vegetation_pct"`
	SkyPct        float64 `json:"sky_pct"`
	BuildingPct   float64 `json:"building_pct"`
	RoadPct       float64 `json:"road_pct"`
	SidewalkPct   float64 `json:"sidewalk_pct"`
	HeatRisk      string  `json:"heat_risk"`
	CachedAt      int64   `json:"cached_at"`
}

// AirlensCache wraps a Redis client for 30-day green-score proximity caching.
type AirlensCache struct {
	rdb *redis.Client
}

// NewAirlensCache creates an AirlensCache backed by the given Redis client.
func NewAirlensCache(rdb *redis.Client) *AirlensCache {
	return &AirlensCache{rdb: rdb}
}

// Get searches for a cached green score within 200 m of the given coordinate.
// Returns the score and true on a cache hit; nil and false on a miss.
func (c *AirlensCache) Get(ctx context.Context, lat, lng float64) (*CachedGreenScore, bool) {
	locations, err := c.rdb.GeoSearch(ctx, airlensGeoKey, &redis.GeoSearchQuery{
		Longitude:  lng,
		Latitude:   lat,
		Radius:     airlensProximity,
		RadiusUnit: "m",
		Sort:       "ASC",
		Count:      1,
	}).Result()
	if err != nil || len(locations) == 0 {
		return nil, false
	}

	memberKey := fmt.Sprintf("%s%s", airlensScorePrefix, locations[0])
	data, err := c.rdb.Get(ctx, memberKey).Bytes()
	if err != nil {
		return nil, false
	}

	var score CachedGreenScore
	if err := json.Unmarshal(data, &score); err != nil {
		return nil, false
	}
	return &score, true
}

// Set stores a green score in Redis associated with the given coordinate.
func (c *AirlensCache) Set(ctx context.Context, lat, lng float64, score CachedGreenScore) error {
	score.CachedAt = time.Now().UTC().Unix()
	memberID := airlensCoordKey(lat, lng)

	if err := c.rdb.GeoAdd(ctx, airlensGeoKey, &redis.GeoLocation{
		Name:      memberID,
		Latitude:  lat,
		Longitude: lng,
	}).Err(); err != nil {
		return fmt.Errorf("airlens geo add: %w", err)
	}

	data, err := json.Marshal(score)
	if err != nil {
		return fmt.Errorf("airlens marshal: %w", err)
	}

	memberKey := fmt.Sprintf("%s%s", airlensScorePrefix, memberID)
	if err := c.rdb.Set(ctx, memberKey, data, airlensTTL).Err(); err != nil {
		return fmt.Errorf("airlens set score: %w", err)
	}
	return nil
}

func airlensCoordKey(lat, lng float64) string {
	return fmt.Sprintf("%.5f_%.5f", lat, lng)
}
