// Layer management functions for the Bekasi Flood Monitoring System
import { createLegend, showLegend, hideLegend } from './utils.js';
import { bekasiBounds, bekasiGeoJSON } from './config.js';

// Import opacity slider function from script.js
let addOpacitySliderToMap;

// Reference to global map objects and layer collections
let map;
let layers = {};
let layersLeft = {};
let layersRight = {};

/**
 * Initialize the layer management module with map references
 */
export function initLayerManager(mainMap, mainLayers, leftMap, leftLayers, rightMap, rightLayers, opacitySliderFn) {
  map = mainMap;
  layers = mainLayers;
  layersLeft = leftLayers || {};
  layersRight = rightLayers || {};
  addOpacitySliderToMap = opacitySliderFn;

  if (leftMap) window.mapLeft = leftMap;
  if (rightMap) window.mapRight = rightMap;
}

/**
 * Show DEM layer on the main map
 */
export function showDEM() {
  console.log('Loading elevation data...');
  
  const bekasiGeometry = ee.FeatureCollection([
    ee.Feature(ee.Geometry.Polygon(bekasiGeoJSON.features[0].geometry.coordinates), {})
  ]).geometry();
  
  const dem = ee.Image("USGS/SRTMGL1_003").clip(bekasiGeometry);
  
  const demVis = {
    min: 0,
    max: 50,
    palette: ['#253494', '#2c7fb8', '#41b6c4', '#a1dab4', '#ffffcc']
  };
  
  addLayer(dem, demVis, 'Elevation');
  
  createLegend('Elevation (m)', 
    ['#253494', '#2c7fb8', '#41b6c4', '#a1dab4', '#ffffcc'],
    ['0', '10', '20', '30', '50'],
    'Elevation');
}

/**
 * Show Population layer on the main map
 * Dynamically calculates min/max values from AOI with proper rounding
 */
export function showPopulation() {
  console.log('Loading population data...');
  
  const bekasiGeometry = ee.FeatureCollection([
    ee.Feature(ee.Geometry.Polygon(bekasiGeoJSON.features[0].geometry.coordinates), {})
  ]).geometry();
  
  const population = ee.ImageCollection("CIESIN/GPWv411/GPW_Population_Count")
    .filter(ee.Filter.date('2020-01-01', '2020-12-31'))
    .first()
    .clip(bekasiGeometry);
  
  // Calculate min and max values within the AOI
  const stats = population.reduceRegion({
    reducer: ee.Reducer.minMax(),
    geometry: bekasiGeometry,
    scale: 100,
    maxPixels: 1e9
  });
  
  // Evaluate the statistics
  stats.evaluate(function(result) {
    console.log('Population statistics:', result);
    
    // Get min and max values, ensure min is at least 0
    let minPop = result.population_count_min || 0;
    let maxPop = result.population_count_max || 5000;
    
    // If min is negative, set it to 0
    if (minPop < 0) {
      minPop = 0;
    }
    
    // Round values properly
    minPop = Math.floor(minPop);
    maxPop = Math.ceil(maxPop);
    
    console.log(`Population range: ${minPop} - ${maxPop}`);
    
    // Define color ranges matching the provided image
    const colorRanges = [
      { min: 20, max: 99, color: '#94CEEF', label: '20-99' },
      { min: 100, max: 399, color: '#6CA5D3', label: '100-399' },
      { min: 400, max: 999, color: '#4682B4', label: '400-1k' },
      { min: 1000, max: 2999, color: '#2E5C8A', label: '1k-3k' },
      { min: 3000, max: 5499, color: '#1E3A5F', label: '3k-5.5k' },
      { min: 5500, max: 7499, color: '#6B4C9A', label: '5.5k-7.5k' },
      { min: 7500, max: 9999, color: '#8B6BA8', label: '7.5k-10k' },
      { min: 10000, max: 11999, color: '#A97FB5', label: '10k-12k' },
      { min: 12000, max: 15999, color: '#C893C2', label: '12k-16k' },
      { min: 16000, max: 21999, color: '#E6A7CF', label: '16k-22k' },
      { min: 22000, max: 29999, color: '#8B4513', label: '22k-30k' },
      { min: 30000, max: 49999, color: '#FF0000', label: '30k-50k' },
      { min: 50000, max: 99999, color: '#DC143C', label: '50k-100k' },
      { min: 100000, max: 199999, color: '#FFA500', label: '100k-200k' },
      { min: 200000, max: Infinity, color: '#FFD700', label: '200k+' }
    ];
    
    // Filter ranges that fall within our data range
    const relevantRanges = colorRanges.filter(range => 
      range.min <= maxPop && (range.max >= minPop || range.max === Infinity)
    );
    
    // Extract colors and labels for relevant ranges
    const palette = relevantRanges.map(r => r.color);
    const labels = relevantRanges.map(r => r.label);
    
    // Set visualization min/max to the first and last relevant range
    const visMin = relevantRanges[0].min;
    const visMax = relevantRanges[relevantRanges.length - 1].max === Infinity ? 
                   maxPop : relevantRanges[relevantRanges.length - 1].max;
    
    const popVis = {
      min: visMin,
      max: visMax,
      palette: palette
    };
    
    addLayer(population, popVis, 'Population');
    
    // Add click handler for population popup
    addPopulationClickHandler(map, population);
    
    // Create legend with relevant ranges only
    createLegend('Population Density (persons/km²)', 
      palette,
      labels,
      'Population');
      
    console.log('Population layer added with ranges:', labels);
  }, function(error) {
    console.error('Error calculating population statistics:', error);
    
    // Fallback to default values if calculation fails
    const popVis = {
      min: 20,
      max: 5500,
      palette: ['#94CEEF', '#6CA5D3', '#4682B4', '#2E5C8A', '#1E3A5F', '#6B4C9A']
    };
    
    addLayer(population, popVis, 'Population');
    
    // Add click handler for population popup
    addPopulationClickHandler(map, population);
    
    createLegend('Population Density (persons/km²)', 
      ['#94CEEF', '#6CA5D3', '#4682B4', '#2E5C8A', '#1E3A5F', '#6B4C9A'],
      ['20-99', '100-399', '400-1k', '1k-3k', '3k-5.5k', '5.5k-7.5k'],
      'Population');
  });
}

