const DEFAULT_API_BASE = 'http://localhost:8080/api/v1';

/** Normalizes NEXT_PUBLIC_API_URL — always ends with /api/v1. */
export function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!raw) return DEFAULT_API_BASE;

  const withoutTrailingSlash = raw.replace(/\/+$/, '');
  if (withoutTrailingSlash.endsWith('/api/v1')) {
    return withoutTrailingSlash;
  }

  return `${withoutTrailingSlash}/api/v1`;
}

/** Backend origin without /api/v1 (for /health/* endpoints). */
export function getBackendOrigin(): string {
  return getApiBaseUrl().replace(/\/api\/v1\/?$/, '');
}
