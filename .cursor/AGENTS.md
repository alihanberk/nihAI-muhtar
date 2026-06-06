# Nihai Muhtar - Cursor AI Rules

Bu proje Cursor Hackathon 2026 için geliştirilmektedir ve aşağıdaki kurallara uyulmalıdır:

## 🎯 Proje Hedefi

AI destekli kentsel sorun tespiti ve çözüm platformu. Google Street View görüntülerini analiz ederek kentsel sorunları tespit eder.

## 🏗️ Mimari Kurallar

### Backend (Go)
- **Clean Architecture** kullanılmalı (masterfabric-go mimarisi baz alınarak)
- Domain-Driven Design prensipleri uygulanmalı
- Her domain kendi klasöründe olmalı: `internal/domain/{user,detection,report}`
- Use case'ler `internal/application/usecases/` altında
- Infrastructure implementasyonları `internal/infrastructure/` altında
- Dependency injection kullanılmalı
- Interface'ler domain layer'da tanımlanmalı

### Frontend (Next.js)
- App Router kullanılmalı
- TypeScript strict mode aktif
- Tailwind CSS ile styling
- Server Components öncelikli, gerektiğinde Client Components
- API çağrıları için fetch veya axios kullanılmalı
- Environment variables `NEXT_PUBLIC_` prefix ile

## 📁 Klasör Yapısı

```
backend/
├── cmd/server/           # Entry point
├── internal/
│   ├── domain/           # Business entities (ZERO external deps)
│   ├── application/      # Use cases
│   ├── infrastructure/   # External implementations
│   └── shared/           # Cross-cutting concerns

frontend/
├── app/                  # Next.js app router
├── components/           # React components
└── lib/                  # Utilities
```

## 🔒 KVKK ve Güvenlik

- **ASLA** yüz tanıma implementasyonu yapma
- **ASLA** plaka okuma özelliği ekleme
- **ASLA** kişi profilleme yapma
- Tüm görsellerde yüz/plaka bulanıklaştırma zorunlu
- API anahtarları .env dosyasında, asla commit'e dahil etme

## 🤖 AI Entegrasyonu

- Hugging Face modelleri kullanılmalı
- Model inference için ayrı service layer oluşturulmalı
- AI çağrıları asenkron yapılmalı
- Hata durumları gracefully handle edilmeli

## 📝 Kod Standartları

### Go
- `gofmt` ile formatlanmış kod
- Error handling her zaman yapılmalı
- Context kullanımı zorunlu (timeout, cancellation için)
- Struct field'ları JSON tag'leri ile işaretlenmeli
- Exported fonksiyonlar comment ile dokümante edilmeli

### TypeScript/React
- ESLint kurallarına uyulmalı
- Prop types tanımlanmalı
- Custom hooks `use` prefix ile
- Component'ler functional olmalı
- Error boundaries kullanılmalı

## 🧪 Test Kuralları

- Her use case için unit test yazılmalı
- Infrastructure layer için integration test
- HTTP handler'lar için e2e test
- Test coverage minimum %70

## 📊 Commit Kuralları

- Anlamlı commit mesajları (Türkçe veya İngilizce)
- Conventional commits format: `feat:`, `fix:`, `docs:`, `refactor:`
- Tek seferde büyük commit değil, küçük atomik commit'ler
- Her feature için ayrı branch (opsiyonel)

## 🚀 Deployment

- Frontend: Vercel
- Backend: Render.com
- Database: PostgreSQL (Render.com managed)
- Redis: Render.com veya external provider

## 📚 Dökümentasyon

- README'de AI kullanımı detaylı açıklanmalı
- Cursor kullanımı (hangi promptlar, hangi özellikler) belgelenmeli
- API endpoint'leri dokümante edilmeli
- Environment variable'lar açıklanmalı

## ⚡ Performans

- Database query'leri optimize edilmeli
- Redis caching kullanılmalı
- Image processing asenkron yapılmalı
- Pagination her liste endpoint'inde olmalı

## 🎨 UI/UX

- Responsive tasarım (mobile-first)
- Loading states gösterilmeli
- Error states user-friendly
- Dark mode desteği (opsiyonel)

---

**ÖNEMLİ**: Bu kurallara uymayan kod değişiklikleri kabul edilmeyecektir. Her commit bu kurallara uygunluk açısından kontrol edilmelidir.
