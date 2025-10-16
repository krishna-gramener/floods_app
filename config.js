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
  'Bekasi Barat': [106.977, -6.217],
  'Bekasi Timur': [107.010, -6.226],
  'Bekasi Selatan': [106.995, -6.289],
  'Bekasi Utara': [106.987, -6.167],
  'Medan Satria': [106.943, -6.248],
  'Jatiasih': [106.990, -6.324],
  'Jatisampurna': [106.996, -6.242],
  'Mustika Jaya': [107.004, -6.203],
  'Bantar Gebang': [107.039, -6.213],
  'Rawalumbu': [106.986, -6.270],
  'Pondok Gede': [107.083, -6.301]
};
