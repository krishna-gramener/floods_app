// Map control functions for the Bekasi Flood Monitoring System
// import { updateStatus } from './utils.js';
import { showDEM, showPopulation, showGSW, showAOI, showBuildingFootprints, showBekasiWards, showDEMOnMap, showPopulationOnMap, showGSWOnMap, showAOIOnMap, showBuildingFootprintsOnMap, showBekasiWardsOnMap, clearLayer, refreshMainMapLayers } from './layers.js';
import { showLegend, hideLegend } from './utils.js';
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
 * Custom control class for the Basemap Gallery to give it a unique icon class.
 */
const BasemapGalleryControl = L.Control.Layers.extend({
    onAdd: function (map) {
        const container = L.Control.Layers.prototype.onAdd.call(this, map);
        L.DomUtil.addClass(container, 'leaflet-control-basemap-gallery'); 
        return container;
    }
});

// A helper function to create an instance of the custom control
function basemapControl(baseLayers, overlays, options) {
    return new BasemapGalleryControl(baseLayers, overlays, options);
}

/**
 * Initialize the map controls module with references
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
/**
 * Initialize the main map
 */
export function initMap() {
    console.log('Initializing map...');
    
    if (!bekasiBounds) {
        console.error('bekasiBounds is not defined');
        bekasiBounds = {
            bounds: [[-6.45, 106.88], [-6.10, 107.15]],
            center: [-6.275, 107.015]
        };
    }
    
    // Create the map centered on Bekasi
    map = L.map('map', {
        center: bekasiBounds.center,
        zoom: 12,
        zoomControl: false, 
        fullscreenControl: true,
        fullscreenControlOptions: {
            position: 'topright'
        }
    });
    
    // Add base layers
    addBaseLayers();
    
    // DON'T add the Bekasi boundary by default
    // It will only be shown when user checks the "Bekasi AOI" checkbox
    
    // Layer Control 1: Basemap Gallery (Base layers only, custom icon)
    basemapControl(baseMaps, null, {
        position: 'topleft', 
        collapsed: true 
    }).addTo(map);

    // Layer Control 2: Layer List (Overlays only, default icon)
    const layerControl = L.control.layers(null, {}, {
        position: 'topleft', 
        collapsed: true 
    }).addTo(map);

    // Custom zoom control at bottomright
    L.control.zoom({
        position: 'bottomright'
    }).addTo(map);
    
    // Add data layers to the Layer List control
    layerControl.addOverlay(createDummyLayer(), 'Bekasi AOI');
    layerControl.addOverlay(createDummyLayer(), 'Elevation');
    layerControl.addOverlay(createDummyLayer(), 'Population');
    layerControl.addOverlay(createDummyLayer(), 'Surface Water');
    layerControl.addOverlay(createDummyLayer(), 'Building Footprints');
    layerControl.addOverlay(createDummyLayer(), 'Bekasi Wards');
    
    // Initialize overlays object
    overlays['Pre-Flood Analysis'] = L.layerGroup();
    overlays['During-Flood Analysis'] = null;
    overlays['Post-Flood Analysis'] = null;
    
    // Add event listeners for main map overlay checkboxes
    map.on('overlayadd', function(e) {
        const layerName = e.name;
        console.log(`Layer added to main map: ${layerName}`);
        
        if (layerName === 'Bekasi AOI') {
            showAOI();
        } else if (layerName === 'Elevation') {
            showDEM();
            showLegend('Elevation');
        } else if (layerName === 'Population') {
            showPopulation();
            showLegend('Population');
        } else if (layerName === 'Surface Water') {
            showGSW();
            showLegend('Surface Water');
        }else if (layerName === 'Building Footprints') {
            showBuildingFootprints();
            showLegend('Building Footprints');
        }else if (layerName === 'Bekasi Wards') {
            showBekasiWards();
            showLegend('Bekasi Wards');
        }
    });
    
    map.on('overlayremove', function(e) {
        const layerName = e.name;
        console.log(`Layer removed from main map: ${layerName}`);
        
        if (layerName === 'Bekasi AOI') {
            clearLayer('Bekasi AOI');
            removeOpacitySliderForLayer('main', 'Bekasi AOI');
        } else if (layerName === 'Elevation') {
            clearLayer('Elevation');
            removeOpacitySliderForLayer('main', 'Elevation');
            hideLegend('Elevation');
        } else if (layerName === 'Population') {
            clearLayer('Population');
            removeOpacitySliderForLayer('main', 'Population');
            hideLegend('Population');
            // Remove population click handler
            if (map._populationClickHandler) {
                map.off('click', map._populationClickHandler);
                delete map._populationClickHandler;
                console.log('Population click handler removed from main map');
            }
        } else if (layerName === 'Surface Water') {
            clearLayer('Surface Water');
            removeOpacitySliderForLayer('main', 'Surface Water');
            hideLegend('Surface Water');
        }else if (layerName === 'Building Footprints') {
            clearLayer('Building Footprints');
            removeOpacitySliderForLayer('main', 'Building Footprints');
            hideLegend('Building Footprints');
        }else if (layerName === 'Bekasi Wards') {
            clearLayer('Bekasi Wards');
            removeOpacitySliderForLayer('main', 'Bekasi Wards');
            hideLegend('Bekasi Wards');
        }
    });
    
    // Add custom coordinates display to bottom left
    addCoordinatesDisplay(map, 'bottomleft');
    
    // Handle base map changes to ensure overlays remain visible
    map.on('baselayerchange', function(e) {
        console.log('Base layer changed to:', e.name);
        
        // Re-add all active overlays to ensure they're on top of the new base layer
        Object.keys(overlays).forEach(function(layerName) {
            // THE FIX IS HERE
            if (overlays[layerName] && map.hasLayer(overlays[layerName])) {
                overlays[layerName].bringToFront();
            }
        });
    });
    
    // Create legend control
    legend = L.control({position: 'bottomleft'});
    legend.onAdd = function() {
        const div = L.DomUtil.create('div', 'legend');
        div.innerHTML = '<div id="legend-content"></div>';
        return div;
    };
    legend.addTo(map);
    
    console.log('Map initialized. Click a button to load data.');
    
    return map;
}

