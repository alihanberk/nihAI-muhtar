package auth

import (
	"context"
	"fmt"

	"github.com/nihai-muhtar/backend/internal/domain/user"
	"github.com/nihai-muhtar/backend/internal/shared/security"
)

// Service handles authentication business logic
type Service struct {
	userRepo  user.Repository
	jwtConfig security.JWTConfig
}

// NewService creates a new auth service
func NewService(userRepo user.Repository, jwtConfig security.JWTConfig) *Service {
	return &Service{
		userRepo:  userRepo,
		jwtConfig: jwtConfig,
	}
}

// Register registers a new user
func (s *Service) Register(ctx context.Context, req user.CreateUserRequest) (*user.User, error) {
	// Validate input
	if req.Email == "" {
		return nil, fmt.Errorf("email is required")
	}
	if req.Password == "" {
		return nil, fmt.Errorf("password is required")
	}
	if req.FullName == "" {
		return nil, fmt.Errorf("full name is required")
	}

	// Validate password strength
	if err := security.ValidatePasswordStrength(req.Password); err != nil {
		return nil, err
	}

	// Check if user already exists
	exists, err := s.userRepo.Exists(ctx, req.Email)
	if err != nil {
		return nil, fmt.Errorf("failed to check user existence: %w", err)
	}
	if exists {
		return nil, fmt.Errorf("user with this email already exists")
	}

	// Hash password
	hashedPassword, err := security.HashPassword(req.Password)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// Create user
	newUser := &user.User{
		Email:        req.Email,
		PasswordHash: hashedPassword,
		FullName:     req.FullName,
	}

	if err := s.userRepo.Create(ctx, newUser); err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	return newUser, nil
}

// Login authenticates a user and returns a JWT token
func (s *Service) Login(ctx context.Context, req user.LoginRequest) (*user.LoginResponse, error) {
	// Validate input
	if req.Email == "" {
		return nil, fmt.Errorf("email is required")
	}
	if req.Password == "" {
		return nil, fmt.Errorf("password is required")
	}

	// Get user by email
	existingUser, err := s.userRepo.GetByEmail(ctx, req.Email)
	if err != nil {
		return nil, fmt.Errorf("invalid email or password")
	}

	// Compare passwords
	if err := security.ComparePassword(existingUser.PasswordHash, req.Password); err != nil {
		return nil, fmt.Errorf("invalid email or password")
	}

	// Generate JWT token
	token, err := security.GenerateToken(existingUser.ID, existingUser.Email, s.jwtConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}

	return &user.LoginResponse{
		Token: token,
		User:  existingUser,
	}, nil
}

// ValidateToken validates a JWT token and returns user claims
func (s *Service) ValidateToken(tokenString string) (*security.Claims, error) {
	claims, err := security.ValidateToken(tokenString, s.jwtConfig.SecretKey)
	if err != nil {
		return nil, fmt.Errorf("invalid token: %w", err)
	}
	return claims, nil
}

// GetUserByID retrieves a user by ID
func (s *Service) GetUserByID(ctx context.Context, userID string) (*user.User, error) {
	return s.userRepo.GetByID(ctx, userID)
}
