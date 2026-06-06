'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const [backendStatus, setBackendStatus] = useState<string>('Kontrol ediliyor...');
  const [backendHealthy, setBackendHealthy] = useState<boolean>(false);

  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  useEffect(() => {
    // Backend health check
    fetch('http://localhost:8080/health/live')
      .then((res) => res.json())
      .then((data) => {
        setBackendStatus('Backend bağlantısı başarılı ✓');
        setBackendHealthy(true);
      })
      .catch(() => {
        setBackendStatus('Backend bağlanamadı (Backend henüz başlatılmamış)');
        setBackendHealthy(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <main className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
            🏙️ Nihai Muhtar
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-2">
            AI-Driven Kentsel Çözümler Platformu
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Cursor Hackathon 2026
          </p>
        </div>

        {/* Status Card */}
        <div className="max-w-2xl mx-auto mb-12">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">
              Sistem Durumu
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded">
                <span className="text-gray-700 dark:text-gray-300">Frontend</span>
                <span className="text-green-600 dark:text-green-400 font-medium">
                  ✓ Çalışıyor
                </span>
              </div>
              <div className={`flex items-center justify-between p-3 rounded ${
                backendHealthy 
                  ? 'bg-green-50 dark:bg-green-900/20' 
                  : 'bg-yellow-50 dark:bg-yellow-900/20'
              }`}>
                <span className="text-gray-700 dark:text-gray-300">Backend</span>
                <span className={`font-medium ${
                  backendHealthy 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-yellow-600 dark:text-yellow-400'
                }`}>
                  {backendStatus}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="max-w-4xl mx-auto mb-12">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-6 text-center">
            Özellikler
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="text-3xl mb-3">🤖</div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
                AI Görüntü Analizi
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Hugging Face modelleri ile kentsel sorun tespiti
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="text-3xl mb-3">🗺️</div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
                Street View Entegrasyonu
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Google Street View API ile gerçek zamanlı veri
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="text-3xl mb-3">🔒</div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
                KVKK Uyumlu
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Gizlilik odaklı, yüz/plaka bulanıklaştırma
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="text-3xl mb-3">⚡</div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
                Kurumsal Mimari
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Go + Clean Architecture + Multi-tenant
              </p>
            </div>
          </div>
        </div>

        {/* Tech Stack */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-6 text-center">
            Teknoloji Yığını
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="grid md:grid-cols-3 gap-6 text-center">
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-white mb-2">Frontend</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Next.js + TypeScript + Tailwind CSS</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-white mb-2">Backend</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Go + PostgreSQL + Redis + Kafka</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-white mb-2">AI/ML</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Hugging Face + Computer Vision</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="max-w-2xl mx-auto mt-12 text-center">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-8 shadow-lg">
            <h2 className="text-2xl font-bold text-white mb-4">
              Hemen Başlayın
            </h2>
            <p className="text-blue-100 mb-6">
              AI destekli kentsel sorun tespiti için platformumuza katılın
            </p>
            <div className="flex gap-4 justify-center">
              <Link
                href="/register"
                className="px-6 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
              >
                Kayıt Ol
              </Link>
              <Link
                href="/login"
                className="px-6 py-3 bg-blue-700 text-white rounded-lg font-semibold hover:bg-blue-800 transition-colors border border-blue-500"
              >
                Giriş Yap
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-16 text-gray-500 dark:text-gray-400">
          <p className="text-sm">
            Cursor IDE ile AI destekli geliştirme
          </p>
        </div>
      </main>
    </div>
  );
}