/**
 * Add base layers to the main map
 */
export function addBaseLayers() {
  baseMaps = {};
  baseMaps["Normal"] = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });
  baseMaps["Satellite"] = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  });
  
  baseMaps["Satellite"].addTo(map);
  
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
    mapContainer.style.display = 'none';
    comparisonContainer.style.display = 'flex';
    compareButton.innerHTML = '<i class="bi bi-fullscreen-exit"></i>';
    compareButton.title = 'Return to single map view';
    
    compareFullscreenButton.classList.remove('d-none');
    compareFullscreenButton.classList.add('d-inline-block');
    
    removeAllOpacitySliders('main');
    
    if (!mapLeft || !mapRight) {
      initComparisonMaps();
    } else {
      mapLeft.setView(map.getCenter(), map.getZoom());
      mapRight.setView(map.getCenter(), map.getZoom());
    }
    
    isComparisonMode = true;
    
    if (window.updateFloodAnalysisComparisonMode) {
      window.updateFloodAnalysisComparisonMode(true);
    }
  } else {
    mapContainer.style.display = 'block';
    comparisonContainer.style.display = 'none';
    compareButton.innerHTML = '<i class="bi bi-layout-split"></i>';
    compareButton.title = 'Toggle comparison view';
    
    compareFullscreenButton.classList.remove('d-inline-block');
    compareFullscreenButton.classList.add('d-none');
    
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    
    if (mapLeft) {
      map.setView(mapLeft.getCenter(), mapLeft.getZoom());
    }
    
    removeAllOpacitySliders('left');
    removeAllOpacitySliders('right');
    
    refreshMainMapLayers();
    
    isComparisonMode = false;
    
    if (window.updateFloodAnalysisComparisonMode) {
      window.updateFloodAnalysisComparisonMode(false);
    }
  }
  
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
    if (comparisonContainer.requestFullscreen) {
      comparisonContainer.requestFullscreen();
    } else if (comparisonContainer.mozRequestFullScreen) {
      comparisonContainer.mozRequestFullScreen();
    } else if (comparisonContainer.webkitRequestFullscreen) {
      comparisonContainer.webkitRequestFullscreen();
    } else if (comparisonContainer.msRequestFullscreen) {
      comparisonContainer.msRequestFullscreen();
    }
    compareFullscreenButton.innerHTML = '<i class="bi bi-fullscreen-exit"></i>';
    compareFullscreenButton.title = 'Exit fullscreen comparison';
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
    compareFullscreenButton.innerHTML = '<i class="bi bi-fullscreen"></i>';
    compareFullscreenButton.title = 'Fullscreen comparison';
  }
  
  setTimeout(function() {
    if (mapLeft) mapLeft.invalidateSize();
    if (mapRight) mapRight.invalidateSize();
  }, 100);
}

/**
 * Initialize the comparison maps
 */
export function initComparisonMaps() {
  const leftMap = L.map('map-left', {
    zoomControl: false, 
    fullscreenControl: true,
    fullscreenControlOptions: {
      position: 'topleft'
    }
  }).setView(bekasiBounds.center, 12);
  
  const rightMap = L.map('map-right', {
    zoomControl: false, 
    fullscreenControl: true,
    fullscreenControlOptions: {
      position: 'topleft'
    }
  }).setView(bekasiBounds.center, 12);
  
  mapLeft = leftMap;
  mapRight = rightMap;

  // Custom zoom control at bottomright
  L.control.zoom({
    position: 'bottomright'
  }).addTo(leftMap);
  L.control.zoom({
    position: 'bottomright'
  }).addTo(rightMap);
  
  addBaseLayersToComparisonMaps();
  
  addCoordinatesDisplay(leftMap, 'bottomleft');
  addCoordinatesDisplay(rightMap, 'bottomleft');
  
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
}

/**
 * Add base layers to comparison maps
 */
