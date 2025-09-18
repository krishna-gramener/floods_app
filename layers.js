// Layer management functions for the Bekasi Flood Monitoring System
import { updateStatus, createLegend } from './utils.js';
import { bekasiBounds, bekasiGeoJSON } from './config.js';

// Global Earth Engine datasets are accessed directly in each function for consistency

// Import opacity slider function from script.js
let addOpacitySliderToMap;

// Reference to global map objects and layer collections
let map;
let layers = {};
let layersLeft = {};
let layersRight = {};

/**
 * Initialize the layer management module with map references
 * @param {L.Map} mainMap - The main map instance
 * @param {Object} mainLayers - The main map layers collection
 * @param {L.Map} leftMap - The left comparison map instance
 * @param {Object} leftLayers - The left map layers collection
 * @param {L.Map} rightMap - The right comparison map instance
 * @param {Object} rightLayers - The right map layers collection
 * @param {Function} opacitySliderFn - Function to create opacity sliders
 */
export function initLayerManager(mainMap, mainLayers, leftMap, leftLayers, rightMap, rightLayers, opacitySliderFn) {
  map = mainMap;
  layers = mainLayers;
  layersLeft = leftLayers || {};
  layersRight = rightLayers || {};
  addOpacitySliderToMap = opacitySliderFn;

  // Store map references only if they exist
  if (leftMap) window.mapLeft = leftMap;
  if (rightMap) window.mapRight = rightMap;
}

/**
 * Show DEM layer on the main map
 */
export function showDEM() {
  updateStatus('Loading elevation data...');
  
  // Use GeoJSON AOI for more precise area definition
  const bekasiGeometry = ee.FeatureCollection([
    ee.Feature(ee.Geometry.Polygon(bekasiGeoJSON.features[0].geometry.coordinates), {})
  ]).geometry();
  
  // Get DEM data
  const dem = ee.Image("USGS/SRTMGL1_003").clip(bekasiGeometry);
  
  // Visualization parameters
  const demVis = {
    min: 0,
    max: 50,
    palette: ['#253494', '#2c7fb8', '#41b6c4', '#a1dab4', '#ffffcc']
  };
  
  // Add the layer to the map
  addLayer(dem, demVis, 'Elevation');
  
  // Update legend
  createLegend('Elevation (m)', 
    ['#253494', '#2c7fb8', '#41b6c4', '#a1dab4', '#ffffcc'],
    ['0', '10', '20', '30', '50']);
}

/**
 * Show Population layer on the main map
 */
export function showPopulation() {
  updateStatus('Loading population data...');
  
  // Use GeoJSON AOI for more precise area definition
  const bekasiGeometry = ee.FeatureCollection([
    ee.Feature(ee.Geometry.Polygon(bekasiGeoJSON.features[0].geometry.coordinates), {})
  ]).geometry();
  
  // Get population data
  const population = ee.ImageCollection("CIESIN/GPWv411/GPW_Population_Count")
    .filter(ee.Filter.date('2020-01-01', '2020-12-31'))
    .first()
    .clip(bekasiGeometry);
  
  // Visualization parameters
  const popVis = {
    min: 0,
    max: 5000,
    palette: ['white', 'yellow', 'orange', 'red']
  };
  
  // Add the layer to the map
  addLayer(population, popVis, 'Population');
  
  // Update legend
  createLegend('Population Density', 
    ['white', 'yellow', 'orange', 'red'],
    ['Low', 'Medium', 'High', 'Very High']);
}

/**
 * Show DEM layer on a specific map
 * @param {L.Map} targetMap - The map to add the layer to
 * @param {Object} layerCollection - The collection to store the layer in
 * @param {string} layerName - The name for the layer
 */
export function showDEMOnMap(targetMap, layerCollection, layerName) {
  // Use GeoJSON AOI for more precise area definition (same as main map)
  const bekasiGeometry = ee.FeatureCollection([
    ee.Feature(ee.Geometry.Polygon(bekasiGeoJSON.features[0].geometry.coordinates), {})
  ]).geometry();
  
  // Get DEM data
  const dem = ee.Image("USGS/SRTMGL1_003").clip(bekasiGeometry);
  
  // Visualization parameters
  const demVis = {
    min: 0,
    max: 50,
    palette: ['#253494', '#2c7fb8', '#41b6c4', '#a1dab4', '#ffffcc'],
    opacity: 0.7
  };
  
  // Add the layer to the map
  addLayerToMap(targetMap, layerCollection, dem, demVis, layerName);
}

/**
 * Show Population layer on a specific map
 * @param {L.Map} targetMap - The map to add the layer to
 * @param {Object} layerCollection - The collection to store the layer in
 * @param {string} layerName - The name for the layer
 */
