package database

import (
	"net/url"
	"os"
	"strings"
)

// NormalizeDatabaseURL fixes Render internal PostgreSQL hostnames that omit the
// regional domain suffix (e.g. dpg-xxx-a → dpg-xxx-a.frankfurt-postgres.render.com).
func NormalizeDatabaseURL(rawURL string) string {
	if rawURL == "" {
		return ""
	}

	region := os.Getenv("RENDER_DB_REGION")
	if region == "" {
		region = "frankfurt"
	}

	normalized := strings.Replace(rawURL, "postgresql://", "postgres://", 1)

	parsed, err := url.Parse(normalized)
	if err != nil {
		return rawURL
	}

	host := parsed.Hostname()
	if isRenderInternalHost(host) {
		port := parsed.Port()
		if port == "" {
			port = "5432"
		}
		parsed.Host = host + "." + region + "-postgres.render.com:" + port

		query := parsed.Query()
		if query.Get("sslmode") == "" {
			query.Set("sslmode", "require")
			parsed.RawQuery = query.Encode()
		}
	}

	return parsed.String()
}

func isRenderInternalHost(host string) bool {
	return strings.HasPrefix(host, "dpg-") &&
		strings.HasSuffix(host, "-a") &&
		!strings.Contains(host, ".")
}
