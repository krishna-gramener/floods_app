// Map control functions for the Bekasi Flood Monitoring System
import { updateStatus } from './utils.js';
import { showDEM, showPopulation, showDEMOnMap, showPopulationOnMap, clearLayer, refreshMainMapLayers } from './layers.js';
import { bekasiBounds } from './config.js';

// Import opacity slider functions from script.js
let removeOpacitySliderForLayer;
let removeAllOpacitySliders;

// Reference to global map objects and layer collections
let map;
let mapLeft;
let mapRight;
let layers = {};
let layersLeft = {};
let layersRight = {};
let overlays = {};
let baseMaps = {};
let legend;
let isComparisonMode = false;

/**
 * Initialize the map controls module with references
 * @param {Object} mainMap - The main map instance
 * @param {Object} mainLayers - The main map layers collection
 * @param {Object} mainOverlays - The main map overlays collection
 * @param {Object} leftMap - The left comparison map instance
 * @param {Object} leftLayers - The left map layers collection
 * @param {Object} rightMap - The right comparison map instance
 * @param {Object} rightLayers - The right map layers collection
 * @param {Object} bounds - The Bekasi bounds object
 * @param {boolean} comparisonMode - Whether the app is in comparison mode
 * @param {Function} removeOpacitySliderForLayerFn - Function to remove opacity slider for a layer
 * @param {Function} removeAllOpacitySlidersFn - Function to remove all opacity sliders
 */
export function initMapControls(mainMap, mainLayers, mainOverlays, leftMap, leftLayers, rightMap, rightLayers, bounds, comparisonMode, removeOpacitySliderForLayerFn, removeAllOpacitySlidersFn) {
  map = mainMap;
  mapLeft = leftMap;
  mapRight = rightMap;
  layers = mainLayers;
  layersLeft = leftLayers;
  layersRight = rightLayers;
  overlays = mainOverlays;
  isComparisonMode = comparisonMode;
  removeOpacitySliderForLayer = removeOpacitySliderForLayerFn;
  removeAllOpacitySliders = removeAllOpacitySlidersFn;
}

/**
 * Initialize the main map
 */
export function initMap() {
  updateStatus('Initializing map...');
  
  if (!bekasiBounds) {
    console.error('bekasiBounds is not defined');
    // Use default Bekasi coordinates if bounds not provided
    bekasiBounds = {
      bounds: [[-6.45, 106.88], [-6.10, 107.15]],
      center: [-6.275, 107.015]
    };
  }
  
  // Create the map centered on Bekasi
  map = L.map('map', {
    center: bekasiBounds.center,
    zoom: 13, // Slightly higher zoom for better detail
    fullscreenControl: true,
    fullscreenControlOptions: {
      position: 'topleft'
    }
  });
  
  // Add base layers
  addBaseLayers();
  
  // Add Bekasi boundary using GeoJSON
  const aoiCoordinates = [
    [
      [107.06234950376387, -6.213090828568937],
      [106.9242495370928, -6.213090828568937],
      [106.9242495370928, -6.348589327912876],
      [107.06234950376387, -6.348589327912876],
      [107.06234950376387, -6.213090828568937]
    ]
  ];
  
  // Convert GeoJSON coordinates to Leaflet format (swap lat/lng)
  const leafletCoords = aoiCoordinates[0].map(coord => [coord[1], coord[0]]);
  
  // Add polygon to map
  L.polygon(leafletCoords, {
    color: '#000',
    weight: 2,
    fillOpacity: 0.05,
    fillColor: '#3388ff'
  }).addTo(map).bindPopup('Bekasi Study Area - March 2025 Flood Zone');
  
  // Add layer control for base maps and overlays
  const layerControl = L.control.layers(baseMaps, {}, {
    position: 'topright',
    collapsed: false
  }).addTo(map);
  
  // Add data layers to the control
  layerControl.addOverlay(createDummyLayer(), 'Elevation');
  layerControl.addOverlay(createDummyLayer(), 'Population');
  
  // Initialize overlays object
  overlays['Pre-Flood Analysis'] = L.layerGroup();
  overlays['During-Flood Analysis'] = null;
  overlays['Post-Flood Analysis'] = null;
  
  // Add event listeners for main map overlay checkboxes
  map.on('overlayadd', function(e) {
    const layerName = e.name;
    console.log(`Layer added to main map: ${layerName}`);
    
    if (layerName === 'Elevation') {
      showDEM();
    } else if (layerName === 'Population') {
      showPopulation();
    }
  });
  
  map.on('overlayremove', function(e) {
    const layerName = e.name;
    console.log(`Layer removed from main map: ${layerName}`);
    
    if (layerName === 'Elevation') {
      clearLayer('Elevation');
      removeOpacitySliderForLayer('main', 'Elevation');
    } else if (layerName === 'Population') {
      clearLayer('Population');
      removeOpacitySliderForLayer('main', 'Population');
    }
  });
  
  // Add custom coordinates display to bottom left
  addCoordinatesDisplay(map, 'bottomleft');
  
  // Handle base map changes to ensure overlays remain visible
  map.on('baselayerchange', function(e) {
    console.log('Base layer changed to:', e.name);
    
    // Re-add all active overlays to ensure they're on top of the new base layer
    Object.keys(overlays).forEach(function(layerName) {
      if (map.hasLayer(overlays[layerName])) {
        overlays[layerName].bringToFront();
      }
    });
  });
  
  // Create legend control
  legend = L.control({position: 'bottomright'});
  legend.onAdd = function() {
    const div = L.DomUtil.create('div', 'legend');
    div.innerHTML = '<div id="legend-content"></div>';
    return div;
  };
  legend.addTo(map);
  
  updateStatus('Map initialized. Click a button to load data.');
  
  return map;
}

