# Yayına Alma Rehberi (Vercel + Render.com)

Hackathon kurallarına (`docs/project-rules.txt`) uygun canlı demo için adım adım rehber.

## Mimari

```
[Vercel — Next.js Frontend]
         │
         ▼ HTTPS
[Render.com — Go Backend API]
         │
         ▼
[Render.com — PostgreSQL]
```

Opsiyonel: Redis (cache). Backend Redis olmadan da çalışır; cache devre dışı kalır.

---

## Ön Koşullar

- GitHub repo: `https://github.com/alihanberk/nihAI-muhtar`
- [Render.com](https://render.com) hesabı (GitHub bağlantılı)
- [Vercel](https://vercel.com) hesabı (GitHub bağlantılı)
- API anahtarları:
  - `GOOGLE_API_KEY` — Directions + Street View
  - `HUGGINGFACE_API_KEY` — AI analiz
  - `NEXT_PUBLIC_MAPBOX_TOKEN` — harita (frontend)
  - `NEXT_PUBLIC_GOOGLE_API_KEY` — Places autocomplete (frontend)

---

## 1. Backend — Render.com

### Yöntem A: Blueprint (önerilen)

1. [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**
2. Repo'yu bağla: `alihanberk/nihAI-muhtar`
3. `render.yaml` otomatik algılanır → **Apply**
4. Oluşan servisler:
   - `nihai-muhtar-db` — PostgreSQL
   - `nihai-muhtar-api` — Go API (Docker)

### Yöntem B: Manuel Web Service

1. **New** → **Web Service** → repo seç
2. Ayarlar:
   - **Root Directory**: `backend`
   - **Runtime**: Docker
   - **Dockerfile Path**: `Dockerfile`
   - **Health Check Path**: `/health/live`
3. **New** → **PostgreSQL** oluştur, connection string'i kopyala

### Ortam Değişkenleri (Render)

| Değişken | Zorunlu | Açıklama |
|----------|---------|----------|
| `DATABASE_URL` | Evet | Blueprint ile otomatik |
| `GOOGLE_API_KEY` | Evet | Google Cloud API key |
| `HUGGINGFACE_API_KEY` | Evet | Hugging Face token |
| `HUGGINGFACE_MODEL` | Hayır | Varsayılan: `openai/clip-vit-base-patch32` |
| `JWT_SECRET` | Evet | Blueprint ile otomatik üretilir |
| `CORS_ALLOWED_ORIGINS` | Evet | Vercel URL (aşağıda) |
| `DB_SSLMODE` | Evet | `require` |
| `KAFKA_ENABLED` | Hayır | `false` |

**CORS örneği** (Vercel deploy sonrası):

```
CORS_ALLOWED_ORIGINS=https://nihai-muhtar.vercel.app,http://localhost:3000
```

### Doğrulama

```bash
curl https://nihai-muhtar-api.onrender.com/health/live
# {"status":"alive"}

curl https://nihai-muhtar-api.onrender.com/health/ready
# {"status":"ready","services":{"postgres":"healthy"}}
```

> **Not:** Render free tier ilk istekte ~30–60 sn cold start yapabilir. Canlı demo öncesi bir kez health endpoint'ine istek atın.

---

## 2. Frontend — Vercel

1. [Vercel Dashboard](https://vercel.com/new) → GitHub repo import
2. Ayarlar:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Next.js (otomatik)
3. Environment Variables:

| Değişken | Değer |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://nihai-muhtar-api.onrender.com/api/v1` |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox public token |
| `NEXT_PUBLIC_GOOGLE_API_KEY` | Google API key |

4. **Deploy**

### Vercel deploy sonrası

Render'daki `CORS_ALLOWED_ORIGINS` değişkenine Vercel URL'ini ekleyin ve backend servisini yeniden deploy edin.

---

## 3. Canlı Demo Kontrol Listesi

Hackathon ödül şartları için:

- [ ] Frontend Vercel'de açılıyor
- [ ] Backend `/health/ready` → postgres healthy
- [ ] Kayıt / giriş çalışıyor
- [ ] Road Score analizi tamamlanıyor (`/road-score`)
- [ ] Google Street View + Hugging Face entegrasyonu aktif
- [ ] KVKK: yüz/plaka bulanıklaştırma pipeline'ı çalışıyor
- [ ] README'de canlı URL'ler güncellendi

---

## 4. Yerel Geliştirme vs Production

| Ortam | Frontend | Backend | DB |
|-------|----------|---------|-----|
| Local | `localhost:3000` | `localhost:8080` | Docker Compose |
| Production | `*.vercel.app` | `*.onrender.com` | Render PostgreSQL |

---

## 5. Sorun Giderme

### CORS hatası (browser console)

`CORS_ALLOWED_ORIGINS` içinde Vercel URL'si yok. Trailing slash olmadan tam domain ekleyin.

### Database connection failed

- `DATABASE_URL` doğru mu?
- `DB_SSLMODE=require` ayarlı mı?
- Migration loglarını Render deploy loglarından kontrol edin

### Backend 502 / timeout

Free tier cold start. Demo öncesi warm-up yapın veya paid plan kullanın.

### API key eksik

`GOOGLE_API_KEY` ve `HUGGINGFACE_API_KEY` Render environment'ta tanımlı olmalı.

---

## 6. Hackathon Sonrası — Veri İmhası (KVKK)

Etkinlik bitiminde:

1. Render PostgreSQL'deki ham görüntü/cache verilerini silin
2. Uygulama loglarında PII kontrolü yapın
3. İmha işlemini README veya ayrı bir `docs/data-deletion.md` ile belgeleyin