export function addBaseLayersToComparisonMaps() {
  const leftBaseMaps = {};
  leftBaseMaps["Normal"] = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });
  leftBaseMaps["Satellite"] = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  });
  
  const rightBaseMaps = {};
  rightBaseMaps["Normal"] = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });
  rightBaseMaps["Satellite"] = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  });
  
  leftBaseMaps["Satellite"].addTo(mapLeft);
  rightBaseMaps["Satellite"].addTo(mapRight);
  
  // Layer Control 1: Basemap Gallery (Base layers only, custom icon)
  const leftBaseControl = basemapControl(leftBaseMaps, null, {
    position: 'topleft', 
    collapsed: true
  }).addTo(mapLeft);
  
  // Layer Control 2: Layer List (Overlays only, default icon)
  const leftLayerControl = L.control.layers(null, {}, {
    position: 'topleft', 
    collapsed: true
  }).addTo(mapLeft);

  // Layer Control 1: Basemap Gallery (Base layers only, custom icon)
  const rightBaseControl = basemapControl(rightBaseMaps, null, {
    position: 'topleft', 
    collapsed: true
  }).addTo(mapRight);
  
  // Layer Control 2: Layer List (Overlays only, default icon)
  const rightLayerControl = L.control.layers(null, {}, {
    position: 'topleft', 
    collapsed: true
  }).addTo(mapRight);
  
  // Add overlays to the Layer List controls
  leftLayerControl.addOverlay(createDummyLayer(), 'Bekasi AOI');
  leftLayerControl.addOverlay(createDummyLayer(), 'Elevation');
  leftLayerControl.addOverlay(createDummyLayer(), 'Population');
  leftLayerControl.addOverlay(createDummyLayer(), 'Surface Water');
  leftLayerControl.addOverlay(createDummyLayer(), 'Building Footprints');
  leftLayerControl.addOverlay(createDummyLayer(), 'Bekasi Wards');
  rightLayerControl.addOverlay(createDummyLayer(), 'Bekasi AOI');
  rightLayerControl.addOverlay(createDummyLayer(), 'Elevation');
  rightLayerControl.addOverlay(createDummyLayer(), 'Population');
  rightLayerControl.addOverlay(createDummyLayer(), 'Surface Water');
  rightLayerControl.addOverlay(createDummyLayer(), 'Building Footprints');
  rightLayerControl.addOverlay(createDummyLayer(), 'Bekasi Wards');
  // DON'T add black border by default to comparison maps either
  // Users need to check "Bekasi AOI" checkbox to see the boundary
  
  mapLeft.on('overlayadd', function(e) {
    const layerName = e.name;
    console.log(`Layer added to left map: ${layerName}`);
    
    if (layerName === 'Bekasi AOI') {
      showAOIOnMap(mapLeft, layersLeft, layerName);
    } else if (layerName === 'Elevation') {
      showDEMOnMap(mapLeft, layersLeft, layerName);
    } else if (layerName === 'Population') {
      showPopulationOnMap(mapLeft, layersLeft, layerName);
    } else if (layerName === 'Surface Water') {
      showGSWOnMap(mapLeft, layersLeft, layerName);
    } else if (layerName === 'Building Footprints') {
      showBuildingFootprintsOnMap(mapLeft, layersLeft, layerName);
    } else if (layerName === 'Bekasi Wards') {
      showBekasiWardsOnMap(mapLeft, layersLeft, layerName);
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
  
  mapRight.on('overlayadd', function(e) {
    const layerName = e.name;
    console.log(`Layer added to right map: ${layerName}`);
    
    if (layerName === 'Bekasi AOI') {
      showAOIOnMap(mapRight, layersRight, layerName);
    } else if (layerName === 'Elevation') {
      showDEMOnMap(mapRight, layersRight, layerName);
    } else if (layerName === 'Population') {
      showPopulationOnMap(mapRight, layersRight, layerName);
    } else if (layerName === 'Surface Water') {
      showGSWOnMap(mapRight, layersRight, layerName);
    } else if (layerName === 'Building Footprints') {
      showBuildingFootprintsOnMap(mapRight, layersRight, layerName);
    } else if (layerName === 'Bekasi Wards') {
      showBekasiWardsOnMap(mapRight, layersRight, layerName);
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
 */
export function addCoordinatesDisplay(targetMap, position) {
  const mapId = targetMap === map ? 'main' : (targetMap === mapLeft ? 'left' : 'right');
  const coordsClass = `coordinates-control-${mapId}`;
  
  const coordsDisplay = L.control({position: position});
  
  coordsDisplay.onAdd = function(map) {
    const div = L.DomUtil.create('div', `leaflet-control leaflet-bar ${coordsClass}`);
    div.innerHTML = 'Lat: 0.00000, Lng: 0.00000';
    // div.style.backgroundColor = 'white';
    div.style.padding = '5px 10px';
    div.style.fontSize = '12px';
    div.style.borderRadius = '4px';
    div.style.boxShadow = '0 1px 5px rgba(0,0,0,0.4)';
    div.style.zIndex = '1000';
    return div;
  };
  
  coordsDisplay.addTo(targetMap);
  
  targetMap.on('mousemove', function(e) {
    const lat = e.latlng.lat.toFixed(5);
    const lng = e.latlng.lng.toFixed(5);
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