// Import authentication module and utilities
import { authenticate } from './auth.js';
import { createOpacitySlider, updateOpacitySlider, removeOpacitySlider } from './utils.js';
import { addLayerToLeftMap, addLayerToRightMap } from './comparison-layers.js';

// Global variables
let map;
let mapLeft;
let mapRight;
let layers = {};
let layersLeft = {};
let layersRight = {};
let legend;
let isComparisonMode = false;

// Bekasi boundaries (coordinates from besaki.js)
const bekasiBounds = {
  bounds: [[-6.45, 106.88], [-6.10, 107.15]],
  center: [-6.275, 107.015]
};

// Key Bekasi sub-areas (from besaki.js)
const bekasiAreas = {
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

// Functions for adding layers to comparison maps

/**
 * Show DEM layer on a specific map
 * @param {L.Map} targetMap - The map to add the layer to
 * @param {Object} layerCollection - The collection to store the layer in
 * @param {string} layerName - The name for the layer
 */
function showDEMOnMap(targetMap, layerCollection, layerName) {
  // Define Bekasi geometry
  const bekasiGeometry = ee.Geometry.Rectangle([106.88, -6.45, 107.15, -6.10]);
  
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
function showPopulationOnMap(targetMap, layerCollection, layerName) {
  // Define Bekasi geometry
  const bekasiGeometry = ee.Geometry.Rectangle([106.88, -6.45, 107.15, -6.10]);
  
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
 * Generic function to add an Earth Engine layer to a specific map
 * @param {L.Map} targetMap - The map to add the layer to
 * @param {Object} layerCollection - The collection to store the layer in
 * @param {ee.Image} eeObject - The Earth Engine object to add
 * @param {Object} visParams - Visualization parameters
 * @param {string} name - The name for the layer
 */
function addLayerToMap(targetMap, layerCollection, eeObject, visParams, name) {
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
      
      // Create opacity slider for this layer
      addOpacitySliderToMap(targetMap, eeLayer, name);
      
      console.log(`${name} layer added to map`);
    });
  } catch (e) {
    console.error(`Error processing ${name} for map:`, e);
  }
}

/**
 * Add opacity slider to a specific map for a layer
 * @param {L.Map} targetMap - The map to add the slider to
 * @param {L.TileLayer} layer - The layer to control
 * @param {string} layerName - The name of the layer
 */
