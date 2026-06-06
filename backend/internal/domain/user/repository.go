package user

import (
	"context"
)

// Repository defines the interface for user data access
type Repository interface {
	// Create creates a new user
	Create(ctx context.Context, user *User) error
	
	// GetByID retrieves a user by ID
	GetByID(ctx context.Context, id string) (*User, error)
	
	// GetByEmail retrieves a user by email
	GetByEmail(ctx context.Context, email string) (*User, error)
	
	// Update updates an existing user
	Update(ctx context.Context, user *User) error
	
	// Delete deletes a user by ID
	Delete(ctx context.Context, id string) error
	
	// Exists checks if a user exists by email
	Exists(ctx context.Context, email string) (bool, error)
}
