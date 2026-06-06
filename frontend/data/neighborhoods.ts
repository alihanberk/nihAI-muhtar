// Radius in meters — defines the circular muhtarlık boundary
export interface Neighborhood {
  id: string;
  name: string;
  district: string;
  lat: number;
  lng: number;
  radius: number; // meters
}

// ─── Helper functions ─────────────────────────────────────────────────────────

/** Haversine distance in meters between two WGS-84 points */
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Returns true when the point is within the neighborhood circle */
export function isInsideNeighborhood(lat: number, lng: number, n: Neighborhood): boolean {
  return haversineDistance(lat, lng, n.lat, n.lng) <= n.radius;
}

/**
 * Generates a clockwise circle polygon ring as [lng, lat] pairs.
 * Clockwise so it acts as a hole when placed inside a CCW world ring.
 */
export function circlePolygonCoords(
  lat: number,
  lng: number,
  radiusMeters: number,
  numPoints = 64,
): number[][] {
  const coords: number[][] = [];
  const latRad = (lat * Math.PI) / 180;
  for (let i = 0; i <= numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    // cos → dLat, sin → dLng gives clockwise order starting at north
    const dLat = (radiusMeters * Math.cos(angle)) / 111320;
    const dLng = (radiusMeters * Math.sin(angle)) / (111320 * Math.cos(latRad));
    coords.push([lng + dLng, lat + dLat]);
  }
  return coords;
}

/** Loose bounding box from center + radius (for camera maxBounds) */
export function getNeighborhoodBounds(
  n: Neighborhood,
  paddingFactor = 1.5,
): { north: number; south: number; east: number; west: number } {
  const latDelta = (n.radius * paddingFactor) / 111320;
  const lngDelta =
    (n.radius * paddingFactor) / (111320 * Math.cos((n.lat * Math.PI) / 180));
  return {
    north: n.lat + latDelta,
    south: n.lat - latDelta,
    east: n.lng + lngDelta,
    west: n.lng - lngDelta,
  };
}

// ─── Neighborhood data ────────────────────────────────────────────────────────