/**
 * Add click handler to display population count in popup
 * @param {L.Map} targetMap - The map to add the handler to
 * @param {ee.Image} populationImage - The population image
 */
function addPopulationClickHandler(targetMap, populationImage) {
  // Remove any existing population click handler
  if (targetMap._populationClickHandler) {
    targetMap.off('click', targetMap._populationClickHandler);
  }
  
  // Create new click handler
  const clickHandler = function(e) {
    const point = ee.Geometry.Point([e.latlng.lng, e.latlng.lat]);
    
    // Sample the population value at the clicked point
    const sample = populationImage.sample(point, 100);
    
    sample.evaluate(function(result) {
      if (result && result.features && result.features.length > 0) {
        const popValue = result.features[0].properties.population_count;
        
        if (popValue !== null && popValue !== undefined) {
          // Round the population value
          const roundedPop = Math.round(popValue);
          
          // Create popup content
          const popupContent = `
            <div style="padding: 5px;">
              <strong>Population Density</strong><br>
              <span style="font-size: 16px; color: #ff7504ff;">${roundedPop.toLocaleString()}</span> persons/km²<br>
              <small style="color: #50a302ff;">Lat: ${e.latlng.lat.toFixed(5)}, Lng: ${e.latlng.lng.toFixed(5)}</small>
            </div>
          `;
          
          // Show popup at clicked location
          L.popup()
            .setLatLng(e.latlng)
            .setContent(popupContent)
            .openOn(targetMap);
        } else {
          L.popup()
            .setLatLng(e.latlng)
            .setContent('<div style="padding: 5px;">No population data at this location</div>')
            .openOn(targetMap);
        }
      }
    }, function(error) {
      console.error('Error sampling population:', error);
      L.popup()
        .setLatLng(e.latlng)
        .setContent('<div style="padding: 5px;">Error retrieving population data</div>')
        .openOn(targetMap);
    });
  };
  
  // Store handler reference and add to map
  targetMap._populationClickHandler = clickHandler;
  targetMap.on('click', clickHandler);
}

/**
 * Show DEM layer on a specific map
 */