/**
 * Add base layers to the main map
 */
export function addBaseLayers() {
  // Create base maps
  baseMaps = {}; // Use the global baseMaps variable
  baseMaps["Normal"] = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });
  baseMaps["Satellite"] = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  });
  
  // Add default base layer
  baseMaps["Normal"].addTo(map);
  
  return baseMaps;
}

/**
 * Toggle between single map and comparison view
 */
export function toggleComparisonView() {
  const mapContainer = document.getElementById('map-container');
  const comparisonContainer = document.getElementById('comparison-container');
  const compareButton = document.getElementById('compare-button');
  const compareFullscreenButton = document.getElementById('compare-fullscreen-button');
  
  if (!isComparisonMode) {
    // Switch to comparison view
    mapContainer.style.display = 'none';
    comparisonContainer.style.display = 'flex';
    compareButton.innerHTML = '<i class="bi bi-fullscreen-exit"></i>';
    compareButton.title = 'Return to single map view';
    
    // Show the fullscreen comparison button
    compareFullscreenButton.classList.remove('d-none');
    compareFullscreenButton.classList.add('d-inline-block');
    
    // Remove all opacity sliders from main map
    removeAllOpacitySliders('main');
    
    // Initialize comparison maps if not already done
    if (!mapLeft || !mapRight) {
      initComparisonMaps();
    } else {
      // Update the view to match the main map
      mapLeft.setView(map.getCenter(), map.getZoom());
      mapRight.setView(map.getCenter(), map.getZoom());
    }
    
    isComparisonMode = true;
  } else {
    // Switch back to single map view
    mapContainer.style.display = 'block';
    comparisonContainer.style.display = 'none';
    compareButton.innerHTML = '<i class="bi bi-layout-split"></i>';
    compareButton.title = 'Toggle comparison view';
    
    // Hide the fullscreen comparison button
    compareFullscreenButton.classList.remove('d-inline-block');
    compareFullscreenButton.classList.add('d-none');
    
    // Exit fullscreen if we're in fullscreen mode
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    
    // Update the main map view to match the comparison maps
    if (mapLeft) {
      map.setView(mapLeft.getCenter(), mapLeft.getZoom());
    }
    
    // Remove all opacity sliders from comparison maps
    removeAllOpacitySliders('left');
    removeAllOpacitySliders('right');
    
    // Restore main map layers and their opacity sliders
    refreshMainMapLayers();
    
    isComparisonMode = false;
  }
  
  // Invalidate size to ensure proper rendering after display changes
  setTimeout(function() {
    if (map) map.invalidateSize();
    if (mapLeft) mapLeft.invalidateSize();
    if (mapRight) mapRight.invalidateSize();
  }, 100);
}

