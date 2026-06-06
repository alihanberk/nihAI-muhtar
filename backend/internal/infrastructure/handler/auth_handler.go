package handler

import (
	"encoding/json"
	"net/http"

	"github.com/nihai-muhtar/backend/internal/application/auth"
	"github.com/nihai-muhtar/backend/internal/domain/user"
)

// AuthHandler handles authentication HTTP requests
type AuthHandler struct {
	authService *auth.Service
}

// NewAuthHandler creates a new auth handler
func NewAuthHandler(authService *auth.Service) *AuthHandler {
	return &AuthHandler{
		authService: authService,
	}
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message,omitempty"`
}

// SuccessResponse represents a success response
type SuccessResponse struct {
	Data    interface{} `json:"data"`
	Message string      `json:"message,omitempty"`
}

// Register handles user registration
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req user.CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	newUser, err := h.authService.Register(r.Context(), req)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Registration failed", err.Error())
		return
	}

	respondWithJSON(w, http.StatusCreated, SuccessResponse{
		Data:    newUser.ToResponse(),
		Message: "User registered successfully",
	})
}

// Login handles user login
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req user.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	loginResp, err := h.authService.Login(r.Context(), req)
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, "Login failed", err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, SuccessResponse{
		Data: map[string]interface{}{
			"token": loginResp.Token,
			"user":  loginResp.User.ToResponse(),
		},
		Message: "Login successful",
	})
}

// respondWithError writes an error response
func respondWithError(w http.ResponseWriter, statusCode int, error, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(ErrorResponse{
		Error:   error,
		Message: message,
	})
}

// respondWithJSON writes a JSON response
func respondWithJSON(w http.ResponseWriter, statusCode int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(data)
}
