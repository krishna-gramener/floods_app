// config.js

export async function getBekasiWards() {
  try {
    const response = await fetch('./data/data_flood.geojson');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch Bekasi wards GeoJSON:', error);
    // Return an empty object on failure to prevent the app from crashing
    return { type: 'FeatureCollection', features: [] };
  }
}

// Bekasi boundaries - updated to match GeoJSON AOI
export const bekasiBounds = {
  // Bounds derived from GeoJSON coordinates
  bounds: [[-6.348589327912876, 106.9242495370928], [-6.213090828568937, 107.06234950376387]],
  // Center of the GeoJSON polygon
  center: [-6.280840078240907, 106.99329952042834]
};

// GeoJSON AOI for Bekasi (March 2025 flood area)
export const bekasiGeoJSON = {
  "type": "FeatureCollection",
  "features": [{
    "type": "Feature",
    "properties": {},
    "geometry": {
      "coordinates": [
        [
          [107.06234950376387, -6.213090828568937],
          [106.9242495370928, -6.213090828568937],
          [106.9242495370928, -6.348589327912876],
          [107.06234950376387, -6.348589327912876],
          [107.06234950376387, -6.213090828568937]
        ]
      ],
      "type": "Polygon"
    }
  }]
};

// Key Bekasi sub-areas
export const bekasiAreas = {
  'Bekasi Barat': [106.9598, -6.2313],
  'Villa jatiasih': [106.96186, -6.29368],
  'Bekasi Selatan': [106.977552, -6.255393],
  'Bekasi Utara': [107.000429, -6.205964],
  'Medan Satria': [106.97222, -6.21192],
  'Jatiasih': [106.95671, -6.29811],
  'Jatisampurna': [106.9165, -6.3756],
  'Mustika Jaya': [107.02881, -6.28354],
  'Bantar Gebang': [106.98452, -6.31300],
  'Bojong Rawalumbu': [106.996244, -6.280565],
  'Duren jaya': [107.02057, -6.23599]
};
