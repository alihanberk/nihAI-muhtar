'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';

interface AppCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  iconBg: string;
  color: string;
  href: string;
  comingSoon?: boolean;
}

const apps: AppCard[] = [
  {
    id: "roadscore",
    title: "RoadScore",
    description: "Rota üzerindeki yol yüzey kalitesini AI ile analiz et. Street View + HuggingFace.",
    icon: "🛣",
    iconBg: "bg-blue-100",
    color: "text-blue-600",
    href: "/road-score",
  },
  // More apps will be added here
];

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="px-12 py-6">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-xl font-bold">N</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">
                🏙️ Nihai Muhtar
              </h1>
            </div>

            {/* User Info */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center">
                <span className="text-gray-600 text-sm font-medium">
                  {user.email[0].toUpperCase()}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-700">
                  {user.email}
                </span>
              </div>
              <button
                onClick={logout}
                className="ml-4 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Çıkış
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-12 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Hoş Geldiniz
          </h2>
          <p className="text-gray-600">
            Nihai Muhtar SuperApp - Uygulamalarınızı seçin ve işlemlerinize başlayın
          </p>
        </div>

        {/* Apps Grid */}
        {apps.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl">
            {apps.map((app) => (
              <Link
                key={app.id}
                href={app.comingSoon ? '#' : app.href}
                className={`group ${app.comingSoon ? 'cursor-not-allowed' : ''}`}
                onClick={(e) => app.comingSoon && e.preventDefault()}
              >
                <div className={`bg-white rounded-xl p-8 shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 h-full relative ${
                  app.comingSoon ? 'opacity-60' : 'hover:border-blue-200'
                }`}>
                  {app.comingSoon && (
                    <div className="absolute top-4 right-4 bg-yellow-100 text-yellow-800 text-xs font-semibold px-3 py-1 rounded-full">
                      Yakında
                    </div>
                  )}

                  {/* Icon */}
                  <div className={`w-16 h-16 ${app.iconBg} rounded-xl flex items-center justify-center mb-5`}>
                    <span className="text-4xl">{app.icon}</span>
                  </div>

                  {/* Title */}
                  <h3 className={`text-2xl font-semibold text-gray-900 mb-3 ${!app.comingSoon && 'group-hover:text-blue-600'} transition-colors`}>
                    {app.title}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {app.description}
                  </p>

                  {/* Hover Arrow */}
                  {!app.comingSoon && (
                    <div className="mt-6 flex items-center gap-2 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-sm font-medium">Uygulamayı Aç</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl p-12 text-center border-2 border-dashed border-gray-300">
              <div className="text-6xl mb-4">🚀</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Uygulamalar Ekleniyor
              </h3>
              <p className="text-gray-600">
                SuperApp yapısı hazır. Uygulamalarınızı ekleyerek başlayabilirsiniz.
              </p>
            </div>
          </div>
        )}

        {/* Info Card */}
        <div className="mt-12 max-w-7xl">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-8 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold mb-2">
                  Nihai Muhtar SuperApp
                </h3>
                <p className="text-blue-100">
                  Birden fazla uygulamayı tek platformda yönetin
                </p>
              </div>
              <div className="text-6xl opacity-20">
                🏙️
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