export function showDEMOnMap(targetMap, layerCollection, layerName) {
  const bekasiGeometry = ee.FeatureCollection([
    ee.Feature(ee.Geometry.Polygon(bekasiGeoJSON.features[0].geometry.coordinates), {})
  ]).geometry();
  
  const dem = ee.Image("USGS/SRTMGL1_003").clip(bekasiGeometry);
  
  const demVis = {
    min: 0,
    max: 50,
    palette: ['#253494', '#2c7fb8', '#41b6c4', '#a1dab4', '#ffffcc'],
    opacity: 0.7
  };
  
  addLayerToMap(targetMap, layerCollection, dem, demVis, layerName);
}

/**
 * Show Population layer on a specific map
 * Dynamically calculates min/max values from AOI with proper rounding
 */
export function showPopulationOnMap(targetMap, layerCollection, layerName) {
  const bekasiGeometry = ee.FeatureCollection([
    ee.Feature(ee.Geometry.Polygon(bekasiGeoJSON.features[0].geometry.coordinates), {})
  ]).geometry();
  
  const population = ee.ImageCollection("CIESIN/GPWv411/GPW_Population_Count")
    .filter(ee.Filter.date('2020-01-01', '2020-12-31'))
    .first()
    .clip(bekasiGeometry);
  
  // Calculate min and max values within the AOI
  const stats = population.reduceRegion({
    reducer: ee.Reducer.minMax(),
    geometry: bekasiGeometry,
    scale: 100,
    maxPixels: 1e9
  });
  
  // Evaluate the statistics
  stats.evaluate(function(result) {
    console.log('Population statistics for comparison map:', result);
    
    let minPop = result.population_count_min || 0;
    let maxPop = result.population_count_max || 5000;
    
    if (minPop < 0) {
      minPop = 0;
    }
    
    minPop = Math.floor(minPop);
    maxPop = Math.ceil(maxPop);
    
    // Define color ranges matching the provided image
    const colorRanges = [
      { min: 20, max: 99, color: '#94CEEF', label: '20-99' },
      { min: 100, max: 399, color: '#6CA5D3', label: '100-399' },
      { min: 400, max: 999, color: '#4682B4', label: '400-1k' },
      { min: 1000, max: 2999, color: '#2E5C8A', label: '1k-3k' },
      { min: 3000, max: 5499, color: '#1E3A5F', label: '3k-5.5k' },
      { min: 5500, max: 7499, color: '#6B4C9A', label: '5.5k-7.5k' },
      { min: 7500, max: 9999, color: '#8B6BA8', label: '7.5k-10k' },
      { min: 10000, max: 11999, color: '#A97FB5', label: '10k-12k' },
      { min: 12000, max: 15999, color: '#C893C2', label: '12k-16k' },
      { min: 16000, max: 21999, color: '#E6A7CF', label: '16k-22k' },
      { min: 22000, max: 29999, color: '#8B4513', label: '22k-30k' },
      { min: 30000, max: 49999, color: '#FF0000', label: '30k-50k' },
      { min: 50000, max: 99999, color: '#DC143C', label: '50k-100k' },
      { min: 100000, max: 199999, color: '#FFA500', label: '100k-200k' },
      { min: 200000, max: Infinity, color: '#FFD700', label: '200k+' }
    ];
    
    // Filter ranges that fall within our data range
    const relevantRanges = colorRanges.filter(range => 
      range.min <= maxPop && (range.max >= minPop || range.max === Infinity)
    );
    
    // Extract colors for relevant ranges
    const palette = relevantRanges.map(r => r.color);
    
    // Set visualization min/max to the first and last relevant range
    const visMin = relevantRanges[0].min;
    const visMax = relevantRanges[relevantRanges.length - 1].max === Infinity ? 
                   maxPop : relevantRanges[relevantRanges.length - 1].max;
    
    const popVis = {
      min: visMin,
      max: visMax,
      palette: palette,
      opacity: 0.7
    };
    
    addLayerToMap(targetMap, layerCollection, population, popVis, layerName);
    
    // Add click handler for comparison map
    addPopulationClickHandler(targetMap, population);
    
  }, function(error) {
    console.error('Error calculating population statistics:', error);
    
    // Fallback to default values
    const popVis = {
      min: 20,
      max: 5500,
      palette: ['#94CEEF', '#6CA5D3', '#4682B4', '#2E5C8A', '#1E3A5F', '#6B4C9A'],
      opacity: 0.7
    };
    
    addLayerToMap(targetMap, layerCollection, population, popVis, layerName);
    
    // Add click handler for comparison map
    addPopulationClickHandler(targetMap, population);
  });
}