function addOpacitySliderToMap(targetMap, layer, layerName) {
  // Create a unique ID for the slider based on the map and layer
  const mapId = targetMap === map ? 'main' : (targetMap === mapLeft ? 'left' : 'right');
  const buttonId = `opacity-button-${mapId}-${layerName.replace(/\s+/g, '-').toLowerCase()}`;
  
  // Check if button already exists and remove it
  const existingButton = document.getElementById(buttonId);
  if (existingButton) {
    existingButton.remove();
  }
  
  // Create a custom control container if it doesn't exist
  let opacityControlsContainer = document.getElementById(`opacity-controls-${mapId}`);
  if (!opacityControlsContainer) {
    opacityControlsContainer = document.createElement('div');
    opacityControlsContainer.id = `opacity-controls-${mapId}`;
    opacityControlsContainer.className = 'opacity-controls-container';
    opacityControlsContainer.style.position = 'absolute';
    opacityControlsContainer.style.top = '10px';
    opacityControlsContainer.style.right = '50px'; // Position to the left of the layer control
    opacityControlsContainer.style.zIndex = '1000';
    targetMap.getContainer().appendChild(opacityControlsContainer);
  }
  
  // Create the opacity button
  const buttonDiv = document.createElement('div');
  buttonDiv.id = buttonId;
  buttonDiv.className = 'opacity-button-control';
  buttonDiv.style.backgroundColor = 'white';
  buttonDiv.style.padding = '5px';
  buttonDiv.style.borderRadius = '4px';
  buttonDiv.style.boxShadow = '0 1px 5px rgba(0,0,0,0.4)';
  buttonDiv.style.marginBottom = '5px';
  buttonDiv.style.cursor = 'pointer';
  buttonDiv.style.display = 'flex';
  buttonDiv.style.alignItems = 'center';
  buttonDiv.setAttribute('data-map-id', mapId);
  buttonDiv.setAttribute('data-layer-name', layerName);
  buttonDiv.innerHTML = `<i class="bi bi-sliders"></i> ${layerName}`;
  buttonDiv.title = `Adjust ${layerName} opacity`;
  
  // Add click event to show/hide the slider panel
  buttonDiv.addEventListener('click', function(e) {
    // Prevent the click from affecting the map
    e.stopPropagation();
    
    const sliderId = `opacity-panel-${mapId}-${layerName.replace(/\s+/g, '-').toLowerCase()}`;
    let sliderPanel = document.getElementById(sliderId);
    
    if (sliderPanel) {
      // Toggle visibility if panel already exists
      sliderPanel.style.display = sliderPanel.style.display === 'none' ? 'block' : 'none';
    } else {
      // Create the slider panel
      sliderPanel = document.createElement('div');
      sliderPanel.id = sliderId;
      sliderPanel.className = 'opacity-panel';
      sliderPanel.style.position = 'absolute';
      sliderPanel.style.top = '40px';
      sliderPanel.style.right = '50px';
      sliderPanel.style.backgroundColor = 'white';
      sliderPanel.style.padding = '10px';
      sliderPanel.style.borderRadius = '4px';
      sliderPanel.style.boxShadow = '0 2px 5px rgba(0,0,0,0.4)';
      sliderPanel.style.zIndex = '1001'; // Higher than the button
      sliderPanel.style.width = '200px';
      sliderPanel.setAttribute('data-map-id', mapId);
      sliderPanel.setAttribute('data-layer-name', layerName);
      
      // Create panel header
      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.marginBottom = '10px';
      
      const title = document.createElement('div');
      title.innerHTML = `${layerName} Opacity`;
      title.style.fontWeight = 'bold';
      
      const closeBtn = document.createElement('button');
      closeBtn.innerHTML = '\u00d7';
      closeBtn.style.border = 'none';
      closeBtn.style.background = 'none';
      closeBtn.style.fontSize = '16px';
      closeBtn.style.cursor = 'pointer';
      closeBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        sliderPanel.style.display = 'none';
      });
      
      header.appendChild(title);
      header.appendChild(closeBtn);
      sliderPanel.appendChild(header);
      
      // Create slider
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.id = `slider-${sliderId}`;
      slider.min = '0';
      slider.max = '100';
      slider.value = layer.options.opacity * 100;
      slider.style.width = '100%';
      
      // Add event listener to update opacity
      slider.addEventListener('input', function() {
        const opacity = parseInt(this.value) / 100;
        layer.setOpacity(opacity);
        valueDisplay.innerHTML = `${this.value}%`;
      });
      
      sliderPanel.appendChild(slider);
      
      // Add value display
      const valueDisplay = document.createElement('div');
      valueDisplay.style.textAlign = 'center';
      valueDisplay.style.marginTop = '5px';
      valueDisplay.innerHTML = `${slider.value}%`;
      
      slider.addEventListener('input', function() {
        valueDisplay.innerHTML = `${this.value}%`;
      });
      
      sliderPanel.appendChild(valueDisplay);
      
      // Prevent map interactions when using the slider panel
      sliderPanel.addEventListener('mousedown', function(e) {
        e.stopPropagation();
      });
      sliderPanel.addEventListener('dblclick', function(e) {
        e.stopPropagation();
      });
      sliderPanel.addEventListener('wheel', function(e) {
        e.stopPropagation();
      });
      
      // Add to map container
      targetMap.getContainer().appendChild(sliderPanel);
    }
  });
  
  // Add the button to the container
  opacityControlsContainer.appendChild(buttonDiv);
}

/**
 * Remove all opacity sliders from a specific map
 * @param {string} mapId - The map ID ('main', 'left', or 'right')
 */
function removeAllOpacitySliders(mapId) {
  // Find all opacity controls for the specified map
  const controls = document.querySelectorAll(`.opacity-control[data-map-id="${mapId}"]`);
  
  // Remove each control
  controls.forEach(control => {
    if (control && control.parentElement) {
      // Make sure we're not removing a coordinates control
      if (!control.classList.contains(`coordinates-control-${mapId}`)) {
        control.parentElement.remove();
      }
    }
  });
}

