-- FacadeScore Module: Building facade structural analysis tables
-- Migration 000003

-- facade_analysis_jobs: district-level batch analysis tracking
CREATE TABLE IF NOT EXISTS facade_analysis_jobs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    district    TEXT NOT NULL,
    center_lat  DOUBLE PRECISION NOT NULL,
    center_lng  DOUBLE PRECISION NOT NULL,
    radius_m    INTEGER NOT NULL DEFAULT 500,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','processing','completed','failed')),
    total_count INTEGER NOT NULL DEFAULT 0,
    done_count  INTEGER NOT NULL DEFAULT 0,
    error_msg   TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- facade_buildings: per-building analysis result
CREATE TABLE IF NOT EXISTS facade_buildings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id              UUID NOT NULL REFERENCES facade_analysis_jobs(id) ON DELETE CASCADE,
    district            TEXT NOT NULL,
    address             TEXT NOT NULL DEFAULT '',
    lat                 DOUBLE PRECISION NOT NULL,
    lng                 DOUBLE PRECISION NOT NULL,
    heading             DOUBLE PRECISION NOT NULL DEFAULT 0,
    street_view_url     TEXT NOT NULL DEFAULT '',
    health_score        DOUBLE PRECISION NOT NULL DEFAULT 0
                            CHECK (health_score >= 0 AND health_score <= 100),
    risk_level          VARCHAR(20) NOT NULL DEFAULT 'HEALTHY'
                            CHECK (risk_level IN ('HEALTHY','ATTENTION','RISKY','EMERGENCY')),
    defect_count        INTEGER NOT NULL DEFAULT 0,
    needs_human_review  BOOLEAN NOT NULL DEFAULT FALSE,
    analysis_year       INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_TIMESTAMP),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- facade_defects: individual defect detections per building
CREATE TABLE IF NOT EXISTS facade_defects (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    building_id  UUID NOT NULL REFERENCES facade_buildings(id) ON DELETE CASCADE,
    defect_type  VARCHAR(50) NOT NULL
                     CHECK (defect_type IN (
                         'structural_crack','spalling','corrosion_stain',
                         'deformed_balcony','damaged_fire_escape',
                         'building_tilt','frame_deformation'
                     )),
    severity     SMALLINT NOT NULL DEFAULT 1 CHECK (severity BETWEEN 1 AND 5),
    confidence   DOUBLE PRECISION NOT NULL DEFAULT 0
                     CHECK (confidence >= 0 AND confidence <= 1),
    uncertain    BOOLEAN NOT NULL DEFAULT FALSE,
    bbox_xmin    INTEGER NOT NULL DEFAULT 0,
    bbox_ymin    INTEGER NOT NULL DEFAULT 0,
    bbox_xmax    INTEGER NOT NULL DEFAULT 640,
    bbox_ymax    INTEGER NOT NULL DEFAULT 480,
    label        TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- facade_citizen_reports: crowdsourced mobile damage reports (KVKK: no PII)
CREATE TABLE IF NOT EXISTS facade_citizen_reports (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    building_id  UUID REFERENCES facade_buildings(id) ON DELETE SET NULL,
    lat          DOUBLE PRECISION NOT NULL,
    lng          DOUBLE PRECISION NOT NULL,
    description  TEXT NOT NULL,
    photo_url    TEXT NOT NULL DEFAULT '',
    status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','reviewed','dismissed')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_facade_jobs_district
    ON facade_analysis_jobs (district, status);

CREATE INDEX IF NOT EXISTS idx_facade_buildings_district
    ON facade_buildings (district, health_score DESC);

CREATE INDEX IF NOT EXISTS idx_facade_buildings_job
    ON facade_buildings (job_id);

CREATE INDEX IF NOT EXISTS idx_facade_buildings_risk
    ON facade_buildings (risk_level, health_score DESC);

CREATE INDEX IF NOT EXISTS idx_facade_buildings_lat_lng
    ON facade_buildings (lat, lng);

CREATE INDEX IF NOT EXISTS idx_facade_defects_building
    ON facade_defects (building_id, severity DESC);

CREATE INDEX IF NOT EXISTS idx_facade_defects_uncertain
    ON facade_defects (uncertain) WHERE uncertain = TRUE;

CREATE INDEX IF NOT EXISTS idx_citizen_reports_building
    ON facade_citizen_reports (building_id, created_at DESC);

-- Auto-update triggers
CREATE OR REPLACE FUNCTION update_facade_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_facade_jobs_updated_at ON facade_analysis_jobs;
CREATE TRIGGER trg_facade_jobs_updated_at
    BEFORE UPDATE ON facade_analysis_jobs
    FOR EACH ROW EXECUTE FUNCTION update_facade_updated_at();

DROP TRIGGER IF EXISTS trg_facade_buildings_updated_at ON facade_buildings;
CREATE TRIGGER trg_facade_buildings_updated_at
    BEFORE UPDATE ON facade_buildings
    FOR EACH ROW EXECUTE FUNCTION update_facade_updated_at();
