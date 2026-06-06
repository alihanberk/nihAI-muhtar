"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface GeoFeature {
  place_name: string;
  center: [number, number]; // [lng, lat]
}

interface LocationSearchProps {
  label: string;
  placeholder: string;
  value: string;
  onSelect: (name: string, lat: number, lng: number) => void;
  icon?: string;
}

export default function LocationSearch({
  label,
  placeholder,
  value,
  onSelect,
  icon = "📍",
}: LocationSearchProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<GeoFeature[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external value changes (e.g. from map click)
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${token}&language=tr&country=TR&limit=5&types=address,place,poi,locality,neighborhood`;
      const res = await fetch(url);
      const data = await res.json();
      setResults(data.features ?? []);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 300);
  };

  const handleSelect = (feature: GeoFeature) => {
    const [lng, lat] = feature.center;
    const name = feature.place_name;
    setQuery(name);
    setResults([]);
    setOpen(false);
    onSelect(name, lat, lng);
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs text-white/40 mb-1">{label}</label>
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm pointer-events-none">
          {icon}
        </span>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-8 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/50 focus:bg-white/8 transition-all"
        />
        {loading && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <span className="inline-block w-3 h-3 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          </span>
        )}
        {query && !loading && (
          <button
            type="button"
            onClick={() => { setQuery(""); setResults([]); setOpen(false); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-zinc-800 border border-white/10 rounded-xl overflow-hidden shadow-2xl">
          {results.map((f, i) => (
            <li key={i}>
              <button
                type="button"
                onMouseDown={() => handleSelect(f)}
                className="w-full text-left px-3 py-2.5 text-sm text-white hover:bg-white/10 transition-colors flex items-start gap-2"
              >
                <span className="text-white/40 mt-0.5 flex-shrink-0 text-xs">📍</span>
                <span className="leading-snug">{f.place_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && results.length === 0 && query.length > 2 && !loading && (
        <div className="absolute z-50 w-full mt-1 bg-zinc-800 border border-white/10 rounded-xl px-3 py-3 text-xs text-white/40">
          Sonuç bulunamadı
        </div>
      )}
    </div>
  );
}