/**
 * Remove opacity slider for a specific layer on a specific map
 * @param {string} mapId - The map ID ('main', 'left', or 'right')
 * @param {string} layerName - The name of the layer
 */
function removeOpacitySliderForLayer(mapId, layerName) {
  // Find and remove the opacity button
  const buttonId = `opacity-button-${mapId}-${layerName.replace(/\s+/g, '-').toLowerCase()}`;
  const button = document.getElementById(buttonId);
  if (button) {
    button.remove();
  }
  
  // Find and remove the opacity slider panel
  const panelId = `opacity-panel-${mapId}-${layerName.replace(/\s+/g, '-').toLowerCase()}`;
  const sliderPanel = document.getElementById(panelId);
  if (sliderPanel) {
    sliderPanel.remove();
  }
}

/**
 * Refresh all layers on the main map
 * This ensures layers are properly displayed after switching back from comparison view
 */
function refreshMainMapLayers() {
  // Get all active layers
  Object.keys(layers).forEach(layerName => {
    const layer = layers[layerName];
    
    // If the layer exists, refresh it
    if (layer) {
      // Temporarily remove and re-add the layer to refresh it
      if (map.hasLayer(layer)) {
        map.removeLayer(layer);
        layer.addTo(map);
        
        // Re-add the opacity slider
        addOpacitySliderToMap(map, layer, layerName);
      }
    }
  });
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', function() {
  // Set up comparison view toggle button
  document.getElementById('compare-button').addEventListener('click', toggleComparisonView);
  
  // Start authentication process
  updateStatus('Authenticating the user...');
  authenticate(initApp);
});

// Toggle layer visibility based on checkbox state
function toggleLayerByCheckbox(checkboxId, layerType) {
  const checkbox = document.getElementById(checkboxId);
  const isChecked = checkbox.checked;
  
  // Show or hide the layer based on checkbox state
  if (isChecked) {
    // Show the layer
    switch (layerType) {
      case 'Elevation':
        showDEM();
        break;
      case 'Population':
        showPopulation();
        break;
      // Uncomment to add more layers
      // case 'Water':
      //   showWaterOccurrence();
      //   break;
      // case 'RiskZones':
      //   showRiskZones();
      //   break;
    }
  } else {
    // If the checkbox is unchecked, clear the layer
    clearLayer(layerType);
    
    // Also remove the opacity slider
    removeOpacitySlider(layerType);
  }
}

// Initialize the app after authentication
function initApp() {
  updateStatus('User initialized successfully');
  console.log('User initialized successfully');
  
  // Initialize the map
  initMap();
  
  // Add base layers
  addBaseLayers();
  
  // Check the elevation checkbox since that layer is loaded by default
//   document.getElementById('chkElevation').checked = true;
  
  // Hide loading overlay
  hideLoading();
}

// Add base layers to the map
function addBaseLayers() {
  // Define Bekasi geometry
  const bekasiGeometry = ee.Geometry.Rectangle([106.88, -6.45, 107.15, -6.10]);
  
  // Add DEM layer (visible by default like in demo.js)
  const dem = ee.Image("USGS/SRTMGL1_003").clip(bekasiGeometry);
  addLayer(dem, {
    min: 0, 
    max: 50, 
    palette: ['#253494', '#2c7fb8', '#41b6c4', '#a1dab4', '#ffffcc'],
    opacity: 0.7
  }, 'Bekasi Elevation', false);
  
  // Also add population layer (hidden by default)
  const population = ee.ImageCollection("CIESIN/GPWv411/GPW_Population_Count")
    .filter(ee.Filter.date('2020-01-01', '2020-12-31'))
    .first()
    .clip(bekasiGeometry);
    
  addLayer(population, {
    min: 0,
    max: 5000,
    palette: ['white', 'yellow', 'orange', 'red'],
    opacity: 0.7
  }, 'Population Density', false);
  
  // Create default legend
  createLegend('Elevation', 
    ['#253494', '#2c7fb8', '#41b6c4', '#a1dab4', '#ffffcc'], 
    ['0m', '10m', '20m', '30m', '50m']);
}

// Global variables for base layers and overlays
let baseMaps = {};
let overlays = {};

