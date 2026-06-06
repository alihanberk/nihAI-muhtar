package facadescore

import "context"

// Repository defines the persistence contract for the FacadeScore module.
// Implementations live in infrastructure/repository.
type Repository interface {
	// Job management
	CreateJob(ctx context.Context, job *AnalysisJob) error
	GetJob(ctx context.Context, jobID string) (*AnalysisJob, error)
	UpdateJobStatus(ctx context.Context, jobID string, status JobStatus) error
	IncrementJobDone(ctx context.Context, jobID string) error

	// Building analysis
	CreateBuilding(ctx context.Context, b *BuildingAnalysis) error
	UpdateBuilding(ctx context.Context, b *BuildingAnalysis) error
	GetBuilding(ctx context.Context, buildingID string) (*BuildingAnalysis, error)
	ListBuildingsByDistrict(ctx context.Context, district string) ([]*BuildingAnalysis, error)
	ListBuildingsByJob(ctx context.Context, jobID string) ([]*BuildingAnalysis, error)
	GetPriorityBuildings(ctx context.Context, limit int) ([]*BuildingAnalysis, error)

	// Defect persistence
	CreateDefect(ctx context.Context, d *FacadeDefect) error
	ListDefectsByBuilding(ctx context.Context, buildingID string) ([]*FacadeDefect, error)

	// Citizen reports
	CreateCitizenReport(ctx context.Context, cr *CitizenReport) error
	ListCitizenReports(ctx context.Context, buildingID string) ([]*CitizenReport, error)

	// Heatmap aggregation
	GetDistrictHeatmap(ctx context.Context, district string) (*DistrictHeatmap, error)
	ListAllDistrictHeatmaps(ctx context.Context) ([]*DistrictHeatmap, error)
}