export const neighborhoods: Neighborhood[] = [
  // ── Beşiktaş ────────────────────────────────────────────────────────────────
  { id: "besiktas-central",  name: "Beşiktaş Merkez",  district: "Beşiktaş",    lat: 41.0430, lng: 29.0065, radius: 650 },
  { id: "levent",            name: "Levent",            district: "Beşiktaş",    lat: 41.0790, lng: 29.0110, radius: 600 },
  { id: "etiler",            name: "Etiler",            district: "Beşiktaş",    lat: 41.0790, lng: 29.0350, radius: 550 },
  { id: "ortakoy",           name: "Ortaköy",           district: "Beşiktaş",    lat: 41.0480, lng: 29.0260, radius: 500 },
  { id: "bebek",             name: "Bebek",             district: "Beşiktaş",    lat: 41.0760, lng: 29.0430, radius: 500 },
  { id: "arnavutkoy-bes",    name: "Arnavutköy",        district: "Beşiktaş",    lat: 41.0640, lng: 29.0430, radius: 450 },
  { id: "ulus",              name: "Ulus",              district: "Beşiktaş",    lat: 41.0700, lng: 29.0280, radius: 500 },

  // ── Şişli ────────────────────────────────────────────────────────────────────
  { id: "nisantasi",         name: "Nişantaşı",         district: "Şişli",       lat: 41.0490, lng: 28.9960, radius: 550 },
  { id: "mecidiyekoy",       name: "Mecidiyeköy",       district: "Şişli",       lat: 41.0670, lng: 28.9970, radius: 600 },
  { id: "bomonti",           name: "Bomonti",           district: "Şişli",       lat: 41.0590, lng: 28.9820, radius: 500 },
  { id: "gultepe",           name: "Gültepe",           district: "Şişli",       lat: 41.0780, lng: 28.9850, radius: 550 },
  { id: "sisli-merkez",      name: "Şişli Merkez",      district: "Şişli",       lat: 41.0600, lng: 28.9870, radius: 600 },
  { id: "feriköy",           name: "Feriköy",           district: "Şişli",       lat: 41.0560, lng: 28.9820, radius: 450 },
  { id: "cumhuriyet",        name: "Cumhuriyet",        district: "Şişli",       lat: 41.0530, lng: 28.9960, radius: 400 },

  // ── Kağıthane ────────────────────────────────────────────────────────────────
  { id: "kagithane-merkez",  name: "Kağıthane Merkez",  district: "Kağıthane",   lat: 41.0750, lng: 28.9720, radius: 600 },
  { id: "seyrantepe",        name: "Seyrantepe",        district: "Kağıthane",   lat: 41.0870, lng: 28.9810, radius: 550 },
  { id: "gülseren",          name: "Gülseren",          district: "Kağıthane",   lat: 41.0830, lng: 28.9680, radius: 500 },

  // ── Kadıköy ──────────────────────────────────────────────────────────────────
  { id: "kadikoy-merkez",    name: "Kadıköy Merkez",    district: "Kadıköy",     lat: 40.9905, lng: 29.0220, radius: 700 },
  { id: "moda",              name: "Moda",              district: "Kadıköy",     lat: 40.9840, lng: 29.0230, radius: 550 },
  { id: "bostanci",          name: "Bostancı",          district: "Kadıköy",     lat: 40.9630, lng: 29.0840, radius: 600 },
  { id: "goztepe",           name: "Göztepe",           district: "Kadıköy",     lat: 40.9750, lng: 29.0550, radius: 600 },
  { id: "suadiye",           name: "Suadiye",           district: "Kadıköy",     lat: 40.9680, lng: 29.0640, radius: 550 },
  { id: "fenerbahce",        name: "Fenerbahçe",        district: "Kadıköy",     lat: 40.9760, lng: 29.0380, radius: 500 },
  { id: "erenköy",           name: "Erenköy",           district: "Kadıköy",     lat: 40.9700, lng: 29.0760, radius: 600 },
  { id: "caddebostan",       name: "Caddebostan",       district: "Kadıköy",     lat: 40.9640, lng: 29.0580, radius: 500 },
  { id: "fikirtepe",         name: "Fikirtepe",         district: "Kadıköy",     lat: 41.0010, lng: 29.0300, radius: 500 },

  // ── Üsküdar ──────────────────────────────────────────────────────────────────
  { id: "uskudar-merkez",    name: "Üsküdar Merkez",    district: "Üsküdar",     lat: 41.0210, lng: 29.0140, radius: 700 },
  { id: "baglarba",          name: "Bağlarbaşı",        district: "Üsküdar",     lat: 41.0100, lng: 29.0300, radius: 550 },
  { id: "kuzguncuk",         name: "Kuzguncuk",         district: "Üsküdar",     lat: 41.0410, lng: 29.0390, radius: 500 },
  { id: "beylerbeyi",        name: "Beylerbeyi",        district: "Üsküdar",     lat: 41.0390, lng: 29.0360, radius: 500 },
  { id: "altunizade",        name: "Altunizade",        district: "Üsküdar",     lat: 41.0100, lng: 29.0530, radius: 550 },
  { id: "acıbadem",          name: "Acıbadem",          district: "Üsküdar",     lat: 41.0000, lng: 29.0390, radius: 550 },

  // ── Fatih ────────────────────────────────────────────────────────────────────
  { id: "sultanahmet",       name: "Sultanahmet",       district: "Fatih",       lat: 41.0054, lng: 28.9768, radius: 650 },
  { id: "eminonu",           name: "Eminönü",           district: "Fatih",       lat: 41.0160, lng: 28.9700, radius: 550 },
  { id: "beyazit",           name: "Beyazıt",           district: "Fatih",       lat: 41.0080, lng: 28.9640, radius: 600 },
  { id: "aksaray",           name: "Aksaray",           district: "Fatih",       lat: 41.0050, lng: 28.9530, radius: 600 },
  { id: "fener",             name: "Fener",             district: "Fatih",       lat: 41.0290, lng: 28.9490, radius: 550 },
  { id: "balat",             name: "Balat",             district: "Fatih",       lat: 41.0250, lng: 28.9500, radius: 450 },
  { id: "fatih-merkez",      name: "Fatih Merkez",      district: "Fatih",       lat: 41.0170, lng: 28.9490, radius: 600 },

  // ── Beyoğlu ──────────────────────────────────────────────────────────────────
  { id: "taksim",            name: "Taksim",            district: "Beyoğlu",     lat: 41.0370, lng: 28.9850, radius: 600 },
  { id: "galata",            name: "Galata",            district: "Beyoğlu",     lat: 41.0270, lng: 28.9740, radius: 500 },
  { id: "cihangir",          name: "Cihangir",          district: "Beyoğlu",     lat: 41.0340, lng: 28.9830, radius: 450 },
  { id: "kasimpasa",         name: "Kasımpaşa",         district: "Beyoğlu",     lat: 41.0390, lng: 28.9600, radius: 600 },
  { id: "pera",              name: "Pera (İstiklal)",   district: "Beyoğlu",     lat: 41.0310, lng: 28.9770, radius: 500 },
  { id: "kuledibi",          name: "Kuledibi",          district: "Beyoğlu",     lat: 41.0260, lng: 28.9750, radius: 400 },

  // ── Sarıyer ──────────────────────────────────────────────────────────────────
  { id: "maslak",            name: "Maslak",            district: "Sarıyer",     lat: 41.1080, lng: 29.0190, radius: 700 },
  { id: "istinye",           name: "İstinye",           district: "Sarıyer",     lat: 41.1080, lng: 29.0560, radius: 600 },
  { id: "tarabya",           name: "Tarabya",           district: "Sarıyer",     lat: 41.1190, lng: 29.0630, radius: 550 },
  { id: "yenikoy",           name: "Yeniköy",           district: "Sarıyer",     lat: 41.1270, lng: 29.0660, radius: 500 },
  { id: "rumelihisari",      name: "Rumelihisarı",      district: "Sarıyer",     lat: 41.0890, lng: 29.0550, radius: 500 },
  { id: "buyukdere",         name: "Büyükdere",         district: "Sarıyer",     lat: 41.1020, lng: 29.0120, radius: 600 },

  // ── Bakırköy ─────────────────────────────────────────────────────────────────
  { id: "bakirkoy-merkez",   name: "Bakırköy Merkez",   district: "Bakırköy",    lat: 40.9810, lng: 28.8720, radius: 650 },
  { id: "florya",            name: "Florya",            district: "Bakırköy",    lat: 40.9680, lng: 28.8120, radius: 600 },
  { id: "yesilkoy",          name: "Yeşilköy",          district: "Bakırköy",    lat: 40.9720, lng: 28.8370, radius: 600 },
  { id: "atakoy",            name: "Ataköy",            district: "Bakırköy",    lat: 40.9830, lng: 28.8490, radius: 700 },
  { id: "yesilbağlar",       name: "Yeşilbağlar",       district: "Bakırköy",    lat: 40.9870, lng: 28.8650, radius: 500 },

  // ── Bahçelievler ──────────────────────────────────────────────────────────────
  { id: "bahcelievler-merkez", name: "Bahçelievler Merkez", district: "Bahçelievler", lat: 41.0030, lng: 28.8590, radius: 650 },
  { id: "soganli",           name: "Soğanlı",           district: "Bahçelievler", lat: 41.0100, lng: 28.8460, radius: 600 },
  { id: "yenibosna",         name: "Yenibosna",         district: "Bahçelievler", lat: 41.0060, lng: 28.8300, radius: 600 },

  // ── Zeytinburnu ──────────────────────────────────────────────────────────────
  { id: "zeytinburnu-merkez", name: "Zeytinburnu Merkez", district: "Zeytinburnu", lat: 41.0010, lng: 28.9030, radius: 650 },
  { id: "merkezefendi",      name: "Merkezefendi",      district: "Zeytinburnu", lat: 41.0050, lng: 28.8920, radius: 550 },
  { id: "kazlicesme",        name: "Kazlıçeşme",        district: "Zeytinburnu", lat: 41.0010, lng: 28.9210, radius: 500 },

  // ── Bayrampaşa ────────────────────────────────────────────────────────────────
  { id: "bayrampa-merkez",   name: "Bayrampaşa Merkez", district: "Bayrampaşa",  lat: 41.0400, lng: 28.9150, radius: 650 },
  { id: "sagmalcilar",       name: "Sağmalcılar",       district: "Bayrampaşa",  lat: 41.0430, lng: 28.9000, radius: 600 },

  // ── Güngören ─────────────────────────────────────────────────────────────────
  { id: "gungoren-merkez",   name: "Güngören Merkez",   district: "Güngören",    lat: 41.0180, lng: 28.8770, radius: 650 },
  { id: "mehmet-nesih",      name: "Mehmet Nesih Özmen", district: "Güngören",   lat: 41.0150, lng: 28.8650, radius: 600 },

  // ── Esenler ──────────────────────────────────────────────────────────────────
  { id: "esenler-merkez",    name: "Esenler Merkez",    district: "Esenler",     lat: 41.0420, lng: 28.8760, radius: 700 },
  { id: "turgutreis",        name: "Turgut Reis",       district: "Esenler",     lat: 41.0510, lng: 28.8690, radius: 600 },

  // ── Bağcılar ─────────────────────────────────────────────────────────────────
  { id: "bagcilar-merkez",   name: "Bağcılar Merkez",   district: "Bağcılar",    lat: 41.0330, lng: 28.8530, radius: 700 },
  { id: "bagcilar-yenigün",  name: "Yeni Gün",          district: "Bağcılar",    lat: 41.0390, lng: 28.8400, radius: 600 },
  { id: "kirazli",           name: "Kirazlı",           district: "Bağcılar",    lat: 41.0430, lng: 28.8340, radius: 600 },

  // ── Gaziosmanpaşa ────────────────────────────────────────────────────────────
  { id: "gop-merkez",        name: "Gaziosmanpaşa Merkez", district: "Gaziosmanpaşa", lat: 41.0680, lng: 28.9100, radius: 700 },
  { id: "fevzicakmak",       name: "Fevzi Çakmak",      district: "Gaziosmanpaşa", lat: 41.0610, lng: 28.9200, radius: 600 },
  { id: "barbaros",          name: "Barbaros",          district: "Gaziosmanpaşa", lat: 41.0770, lng: 28.9060, radius: 600 },

  // ── Sultangazi ────────────────────────────────────────────────────────────────
  { id: "sultangazi-merkez", name: "Sultangazi Merkez", district: "Sultangazi",  lat: 41.1080, lng: 28.8870, radius: 700 },
  { id: "yayla",             name: "Yayla",             district: "Sultangazi",  lat: 41.1010, lng: 28.9040, radius: 650 },
  { id: "habibler",          name: "Habibler",          district: "Sultangazi",  lat: 41.0870, lng: 28.8740, radius: 650 },

  // ── Arnavutköy ────────────────────────────────────────────────────────────────
  { id: "arnavutkoy-merkez", name: "Arnavutköy Merkez", district: "Arnavutköy",  lat: 41.1870, lng: 28.7390, radius: 750 },
  { id: "bolluca",           name: "Bolluca",           district: "Arnavutköy",  lat: 41.1650, lng: 28.7650, radius: 700 },

  // ── Küçükçekmece ─────────────────────────────────────────────────────────────
  { id: "kucukcekmece-merkez", name: "Küçükçekmece Merkez", district: "Küçükçekmece", lat: 41.0040, lng: 28.7700, radius: 700 },
  { id: "halkalı",           name: "Halkalı",           district: "Küçükçekmece", lat: 41.0080, lng: 28.7960, radius: 700 },
  { id: "sefakoy",           name: "Sefaköy",           district: "Küçükçekmece", lat: 41.0050, lng: 28.7870, radius: 650 },

  // ── Avcılar ──────────────────────────────────────────────────────────────────
  { id: "avcilar-merkez",    name: "Avcılar Merkez",    district: "Avcılar",     lat: 40.9790, lng: 28.7200, radius: 700 },
  { id: "ambarlı",           name: "Ambarlı",           district: "Avcılar",     lat: 40.9720, lng: 28.6880, radius: 650 },

  // ── Beylikdüzü ────────────────────────────────────────────────────────────────
  { id: "beylikduzu-merkez", name: "Beylikdüzü Merkez", district: "Beylikdüzü",  lat: 41.0000, lng: 28.6450, radius: 750 },
  { id: "cumhuriyet-bey",    name: "Cumhuriyet Mah.",   district: "Beylikdüzü",  lat: 40.9960, lng: 28.6320, radius: 650 },

  // ── Esenyurt ─────────────────────────────────────────────────────────────────
  { id: "esenyurt-merkez",   name: "Esenyurt Merkez",   district: "Esenyurt",    lat: 41.0270, lng: 28.6700, radius: 750 },
  { id: "esenyurt-cumhuriyet", name: "Esenyurt Cumhuriyet", district: "Esenyurt", lat: 41.0190, lng: 28.6570, radius: 700 },

  // ── Başakşehir ────────────────────────────────────────────────────────────────
  { id: "basaksehir-merkez", name: "Başakşehir Merkez", district: "Başakşehir",  lat: 41.0920, lng: 28.8060, radius: 700 },
  { id: "ikitelli",          name: "İkitelli",          district: "Başakşehir",  lat: 41.0700, lng: 28.7980, radius: 650 },
  { id: "kayabasi",          name: "Kayabaşı",          district: "Başakşehir",  lat: 41.1020, lng: 28.8220, radius: 700 },
  { id: "bahcesehir",        name: "Bahçeşehir",        district: "Başakşehir",  lat: 41.0810, lng: 28.7730, radius: 700 },

  // ── Eyüpsultan ────────────────────────────────────────────────────────────────
  { id: "eyup-merkez",       name: "Eyüp Merkez",       district: "Eyüpsultan",  lat: 41.0470, lng: 28.9330, radius: 650 },
  { id: "gokturk",           name: "Göktürk",           district: "Eyüpsultan",  lat: 41.1380, lng: 28.8890, radius: 750 },
  { id: "alibeyköy",         name: "Alibeyköy",         district: "Eyüpsultan",  lat: 41.0680, lng: 28.9290, radius: 700 },
  { id: "kagithane-eyup",    name: "Kağıthane (Eyüp)",  district: "Eyüpsultan",  lat: 41.0580, lng: 28.9340, radius: 600 },

  // ── Maltepe ──────────────────────────────────────────────────────────────────
  { id: "maltepe-merkez",    name: "Maltepe Merkez",    district: "Maltepe",     lat: 40.9340, lng: 29.1260, radius: 700 },
  { id: "cevizli",           name: "Cevizli",           district: "Maltepe",     lat: 40.9270, lng: 29.1200, radius: 600 },
  { id: "altayceşme",        name: "Altayçeşme",        district: "Maltepe",     lat: 40.9370, lng: 29.1570, radius: 600 },
  { id: "baglarbasi-mlt",    name: "Bağlarbaşı",        district: "Maltepe",     lat: 40.9490, lng: 29.1300, radius: 600 },

  // ── Kartal ───────────────────────────────────────────────────────────────────
  { id: "kartal-merkez",     name: "Kartal Merkez",     district: "Kartal",      lat: 40.9000, lng: 29.1850, radius: 700 },
  { id: "uçtepeler",         name: "Uçtepeler",         district: "Kartal",      lat: 40.9100, lng: 29.2000, radius: 600 },
  { id: "topselvi",          name: "Topselvi",          district: "Kartal",      lat: 40.8910, lng: 29.1980, radius: 600 },

  // ── Ataşehir ─────────────────────────────────────────────────────────────────
  { id: "atasehir-merkez",   name: "Ataşehir Merkez",   district: "Ataşehir",    lat: 40.9920, lng: 29.1220, radius: 700 },
  { id: "icerenkoy",         name: "İçerenköy",         district: "Ataşehir",    lat: 40.9770, lng: 29.1150, radius: 650 },
  { id: "kayisdagi",         name: "Kayışdağı",         district: "Ataşehir",    lat: 40.9870, lng: 29.1450, radius: 650 },
  { id: "küçükbakkalköy",    name: "Küçükbakkalköy",    district: "Ataşehir",    lat: 40.9990, lng: 29.1370, radius: 600 },

  // ── Ümraniye ─────────────────────────────────────────────────────────────────
  { id: "umraniye-merkez",   name: "Ümraniye Merkez",   district: "Ümraniye",    lat: 41.0160, lng: 29.1230, radius: 700 },
  { id: "alemdaglı",         name: "Alemdağlı",         district: "Ümraniye",    lat: 41.0140, lng: 29.1550, radius: 650 },
  { id: "çakmak",            name: "Çakmak",            district: "Ümraniye",    lat: 41.0300, lng: 29.1260, radius: 650 },

  // ── Sancaktepe ────────────────────────────────────────────────────────────────
  { id: "sancaktepe-merkez", name: "Sancaktepe Merkez", district: "Sancaktepe",  lat: 41.0020, lng: 29.2220, radius: 750 },
  { id: "yenidogan-san",     name: "Yenidoğan",         district: "Sancaktepe",  lat: 40.9900, lng: 29.2140, radius: 700 },

  // ── Sultanbeyli ───────────────────────────────────────────────────────────────
  { id: "sultanbeyli-merkez", name: "Sultanbeyli Merkez", district: "Sultanbeyli", lat: 40.9600, lng: 29.2650, radius: 750 },
  { id: "hasanpasa-sul",     name: "Hasanpaşa",         district: "Sultanbeyli", lat: 40.9510, lng: 29.2550, radius: 700 },

  // ── Pendik ───────────────────────────────────────────────────────────────────
  { id: "pendik-merkez",     name: "Pendik Merkez",     district: "Pendik",      lat: 40.8790, lng: 29.2380, radius: 750 },
  { id: "kurtkoy",           name: "Kurtköy",           district: "Pendik",      lat: 40.9060, lng: 29.2700, radius: 700 },
  { id: "kaynarca",          name: "Kaynarca",          district: "Pendik",      lat: 40.8870, lng: 29.2590, radius: 700 },

  // ── Tuzla ────────────────────────────────────────────────────────────────────
  { id: "tuzla-merkez",      name: "Tuzla Merkez",      district: "Tuzla",       lat: 40.8170, lng: 29.2990, radius: 750 },
  { id: "içmeler",           name: "İçmeler",           district: "Tuzla",       lat: 40.8570, lng: 29.2680, radius: 700 },

  // ── Beykoz ───────────────────────────────────────────────────────────────────
  { id: "beykoz-merkez",     name: "Beykoz Merkez",     district: "Beykoz",      lat: 41.1260, lng: 29.1000, radius: 750 },
  { id: "pasabahce",         name: "Paşabahçe",         district: "Beykoz",      lat: 41.0980, lng: 29.0800, radius: 700 },
  { id: "kavacik",           name: "Kavacık",           district: "Beykoz",      lat: 41.0620, lng: 29.0800, radius: 650 },

  // ── Çekmeköy ─────────────────────────────────────────────────────────────────
  { id: "cekmekoy-merkez",   name: "Çekmeköy Merkez",   district: "Çekmeköy",    lat: 41.0540, lng: 29.1790, radius: 750 },
  { id: "tasdelen",          name: "Taşdelen",          district: "Çekmeköy",    lat: 41.0440, lng: 29.1910, radius: 700 },
];