/**
 * Show Bekasi AOI boundary on a specific map
 * Creates a visible boundary with translucent fill
 */
export function showAOIOnMap(targetMap, layerCollection, layerName) {
  const bekasiGeometry = ee.FeatureCollection([
    ee.Feature(ee.Geometry.Polygon(bekasiGeoJSON.features[0].geometry.coordinates), {})
  ]).geometry();
  
  // Create boundary image with visible black border
  const aoiBoundary = ee.Image().byte().paint({
    featureCollection: ee.FeatureCollection([ee.Feature(bekasiGeometry)]),
    color: 1,
    width: 3
  });
  
  // Visualization for black boundary
  const boundaryVis = {
    palette: ['#000000'],
    opacity: 1.0
  };
  
  addLayerToMap(targetMap, layerCollection, aoiBoundary, boundaryVis, layerName);
}

/**
 * Show VIDA Building Footprints layer on the main map
 */
export function showBuildingFootprints() {
  console.log('Loading VIDA Building Footprints data...');
  
  // Use GeoJSON AOI for more precise area definition
  const bekasiGeometry = ee.FeatureCollection([
    ee.Feature(ee.Geometry.Polygon(bekasiGeoJSON.features[0].geometry.coordinates), {})
  ]).geometry();
  
  // Load VIDA Combined Building Footprints for Indonesia and filter by AOI
  const vidaBuildings = ee.FeatureCollection("projects/sat-io/open-datasets/VIDA_COMBINED/IDN")
                          .filterBounds(bekasiGeometry);
  
  // Visualization parameters for building footprints
  const buildingVis = {
    color: '#FF5500',
    width: 1,
    fillColor: 'FF8800',
    fillOpacity: 0.6
  };
  
  // Add the layer to the map
  addLayer(vidaBuildings, buildingVis, 'Building Footprints');
  
  // Update legend
  createLegend('Buildings', 
    ['#FF8800'],
    ['Building Footprints'],
    'Building Footprints');
}

/**
 * Show VIDA Building Footprints layer on a specific map
 * @param {L.Map} targetMap - The map to add the layer to
 * @param {Object} layerCollection - The collection to store the layer in
 * @param {string} layerName - The name for the layer
 */
export function showBuildingFootprintsOnMap(targetMap, layerCollection, layerName) {
  // Use GeoJSON AOI for more precise area definition
  const bekasiGeometry = ee.FeatureCollection([
    ee.Feature(ee.Geometry.Polygon(bekasiGeoJSON.features[0].geometry.coordinates), {})
  ]).geometry();
  
  // Load VIDA Combined Building Footprints for Indonesia and filter by AOI
  const vidaBuildings = ee.FeatureCollection("projects/sat-io/open-datasets/VIDA_COMBINED/IDN")
                          .filterBounds(bekasiGeometry);
  
  // Visualization parameters for building footprints
  const buildingVis = {
    color: '#FF5500',
    width: 1,
    fillColor: 'FF8800',
    fillOpacity: 0.6,
    opacity: 0.7
  };
  
  // Add the layer to the map
  addLayerToMap(targetMap, layerCollection, vidaBuildings, buildingVis, layerName);
}


/**
 * Show Global Surface Water (GSW) layer on a specific map
 */
export function showGSWOnMap(targetMap, layerCollection, layerName) {
  const bekasiGeometry = ee.FeatureCollection([
    ee.Feature(ee.Geometry.Polygon(bekasiGeoJSON.features[0].geometry.coordinates), {})
  ]).geometry();
  
  const gsw = ee.Image("JRC/GSW1_4/GlobalSurfaceWater");
  const gswOccurrence = gsw.select('occurrence').clip(bekasiGeometry);
  
  const gswVis = {
    min: 0,
    max: 100,
    palette: ['white', '#4292c6', '#08306b'],
    opacity: 0.7
  };
  
  addLayerToMap(targetMap, layerCollection, gswOccurrence, gswVis, layerName);
}

/**
 * Show Bekasi AOI boundary on the main map
 * Creates a visible black boundary when checkbox is checked
 */
