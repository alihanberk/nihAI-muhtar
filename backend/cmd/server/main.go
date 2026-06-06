package main

import (
	"context"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/redis/go-redis/v9"

	"github.com/nihai-muhtar/backend/internal/application/auth"
	appRoadscore "github.com/nihai-muhtar/backend/internal/application/roadscore"
	"github.com/nihai-muhtar/backend/internal/infrastructure/blur"
	"github.com/nihai-muhtar/backend/internal/infrastructure/cache"
	"github.com/nihai-muhtar/backend/internal/infrastructure/database"
	"github.com/nihai-muhtar/backend/internal/infrastructure/directions"
	"github.com/nihai-muhtar/backend/internal/infrastructure/handler"
	rlmiddleware "github.com/nihai-muhtar/backend/internal/infrastructure/middleware"
	"github.com/nihai-muhtar/backend/internal/infrastructure/huggingface"
	"github.com/nihai-muhtar/backend/internal/infrastructure/repository"
	"github.com/nihai-muhtar/backend/internal/infrastructure/streetview"
	"github.com/nihai-muhtar/backend/internal/shared/security"
)

func main() {
	// Initialize logger
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	// Load configuration
	config := loadConfig()

	// Initialize database connection
	dbConfig := database.Config{
		Host:     config.DBHost,
		Port:     config.DBPort,
		User:     config.DBUser,
		Password: config.DBPassword,
		DBName:   config.DBName,
		SSLMode:  "disable",
	}

	db, err := database.NewPostgresConnection(dbConfig)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer database.Close(db)

	slog.Info("Database connection established")

	// Initialize repositories
	userRepo := repository.NewUserRepository(db)
	roadScoreRepo := repository.NewRoadScoreRepository(db)

	// Initialize services
	jwtConfig := security.JWTConfig{
		SecretKey:       config.JWTSecret,
		ExpirationHours: 24,
	}
	authService := auth.NewService(userRepo, jwtConfig)

	// Initialize Redis client
	rdb := redis.NewClient(&redis.Options{
		Addr: fmt.Sprintf("%s:%s", config.RedisHost, config.RedisPort),
	})
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		slog.Warn("Redis connection failed — cache disabled", "error", err)
	} else {
		slog.Info("Redis connection established")
	}

	// Initialize RoadScore infrastructure
	roadScoreCache := cache.NewRoadScoreCache(rdb)
	directionsClient := directions.NewClient(config.GoogleAPIKey)
	streetViewClient := streetview.NewClient(config.GoogleAPIKey)
	hfClient := huggingface.NewClient(config.HuggingFaceAPIKey, config.HuggingFaceModel)
	blurProcessor := blur.NewProcessor()
	streetViewRateLimiter := rlmiddleware.NewStreetViewRateLimiter()
	_ = streetViewRateLimiter // available for use in subrouters

	// Initialize RoadScore use case + handler
	analyzeUC := appRoadscore.NewAnalyzeRouteUseCase(
		roadScoreRepo,
		directionsClient,
		streetViewClient,
		hfClient,
		blurProcessor,
		roadScoreCache,
	)
	roadScoreHandler := handler.NewRoadScoreHandler(analyzeUC, roadScoreRepo)

	// Initialize auth handler
	authHandler := handler.NewAuthHandler(authService)

	// Initialize router
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))

	// CORS
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Health check routes
	r.Get("/health/live", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"alive"}`))
	})

	r.Get("/health/ready", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		
		// Check database health
		dbHealthy := "healthy"
		if err := database.HealthCheck(db); err != nil {
			dbHealthy = "unhealthy"
			w.WriteHeader(http.StatusServiceUnavailable)
		} else {
			w.WriteHeader(http.StatusOK)
		}
		
		response := fmt.Sprintf(`{"status":"ready","services":{"postgres":"%s"}}`, dbHealthy)
		w.Write([]byte(response))
	})

	// API routes
	r.Route("/api/v1", func(r chi.Router) {
		// Auth routes
		r.Post("/auth/register", authHandler.Register)
		r.Post("/auth/login", authHandler.Login)

		// RoadScore routes
		r.Route("/road-score", func(r chi.Router) {
			r.Post("/analyze", roadScoreHandler.AnalyzeRoute)
			r.Get("/analysis/{analysisId}", roadScoreHandler.GetAnalysis)
			r.Get("/routes/{routeId}/segments", roadScoreHandler.GetSegments)
			r.Get("/analysis/{analysisId}/report", roadScoreHandler.GenerateReport)
		})

		// Detection routes (placeholders for now)
		r.Post("/detections", handleCreateDetection)
		r.Get("/detections", handleListDetections)
		r.Get("/detections/{id}", handleGetDetection)

		// Report routes (placeholders for now)
		r.Post("/reports", handleCreateReport)
		r.Get("/reports", handleListReports)
		r.Get("/reports/{id}", handleGetReport)
	})

	// Start server
	addr := fmt.Sprintf("%s:%s", config.ServerHost, config.ServerPort)
	srv := &http.Server{
		Addr:         addr,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	go func() {
		slog.Info("Starting server", "addr", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	slog.Info("Server stopped")
}

// Config holds application configuration
type Config struct {
	ServerHost        string
	ServerPort        string
	DBHost            string
	DBPort            string
	DBUser            string
	DBPassword        string
	DBName            string
	RedisHost         string
	RedisPort         string
	JWTSecret         string
	GoogleAPIKey      string
	HuggingFaceAPIKey string
	HuggingFaceModel  string
}

func loadConfig() *Config {
	return &Config{
		ServerHost:        getEnv("SERVER_HOST", "0.0.0.0"),
		ServerPort:        getEnv("SERVER_PORT", "8080"),
		DBHost:            getEnv("DB_HOST", "localhost"),
		DBPort:            getEnv("DB_PORT", "5432"),
		DBUser:            getEnv("DB_USER", "muhtar"),
		DBPassword:        getEnv("DB_PASSWORD", "muhtar123"),
		DBName:            getEnv("DB_NAME", "muhtar_db"),
		RedisHost:         getEnv("REDIS_HOST", "localhost"),
		RedisPort:         getEnv("REDIS_PORT", "6379"),
		JWTSecret:         getEnv("JWT_SECRET", "your-secret-key-change-this-in-production"),
		GoogleAPIKey:      getEnv("GOOGLE_API_KEY", ""),
		HuggingFaceAPIKey: getEnv("HUGGINGFACE_API_KEY", ""),
		HuggingFaceModel:  getEnv("HUGGINGFACE_MODEL", ""),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// Placeholder handlers for future modules
func handleCreateDetection(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"message":"Create detection endpoint - implementation pending"}`))
}

func handleListDetections(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"message":"List detections endpoint - implementation pending"}`))
}

func handleGetDetection(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"message":"Get detection endpoint - implementation pending"}`))
}

func handleCreateReport(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"message":"Create report endpoint - implementation pending"}`))
}

func handleListReports(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"message":"List reports endpoint - implementation pending"}`))
}

func handleGetReport(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"message":"Get report endpoint - implementation pending"}`))
}