// Initialize the Leaflet map
function initMap() {
  // Create a Leaflet map centered on Bekasi with fullscreen control
  map = L.map('map', {
    fullscreenControl: true,
    fullscreenControlOptions: {
      position: 'topleft',
      title: 'View Fullscreen',
      titleCancel: 'Exit Fullscreen'
    }
  }).setView(bekasiBounds.center, 11);
  
  // Create base layers
  // Normal map (OpenStreetMap)
  baseMaps["Normal"] = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });
  
  // Satellite map (ESRI World Imagery)
  baseMaps["Satellite"] = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  });
  
  // Add the normal map as default
  baseMaps["Normal"].addTo(map);
  
  // Add Bekasi boundary
  L.rectangle(bekasiBounds.bounds, {
    color: 'black',
    weight: 2,
    fillOpacity: 0,
  }).addTo(map).bindPopup('Bekasi Study Area');
  
  // Create overlay layers for main map
  const mainOverlays = {};
  
  // Add layer control for base maps and overlays
  const layerControl = L.control.layers(baseMaps, {}, {
    position: 'topright',
    collapsed: false
  }).addTo(map);
  
  // Add data layers to the control
  layerControl.addOverlay(createDummyLayer(), 'Elevation');
  layerControl.addOverlay(createDummyLayer(), 'Population');
  
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
}

// Show Digital Elevation Model (DEM)
function showDEM() {
  updateStatus('Loading elevation data...');
  
  // Define Bekasi geometry
  const bekasiGeometry = ee.Geometry.Rectangle([106.88, -6.45, 107.15, -6.10]);
  
  // Get DEM data
  const dem = ee.Image("USGS/SRTMGL1_003").clip(bekasiGeometry);
  
  // Visualization parameters (same as floods.js)
  const demVis = {
    min: 0,
    max: 50,
    palette: ['#253494', '#2c7fb8', '#41b6c4', '#a1dab4', '#ffffcc']
  };
  
  // Add the layer to the map
  addLayer(dem, demVis, 'Elevation');
  
  // Update legend
  createLegend('Elevation', 
    ['#253494', '#2c7fb8', '#41b6c4', '#a1dab4', '#ffffcc'],
    ['0m', '10m', '20m', '30m', '50m']);
}

