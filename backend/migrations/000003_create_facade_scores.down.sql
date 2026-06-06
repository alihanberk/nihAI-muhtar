-- Rollback FacadeScore Module (Migration 000003)

DROP TRIGGER IF EXISTS trg_facade_buildings_updated_at ON facade_buildings;
DROP TRIGGER IF EXISTS trg_facade_jobs_updated_at ON facade_analysis_jobs;
DROP FUNCTION IF EXISTS update_facade_updated_at();

DROP INDEX IF EXISTS idx_citizen_reports_building;
DROP INDEX IF EXISTS idx_facade_defects_uncertain;
DROP INDEX IF EXISTS idx_facade_defects_building;
DROP INDEX IF EXISTS idx_facade_buildings_lat_lng;
DROP INDEX IF EXISTS idx_facade_buildings_risk;
DROP INDEX IF EXISTS idx_facade_buildings_job;
DROP INDEX IF EXISTS idx_facade_buildings_district;
DROP INDEX IF EXISTS idx_facade_jobs_district;

DROP TABLE IF EXISTS facade_citizen_reports;
DROP TABLE IF EXISTS facade_defects;
DROP TABLE IF EXISTS facade_buildings;
DROP TABLE IF EXISTS facade_analysis_jobs;
