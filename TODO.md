# Development TODO

## ✅ Tamamlanan

- [x] Proje yapısı oluşturuldu
- [x] Next.js frontend kurulumu
- [x] Go backend iskelet yapısı
- [x] Docker Compose yapılandırması
- [x] Cursor kuralları (AGENTS.md)
- [x] README ve dökümentasyon
- [x] Frontend homepage tasarımı
- [x] Backend health check endpoints
- [x] Environment variables yapılandırması

## 🚧 Yapılacaklar

### Backend (Go)
- [ ] Database migration system (goose veya golang-migrate)
- [ ] PostgreSQL connection ve repository pattern
- [ ] User entity ve repository
- [ ] Detection entity ve repository
- [ ] Report entity ve repository
- [ ] JWT authentication middleware
- [ ] Register/Login endpoint implementasyonu
- [ ] Detection CRUD endpoints
- [ ] Report CRUD endpoints
- [ ] Redis caching layer
- [ ] Kafka event publishing
- [ ] AI service client (Hugging Face)
- [ ] Google Street View API client
- [ ] Image processing utilities (blur faces/plates)
- [ ] Unit tests
- [ ] Integration tests

### Frontend (Next.js)
- [ ] Auth context/provider
- [ ] Login sayfası
- [ ] Register sayfası
- [ ] Dashboard sayfası
- [ ] Detection list sayfası
- [ ] Detection detail sayfası
- [ ] Report list sayfası
- [ ] Report detail sayfası
- [ ] Map component (Google Maps/Street View)
- [ ] Image upload component
- [ ] Loading states
- [ ] Error handling
- [ ] Toast notifications
- [ ] API client utilities
- [ ] Form validation

### AI/ML
- [ ] Hugging Face model seçimi (object detection)
- [ ] Model inference service
- [ ] Image preprocessing pipeline
- [ ] Face detection ve blurring
- [ ] License plate detection ve blurring
- [ ] Urban object detection
  - [ ] Damaged roads
  - [ ] Broken signs
  - [ ] Garbage bins
  - [ ] Street lights
- [ ] Confidence scoring
- [ ] Result formatting

### Database
- [ ] Users table migration
- [ ] Detections table migration
- [ ] Reports table migration
- [ ] Indexes oluşturma
- [ ] Seed data scripts

### Deployment
- [ ] Frontend Vercel deploy
- [ ] Backend Render.com deploy
- [ ] PostgreSQL production database
- [ ] Redis production setup
- [ ] Environment variables production
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Monitoring setup

### Documentation
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Architecture decision records
- [ ] AI model usage documentation
- [ ] Cursor usage documentation (prompts, features)
- [ ] Deployment guide
- [ ] Contributing guide

## 🔴 Kritik Önemli (KVKK)
- [ ] Face blurring implementasyonu
- [ ] License plate blurring implementasyonu
- [ ] Privacy policy sayfası
- [ ] Data deletion mechanism
- [ ] User consent forms

## 📝 Notlar

- Backend için Go kurulumu gerekli
- Docker Desktop başlatılmalı
- API keys eklenmeli (.env dosyalarına)
- Git commit'leri düzenli yapılmalı
- Her feature için test yazılmalı

## 🎯 Öncelik Sırası

1. **Yüksek Öncelik**
   - Backend database bağlantısı
   - User authentication
   - Frontend login/register

2. **Orta Öncelik**
   - Detection CRUD
   - AI service entegrasyonu
   - Google Street View entegrasyonu

3. **Düşük Öncelik**
   - Advanced features
   - Performance optimizations
   - UI polish

---

**Güncellenme:** 2026-06-06
