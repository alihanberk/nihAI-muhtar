package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"

	"github.com/nihai-muhtar/backend/internal/domain/airlens"
)

// AirlensRepo implements airlens.Repository using PostgreSQL.
type AirlensRepo struct {
	db *sqlx.DB
}

// NewAirlensRepository creates an AirlensRepo backed by the given database pool.
func NewAirlensRepository(db *sqlx.DB) *AirlensRepo {
	return &AirlensRepo{db: db}
}

// CreateScan inserts a new district scan record and populates scan.ID.
func (r *AirlensRepo) CreateScan(ctx context.Context, scan *airlens.Scan) error {
	query := `
		INSERT INTO airlens_scans
			(district_name, center_lat, center_lng, radius_meters, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id`

	return r.db.QueryRowContext(ctx, query,
		scan.DistrictName,
		scan.CenterLat, scan.CenterLng,
		scan.RadiusMeters,
		string(airlens.ScanStatusPending),
		time.Now().UTC(),
	).Scan(&scan.ID)
}

// UpdateScan writes the final statistics and status back to an existing scan.
func (r *AirlensRepo) UpdateScan(ctx context.Context, scan *airlens.Scan) error {
	query := `
		UPDATE airlens_scans SET
			total_cells     = $1,
			scored_cells    = $2,
			avg_green_score = $3,
			heat_risk_level = $4,
			status          = $5,
			duration_ms     = $6,
			completed_at    = $7
		WHERE id = $8`

	var completedAt *time.Time
	if scan.Status == airlens.ScanStatusCompleted || scan.Status == airlens.ScanStatusFailed {
		now := time.Now().UTC()
		completedAt = &now
	}

	_, err := r.db.ExecContext(ctx, query,
		scan.TotalCells,
		scan.ScoredCells,
		scan.AvgGreenScore,
		string(scan.HeatRiskLevel),
		string(scan.Status),
		scan.DurationMs,
		completedAt,
		scan.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update airlens scan: %w", err)
	}
	return nil
}

// GetScan retrieves a scan with all its grid cells.
func (r *AirlensRepo) GetScan(ctx context.Context, id string) (*airlens.Scan, error) {
	query := `
		SELECT id, district_name, center_lat, center_lng, radius_meters,
		       total_cells, scored_cells, avg_green_score, heat_risk_level,
		       status, duration_ms, created_at, completed_at
		FROM airlens_scans
		WHERE id = $1`

	scan := &airlens.Scan{}
	var (
		heatRiskStr string
		statusStr   string
		completedAt sql.NullTime
		durationMs  sql.NullInt64
		avgGreen    sql.NullFloat64
	)
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&scan.ID, &scan.DistrictName,
		&scan.CenterLat, &scan.CenterLng,
		&scan.RadiusMeters,
		&scan.TotalCells, &scan.ScoredCells,
		&avgGreen, &heatRiskStr,
		&statusStr, &durationMs,
		&scan.CreatedAt, &completedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("airlens scan not found: %s", id)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get airlens scan: %w", err)
	}

	scan.HeatRiskLevel = airlens.HeatRiskLevel(heatRiskStr)
	scan.Status = airlens.ScanStatus(statusStr)
	if avgGreen.Valid {
		scan.AvgGreenScore = avgGreen.Float64
	}
	if durationMs.Valid {
		scan.DurationMs = durationMs.Int64
	}
	if completedAt.Valid {
		t := completedAt.Time
		scan.CompletedAt = &t
	}

	cells, err := r.GetCellsByScan(ctx, id)
	if err != nil {
		return nil, err
	}
	scan.Cells = cells

	return scan, nil
}

// ListScans returns recent scans for a district, newest first.
func (r *AirlensRepo) ListScans(ctx context.Context, districtName string, limit int) ([]airlens.Scan, error) {
	query := `
		SELECT id, district_name, center_lat, center_lng, radius_meters,
		       total_cells, scored_cells, avg_green_score, heat_risk_level,
		       status, duration_ms, created_at, completed_at
		FROM airlens_scans
		WHERE district_name = $1
		ORDER BY created_at DESC
		LIMIT $2`

	rows, err := r.db.QueryContext(ctx, query, districtName, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to list airlens scans: %w", err)
	}
	defer rows.Close()

	// Initialise as empty slice so JSON serialises to [] rather than null.
	scans := make([]airlens.Scan, 0)
	for rows.Next() {
		var (
			scan        airlens.Scan
			heatRiskStr string
			statusStr   string
			completedAt sql.NullTime
			durationMs  sql.NullInt64
			avgGreen    sql.NullFloat64
		)
		if err := rows.Scan(
			&scan.ID, &scan.DistrictName,
			&scan.CenterLat, &scan.CenterLng,
			&scan.RadiusMeters,
			&scan.TotalCells, &scan.ScoredCells,
			&avgGreen, &heatRiskStr,
			&statusStr, &durationMs,
			&scan.CreatedAt, &completedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan airlens scan row: %w", err)
		}
		scan.HeatRiskLevel = airlens.HeatRiskLevel(heatRiskStr)
		scan.Status = airlens.ScanStatus(statusStr)
		if avgGreen.Valid {
			scan.AvgGreenScore = avgGreen.Float64
		}
		if durationMs.Valid {
			scan.DurationMs = durationMs.Int64
		}
		if completedAt.Valid {
			t := completedAt.Time
			scan.CompletedAt = &t
		}
		scans = append(scans, scan)
	}
	return scans, rows.Err()
}

