package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"

	"github.com/nihai-muhtar/backend/internal/domain/facadescore"
)

// FacadeScoreRepository implements facadescore.Repository using PostgreSQL.
type FacadeScoreRepository struct {
	db *sqlx.DB
}

// NewFacadeScoreRepository creates a FacadeScoreRepository.
func NewFacadeScoreRepository(db *sqlx.DB) *FacadeScoreRepository {
	return &FacadeScoreRepository{db: db}
}

// ─── Job management ──────────────────────────────────────────────────────────

func (r *FacadeScoreRepository) CreateJob(ctx context.Context, job *facadescore.AnalysisJob) error {
	query := `
		INSERT INTO facade_analysis_jobs
			(district, center_lat, center_lng, radius_m, status, total_count, done_count)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at, updated_at`

	return r.db.QueryRowContext(ctx, query,
		job.District, job.CenterLat, job.CenterLng, job.RadiusM,
		job.Status, job.TotalCount, job.DoneCount,
	).Scan(&job.ID, &job.CreatedAt, &job.UpdatedAt)
}

func (r *FacadeScoreRepository) GetJob(ctx context.Context, jobID string) (*facadescore.AnalysisJob, error) {
	var job facadescore.AnalysisJob
	query := `SELECT id, district, center_lat, center_lng, radius_m, status,
	           total_count, done_count, error_msg, created_at, updated_at
	           FROM facade_analysis_jobs WHERE id = $1`
	if err := r.db.GetContext(ctx, &job, query, jobID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("job %s not found", jobID)
		}
		return nil, fmt.Errorf("failed to get job: %w", err)
	}
	return &job, nil
}

func (r *FacadeScoreRepository) UpdateJobStatus(ctx context.Context, jobID string, status facadescore.JobStatus) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE facade_analysis_jobs SET status = $1, updated_at = $2 WHERE id = $3`,
		status, time.Now().UTC(), jobID,
	)
	return err
}

func (r *FacadeScoreRepository) IncrementJobDone(ctx context.Context, jobID string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE facade_analysis_jobs SET done_count = done_count + 1, updated_at = $1 WHERE id = $2`,
		time.Now().UTC(), jobID,
	)
	return err
}

// ─── Building analysis ───────────────────────────────────────────────────────

func (r *FacadeScoreRepository) CreateBuilding(ctx context.Context, b *facadescore.BuildingAnalysis) error {
	query := `
		INSERT INTO facade_buildings
			(job_id, district, address, lat, lng, heading, street_view_url,
			 health_score, risk_level, defect_count, needs_human_review, analysis_year)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		RETURNING id, created_at, updated_at`

	return r.db.QueryRowContext(ctx, query,
		b.JobID, b.District, b.Address, b.Lat, b.Lng, b.Heading,
		b.StreetViewURL, b.HealthScore, b.RiskLevel, b.DefectCount,
		b.NeedsHumanReview, b.AnalysisYear,
	).Scan(&b.ID, &b.CreatedAt, &b.UpdatedAt)
}

