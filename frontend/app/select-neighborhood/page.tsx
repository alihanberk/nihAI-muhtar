'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useNeighborhood } from '@/contexts/NeighborhoodContext';
import { neighborhoods, searchNeighborhoods, districtColors, type Neighborhood } from '@/data/neighborhoods';

export default function SelectNeighborhoodPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { setNeighborhood } = useNeighborhood();

  const [query, setQuery] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const districts = useMemo(() => {
    const all = Array.from(new Set(neighborhoods.map((n) => n.district))).sort();
    return all;
  }, []);

  const filtered = useMemo(() => {
    let results = searchNeighborhoods(query);
    if (selectedDistrict) {
      results = results.filter((n) => n.district === selectedDistrict);
    }
    return results;
  }, [query, selectedDistrict]);

  const handleSelect = (n: Neighborhood) => {
    setNeighborhood(n);
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-lg font-bold">N</span>
            </div>
            <span className="text-white font-semibold text-lg">Nihai Muhtar</span>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              <span className="text-white/50 text-sm">{user.email}</span>
              <button
                onClick={() => { logout(); router.push('/login'); }}
                className="text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                Çıkış
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500/20 rounded-2xl mb-5 text-4xl">
            🏘️
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">
            Muhtarlık Bölgenizi Seçin
          </h1>
          <p className="text-white/50 text-base max-w-md mx-auto">
            Tüm analizler ve harita verileri seçtiğiniz mahalle sınırları içinde çalışacaktır.
          </p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-lg">🔍</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Mahalle veya ilçe ara…"
              className="w-full pl-11 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
            />
          </div>
        </div>

        {/* District filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => setSelectedDistrict(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              selectedDistrict === null
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:border-white/20'
            }`}
          >
            Tümü
          </button>
          {districts.map((d) => (
            <button
              key={d}
              onClick={() => setSelectedDistrict(selectedDistrict === d ? null : d)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                selectedDistrict === d
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:border-white/20'
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Neighborhood grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-white/30">
            <div className="text-4xl mb-3">🗺️</div>
            <p>Mahalle bulunamadı.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((n) => {
              const badgeClass = districtColors[n.district] ?? 'bg-gray-100 text-gray-800';
              return (
                <button
                  key={n.id}
                  onClick={() => handleSelect(n)}
                  onMouseEnter={() => setHoveredId(n.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={`text-left p-4 rounded-xl border transition-all duration-200 group ${
                    hoveredId === n.id
                      ? 'bg-blue-600/20 border-blue-500/50 shadow-lg shadow-blue-500/10'
                      : 'bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-white text-sm leading-snug group-hover:text-blue-300 transition-colors">
                      {n.name}
                    </h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${badgeClass}`}>
                      {n.district}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-white/30 text-xs">
                    <span>📍</span>
                    <span>{n.lat.toFixed(4)}, {n.lng.toFixed(4)}</span>
                  </div>
                  <div className={`mt-3 flex items-center gap-1 text-xs font-medium transition-all duration-200 ${
                    hoveredId === n.id ? 'text-blue-400 opacity-100' : 'opacity-0'
                  }`}>
                    <span>Bu mahallede çalış</span>
                    <span>→</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <p className="text-center text-white/20 text-xs mt-10">
          Seçtiğiniz mahalle sonradan Dashboard üzerinden değiştirilebilir.
        </p>
      </main>
    </div>
  );
}
