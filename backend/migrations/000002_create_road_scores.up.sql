-- Enable PostGIS if available (optional — falls back gracefully)
-- For standard postgres:16-alpine, the geometry column is omitted.
-- Uncomment the line below if using postgis/postgis image:
-- CREATE EXTENSION IF NOT EXISTS postgis;

-- route_analyses stores the top-level origin→destination analysis request
CREATE TABLE IF NOT EXISTS route_analyses (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    origin_lat          DOUBLE PRECISION NOT NULL,
    origin_lng          DOUBLE PRECISION NOT NULL,
    destination_lat     DOUBLE PRECISION NOT NULL,
    destination_lng     DOUBLE PRECISION NOT NULL,
    origin_address      TEXT NOT NULL DEFAULT '',
    destination_address TEXT NOT NULL DEFAULT '',
    status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','processing','completed','failed')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- road_score_routes holds the three alternative routes per analysis
CREATE TABLE IF NOT EXISTS road_score_routes (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id      UUID NOT NULL REFERENCES route_analyses(id) ON DELETE CASCADE,
    route_index      INTEGER NOT NULL,
    route_type       VARCHAR(20) NOT NULL DEFAULT 'fastest'
                         CHECK (route_type IN ('fastest','healthiest','balanced')),
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    distance_meters  INTEGER NOT NULL DEFAULT 0,
    damage_score     DOUBLE PRECISION NOT NULL DEFAULT 0
                         CHECK (damage_score >= 0 AND damage_score <= 100),
    segment_count    INTEGER NOT NULL DEFAULT 0,
    encoded_polyline TEXT NOT NULL DEFAULT '',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- road_score_segments holds per-coordinate AI damage results.
-- lat/lng stored as DOUBLE PRECISION for broad compatibility.
-- A geometry(POINT,4326) column can be added later with PostGIS.
CREATE TABLE IF NOT EXISTS road_score_segments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id        UUID NOT NULL REFERENCES road_score_routes(id) ON DELETE CASCADE,
    lat             DOUBLE PRECISION NOT NULL,
    lng             DOUBLE PRECISION NOT NULL,
    damage_score    DOUBLE PRECISION NOT NULL DEFAULT 0
                        CHECK (damage_score >= 0 AND damage_score <= 100),
    damage_category VARCHAR(20) NOT NULL DEFAULT 'GOOD'
                        CHECK (damage_category IN ('GOOD','FAIR','POOR','CRITICAL')),
    heading         DOUBLE PRECISION NOT NULL DEFAULT 0,
    confidence      DOUBLE PRECISION NOT NULL DEFAULT 0,
    segment_order   INTEGER NOT NULL DEFAULT 0,
    cached          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for proximity queries via lat/lng (replaces GIST when PostGIS unavailable)
CREATE INDEX IF NOT EXISTS idx_segments_lat_lng
    ON road_score_segments (lat, lng);

CREATE INDEX IF NOT EXISTS idx_segments_route_id
    ON road_score_segments (route_id, segment_order);

CREATE INDEX IF NOT EXISTS idx_routes_analysis_id
    ON road_score_routes (analysis_id);

CREATE INDEX IF NOT EXISTS idx_analyses_status
    ON route_analyses (status, created_at DESC);

-- Auto-update updated_at on route_analyses
CREATE OR REPLACE FUNCTION update_route_analyses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_route_analyses_updated_at
    BEFORE UPDATE ON route_analyses
    FOR EACH ROW EXECUTE FUNCTION update_route_analyses_updated_at();
