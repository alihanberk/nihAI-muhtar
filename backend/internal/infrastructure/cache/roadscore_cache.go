// Package cache provides Redis-backed caching for road segment scores.
// Coordinates are stored in a Redis GEO set, enabling O(log N) radius queries.
// Any coordinate within 500 m of a cached entry reuses its score, preventing
// redundant Street View and HuggingFace API calls.
package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	geoSetKey      = "roadscore:geo"
	scoreKeyPrefix = "roadscore:score:"
	// cacheTTL is how long a cached segment score remains valid.
	cacheTTL = 7 * 24 * time.Hour // 1 week
	// proximityMeters is the cache hit radius — matches the task spec.
	proximityMeters = 500.0
)

// CachedScore is the payload stored per coordinate.
type CachedScore struct {
	DamageScore float64 `json:"damage_score"`
	Category    string  `json:"category"`
	Confidence  float64 `json:"confidence"`
	CachedAt    int64   `json:"cached_at"`
}

// RoadScoreCache wraps a Redis client for coordinate-proximity lookups.
type RoadScoreCache struct {
	rdb *redis.Client
}

// NewRoadScoreCache creates a cache backed by the given Redis client.
func NewRoadScoreCache(rdb *redis.Client) *RoadScoreCache {
	return &RoadScoreCache{rdb: rdb}
}

// Get searches for a cached score within 500 m of the given coordinate.
// Returns the score and true on a cache hit, or nil and false on a miss.
func (c *RoadScoreCache) Get(ctx context.Context, lat, lng float64) (*CachedScore, bool) {
	// GEOSEARCH returns members within the specified radius
	result, err := c.rdb.GeoSearchStore(ctx, geoSetKey, geoSetKey, &redis.GeoSearchStoreQuery{
		GeoSearchQuery: redis.GeoSearchQuery{
			Longitude:  lng,
			Latitude:   lat,
			Radius:     proximityMeters,
			RadiusUnit: "m",
			Sort:       "ASC",
			Count:      1,
		},
	}).Result()
	if err != nil || result == 0 {
		return c.getViaSearch(ctx, lat, lng)
	}
	return nil, false
}

// getViaSearch performs the actual GEOSEARCH without storing results.
func (c *RoadScoreCache) getViaSearch(ctx context.Context, lat, lng float64) (*CachedScore, bool) {
	locations, err := c.rdb.GeoSearch(ctx, geoSetKey, &redis.GeoSearchQuery{
		Longitude:  lng,
		Latitude:   lat,
		Radius:     proximityMeters,
		RadiusUnit: "m",
		Sort:       "ASC",
		Count:      1,
	}).Result()
	if err != nil || len(locations) == 0 {
		return nil, false
	}

	memberKey := fmt.Sprintf("%s%s", scoreKeyPrefix, locations[0])
	data, err := c.rdb.Get(ctx, memberKey).Bytes()
	if err != nil {
		return nil, false
	}

	var score CachedScore
	if err := json.Unmarshal(data, &score); err != nil {
		return nil, false
	}
	return &score, true
}

// Set stores a segment score in Redis associated with the given coordinate.
// The coordinate is added to the GEO set for fast proximity lookups.
func (c *RoadScoreCache) Set(ctx context.Context, lat, lng float64, score CachedScore) error {
	score.CachedAt = time.Now().UTC().Unix()

	memberID := coordinateKey(lat, lng)

	// Add the coordinate to the GEO set
	if err := c.rdb.GeoAdd(ctx, geoSetKey, &redis.GeoLocation{
		Name:      memberID,
		Latitude:  lat,
		Longitude: lng,
	}).Err(); err != nil {
		return fmt.Errorf("failed to add geo entry: %w", err)
	}

	data, err := json.Marshal(score)
	if err != nil {
		return fmt.Errorf("failed to marshal cached score: %w", err)
	}

	memberKey := fmt.Sprintf("%s%s", scoreKeyPrefix, memberID)
	if err := c.rdb.Set(ctx, memberKey, data, cacheTTL).Err(); err != nil {
		return fmt.Errorf("failed to set cached score: %w", err)
	}

	return nil
}

// coordinateKey builds a stable string key from a lat/lng pair.
func coordinateKey(lat, lng float64) string {
	return fmt.Sprintf("%.5f_%.5f", lat, lng)
}
