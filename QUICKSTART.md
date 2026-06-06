# 🚀 Hızlı Başlangıç Rehberi

Bu rehber projeyi yerel ortamda çalıştırmanız için gerekli adımları içerir.

## ✅ Başarıyla Tamamlanan Adımlar

1. ✅ Proje yapısı oluşturuldu
2. ✅ Next.js frontend kuruldu ve çalışıyor
3. ✅ Go backend iskelet yapısı hazır
4. ✅ Docker Compose yapılandırması tamamlandı
5. ✅ Cursor kuralları (rules) oluşturuldu

## 📋 Gereksinimler

- [x] Node.js 18+ (✅ Kurulu ve çalışıyor)
- [ ] Go 1.22+ (Henüz kurulmadı)
- [ ] Docker Desktop (Kurulu olabilir ama çalışmıyor)
- [x] Git (✅ Kurulu)

## 🎯 Mevcut Durum

### ✅ Frontend (Next.js) - ÇALIŞIYOR

```bash
# Frontend zaten çalışıyor!
# Tarayıcıdan erişim:
http://localhost:3000
```

**Özellikler:**
- ✅ Modern UI tasarımı
- ✅ Backend durum kontrolü
- ✅ Responsive tasarım
- ✅ Dark mode desteği

### ⚠️ Backend (Go) - HAZIR AMA BAŞLATILMADI

Backend kodu hazır ancak Go kurulu olmadığı için henüz başlatılamadı.

**Çalıştırmak için:**

```bash
# 1. Go'yu yükleyin (eğer yoksa):
# macOS:
brew install go

# 2. Backend dizinine gidin:
cd backend

# 3. Bağımlılıkları indirin:
go mod download

# 4. Sunucuyu başlatın:
go run cmd/server/main.go
```

Backend başladığında: `http://localhost:8080`

### ⚠️ Docker Servisleri - BAŞLATILMADI

Docker Desktop'ın çalışıyor olması gerekiyor.

**Başlatmak için:**

```bash
# 1. Docker Desktop'ı başlatın (GUI'den)

# 2. Docker servislerini başlatın:
docker-compose up -d

# 3. Servislerin durumunu kontrol edin:
docker-compose ps

# 4. Logları görmek için:
docker-compose logs -f
```

**Servisler:**
- PostgreSQL (Port 5432)
- Redis (Port 6379)
- Kafka (Port 9092)
- Kafka UI (Port 8090) - http://localhost:8090

## 🛠️ Tam Kurulum (Tüm Servislerle)

### 1. Docker Servislerini Başlatın

```bash
# Docker Desktop'ı başlatın, ardından:
docker-compose up -d

# Servislerin hazır olmasını bekleyin (yaklaşık 30 saniye)
docker-compose ps
```

### 2. Backend'i Başlatın

```bash
cd backend

# .env dosyasını kopyalayın (zaten var)
# cp .env.example .env

# Bağımlılıkları indirin
go mod download

# Sunucuyu başlatın
make run
# veya
go run cmd/server/main.go
```

### 3. Frontend'i Başlatın (Zaten Çalışıyor)

```bash
cd frontend

# Eğer durmuşsa tekrar başlatın:
npm run dev
```

## 🧪 Test Etme

### Frontend Testi
Tarayıcıdan: http://localhost:3000

Göreceğiniz sayfa:
- 🏙️ Nihai Muhtar başlığı
- Sistem durum kartları (Frontend ✓, Backend durumu)
- Özellikler grid'i
- Teknoloji yığını bilgisi

### Backend Testi

```bash
# Health check
curl http://localhost:8080/health/live
# Beklenen: {"status":"alive"}

curl http://localhost:8080/health/ready
# Beklenen: {"status":"ready","services":{"postgres":"healthy","redis":"healthy"}}

# API endpoint (placeholder)
curl http://localhost:8080/api/v1/detections
# Beklenen: {"message":"List detections endpoint - implementation pending"}
```

## 📁 Proje Yapısı

```
nihai-muhtar/
├── .cursor/rules/          # Cursor AI kuralları
│   └── AGENTS.md
├── backend/                # Go backend
│   ├── cmd/server/         # Main entry point
│   ├── internal/           # Internal packages
│   │   ├── domain/         # Business logic
│   │   ├── application/    # Use cases
│   │   ├── infrastructure/ # External implementations
│   │   └── shared/         # Utilities
│   ├── .env               # Environment variables
│   ├── Makefile           # Build commands
│   └── go.mod             # Go dependencies
├── frontend/              # Next.js frontend
│   ├── app/               # Next.js app router
│   ├── .env.local         # Frontend env vars
│   └── package.json
├── docs/                  # Documentation
│   └── project-rules.txt  # Hackathon rules
├── docker-compose.yml     # Infrastructure services
└── README.md             # Main documentation
```

## 🎓 Sonraki Adımlar

### 1. Backend'i Tamamlama
- [ ] Database migration system
- [ ] User authentication & JWT
- [ ] Detection endpoint implementasyonu
- [ ] Report endpoint implementasyonu
- [ ] AI service entegrasyonu (Hugging Face)

### 2. Frontend'i Geliştirme
- [ ] Login/Register sayfaları
- [ ] Detection list sayfası
- [ ] Detection detail sayfası
- [ ] Map view implementasyonu
- [ ] Google Street View entegrasyonu

### 3. AI Entegrasyonu
- [ ] Hugging Face model seçimi
- [ ] Görüntü işleme pipeline
- [ ] Yüz/plaka bulanıklaştırma
- [ ] Nesne tespiti (kentsel objeler)

### 4. Database Schema
- [ ] Users table
- [ ] Detections table
- [ ] Reports table
- [ ] Migration scripts

### 5. Deployment
- [ ] Frontend Vercel deploy
- [ ] Backend Render.com deploy
- [ ] Database production setup
- [ ] Environment variables

## ⚡ Hızlı Komutlar

```bash
# Frontend
cd frontend
npm run dev              # Development server
npm run build            # Production build
npm run lint             # Linting

# Backend
cd backend
make run                 # Run server
make test                # Run tests
make build               # Build binary
make docker-up           # Start Docker services
make docker-down         # Stop Docker services

# Docker
docker-compose up -d     # Start all services
docker-compose down      # Stop all services
docker-compose ps        # List services
docker-compose logs -f   # Follow logs
```

## 🐛 Sorun Giderme

### "go: command not found"
```bash
# macOS
brew install go

# Linux
sudo apt install golang-go  # Debian/Ubuntu
```

### "docker: command not found" veya "Cannot connect to Docker daemon"
1. Docker Desktop'ı indirin ve yükleyin: https://www.docker.com/products/docker-desktop
2. Uygulamayı başlatın
3. Komutları tekrar deneyin

### Port zaten kullanımda
```bash
# Port kullanımını kontrol et
lsof -i :3000  # Frontend
lsof -i :8080  # Backend

# Süreci öldür
kill -9 <PID>
```

### Frontend backend'e bağlanamıyor
1. Backend'in çalıştığından emin olun
2. `.env.local` dosyasını kontrol edin
3. CORS ayarlarını kontrol edin

## 📚 Ek Kaynaklar

- [Next.js Docs](https://nextjs.org/docs)
- [Go Documentation](https://go.dev/doc/)
- [Chi Router](https://go-chi.io/)
- [Docker Compose](https://docs.docker.com/compose/)

---

**Başarılar!** 🎉

Sorularınız için README.md dosyasına bakın veya takım arkadaşlarınızla iletişime geçin.
