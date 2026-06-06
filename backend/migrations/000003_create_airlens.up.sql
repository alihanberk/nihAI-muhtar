-- AirLens module: street-level greenery scoring and heat-risk mapping.
-- Each district scan produces one airlens_scans record and many airlens_grid_cells.
-- Only aggregated scores are stored — raw imagery is discarded after processing (KVKK).

CREATE TABLE IF NOT EXISTS airlens_scans (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    district_name   VARCHAR(255) NOT NULL,
    center_lat      DOUBLE PRECISION NOT NULL,
    center_lng      DOUBLE PRECISION NOT NULL,
    radius_meters   INTEGER     NOT NULL,
    total_cells     INTEGER     NOT NULL DEFAULT 0,
    scored_cells    INTEGER     NOT NULL DEFAULT 0,
    avg_green_score DOUBLE PRECISION,
    heat_risk_level VARCHAR(20),
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','processing','completed','failed')),
    duration_ms     BIGINT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS airlens_grid_cells (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id         UUID        NOT NULL REFERENCES airlens_scans(id) ON DELETE CASCADE,
    lat             DOUBLE PRECISION NOT NULL,
    lng             DOUBLE PRECISION NOT NULL,
    -- Pixel class breakdown (all 0–100, sum ≤ 100)
    green_score     DOUBLE PRECISION NOT NULL DEFAULT 0,
    vegetation_pct  DOUBLE PRECISION NOT NULL DEFAULT 0,
    sky_pct         DOUBLE PRECISION NOT NULL DEFAULT 0,
    building_pct    DOUBLE PRECISION NOT NULL DEFAULT 0,
    road_pct        DOUBLE PRECISION NOT NULL DEFAULT 0,
    sidewalk_pct    DOUBLE PRECISION NOT NULL DEFAULT 0,
    -- Derived metrics
    concrete_ratio  DOUBLE PRECISION NOT NULL DEFAULT 0, -- building + road + sidewalk
    heat_risk       VARCHAR(20) NOT NULL DEFAULT 'LOW'
                        CHECK (heat_risk IN ('LOW','MODERATE','HIGH','CRITICAL')),
    from_cache      BOOLEAN     NOT NULL DEFAULT FALSE,
    processed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_airlens_cells_scan_id
    ON airlens_grid_cells(scan_id);

CREATE INDEX IF NOT EXISTS idx_airlens_cells_coords
    ON airlens_grid_cells(lat, lng);

CREATE INDEX IF NOT EXISTS idx_airlens_cells_green_score
    ON airlens_grid_cells(green_score DESC);

CREATE INDEX IF NOT EXISTS idx_airlens_cells_heat_risk
    ON airlens_grid_cells(heat_risk);