export function showAOI() {
  console.log('Loading AOI boundary...');
  
  const bekasiGeometry = ee.FeatureCollection([
    ee.Feature(ee.Geometry.Polygon(bekasiGeoJSON.features[0].geometry.coordinates), {})
  ]).geometry();
  
  // Create boundary image with visible black border
  const aoiBoundary = ee.Image().byte().paint({
    featureCollection: ee.FeatureCollection([ee.Feature(bekasiGeometry)]),
    color: 1,
    width: 3
  });
  
  // Visualization for black boundary
  const boundaryVis = {
    palette: ['#000000'],
    opacity: 1.0
  };
  
  addLayer(aoiBoundary, boundaryVis, 'Bekasi AOI');
  
  console.log('AOI boundary loaded');
}

/**
 * Show Global Surface Water (GSW) on main map
 */
export function showGSW() {
  console.log('Loading surface water data...');
  
  const bekasiGeometry = ee.FeatureCollection([
    ee.Feature(ee.Geometry.Polygon(bekasiGeoJSON.features[0].geometry.coordinates), {})
  ]).geometry();
  
  const gsw = ee.Image("JRC/GSW1_4/GlobalSurfaceWater");
  const gswOccurrence = gsw.select('occurrence').clip(bekasiGeometry);
  
  const gswVis = {
    min: 0,
    max: 100,
    palette: ['white', '#4292c6', '#08306b'],
    opacity: 0.7
  };
  
  addLayer(gswOccurrence, gswVis, 'Surface Water');
  
  createLegend('Surface Water Occurrence', 
    ['white', '#4292c6', '#08306b'],
    ['Rare', 'Occasional', 'Permanent'],
    'Surface Water');
}

/**
 * Add a layer to the main map
 */
export function addLayer(eeObject, visParams, name, visible = true) {
  console.log(`Processing ${name} data...`);
  try {
    eeObject.getMap(visParams, function(tileLayer) {
      console.log('Layer created:', name, tileLayer);
      
      if (layers[name]) {
        map.removeLayer(layers[name]);
      }
      
      const opacity = visParams.opacity !== undefined ? visParams.opacity : 0.7;
      
      var eeLayer = L.tileLayer(tileLayer.urlFormat, {
        attribution: "Google Earth Engine",
        opacity: opacity,
        zIndex: 10
      });
      
      layers[name] = eeLayer;
      
      if (visible) {
        eeLayer.addTo(map);
        
        if (addOpacitySliderToMap) {
          addOpacitySliderToMap(map, eeLayer, name);
        }
      }
      
      console.log(`${name} layer added to map`);
    });
  } catch (e) {
    console.error('Error in addLayer:', e);
  }
}

/**
 * Generic function to add an Earth Engine layer to a specific map
 */
export function addLayerToMap(targetMap, layerCollection, eeObject, visParams, name) {
  try {
    eeObject.getMap(visParams, function(tileLayer) {
      console.log(`Layer created for map: ${name}`, tileLayer);
      
      if (layerCollection[name]) {
        targetMap.removeLayer(layerCollection[name]);
      }
      
      const opacity = visParams.opacity !== undefined ? visParams.opacity : 0.7;
      
      var eeLayer = L.tileLayer(tileLayer.urlFormat, {
        attribution: "Google Earth Engine",
        opacity: opacity,
        zIndex: 10
      });
      
      layerCollection[name] = eeLayer;
      
      eeLayer.addTo(targetMap);
      
      if (addOpacitySliderToMap) {
        addOpacitySliderToMap(targetMap, eeLayer, name);
      }
      
      console.log(`${name} layer added to map`);
    });
  } catch (e) {
    console.error(`Error processing ${name} for map:`, e);
  }
}

/**
 * Clear a specific layer from the main map
 */
export function clearLayer(layerType) {
  const layerName = layerType === 'RiskZones' ? 'Flood Risk Zones' : layerType;
  
  if (layers[layerName]) {
    map.removeLayer(layers[layerName]);
    delete layers[layerName];
    console.log(`${layerName} layer removed`);
    
    // Remove population click handler when Population layer is removed
    if (layerName === 'Population' && map._populationClickHandler) {
      map.off('click', map._populationClickHandler);
      delete map._populationClickHandler;
      console.log('Population click handler removed');
    }
  }
}

/**
 * Refresh all layers on the main map
 */
export function refreshMainMapLayers() {
  Object.keys(layers).forEach(layerName => {
    const layer = layers[layerName];
    
    if (layer) {
      if (map.hasLayer(layer)) {
        map.removeLayer(layer);
        layer.addTo(map);
      }
    }
  });
}