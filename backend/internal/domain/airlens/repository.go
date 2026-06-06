package airlens

import "context"

// Repository defines the persistence contract for the AirLens module.
// Implementations must store only aggregated scores — no raw imagery.
type Repository interface {
	// CreateScan persists a new district scan record and returns its assigned ID.
	CreateScan(ctx context.Context, scan *Scan) error

	// UpdateScan updates the scan's summary statistics and status.
	UpdateScan(ctx context.Context, scan *Scan) error

	// GetScan retrieves a scan by ID including all its grid cells.
	GetScan(ctx context.Context, id string) (*Scan, error)

	// ListScans returns recent scans for a district ordered by created_at desc.
	ListScans(ctx context.Context, districtName string, limit int) ([]Scan, error)

	// SaveCell persists a single scored grid cell.
	SaveCell(ctx context.Context, cell *GridCell) error

	// GetCellsByScan returns all grid cells for a scan.
	GetCellsByScan(ctx context.Context, scanID string) ([]GridCell, error)

	// GetTopGreenCells returns the N cells with the highest green scores.
	GetTopGreenCells(ctx context.Context, scanID string, n int) ([]GridCell, error)

	// GetHotspotCells returns the N cells with CRITICAL or HIGH heat risk.
	GetHotspotCells(ctx context.Context, scanID string, n int) ([]GridCell, error)
}