// ─── Look-up & search helpers ─────────────────────────────────────────────────

export function getNeighborhoodById(id: string): Neighborhood | undefined {
  return neighborhoods.find((n) => n.id === id);
}

export function searchNeighborhoods(query: string): Neighborhood[] {
  const q = query.toLowerCase().trim();
  if (!q) return neighborhoods;
  return neighborhoods.filter(
    (n) =>
      n.name.toLowerCase().includes(q) ||
      n.district.toLowerCase().includes(q),
  );
}

// ─── District colour map ──────────────────────────────────────────────────────

export const districtColors: Record<string, string> = {
  "Beşiktaş":       "bg-blue-100 text-blue-800",
  "Şişli":          "bg-purple-100 text-purple-800",
  "Kağıthane":      "bg-emerald-100 text-emerald-800",
  "Kadıköy":        "bg-green-100 text-green-800",
  "Üsküdar":        "bg-teal-100 text-teal-800",
  "Fatih":          "bg-orange-100 text-orange-800",
  "Beyoğlu":        "bg-pink-100 text-pink-800",
  "Sarıyer":        "bg-cyan-100 text-cyan-800",
  "Bakırköy":       "bg-lime-100 text-lime-800",
  "Bahçelievler":   "bg-yellow-100 text-yellow-800",
  "Zeytinburnu":    "bg-red-100 text-red-800",
  "Bayrampaşa":     "bg-stone-100 text-stone-800",
  "Güngören":       "bg-fuchsia-100 text-fuchsia-800",
  "Esenler":        "bg-orange-100 text-orange-800",
  "Bağcılar":       "bg-sky-100 text-sky-800",
  "Gaziosmanpaşa":  "bg-indigo-100 text-indigo-800",
  "Sultangazi":     "bg-violet-100 text-violet-800",
  "Arnavutköy":     "bg-rose-100 text-rose-800",
  "Küçükçekmece":   "bg-amber-100 text-amber-800",
  "Avcılar":        "bg-lime-100 text-lime-800",
  "Beylikdüzü":     "bg-teal-100 text-teal-800",
  "Esenyurt":       "bg-blue-100 text-blue-800",
  "Başakşehir":     "bg-amber-100 text-amber-800",
  "Eyüpsultan":     "bg-sky-100 text-sky-800",
  "Maltepe":        "bg-rose-100 text-rose-800",
  "Kartal":         "bg-purple-100 text-purple-800",
  "Ataşehir":       "bg-indigo-100 text-indigo-800",
  "Ümraniye":       "bg-green-100 text-green-800",
  "Sancaktepe":     "bg-cyan-100 text-cyan-800",
  "Sultanbeyli":    "bg-violet-100 text-violet-800",
  "Pendik":         "bg-pink-100 text-pink-800",
  "Tuzla":          "bg-emerald-100 text-emerald-800",
  "Beykoz":         "bg-orange-100 text-orange-800",
  "Çekmeköy":       "bg-yellow-100 text-yellow-800",
};
