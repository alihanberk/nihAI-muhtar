"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useNeighborhood } from "@/contexts/NeighborhoodContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

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
    description:
      "Rota üzerindeki yol yüzey kalitesini AI ile analiz et. Street View + HuggingFace.",
    icon: "🛣",
    iconBg: "bg-blue-100",
    color: "text-blue-600",
    href: "/road-score",
  },
  {
    id: "facadescore",
    title: "FacadeScore",
    description:
      "Bina cephelerindeki yapısal bozulmaları tespit et. Deprem riski odaklı sağlık haritası. DETR + CLIP ile iki aşamalı AI analizi.",
    icon: "🏚️",
    iconBg: "bg-orange-100",
    color: "text-orange-600",
    href: "/facade-score",
  },
  {
    id: "airlens",
    title: "AirLens",
    description:
      "Street View görüntülerinden ağaç & bitki oranı hesapla. Sokak bazında yeşillik skoru ve ısı adası haritası.",
    icon: "🌿",
    iconBg: "bg-green-100",
    color: "text-green-600",
    href: "/airlens",
  },
];

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { neighborhood, clearNeighborhood } = useNeighborhood();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push("/login");
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
              {neighborhood && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
                  <span className="text-blue-600 text-sm">📍</span>
                  <span className="text-sm font-medium text-blue-700">
                    {neighborhood.name}
                  </span>
                  <span className="text-xs text-blue-400">
                    {neighborhood.district}
                  </span>
                  <button
                    onClick={() => {
                      clearNeighborhood();
                      router.push("/select-neighborhood");
                    }}
                    className="text-blue-400 hover:text-blue-600 text-xs ml-1 transition-colors"
                    title="Mahalle değiştir"
                  >
                    ✎
                  </button>
                </div>
              )}
              {!neighborhood && (
                <button
                  onClick={() => router.push("/select-neighborhood")}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 hover:bg-amber-100 transition-colors"
                >
                  <span>⚠️</span>
                  <span>Mahalle seç</span>
                </button>
              )}
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
            {neighborhood
              ? `Hoş Geldiniz, ${neighborhood.name} Muhtarı`
              : "Hoş Geldiniz"}
          </h2>
          <p className="text-gray-600">
            {neighborhood
              ? `${neighborhood.district} ilçesi, ${neighborhood.name} mahallesi · Uygulamalarınızı seçin`
              : "Nihai Muhtar SuperApp - Uygulamalarınızı seçin ve işlemlerinize başlayın"}
          </p>
        </div>

        {/* Apps Grid */}
        {apps.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl">
            {apps.map((app) => (
              <Link
                key={app.id}
                href={app.comingSoon ? "#" : app.href}
                className={`group ${app.comingSoon ? "cursor-not-allowed" : ""}`}
                onClick={(e) => app.comingSoon && e.preventDefault()}
              >
                <div
                  className={`bg-white rounded-xl p-8 shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 h-full relative ${
                    app.comingSoon ? "opacity-60" : "hover:border-blue-200"
                  }`}
                >
                  {app.comingSoon && (
                    <div className="absolute top-4 right-4 bg-yellow-100 text-yellow-800 text-xs font-semibold px-3 py-1 rounded-full">
                      Yakında
                    </div>
                  )}

                  {/* Icon */}
                  <div
                    className={`w-16 h-16 ${app.iconBg} rounded-xl flex items-center justify-center mb-5`}
                  >
                    <span className="text-4xl">{app.icon}</span>
                  </div>

                  {/* Title */}
                  <h3
                    className={`text-2xl font-semibold text-gray-900 mb-3 ${!app.comingSoon && "group-hover:text-blue-600"} transition-colors`}
                  >
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
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
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
                SuperApp yapısı hazır. Uygulamalarınızı ekleyerek
                başlayabilirsiniz.
              </p>
            </div>
          </div>
        )}

        {/* Neighborhood Info Card */}
        <div className="mt-12 max-w-7xl">
          {neighborhood ? (
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-8 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-blue-200 text-sm font-medium uppercase tracking-wider">
                      Aktif Muhtarlık Bölgesi
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold mb-1">
                    {neighborhood.name} Mahallesi
                  </h3>
                  <p className="text-blue-100">
                    {neighborhood.district} İlçesi ·{" "}
                    {neighborhood.lat.toFixed(4)}°N,{" "}
                    {neighborhood.lng.toFixed(4)}°E
                  </p>
                  <button
                    onClick={() => {
                      clearNeighborhood();
                      router.push("/select-neighborhood");
                    }}
                    className="mt-4 text-xs px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                  >
                    Mahalle Değiştir
                  </button>
                </div>
                <div className="text-6xl opacity-20">🏘️</div>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl p-8 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold mb-2">
                    Muhtarlık Bölgesi Seçilmedi
                  </h3>
                  <p className="text-amber-100 mb-4">
                    Analizlerin doğru çalışması için muhtarlık bölgenizi seçin.
                  </p>
                  <button
                    onClick={() => router.push("/select-neighborhood")}
                    className="text-sm px-4 py-2 bg-white text-amber-700 font-semibold rounded-lg hover:bg-amber-50 transition-colors"
                  >
                    Mahalle Seç →
                  </button>
                </div>
                <div className="text-6xl opacity-20">📍</div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