// SaveCell persists a single scored grid cell.
func (r *AirlensRepo) SaveCell(ctx context.Context, cell *airlens.GridCell) error {
	query := `
		INSERT INTO airlens_grid_cells
			(scan_id, lat, lng,
			 green_score, vegetation_pct, sky_pct, building_pct, road_pct, sidewalk_pct,
			 concrete_ratio, heat_risk, from_cache, processed_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING id`

	return r.db.QueryRowContext(ctx, query,
		cell.ScanID,
		cell.Lat, cell.Lng,
		cell.GreenScore,
		cell.VegetationPct, cell.SkyPct,
		cell.BuildingPct, cell.RoadPct, cell.SidewalkPct,
		cell.ConcreteRatio,
		string(cell.HeatRisk),
		cell.FromCache,
		time.Now().UTC(),
	).Scan(&cell.ID)
}

// GetCellsByScan returns all grid cells for a scan.
func (r *AirlensRepo) GetCellsByScan(ctx context.Context, scanID string) ([]airlens.GridCell, error) {
	return r.queryCells(ctx, `
		SELECT id, scan_id, lat, lng,
		       green_score, vegetation_pct, sky_pct, building_pct, road_pct, sidewalk_pct,
		       concrete_ratio, heat_risk, from_cache, processed_at
		FROM airlens_grid_cells
		WHERE scan_id = $1
		ORDER BY processed_at`, scanID)
}

// GetTopGreenCells returns the N highest-scored cells in a scan.
func (r *AirlensRepo) GetTopGreenCells(ctx context.Context, scanID string, n int) ([]airlens.GridCell, error) {
	return r.queryCellsN(ctx, `
		SELECT id, scan_id, lat, lng,
		       green_score, vegetation_pct, sky_pct, building_pct, road_pct, sidewalk_pct,
		       concrete_ratio, heat_risk, from_cache, processed_at
		FROM airlens_grid_cells
		WHERE scan_id = $1
		ORDER BY green_score DESC
		LIMIT $2`, scanID, n)
}

// GetHotspotCells returns the N highest heat-risk cells in a scan.
func (r *AirlensRepo) GetHotspotCells(ctx context.Context, scanID string, n int) ([]airlens.GridCell, error) {
	return r.queryCellsN(ctx, `
		SELECT id, scan_id, lat, lng,
		       green_score, vegetation_pct, sky_pct, building_pct, road_pct, sidewalk_pct,
		       concrete_ratio, heat_risk, from_cache, processed_at
		FROM airlens_grid_cells
		WHERE scan_id = $1
		ORDER BY concrete_ratio DESC, green_score ASC
		LIMIT $2`, scanID, n)
}

// ─── Private helpers ──────────────────────────────────────────────────────────

func (r *AirlensRepo) queryCells(ctx context.Context, query string, args ...any) ([]airlens.GridCell, error) {
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query airlens cells: %w", err)
	}
	defer rows.Close()
	return scanCellRows(rows)
}

func (r *AirlensRepo) queryCellsN(ctx context.Context, query string, scanID string, n int) ([]airlens.GridCell, error) {
	rows, err := r.db.QueryContext(ctx, query, scanID, n)
	if err != nil {
		return nil, fmt.Errorf("failed to query airlens cells: %w", err)
	}
	defer rows.Close()
	return scanCellRows(rows)
}

func scanCellRows(rows *sql.Rows) ([]airlens.GridCell, error) {
	// Initialise as empty slice so JSON serialises to [] rather than null.
	cells := make([]airlens.GridCell, 0)
	for rows.Next() {
		var (
			cell        airlens.GridCell
			heatRiskStr string
		)
		if err := rows.Scan(
			&cell.ID, &cell.ScanID,
			&cell.Lat, &cell.Lng,
			&cell.GreenScore,
			&cell.VegetationPct, &cell.SkyPct,
			&cell.BuildingPct, &cell.RoadPct, &cell.SidewalkPct,
			&cell.ConcreteRatio,
			&heatRiskStr, &cell.FromCache,
			&cell.ProcessedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan airlens cell: %w", err)
		}
		cell.HeatRisk = airlens.HeatRiskLevel(heatRiskStr)
		cells = append(cells, cell)
	}
	return cells, rows.Err()
}