// Show Population Data
function showPopulation() {
  updateStatus('Loading population data...');
  
  // Define Bekasi geometry
  const bekasiGeometry = ee.Geometry.Rectangle([106.88, -6.45, 107.15, -6.10]);
  
  // Get population data
  const population = ee.ImageCollection("CIESIN/GPWv411/GPW_Population_Count")
    .filter(ee.Filter.date('2020-01-01', '2020-12-31'))
    .first()
    .clip(bekasiGeometry);
  
  // Visualization parameters (same as floods.js)
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

// Show Water Occurrence
function showWaterOccurrence() {
  updateStatus('Loading water occurrence data...');
  
  // Define Bekasi geometry
  const bekasiGeometry = ee.Geometry.Rectangle([106.88, -6.45, 107.15, -6.10]);
  
  // Get water occurrence data
  const jrcWater = ee.Image("JRC/GSW1_4/GlobalSurfaceWater")
    .select('occurrence')
    .clip(bekasiGeometry);
  
  // Visualization parameters (same as floods.js)
  const waterVis = {
    min: 0,
    max: 100,
    palette: ['white', 'lightblue', 'blue', 'darkblue']
  };
  
  // Add the layer to the map
  addLayer(jrcWater, waterVis, 'Water Occurrence');
  
  // Update legend
  createLegend('Water Occurrence', 
    ['white', 'lightblue', 'blue', 'darkblue'],
    ['0%', '25%', '50%', '100%']);
}

// Calculate flood risk for a specific area (adapted from besaki.js)
function calculateFloodRisk(area, coords) {
  const point = ee.Geometry.Point(coords);
  const bekasiGeometry = ee.Geometry.Rectangle([106.88, -6.45, 107.15, -6.10]);
  
  // Get datasets (same as besaki.js)
  const dem = ee.Image("USGS/SRTMGL1_003").clip(bekasiGeometry);
  const jrcWater = ee.Image("JRC/GSW1_4/GlobalSurfaceWater")
    .select('occurrence')
    .clip(bekasiGeometry);
  const population = ee.ImageCollection("CIESIN/GPWv411/GPW_Population_Count")
    .filter(ee.Filter.date('2020-01-01', '2020-12-31'))
    .first()
    .clip(bekasiGeometry);
  
  // Sample all data at the point
  const samples = ee.Image.cat([
    dem.rename('elevation'),
    jrcWater.rename('waterOccurrence'),
    population.rename('population'),
    ee.Terrain.slope(dem).rename('slope')
  ]).sample(point, 30);
  
  // Return a promise that will resolve with the risk data
  return new Promise((resolve, reject) => {
    samples.evaluate((result, error) => {
      if (error) {
        reject(error);
        return;
      }
      
      // Handle null or incomplete result
      if (!result || !result.features || result.features.length === 0) {
        // Instead of using dummy values, calculate risk based on location
        // Areas closer to the coast and lower latitude tend to be more flood-prone
        const longitude = coords[0];
        const latitude = coords[1];
        
        // Calculate estimated values based on location
        // Lower elevation for areas closer to the coast (eastern bekasi)
        const estimatedElevation = Math.max(2, 20 - ((longitude - 80.0) * 100));
        
        // Higher water occurrence for areas closer to the coast and water bodies
        const estimatedWaterOcc = Math.min(80, ((longitude - 80.0) * 200) + ((13.1 - latitude) * 100));
        
        // Population density varies but is generally higher in central bekasi
        const centralityFactor = 1 - (Math.abs(longitude - 80.22) + Math.abs(latitude - 13.05)) * 5;
        const estimatedPopulation = Math.max(500, centralityFactor * 5000);
        
        // Slope is generally low in bekasi
        const estimatedSlope = Math.max(1, 5 - ((longitude - 80.0) * 10));
        
        // For estimated values, use JavaScript calculations directly instead of Earth Engine objects
        // This avoids the need for evaluation which can cause errors
        const elevationScore = Math.abs((estimatedElevation / 50) - 1) * 25;
        const slopeScore = Math.abs((estimatedSlope / 10) - 1) * 20;
        const popScore = (estimatedPopulation / 1000) * 25;
        const waterScore = (estimatedWaterOcc / 100) * 30;
        
        // Sum all scores using JavaScript operations
        const totalScore = elevationScore + slopeScore + popScore + waterScore;
        
        resolve({
          area: area,
          coordinates: coords,
          riskScore: totalScore, // This is now a JavaScript number
          elevation: estimatedElevation,
          population: estimatedPopulation,
          waterOccurrence: estimatedWaterOcc,
          slope: estimatedSlope,
          estimated: true // Flag to indicate these are estimated values
        });
        return;
      }
      
      // Extract values from the result
      const properties = result.features[0].properties;
      const elevation = properties.elevation || 0;
      const waterOccurrence = properties.waterOccurrence || 0;
      const population = properties.population || 0;
      const slope = properties.slope || 0;
      
      // Calculate risk score (0-100) exactly as in floods.js
      // Using ee.Number for Earth Engine calculations
      const elevationScore = ee.Number(elevation).divide(50).subtract(1).abs().multiply(25);
      const slopeScore = ee.Number(slope).divide(10).subtract(1).abs().multiply(20);
      const popScore = ee.Number(population).divide(1000).multiply(25);
      const waterScore = ee.Number(waterOccurrence).divide(100).multiply(30);
      
      // Sum all scores
      const totalScore = elevationScore.add(slopeScore).add(popScore).add(waterScore);
      
      // We need to evaluate the Earth Engine objects to get JavaScript values for use in the UI
      elevationScore.evaluate((elevValue) => {
        slopeScore.evaluate((slopeValue) => {
          popScore.evaluate((popValue) => {
            waterScore.evaluate((waterValue) => {
              totalScore.evaluate((riskScoreValue, error) => {
                if (error) {
                  console.error('Error evaluating risk score:', error);
                  // Fallback to a calculated estimate if evaluation fails
                  const jsElevationScore = Math.abs((elevation / 50) - 1) * 25;
                  const jsSlopeScore = Math.abs((slope / 10) - 1) * 20;
                  const jsPopScore = (population / 1000) * 25;
                  const jsWaterScore = (waterOccurrence / 100) * 30;
                  const jsTotalScore = jsElevationScore + jsSlopeScore + jsPopScore + jsWaterScore;
                  
                  resolve({
                    area: area,
                    coordinates: coords,
                    riskScore: jsTotalScore,
                    elevation: elevation,
                    population: population,
                    waterOccurrence: waterOccurrence,
                    slope: slope
                  });
                } else {
                  // Use the evaluated JavaScript values
                  resolve({
                    area: area,
                    coordinates: coords,
                    riskScore: riskScoreValue,
                    elevation: elevation,
                    population: population,
                    waterOccurrence: waterOccurrence,
                    slope: slope
                  });
                }
              });
            });
          });
        });
      });
    });
  });
}

// Show Risk Zones
function showRiskZones() {
  updateStatus('Calculating flood risk zones...');
  
  // Define Bekasi geometry (using approach from besaki.js)
  const bekasiGeometry = ee.Geometry.Rectangle([106.88, -6.45, 107.15, -6.10]);
  
  // Get datasets (same as besaki.js)
  const dem = ee.Image("USGS/SRTMGL1_003").clip(bekasiGeometry);
  const jrcWater = ee.Image("JRC/GSW1_4/GlobalSurfaceWater")
    .select('occurrence')
    .clip(bekasiGeometry);
  const population = ee.ImageCollection("CIESIN/GPWv411/GPW_Population_Count")
    .filter(ee.Filter.date('2020-01-01', '2020-12-31'))
    .first()
    .clip(bekasiGeometry);
  const historicalRainfall = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
    .filterDate('2010-01-01', '2023-12-31') // Updated date range from besaki.js
    .filterBounds(bekasiGeometry)
    .select('precipitation')
    .sum()
    .clip(bekasiGeometry);
  
  // Calculate high rainfall areas (from besaki.js)
  const highRainfallAreas = historicalRainfall.gt(2000); // Areas with >2000mm total rainfall
  
  // Combine factors to create flood proneness (from besaki.js)
  const floodProneness = jrcWater.divide(100).add(
    historicalRainfall.unitScale(0, 5000).multiply(0.5)
  ).add(
    population.unitScale(0, 10000).multiply(0.3)
  );
  
  // Create risk zones (same approach as besaki.js)
  const riskZones = ee.Image(1)
    .where(floodProneness.gt(0.3).and(floodProneness.lte(0.6)), 2)
    .where(floodProneness.gt(0.6).and(floodProneness.lte(0.8)), 3)
    .where(floodProneness.gt(0.8), 4);
  
  // Visualization parameters with opacity (from besaki.js)
  const riskVis = {
    min: 1,
    max: 4,
    palette: ['green', 'yellow', 'orange', 'red'],
    opacity: 0.5 // Added opacity from besaki.js
  };
  
  // Add the layer to the map
  addLayer(riskZones, riskVis, 'Flood Risk Zones');
  
  // Also add population density layer (hidden by default)
  addLayer(population, {
    min: 0, 
    max: 5000, 
    palette: ['white', 'yellow', 'orange', 'red'],
    opacity: 0.5
  }, 'Population Density', false);
  
  // Add historical rainfall layer (hidden by default)
  addLayer(historicalRainfall, {
    min: 0, 
    max: 3000, 
    palette: ['white', 'lightblue', 'blue', 'darkblue'],
    opacity: 0.5
  }, 'Historical Rainfall (2010-2023)', false);
  
  // Calculate risk scores for all areas (region-wise analysis)
  const areaRisks = [];
  const areaPromises = [];
  
  // Process each area
  Object.keys(bekasiAreas).forEach(function(area) {
    const coords = bekasiAreas[area];
    try {
      // Get risk data for this area (returns a Promise)
      const riskPromise = calculateFloodRisk(area, coords);
      areaPromises.push(riskPromise);
      
      // When the promise resolves, add a marker
      riskPromise.then(result => {
        if (!result) return;
        
        // Store the risk data
        areaRisks.push(result);
        
        // Determine color based on risk score
        let color = 'green';
        let size = 5;
        
        if (result.riskScore >= 75) {
          color = 'red';
          size = 10;
        } else if (result.riskScore >= 60) {
          color = 'orange';
          size = 8;
        } else if (result.riskScore >= 45) {
          color = 'yellow';
          size = 6;
        }
        
        // Convert any Earth Engine objects to JavaScript values for display
        const riskScore = typeof result.riskScore === 'number' ? result.riskScore : parseFloat(result.riskScore);
        const elevation = typeof result.elevation === 'number' ? result.elevation : parseFloat(result.elevation);
        const population = typeof result.population === 'number' ? result.population : parseFloat(result.population);
        const waterOccurrence = typeof result.waterOccurrence === 'number' ? result.waterOccurrence : parseFloat(result.waterOccurrence);
        
        // Add marker to map with properly formatted values
        L.circleMarker([result.coordinates[1], result.coordinates[0]], {
          color: color,
          fillColor: color,
          fillOpacity: 0.7,
          radius: size
        }).addTo(map).bindPopup(`
          <strong>${result.area}</strong><br>
          Risk Score: ${isNaN(riskScore) ? '?' : riskScore.toFixed(1)}/100<br>
          Elevation: ${isNaN(elevation) ? '?' : elevation.toFixed(1)} m<br>
          Population: ${isNaN(population) ? '?' : Math.round(population)}/km²<br>
          Water Occurrence: ${isNaN(waterOccurrence) ? '?' : waterOccurrence.toFixed(1)}%
        `);
      }).catch(error => {
        console.error(`Error processing risk data for ${area}:`, error);
      });
    } catch (error) {
      console.error(`Error calculating risk for ${area}:`, error);
    }
  });
  
  // When all promises are resolved, update the status
  Promise.all(areaPromises)
    .then(() => {
      updateStatus(`Risk analysis completed for ${areaRisks.length} areas.`);
    })
    .catch(error => {
      console.error('Error in risk analysis:', error);
      updateStatus('Risk analysis completed with some errors. Check console for details.');
    });
  
  // Update legend
  createLegend('Flood Risk Zones', 
    ['green', 'yellow', 'orange', 'red'],
    ['Low Risk', 'Moderate Risk', 'High Risk', 'Severe Risk']);

  updateStatus(`Risk analysis completed for ${Object.keys(bekasiAreas).length} areas.`);
}

// Add a layer to the map (using the exact approach from demo.js)
function addLayer(eeObject, visParams, name, visible = true) {
  updateStatus(`Processing ${name} data...`);
  try {
    eeObject.getMap(visParams, function(tileLayer) {
      console.log('Layer created:', name, tileLayer);
      
      // Remove existing layer with same name if it exists
      if (layers[name]) {
        map.removeLayer(layers[name]);
        
        // Remove existing opacity slider if it exists
        const sliderId = `opacity-main-${name.replace(/\s+/g, '-').toLowerCase()}`;
        const existingSlider = document.getElementById(sliderId);
        if (existingSlider && existingSlider.parentElement && existingSlider.parentElement.parentElement) {
          existingSlider.parentElement.parentElement.remove();
        }
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
      overlays[name] = eeLayer;
      
      // Add to map if visible is true
      if (visible) {
        eeLayer.addTo(map);
        
        // Create opacity slider for this layer
        addOpacitySliderToMap(map, eeLayer, name);
      }
      
      // Add to layer control if it doesn't exist already
      // This ensures the layer appears in the control panel
      if (!document.querySelector(`.leaflet-control-layers-selector[type="checkbox"][name="${name}"]`)) {
        // Get the layer control and add this overlay
        const layerControl = document.querySelector('.leaflet-control-layers');
        if (layerControl && layerControl._map) {
          layerControl._addLayer(eeLayer, name);
          layerControl._update();
        }
      }
      
      updateStatus(`${name} layer added to map`);
    });
  } catch (e) {
    updateStatus(`Error processing ${name}: ${e.message}`);
    console.error('Error in addLayer:', e);
  }
}

// Create a legend
function createLegend(title, colors, labels) {
  const legendContent = document.getElementById('legend-content');
  let html = `<h5>${title}</h5>`;
  
  for (let i = 0; i < colors.length; i++) {
    html += `
      <div class="legend-item">
        <div class="color-box" style="background-color: ${colors[i]}"></div>
        <div>${labels[i]}</div>
      </div>
    `;
  }
  
  legendContent.innerHTML = html;
}

// Clear a specific layer from the map
function clearLayer(layerType) {
  // Find the layer by name
  const layerName = layerType === 'RiskZones' ? 'Flood Risk Zones' : layerType;
  
  if (layers[layerName]) {
    map.removeLayer(layers[layerName]);
    delete layers[layerName];
    updateStatus(`${layerName} layer removed`);
  }
}

// Clear all layers from the map
function clearLayers() {
  // Remove all layers
  Object.keys(layers).forEach(key => {
    if (layers[key]) {
      map.removeLayer(layers[key]);
      
      // Remove opacity slider for this layer
      removeOpacitySlider(key);
    }
  });
  
  // Reset layers object
  layers = {};
  overlays = {};
  
  // Clear legend
  document.getElementById('legend-content').innerHTML = '';
  
  updateStatus('All layers cleared');
}

// Update status message
function updateStatus(message) {
  document.getElementById('status').textContent = message;
  console.log(message);
}

// Toggle between single map and comparison view
function toggleComparisonView() {
  const mapContainer = document.getElementById('map-container');
  const comparisonContainer = document.getElementById('comparison-container');
  const compareButton = document.getElementById('compare-button');
  
  if (!isComparisonMode) {
    // Switch to comparison view
    mapContainer.style.display = 'none';
    comparisonContainer.style.display = 'flex';
    compareButton.innerHTML = '<i class="bi bi-fullscreen-exit"></i>';
    compareButton.title = 'Return to single map view';
    
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

// Clear layers from comparison maps
function clearComparisonLayers(mapSide) {
  if (mapSide === 'left') {
    // Remove all layers from left map
    Object.keys(layersLeft).forEach(key => {
      if (layersLeft[key]) {
        mapLeft.removeLayer(layersLeft[key]);
      }
    });
    
    // Reset layers object
    layersLeft = {};
    console.log('All layers cleared from left map');
  } else if (mapSide === 'right') {
    // Remove all layers from right map
    Object.keys(layersRight).forEach(key => {
      if (layersRight[key]) {
        mapRight.removeLayer(layersRight[key]);
      }
    });
    
    // Reset layers object
    layersRight = {};
    console.log('All layers cleared from right map');
  }
}

// Initialize the comparison maps
function initComparisonMaps() {
  // Create left map
  mapLeft = L.map('map-left', {
    fullscreenControl: true,
    fullscreenControlOptions: {
      position: 'topleft',
      title: 'View Fullscreen',
      titleCancel: 'Exit Fullscreen'
    }
  }).setView(map.getCenter(), map.getZoom());
  
  // Create right map
  mapRight = L.map('map-right', {
    fullscreenControl: true,
    fullscreenControlOptions: {
      position: 'topleft',
      title: 'View Fullscreen',
      titleCancel: 'Exit Fullscreen'
    }
  }).setView(map.getCenter(), map.getZoom());
  
  // Add base layers to both maps
  addBaseLayersToComparisonMaps();
  
  // Add coordinates display to both maps
  addCoordinatesDisplay(mapLeft, 'bottomleft');
  addCoordinatesDisplay(mapRight, 'bottomleft');
  
  // Sync map movements (optional - can be removed if independent maps are preferred)
  mapLeft.on('move', function() {
    mapRight.setView(mapLeft.getCenter(), mapLeft.getZoom(), {
      animate: false
    });
  });
  
  mapRight.on('move', function() {
    mapLeft.setView(mapRight.getCenter(), mapRight.getZoom(), {
      animate: false
    });
  });
}

// Add base layers to comparison maps
function addBaseLayersToComparisonMaps() {
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

// Create a dummy layer for the layer control
function createDummyLayer() {
  return L.layerGroup();
}

/**
 * Add coordinates display to a specific map
 * @param {L.Map} targetMap - The map to add the slider to
 * @param {string} position - The position on the map ('bottomleft', 'bottomright', etc.)
 */
function addCoordinatesDisplay(targetMap, position) {
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

// Hide loading overlay
function hideLoading() {
  document.getElementById('loading').style.display = 'none';
}
