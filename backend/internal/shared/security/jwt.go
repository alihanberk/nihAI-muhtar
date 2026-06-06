package security

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Claims represents JWT claims
type Claims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	jwt.RegisteredClaims
}

// JWTConfig holds JWT configuration
type JWTConfig struct {
	SecretKey       string
	ExpirationHours int
}

// GenerateToken generates a new JWT token for a user
func GenerateToken(userID, email string, config JWTConfig) (string, error) {
	if config.SecretKey == "" {
		return "", fmt.Errorf("JWT secret key is required")
	}

	if config.ExpirationHours == 0 {
		config.ExpirationHours = 24 // Default to 24 hours
	}

	expirationTime := time.Now().Add(time.Duration(config.ExpirationHours) * time.Hour)

	claims := &Claims{
		UserID: userID,
		Email:  email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(config.SecretKey))
	if err != nil {
		return "", fmt.Errorf("failed to sign token: %w", err)
	}

	return tokenString, nil
}

// ValidateToken validates a JWT token and returns the claims
func ValidateToken(tokenString string, secretKey string) (*Claims, error) {
	if secretKey == "" {
		return nil, fmt.Errorf("JWT secret key is required")
	}

	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		// Verify signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(secretKey), nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	return claims, nil
}

// RefreshToken generates a new token with extended expiration
func RefreshToken(oldToken string, config JWTConfig) (string, error) {
	claims, err := ValidateToken(oldToken, config.SecretKey)
	if err != nil {
		return "", fmt.Errorf("invalid token for refresh: %w", err)
	}

	return GenerateToken(claims.UserID, claims.Email, config)
}