/**
 * Toggle fullscreen for comparison view
 */
export function toggleComparisonFullscreen() {
  const comparisonContainer = document.getElementById('comparison-container');
  const compareFullscreenButton = document.getElementById('compare-fullscreen-button');
  
  if (!document.fullscreenElement) {
    // Enter fullscreen
    if (comparisonContainer.requestFullscreen) {
      comparisonContainer.requestFullscreen();
    } else if (comparisonContainer.mozRequestFullScreen) { // Firefox
      comparisonContainer.mozRequestFullScreen();
    } else if (comparisonContainer.webkitRequestFullscreen) { // Chrome, Safari and Opera
      comparisonContainer.webkitRequestFullscreen();
    } else if (comparisonContainer.msRequestFullscreen) { // IE/Edge
      comparisonContainer.msRequestFullscreen();
    }
    compareFullscreenButton.innerHTML = '<i class="bi bi-fullscreen-exit"></i>';
    compareFullscreenButton.title = 'Exit fullscreen comparison';
  } else {
    // Exit fullscreen
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.mozCancelFullScreen) { // Firefox
      document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) { // Chrome, Safari and Opera
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) { // IE/Edge
      document.msExitFullscreen();
    }
    compareFullscreenButton.innerHTML = '<i class="bi bi-fullscreen"></i>';
    compareFullscreenButton.title = 'Fullscreen comparison';
  }
  
  // Invalidate size to ensure proper rendering after fullscreen changes
  setTimeout(function() {
    if (mapLeft) mapLeft.invalidateSize();
    if (mapRight) mapRight.invalidateSize();
  }, 100);
}

/**
 * Initialize the comparison maps
 */
export function initComparisonMaps() {
  // Create left map
  const leftMap = L.map('map-left', {
    fullscreenControl: true,
    fullscreenControlOptions: {
      position: 'topleft'
    }
  }).setView(bekasiBounds.center, 12);
  
  // Create right map
  const rightMap = L.map('map-right', {
    fullscreenControl: true,
    fullscreenControlOptions: {
      position: 'topleft'
    }
  }).setView(bekasiBounds.center, 12);
  
  // Store maps in module scope
  mapLeft = leftMap;
  mapRight = rightMap;
  
  // Add base layers to comparison maps
  addBaseLayersToComparisonMaps();
  
  // Add coordinates display to both maps
  addCoordinatesDisplay(leftMap, 'bottomleft');
  addCoordinatesDisplay(rightMap, 'bottomleft');
  
  // Synchronize map movements (optional)
  leftMap.on('move', function() {
    rightMap.setView(leftMap.getCenter(), leftMap.getZoom(), {
      animate: false
    });
  });
  
  rightMap.on('move', function() {
    leftMap.setView(rightMap.getCenter(), rightMap.getZoom(), {
      animate: false
    });
  });
  
  return { mapLeft: leftMap, mapRight: rightMap };

  // Return initialized maps
  return { mapLeft, mapRight };

}

/**
 * Add base layers to comparison maps
 */
