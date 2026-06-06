'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { type Neighborhood, getNeighborhoodById } from '@/data/neighborhoods';

const NEIGHBORHOOD_KEY = 'selected_neighborhood_id';

interface NeighborhoodContextType {
  neighborhood: Neighborhood | null;
  setNeighborhood: (n: Neighborhood) => void;
  clearNeighborhood: () => void;
  hasSelectedNeighborhood: boolean;
}

const NeighborhoodContext = createContext<NeighborhoodContextType | undefined>(undefined);

export function NeighborhoodProvider({ children }: { children: React.ReactNode }) {
  const [neighborhood, setNeighborhoodState] = useState<Neighborhood | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedId = localStorage.getItem(NEIGHBORHOOD_KEY);
    if (savedId) {
      const found = getNeighborhoodById(savedId);
      if (found) setNeighborhoodState(found);
    }
  }, []);

  const setNeighborhood = (n: Neighborhood) => {
    setNeighborhoodState(n);
    if (typeof window !== 'undefined') {
      localStorage.setItem(NEIGHBORHOOD_KEY, n.id);
    }
  };

  const clearNeighborhood = () => {
    setNeighborhoodState(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(NEIGHBORHOOD_KEY);
    }
  };

  return (
    <NeighborhoodContext.Provider
      value={{
        neighborhood,
        setNeighborhood,
        clearNeighborhood,
        hasSelectedNeighborhood: !!neighborhood,
      }}
    >
      {children}
    </NeighborhoodContext.Provider>
  );
}

export function useNeighborhood() {
  const context = useContext(NeighborhoodContext);
  if (context === undefined) {
    throw new Error('useNeighborhood must be used within a NeighborhoodProvider');
  }
  return context;
}
