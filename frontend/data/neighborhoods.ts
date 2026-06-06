export interface Neighborhood {
  id: string;
  name: string;
  district: string;
  lat: number;
  lng: number;
  // Approximate bounding box for map restriction
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

export const neighborhoods: Neighborhood[] = [
  // Beşiktaş
  { id: "besiktas-central", name: "Beşiktaş Merkez", district: "Beşiktaş", lat: 41.0430, lng: 29.0065, bounds: { north: 41.0510, south: 41.0360, east: 29.0160, west: 28.9980 } },
  { id: "levent", name: "Levent", district: "Beşiktaş", lat: 41.0790, lng: 29.0110, bounds: { north: 41.0870, south: 41.0710, east: 29.0200, west: 29.0020 } },
  { id: "etiler", name: "Etiler", district: "Beşiktaş", lat: 41.0790, lng: 29.0350, bounds: { north: 41.0860, south: 41.0720, east: 29.0440, west: 29.0260 } },
  { id: "ortakoy", name: "Ortaköy", district: "Beşiktaş", lat: 41.0480, lng: 29.0260, bounds: { north: 41.0560, south: 41.0400, east: 29.0340, west: 29.0180 } },
  { id: "bebek", name: "Bebek", district: "Beşiktaş", lat: 41.0760, lng: 29.0430, bounds: { north: 41.0840, south: 41.0680, east: 29.0510, west: 29.0350 } },

  // Şişli
  { id: "nisantasi", name: "Nişantaşı", district: "Şişli", lat: 41.0490, lng: 28.9960, bounds: { north: 41.0560, south: 41.0420, east: 29.0040, west: 28.9880 } },
  { id: "mecidiyekoy", name: "Mecidiyeköy", district: "Şişli", lat: 41.0670, lng: 28.9970, bounds: { north: 41.0750, south: 41.0590, east: 29.0060, west: 28.9880 } },
  { id: "bomonti", name: "Bomonti", district: "Şişli", lat: 41.0590, lng: 28.9820, bounds: { north: 41.0660, south: 41.0520, east: 28.9910, west: 28.9730 } },
  { id: "gultepe", name: "Gültepe", district: "Şişli", lat: 41.0780, lng: 28.9850, bounds: { north: 41.0860, south: 41.0700, east: 28.9940, west: 28.9760 } },
  { id: "kagithane-merkez", name: "Kağıthane Merkez", district: "Kağıthane", lat: 41.0750, lng: 28.9720, bounds: { north: 41.0830, south: 41.0670, east: 28.9810, west: 28.9630 } },

  // Kadıköy
  { id: "kadikoy-merkez", name: "Kadıköy Merkez", district: "Kadıköy", lat: 40.9905, lng: 29.0220, bounds: { north: 40.9980, south: 40.9830, east: 29.0300, west: 29.0140 } },
  { id: "moda", name: "Moda", district: "Kadıköy", lat: 40.9840, lng: 29.0230, bounds: { north: 40.9910, south: 40.9770, east: 29.0310, west: 29.0150 } },
  { id: "bostanci", name: "Bostancı", district: "Kadıköy", lat: 40.9630, lng: 29.0840, bounds: { north: 40.9710, south: 40.9550, east: 29.0920, west: 29.0760 } },
  { id: "goztepe", name: "Göztepe", district: "Kadıköy", lat: 40.9750, lng: 29.0550, bounds: { north: 40.9830, south: 40.9670, east: 29.0640, west: 29.0460 } },
  { id: "suadiye", name: "Suadiye", district: "Kadıköy", lat: 40.9680, lng: 29.0640, bounds: { north: 40.9760, south: 40.9600, east: 29.0720, west: 29.0560 } },

  // Üsküdar
  { id: "uskudar-merkez", name: "Üsküdar Merkez", district: "Üsküdar", lat: 41.0210, lng: 29.0140, bounds: { north: 41.0290, south: 41.0130, east: 29.0220, west: 29.0060 } },
  { id: "baglarba", name: "Bağlarbaşı", district: "Üsküdar", lat: 41.0100, lng: 29.0300, bounds: { north: 41.0180, south: 41.0020, east: 29.0380, west: 29.0220 } },
  { id: "kuzguncuk", name: "Kuzguncuk", district: "Üsküdar", lat: 41.0410, lng: 29.0390, bounds: { north: 41.0480, south: 41.0340, east: 29.0470, west: 29.0310 } },

  // Fatih
  { id: "sultanahmet", name: "Sultanahmet", district: "Fatih", lat: 41.0054, lng: 28.9768, bounds: { north: 41.0130, south: 40.9980, east: 28.9850, west: 28.9690 } },
  { id: "eminonu", name: "Eminönü", district: "Fatih", lat: 41.0160, lng: 28.9700, bounds: { north: 41.0240, south: 41.0080, east: 28.9780, west: 28.9620 } },
  { id: "beyazit", name: "Beyazıt", district: "Fatih", lat: 41.0080, lng: 28.9640, bounds: { north: 41.0160, south: 41.0000, east: 28.9720, west: 28.9560 } },
  { id: "aksaray", name: "Aksaray", district: "Fatih", lat: 41.0050, lng: 28.9530, bounds: { north: 41.0130, south: 40.9970, east: 28.9610, west: 28.9450 } },
  { id: "fener", name: "Fener", district: "Fatih", lat: 41.0290, lng: 28.9490, bounds: { north: 41.0370, south: 41.0210, east: 28.9570, west: 28.9410 } },

  // Beyoğlu
  { id: "taksim", name: "Taksim", district: "Beyoğlu", lat: 41.0370, lng: 28.9850, bounds: { north: 41.0450, south: 41.0290, east: 28.9930, west: 28.9770 } },
  { id: "galata", name: "Galata", district: "Beyoğlu", lat: 41.0270, lng: 28.9740, bounds: { north: 41.0350, south: 41.0190, east: 28.9820, west: 28.9660 } },
  { id: "cihangir", name: "Cihangir", district: "Beyoğlu", lat: 41.0340, lng: 28.9830, bounds: { north: 41.0420, south: 41.0260, east: 28.9910, west: 28.9750 } },
  { id: "kasimpasa", name: "Kasımpaşa", district: "Beyoğlu", lat: 41.0390, lng: 28.9600, bounds: { north: 41.0470, south: 41.0310, east: 28.9680, west: 28.9520 } },

  // Sarıyer
  { id: "maslak", name: "Maslak", district: "Sarıyer", lat: 41.1080, lng: 29.0190, bounds: { north: 41.1160, south: 41.1000, east: 29.0270, west: 29.0110 } },
  { id: "istinye", name: "İstinye", district: "Sarıyer", lat: 41.1080, lng: 29.0560, bounds: { north: 41.1160, south: 41.1000, east: 29.0640, west: 29.0480 } },
  { id: "tarabya", name: "Tarabya", district: "Sarıyer", lat: 41.1190, lng: 29.0630, bounds: { north: 41.1270, south: 41.1110, east: 29.0710, west: 29.0550 } },

  // Bakırköy
  { id: "bakirkoy-merkez", name: "Bakırköy Merkez", district: "Bakırköy", lat: 40.9810, lng: 28.8720, bounds: { north: 40.9890, south: 40.9730, east: 28.8800, west: 28.8640 } },
  { id: "florya", name: "Florya", district: "Bakırköy", lat: 40.9680, lng: 28.8120, bounds: { north: 40.9760, south: 40.9600, east: 28.8200, west: 28.8040 } },
  { id: "yesilkoy", name: "Yeşilköy", district: "Bakırköy", lat: 40.9720, lng: 28.8370, bounds: { north: 40.9800, south: 40.9640, east: 28.8450, west: 28.8290 } },

  // Başakşehir
  { id: "basaksehir-merkez", name: "Başakşehir Merkez", district: "Başakşehir", lat: 41.0920, lng: 28.8060, bounds: { north: 41.1000, south: 41.0840, east: 28.8140, west: 28.7980 } },
  { id: "ikitelli", name: "İkitelli", district: "Başakşehir", lat: 41.0700, lng: 28.7980, bounds: { north: 41.0780, south: 41.0620, east: 28.8060, west: 28.7900 } },
  { id: "kayabasi", name: "Kayabaşı", district: "Başakşehir", lat: 41.1020, lng: 28.8220, bounds: { north: 41.1100, south: 41.0940, east: 28.8300, west: 28.8140 } },

  // Maltepe
  { id: "maltepe-merkez", name: "Maltepe Merkez", district: "Maltepe", lat: 40.9340, lng: 29.1260, bounds: { north: 40.9420, south: 40.9260, east: 29.1340, west: 29.1180 } },
  { id: "cevizli", name: "Cevizli", district: "Maltepe", lat: 40.9270, lng: 29.1200, bounds: { north: 40.9350, south: 40.9190, east: 29.1280, west: 29.1120 } },

  // Ataşehir
  { id: "atasehir-merkez", name: "Ataşehir Merkez", district: "Ataşehir", lat: 40.9920, lng: 29.1220, bounds: { north: 41.0000, south: 40.9840, east: 29.1300, west: 29.1140 } },
  { id: "icerenkoy", name: "İçerenköy", district: "Ataşehir", lat: 40.9770, lng: 29.1150, bounds: { north: 40.9850, south: 40.9690, east: 29.1230, west: 29.1070 } },

  // Pendik
  { id: "pendik-merkez", name: "Pendik Merkez", district: "Pendik", lat: 40.8790, lng: 29.2380, bounds: { north: 40.8870, south: 40.8710, east: 29.2460, west: 29.2300 } },
  { id: "kurtkoy", name: "Kurtköy", district: "Pendik", lat: 40.9060, lng: 29.2700, bounds: { north: 40.9140, south: 40.8980, east: 29.2780, west: 29.2620 } },

  // Eyüpsultan
  { id: "eyup-merkez", name: "Eyüp Merkez", district: "Eyüpsultan", lat: 41.0470, lng: 28.9330, bounds: { north: 41.0550, south: 41.0390, east: 28.9410, west: 28.9250 } },
  { id: "gokturk", name: "Göktürk", district: "Eyüpsultan", lat: 41.1380, lng: 28.8890, bounds: { north: 41.1460, south: 41.1300, east: 28.8970, west: 28.8810 } },
];

export function getNeighborhoodById(id: string): Neighborhood | undefined {
  return neighborhoods.find((n) => n.id === id);
}

export function searchNeighborhoods(query: string): Neighborhood[] {
  const q = query.toLowerCase().trim();
  if (!q) return neighborhoods;
  return neighborhoods.filter(
    (n) =>
      n.name.toLowerCase().includes(q) ||
      n.district.toLowerCase().includes(q)
  );
}

export const districtColors: Record<string, string> = {
  "Beşiktaş": "bg-blue-100 text-blue-800",
  "Şişli": "bg-purple-100 text-purple-800",
  "Kadıköy": "bg-green-100 text-green-800",
  "Üsküdar": "bg-teal-100 text-teal-800",
  "Fatih": "bg-orange-100 text-orange-800",
  "Beyoğlu": "bg-pink-100 text-pink-800",
  "Sarıyer": "bg-cyan-100 text-cyan-800",
  "Bakırköy": "bg-lime-100 text-lime-800",
  "Başakşehir": "bg-amber-100 text-amber-800",
  "Maltepe": "bg-rose-100 text-rose-800",
  "Ataşehir": "bg-indigo-100 text-indigo-800",
  "Pendik": "bg-violet-100 text-violet-800",
  "Eyüpsultan": "bg-sky-100 text-sky-800",
  "Kağıthane": "bg-emerald-100 text-emerald-800",
};