export function addBaseLayersToComparisonMaps() {
  // Create base layers for left map
  const leftBaseMaps = {};
  leftBaseMaps["Normal"] = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });
  leftBaseMaps["Satellite"] = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  });
  
  // Create base layers for right map
  const rightBaseMaps = {};
  rightBaseMaps["Normal"] = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });
  rightBaseMaps["Satellite"] = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  });
  
  // Add default base layers
  leftBaseMaps["Normal"].addTo(mapLeft);
  rightBaseMaps["Satellite"].addTo(mapRight);
  
  // Add layer controls with empty overlays initially
  const leftLayerControl = L.control.layers(leftBaseMaps, {}, {
    position: 'topright',
    collapsed: false
  }).addTo(mapLeft);
  
  const rightLayerControl = L.control.layers(rightBaseMaps, {}, {
    position: 'topright',
    collapsed: false
  }).addTo(mapRight);
  
  // Add data layers to the controls
  leftLayerControl.addOverlay(createDummyLayer(), 'Elevation');
  leftLayerControl.addOverlay(createDummyLayer(), 'Population');
  
  rightLayerControl.addOverlay(createDummyLayer(), 'Elevation');
  rightLayerControl.addOverlay(createDummyLayer(), 'Population');
  
  // Add Bekasi boundary to both maps
  L.rectangle(bekasiBounds.bounds, {
    color: 'black',
    weight: 2,
    fillOpacity: 0,
  }).addTo(mapLeft).bindPopup('Bekasi Study Area');
  
  L.rectangle(bekasiBounds.bounds, {
    color: 'black',
    weight: 2,
    fillOpacity: 0,
  }).addTo(mapRight).bindPopup('Bekasi Study Area');
  
  // Add event listeners for left map overlay changes
  mapLeft.on('overlayadd', function(e) {
    const layerName = e.name;
    console.log(`Layer added to left map: ${layerName}`);
    
    if (layerName === 'Elevation') {
      showDEMOnMap(mapLeft, layersLeft, layerName);
    } else if (layerName === 'Population') {
      showPopulationOnMap(mapLeft, layersLeft, layerName);
    }
  });
  
  mapLeft.on('overlayremove', function(e) {
    const layerName = e.name;
    console.log(`Layer removed from left map: ${layerName}`);
    
    if (layersLeft[layerName]) {
      mapLeft.removeLayer(layersLeft[layerName]);
      delete layersLeft[layerName];
      removeOpacitySliderForLayer('left', layerName);
    }
  });
  
  // Add event listeners for right map overlay changes
  mapRight.on('overlayadd', function(e) {
    const layerName = e.name;
    console.log(`Layer added to right map: ${layerName}`);
    
    if (layerName === 'Elevation') {
      showDEMOnMap(mapRight, layersRight, layerName);
    } else if (layerName === 'Population') {
      showPopulationOnMap(mapRight, layersRight, layerName);
    }
  });
  
  mapRight.on('overlayremove', function(e) {
    const layerName = e.name;
    console.log(`Layer removed from right map: ${layerName}`);
    
    if (layersRight[layerName]) {
      mapRight.removeLayer(layersRight[layerName]);
      delete layersRight[layerName];
      removeOpacitySliderForLayer('right', layerName);
    }
  });
}

/**
 * Add coordinates display to a specific map
 * @param {L.Map} targetMap - The map to add the slider to
 * @param {string} position - The position on the map ('bottomleft', 'bottomright', etc.)
 */
export function addCoordinatesDisplay(targetMap, position) {
  // Create a unique class for this map's coordinates display
  const mapId = targetMap === map ? 'main' : (targetMap === mapLeft ? 'left' : 'right');
  const coordsClass = `coordinates-control-${mapId}`;
  
  const coordsDisplay = L.control({position: position});
  
  coordsDisplay.onAdd = function(map) {
    const div = L.DomUtil.create('div', `leaflet-control leaflet-bar ${coordsClass}`);
    div.innerHTML = 'Lat: 0.00000, Lng: 0.00000';
    div.style.backgroundColor = 'white';
    div.style.padding = '5px 10px';
    div.style.fontSize = '12px';
    div.style.borderRadius = '4px';
    div.style.boxShadow = '0 1px 5px rgba(0,0,0,0.4)';
    div.style.zIndex = '1000'; // Ensure it's always on top
    return div;
  };
  
  // Add the control to the map
  coordsDisplay.addTo(targetMap);
  
  // Update coordinates on mouse move
  targetMap.on('mousemove', function(e) {
    const lat = e.latlng.lat.toFixed(5);
    const lng = e.latlng.lng.toFixed(5);
    // Find the coordinates control using the unique class
    const coordsElement = targetMap.getContainer().querySelector(`.${coordsClass}`);
    if (coordsElement) {
      coordsElement.innerHTML = `Lat: ${lat}, Lng: ${lng}`;
    }
  });
}

/**
 * Create a dummy layer for the layer control
 */
export function createDummyLayer() {
  return L.layerGroup();
}