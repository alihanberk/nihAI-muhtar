# Nihai Muhtar - AI-Driven Kentsel Çözümler

Cursor Hackathon 2026 projesi - Yapay zeka destekli kentsel sorun tespiti ve çözüm platformu.

## 🎯 Proje Özeti

Bu proje, Google Street View görüntülerini analiz ederek kentsel sorunları (hasarlı yollar, bozuk tabelalar, çöp kutuları vb.) tespit eden ve çözüm önerileri sunan bir AI platformudur.

## 🏗️ Teknoloji Yığını

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS
- **State Management**: React Context / Zustand
- **Deployment**: Vercel

### Backend
- **Language**: Go 1.22+
- **Architecture**: Clean/Hexagonal Architecture (masterfabric-go inspired)
- **Database**: PostgreSQL 16
- **Cache**: Redis 7
- **Message Queue**: Apache Kafka
- **Auth**: JWT
- **Deployment**: Render.com

### AI/ML
- **Platform**: Hugging Face
- **Models**: [Model detayları eklenecek]
- **Computer Vision**: [CV pipeline detayları]

### External APIs
- Google Street View API (10,000 request quota)

## 🚀 Hızlı Başlangıç

### Gereksinimler

- Node.js 18+
- Go 1.22+
- Docker & Docker Compose
- Git

### Kurulum

```bash
# Repository'yi klonlayın
git clone [repo-url]
cd nihai-muhtar

# Docker servislerini başlatın (PostgreSQL, Redis, Kafka)
docker-compose up -d

# Backend'i başlatın
cd backend
go mod download
make run

# Frontend'i başlatın (yeni terminal)
cd frontend
npm install
npm run dev
```

### Erişim (Local)

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080
- **Health Check**: http://localhost:8080/health/live

### Canlı Demo (Production)

| Servis | Platform | URL |
|--------|----------|-----|
| Frontend | Vercel | `https://[proje-adiniz].vercel.app` |
| Backend API | Render.com | `https://nihai-muhtar-api.onrender.com` |

> Deploy adımları: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/alihanberk/nihAI-muhtar)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/import?repository-url=https://github.com/alihanberk/nihAI-muhtar&root-directory=frontend&project-name=nihai-muhtar)

## 📁 Proje Yapısı

```
nihai-muhtar/
├── backend/           # Go backend (Clean Architecture)
│   ├── cmd/          # Application entry points
│   ├── internal/     # Private application code
│   │   ├── domain/       # Business logic & entities
│   │   ├── application/  # Use cases
│   │   ├── infrastructure/ # External implementations
│   │   └── shared/       # Cross-cutting concerns
│   ├── deployments/  # Docker & deployment configs
│   └── scripts/      # Utility scripts
├── frontend/         # Next.js web application
│   ├── src/
│   │   ├── app/          # Next.js app router
│   │   ├── components/   # React components
│   │   ├── lib/          # Utilities & helpers
│   │   └── styles/       # Global styles
│   └── public/       # Static assets
├── docs/             # Documentation
└── docker-compose.yml
```

## 🤖 AI & Cursor Kullanımı

Bu proje Cursor IDE ile geliştirilmiştir ve aşağıdaki AI araçları kullanılmıştır:

### Cursor Features Kullanımı
- **Cursor Agent**: Backend Clean Architecture iskeleti, RoadScore use case, Hugging Face client ve KVKK blur pipeline agent ile üretildi
- **Cursor Rules**: `.cursor/rules/` ve `.cursor/AGENTS.md` — masterfabric-go konvansiyonları, KVKK kısıtları, deployment kuralları
- **AI Assisted Development**: `backend/internal/application/roadscore/`, `infrastructure/huggingface/`, `infrastructure/blur/`, frontend `road-score` sayfası

### Prompt Engineering Teknikleri
- Katmanlı mimari promptları (domain → application → infrastructure ayrımı)
- KVKK odaklı kısıt promptları (yüz/plaka tanıma yasağı, blur zorunluluğu)
- Hackathon tech stack uyumluluk kontrolü (`docs/project-rules.txt` referanslı)

### AI Model Entegrasyonu
- **Platform**: Hugging Face Inference API
- **Model**: `openai/clip-vit-base-patch32` — kentsel hasar skorlama
- **Pipeline**: Street View görüntüsü → blur (KVKK) → HF inference → segment skoru

## 📊 Özellikler

- [ ] Google Street View entegrasyonu
- [ ] Kentsel nesne tespiti (AI)
- [ ] Sorun kategorilendirme
- [ ] Çözüm önerisi motoru
- [ ] İnteraktif harita görünümü
- [ ] Raporlama sistemi

## 🔒 KVKK Uyumluluğu

✅ Sadece cansız kentsel nesneler analiz edilir
✅ Yüz tanıma YOK
✅ Plaka okuma YOK
✅ Kişi profilleme YOK
✅ Tüm görsellerde yüz/plaka bulanıklaştırma uygulanır
✅ Ham görüntüler hackathon sonrası silinir

## 👥 Takım

[Takım üyeleri]

## 📝 Lisans

MIT

## 🙏 Teşekkürler

Cursor Hackathon 2026 organizatörlerine teşekkürler.

---

**Geliştirme Süreci**: Bu proje Cursor IDE ve AI destekli geliştirme araçları kullanılarak oluşturulmuştur. Tüm commit geçmişi şeffaf bir şekilde GitHub'da paylaşılmaktadır.