export function showPopulationOnMap(targetMap, layerCollection, layerName) {
  // Use GeoJSON AOI for more precise area definition (same as main map)
  const bekasiGeometry = ee.FeatureCollection([
    ee.Feature(ee.Geometry.Polygon(bekasiGeoJSON.features[0].geometry.coordinates), {})
  ]).geometry();
  
  // Get population data
  const population = ee.ImageCollection("CIESIN/GPWv411/GPW_Population_Count")
    .filter(ee.Filter.date('2020-01-01', '2020-12-31'))
    .first()
    .clip(bekasiGeometry);
  
  // Visualization parameters
  const popVis = {
    min: 0,
    max: 5000,
    palette: ['white', 'yellow', 'orange', 'red'],
    opacity: 0.7
  };
  
  // Add the layer to the map
  addLayerToMap(targetMap, layerCollection, population, popVis, layerName);
}

/**
 * Show Bekasi AOI boundary on a specific map
 * @param {L.Map} targetMap - The map to add the layer to
 * @param {Object} layerCollection - The collection to store the layer in
 * @param {string} layerName - The name for the layer
 */
export function showAOIOnMap(targetMap, layerCollection, layerName) {
  // Use GeoJSON AOI for precise area definition
  const bekasiGeometry = ee.FeatureCollection([
    ee.Feature(ee.Geometry.Polygon(bekasiGeoJSON.features[0].geometry.coordinates), {})
  ]).geometry();
  
  // Create a filled image for the AOI area with translucent black fill
  const aoiFill = ee.Image(1).clip(bekasiGeometry);
  
  // Create a boundary image for the AOI and combine with fill
  const aoiBoundary = ee.Image().byte().paint({
    featureCollection: ee.FeatureCollection([ee.Feature(bekasiGeometry)]),
    color: 1,
    width: 2
  });
  
  // Visualization parameters for fill
  const fillVis = {
    palette: ['#000000'], // Black fill
    opacity: 0.2 // Translucent
  };
  
  // Add only the fill layer with the AOI name
  addLayerToMap(targetMap, layerCollection, aoiFill, fillVis, layerName);
}

/**
 * Show Global Surface Water (GSW) layer on a specific map
 * @param {L.Map} targetMap - The map to add the layer to
 * @param {Object} layerCollection - The collection to store the layer in
 * @param {string} layerName - The name for the layer
 */
export function showGSWOnMap(targetMap, layerCollection, layerName) {
  // Use GeoJSON AOI for more precise area definition
  const bekasiGeometry = ee.FeatureCollection([
    ee.Feature(ee.Geometry.Polygon(bekasiGeoJSON.features[0].geometry.coordinates), {})
  ]).geometry();
  
  // Get GSW occurrence data from JRC dataset
  const gsw = ee.Image("JRC/GSW1_4/GlobalSurfaceWater");
  const gswOccurrence = gsw.select('occurrence').clip(bekasiGeometry);
  
  // Visualization parameters
  const gswVis = {
    min: 0,
    max: 100,
    palette: ['white', '#4292c6', '#08306b'],
    opacity: 0.7
  };
  
  // Add the layer to the map
  addLayerToMap(targetMap, layerCollection, gswOccurrence, gswVis, layerName);
}

/**
 * Show Bekasi AOI boundary on the main map
 */
export function showAOI() {
  updateStatus('Loading AOI boundary...');
  
  // Use GeoJSON AOI for precise area definition
  const bekasiGeometry = ee.FeatureCollection([
    ee.Feature(ee.Geometry.Polygon(bekasiGeoJSON.features[0].geometry.coordinates), {})
  ]).geometry();
  
  // Create a filled image for the AOI area with translucent black fill
  const aoiFill = ee.Image(1).clip(bekasiGeometry);
  
  // Create a boundary image for the AOI and combine with fill
  const aoiBoundary = ee.Image().byte().paint({
    featureCollection: ee.FeatureCollection([ee.Feature(bekasiGeometry)]),
    color: 1,
    width: 2
  });
  
  // Visualization parameters for fill
  const fillVis = {
    palette: ['#000000'], // Black fill
    opacity: 0.2 // Translucent
  };
  
  // Add only the fill layer with the AOI name
  addLayer(aoiFill, fillVis, 'Bekasi AOI');
  
  updateStatus('AOI boundary loaded');
}

/**
 * Show Global Surface Water (GSW) on main map
 */