func (r *FacadeScoreRepository) UpdateBuilding(ctx context.Context, b *facadescore.BuildingAnalysis) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE facade_buildings SET
			health_score = $1,
			risk_level = $2,
			defect_count = $3,
			needs_human_review = $4,
			updated_at = $5
		WHERE id = $6`,
		b.HealthScore, b.RiskLevel, b.DefectCount,
		b.NeedsHumanReview, time.Now().UTC(), b.ID,
	)
	return err
}

func (r *FacadeScoreRepository) GetBuilding(ctx context.Context, buildingID string) (*facadescore.BuildingAnalysis, error) {
	var b facadescore.BuildingAnalysis
	query := `SELECT id, job_id, district, address, lat, lng, heading, street_view_url,
	           health_score, risk_level, defect_count, needs_human_review, analysis_year,
	           created_at, updated_at
	           FROM facade_buildings WHERE id = $1`
	if err := r.db.GetContext(ctx, &b, query, buildingID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("building %s not found", buildingID)
		}
		return nil, fmt.Errorf("failed to get building: %w", err)
	}

	defects, err := r.ListDefectsByBuilding(ctx, buildingID)
	if err == nil {
		for _, d := range defects {
			b.Defects = append(b.Defects, *d)
		}
	}

	return &b, nil
}

func (r *FacadeScoreRepository) ListBuildingsByDistrict(ctx context.Context, district string) ([]*facadescore.BuildingAnalysis, error) {
	query := `SELECT id, job_id, district, address, lat, lng, heading, street_view_url,
	           health_score, risk_level, defect_count, needs_human_review, analysis_year,
	           created_at, updated_at
	           FROM facade_buildings WHERE district = $1
	           ORDER BY health_score DESC`
	var buildings []*facadescore.BuildingAnalysis
	if err := r.db.SelectContext(ctx, &buildings, query, district); err != nil {
		return nil, fmt.Errorf("failed to list buildings by district: %w", err)
	}
	return buildings, nil
}

func (r *FacadeScoreRepository) ListBuildingsByJob(ctx context.Context, jobID string) ([]*facadescore.BuildingAnalysis, error) {
	query := `SELECT id, job_id, district, address, lat, lng, heading, street_view_url,
	           health_score, risk_level, defect_count, needs_human_review, analysis_year,
	           created_at, updated_at
	           FROM facade_buildings WHERE job_id = $1
	           ORDER BY health_score DESC`
	var buildings []*facadescore.BuildingAnalysis
	if err := r.db.SelectContext(ctx, &buildings, query, jobID); err != nil {
		return nil, fmt.Errorf("failed to list buildings by job: %w", err)
	}
	return buildings, nil
}

func (r *FacadeScoreRepository) GetPriorityBuildings(ctx context.Context, limit int) ([]*facadescore.BuildingAnalysis, error) {
	query := `SELECT id, job_id, district, address, lat, lng, heading, street_view_url,
	           health_score, risk_level, defect_count, needs_human_review, analysis_year,
	           created_at, updated_at
	           FROM facade_buildings
	           WHERE risk_level IN ('RISKY','EMERGENCY')
	           ORDER BY health_score DESC
	           LIMIT $1`
	var buildings []*facadescore.BuildingAnalysis
	if err := r.db.SelectContext(ctx, &buildings, query, limit); err != nil {
		return nil, fmt.Errorf("failed to get priority buildings: %w", err)
	}
	return buildings, nil
}

// ─── Defects ─────────────────────────────────────────────────────────────────

func (r *FacadeScoreRepository) CreateDefect(ctx context.Context, d *facadescore.FacadeDefect) error {
	query := `
		INSERT INTO facade_defects
			(building_id, defect_type, severity, confidence, uncertain,
			 bbox_xmin, bbox_ymin, bbox_xmax, bbox_ymax, label)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		RETURNING id, created_at`

	return r.db.QueryRowContext(ctx, query,
		d.BuildingID, d.DefectType, d.Severity, d.Confidence, d.Uncertain,
		d.BoundingBox.XMin, d.BoundingBox.YMin, d.BoundingBox.XMax, d.BoundingBox.YMax,
		d.Label,
	).Scan(&d.ID, &d.CreatedAt)
}

// defectRow is an intermediate scan target for flat bounding box columns.
type defectRow struct {
	ID         string                   `db:"id"`
	BuildingID string                   `db:"building_id"`
	DefectType facadescore.DefectType   `db:"defect_type"`
	Severity   facadescore.SeverityScore `db:"severity"`
	Confidence float64                  `db:"confidence"`
	Uncertain  bool                     `db:"uncertain"`
	BboxXMin   int                      `db:"bbox_xmin"`
	BboxYMin   int                      `db:"bbox_ymin"`
	BboxXMax   int                      `db:"bbox_xmax"`
	BboxYMax   int                      `db:"bbox_ymax"`
	Label      string                   `db:"label"`
	CreatedAt  time.Time                `db:"created_at"`
}

func (r *FacadeScoreRepository) ListDefectsByBuilding(ctx context.Context, buildingID string) ([]*facadescore.FacadeDefect, error) {
	query := `SELECT id, building_id, defect_type, severity, confidence, uncertain,
	           bbox_xmin, bbox_ymin, bbox_xmax, bbox_ymax, label, created_at
	           FROM facade_defects WHERE building_id = $1 ORDER BY severity DESC`

	var rows []defectRow
	if err := r.db.SelectContext(ctx, &rows, query, buildingID); err != nil {
		return nil, fmt.Errorf("failed to list defects: %w", err)
	}

	defects := make([]*facadescore.FacadeDefect, len(rows))
	for i, row := range rows {
		defects[i] = &facadescore.FacadeDefect{
			ID:         row.ID,
			BuildingID: row.BuildingID,
			DefectType: row.DefectType,
			Severity:   row.Severity,
			Confidence: row.Confidence,
			Uncertain:  row.Uncertain,
			BoundingBox: facadescore.BoundingBox{
				XMin: row.BboxXMin,
				YMin: row.BboxYMin,
				XMax: row.BboxXMax,
				YMax: row.BboxYMax,
			},
			Label:     row.Label,
			CreatedAt: row.CreatedAt,
		}
	}
	return defects, nil
}

// ─── Citizen reports ─────────────────────────────────────────────────────────

func (r *FacadeScoreRepository) CreateCitizenReport(ctx context.Context, cr *facadescore.CitizenReport) error {
	query := `
		INSERT INTO facade_citizen_reports (building_id, lat, lng, description, photo_url, status)
		VALUES ($1,$2,$3,$4,$5,$6)
		RETURNING id, created_at`
	return r.db.QueryRowContext(ctx, query,
		cr.BuildingID, cr.Lat, cr.Lng, cr.Description, cr.PhotoURL, cr.Status,
	).Scan(&cr.ID, &cr.CreatedAt)
}

func (r *FacadeScoreRepository) ListCitizenReports(ctx context.Context, buildingID string) ([]*facadescore.CitizenReport, error) {
	query := `SELECT id, building_id, lat, lng, description, photo_url, status, created_at
	           FROM facade_citizen_reports WHERE building_id = $1 ORDER BY created_at DESC`
	var reports []*facadescore.CitizenReport
	if err := r.db.SelectContext(ctx, &reports, query, buildingID); err != nil {
		return nil, fmt.Errorf("failed to list citizen reports: %w", err)
	}
	return reports, nil
}

// ─── Heatmap aggregation ─────────────────────────────────────────────────────

func (r *FacadeScoreRepository) GetDistrictHeatmap(ctx context.Context, district string) (*facadescore.DistrictHeatmap, error) {
	query := `
		SELECT
			district,
			COUNT(*) AS total_buildings,
			COUNT(*) FILTER (WHERE risk_level = 'HEALTHY')   AS healthy_count,
			COUNT(*) FILTER (WHERE risk_level = 'ATTENTION') AS attention_count,
			COUNT(*) FILTER (WHERE risk_level = 'RISKY')     AS risky_count,
			COUNT(*) FILTER (WHERE risk_level = 'EMERGENCY') AS emergency_count,
			AVG(health_score)                                  AS avg_health_score,
			MAX(updated_at)                                    AS updated_at
		FROM facade_buildings
		WHERE district = $1
		GROUP BY district`

	var hm facadescore.DistrictHeatmap
	if err := r.db.GetContext(ctx, &hm, query, district); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return &facadescore.DistrictHeatmap{District: district}, nil
		}
		return nil, fmt.Errorf("failed to get heatmap for district %s: %w", district, err)
	}
	return &hm, nil
}

func (r *FacadeScoreRepository) ListAllDistrictHeatmaps(ctx context.Context) ([]*facadescore.DistrictHeatmap, error) {
	query := `
		SELECT
			district,
			COUNT(*) AS total_buildings,
			COUNT(*) FILTER (WHERE risk_level = 'HEALTHY')   AS healthy_count,
			COUNT(*) FILTER (WHERE risk_level = 'ATTENTION') AS attention_count,
			COUNT(*) FILTER (WHERE risk_level = 'RISKY')     AS risky_count,
			COUNT(*) FILTER (WHERE risk_level = 'EMERGENCY') AS emergency_count,
			AVG(health_score)                                  AS avg_health_score,
			MAX(updated_at)                                    AS updated_at
		FROM facade_buildings
		GROUP BY district
		ORDER BY avg_health_score DESC`

	var heatmaps []*facadescore.DistrictHeatmap
	if err := r.db.SelectContext(ctx, &heatmaps, query); err != nil {
		return nil, fmt.Errorf("failed to list district heatmaps: %w", err)
	}
	return heatmaps, nil
}

// ensure json import is used for future bounding box serialization hooks.
var _ = json.Marshal