export function showGSW() {
  updateStatus('Loading surface water data...');
  
  // Use GeoJSON AOI for more precise area definition
  const bekasiGeometry = ee.FeatureCollection([
    ee.Feature(ee.Geometry.Polygon(bekasiGeoJSON.features[0].geometry.coordinates), {})
  ]).geometry();
  
  // Get GSW occurrence data from JRC dataset
  const gsw = ee.Image("JRC/GSW1_4/GlobalSurfaceWater");
  const gswOccurrence = gsw.select('occurrence').clip(bekasiGeometry);
  
  // Visualization parameters
  const gswVis = {
    min: 0,
    max: 100,
    palette: ['white', '#4292c6', '#08306b'],
    opacity: 0.7
  };
  
  // Add the layer to the map using the common addLayer function
  addLayer(gswOccurrence, gswVis, 'Surface Water');
  
  // Update legend
  createLegend('Surface Water Occurrence', 
    ['white', '#4292c6', '#08306b'],
    ['Rare', 'Occasional', 'Permanent']);
}

/**
 * Add a layer to the main map
 * @param {ee.Image} eeObject - The Earth Engine object to add
 * @param {Object} visParams - Visualization parameters
 * @param {string} name - The name for the layer
 * @param {boolean} visible - Whether the layer should be visible initially
 */
export function addLayer(eeObject, visParams, name, visible = true) {
  updateStatus(`Processing ${name} data...`);
  try {
    eeObject.getMap(visParams, function(tileLayer) {
      console.log('Layer created:', name, tileLayer);
      
      // Remove existing layer with same name if it exists
      if (layers[name]) {
        map.removeLayer(layers[name]);
      }
      
      // Use opacity from visParams if provided, otherwise default to 0.7
      const opacity = visParams.opacity !== undefined ? visParams.opacity : 0.7;
      
      // Create Leaflet tile layer using the URL from Earth Engine
      var eeLayer = L.tileLayer(tileLayer.urlFormat, {
        attribution: "Google Earth Engine",
        opacity: opacity,
        zIndex: 10 // Ensure Earth Engine layers are always on top of base maps
      });
      
      // Store layer reference in both collections
      layers[name] = eeLayer;
      
      // Add to map if visible is true
      if (visible) {
        eeLayer.addTo(map);
        
        // Add opacity slider if the function is available
        if (addOpacitySliderToMap) {
          addOpacitySliderToMap(map, eeLayer, name);
        }
      }
      
      updateStatus(`${name} layer added to map`);
    });
  } catch (e) {
    updateStatus(`Error processing ${name}: ${e.message}`);
    console.error('Error in addLayer:', e);
  }
}

/**
 * Generic function to add an Earth Engine layer to a specific map
 * @param {L.Map} targetMap - The map to add the layer to
 * @param {Object} layerCollection - The collection to store the layer in
 * @param {ee.Image} eeObject - The Earth Engine object to add
 * @param {Object} visParams - Visualization parameters
 * @param {string} name - The name for the layer
 */
export function addLayerToMap(targetMap, layerCollection, eeObject, visParams, name) {
  try {
    eeObject.getMap(visParams, function(tileLayer) {
      console.log(`Layer created for map: ${name}`, tileLayer);
      
      // Remove existing layer with same name if it exists
      if (layerCollection[name]) {
        targetMap.removeLayer(layerCollection[name]);
      }
      
      // Use opacity from visParams if provided, otherwise default to 0.7
      const opacity = visParams.opacity !== undefined ? visParams.opacity : 0.7;
      
      // Create Leaflet tile layer using the URL from Earth Engine
      var eeLayer = L.tileLayer(tileLayer.urlFormat, {
        attribution: "Google Earth Engine",
        opacity: opacity,
        zIndex: 10 // Ensure Earth Engine layers are always on top of base maps
      });
      
      // Store layer reference
      layerCollection[name] = eeLayer;
      
      // Add to map
      eeLayer.addTo(targetMap);
      
      // Add opacity slider if the function is available
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
 * @param {string} layerType - The type of layer to clear
 */
export function clearLayer(layerType) {
  // Find the layer by name
  const layerName = layerType === 'RiskZones' ? 'Flood Risk Zones' : layerType;
  
  if (layers[layerName]) {
    map.removeLayer(layers[layerName]);
    delete layers[layerName];
    updateStatus(`${layerName} layer removed`);
  }
}

/**
 * Refresh all layers on the main map
 * This ensures layers are properly displayed after switching back from comparison view
 */
export function refreshMainMapLayers() {
  // Get all active layers
  Object.keys(layers).forEach(layerName => {
    const layer = layers[layerName];
    
    // If the layer exists, refresh it
    if (layer) {
      // Temporarily remove and re-add the layer to refresh it
      if (map.hasLayer(layer)) {
        map.removeLayer(layer);
        layer.addTo(map);
      }
    }
  });
}