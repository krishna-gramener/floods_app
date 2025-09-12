// Import authentication module and utilities
import { authenticate } from './auth.js';
import { hideLoading, updateStatus } from './utils.js';
import { initLayerManager} from './layers.js';
import { initMapControls, initMap, toggleComparisonView, toggleComparisonFullscreen} from './map-controls.js';
import { bekasiBounds, bekasiAreas } from './config.js';

// Global variables
let map;
let mapLeft;
let mapRight;
let layers = {};
let layersLeft = {};
let layersRight = {};
let overlays = {};
let isComparisonMode = false;

/**
 * Add opacity slider to a specific map for a layer
 * @param {L.Map} targetMap - The map to add the slider to
 * @param {L.TileLayer} layer - The layer to control
 * @param {string} layerName - The name of the layer
 */
function addOpacitySliderToMap(targetMap, layer, layerName) {
  // Create a unique ID for the slider based on the map and layer
  let mapId;
  if (targetMap === map) {
    mapId = 'main';
  } else if (targetMap._container && targetMap._container.id === 'map-left') {
    mapId = 'left';
  } else if (targetMap._container && targetMap._container.id === 'map-right') {
    mapId = 'right';
  } else {
    console.error('Unknown map container');
    return; // Exit if we can't identify the map
  }
  
  const sliderId = `opacity-button-${mapId}-${layerName.replace(/\s+/g, '-').toLowerCase()}`;
  
  // Check if button already exists and remove it
  const existingButton = document.getElementById(sliderId);
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
    
    // Make sure we have the container
    if (targetMap._container) {
      targetMap._container.appendChild(opacityControlsContainer);
    } else {
      console.error('Map container not found');
      return;
    }
  }
  
  // Create the opacity button
  const buttonDiv = document.createElement('div');
  buttonDiv.id = sliderId;
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
      
      // Get the correct container based on mapId
      let container;
      if (mapId === 'main') {
        container = document.getElementById('map');
      } else if (mapId === 'left') {
        container = document.getElementById('map-left');
      } else if (mapId === 'right') {
        container = document.getElementById('map-right');
      }
      
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
      if (container) {
        container.appendChild(sliderPanel);
      } else if (targetMap._container) {
        targetMap._container.appendChild(sliderPanel);
      } else {
        console.error('Could not find container for opacity slider panel');
      }
    }
  });
  
  // Add the button to the container
  opacityControlsContainer.appendChild(buttonDiv);
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
 * Remove all opacity sliders from a specific map
 * @param {string} mapId - The map ID ('main', 'left', or 'right')
 */
function removeAllOpacitySliders(mapId) {
  // Find all opacity controls for the specified map
  const container = document.getElementById(`opacity-controls-${mapId}`);
  if (container) {
    // Remove all buttons in the container
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
  }
  
  // Find and remove all opacity panels for this map
  const panels = document.querySelectorAll(`.opacity-panel[data-map-id="${mapId}"]`);
  panels.forEach(panel => {
    panel.remove();
  });
}

// Note: refreshMainMapLayers function moved to layers.js

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', function() {
  // Set up comparison view toggle button
  document.getElementById('compare-button').addEventListener('click', toggleComparisonView);
  
  // Set up fullscreen comparison button
  document.getElementById('compare-fullscreen-button').addEventListener('click', toggleComparisonFullscreen);
  
  // Listen for fullscreen change events to update button icon
  document.addEventListener('fullscreenchange', function() {
    const compareFullscreenButton = document.getElementById('compare-fullscreen-button');
    if (document.fullscreenElement) {
      compareFullscreenButton.innerHTML = '<i class="bi bi-fullscreen-exit"></i>';
      compareFullscreenButton.title = 'Exit fullscreen comparison';
    } else {
      compareFullscreenButton.innerHTML = '<i class="bi bi-fullscreen"></i>';
      compareFullscreenButton.title = 'Fullscreen comparison';
    }
  });
  
  // Start authentication process
  updateStatus('Authenticating the user...');
  authenticate(initApp);
});

// Initialize the app after authentication
function initApp() {
  updateStatus('User initialized successfully');
  console.log('User initialized successfully');
  
  // Initialize the map
  map = initMap();
  
  // Initialize the layer manager with map references and opacity slider function
  initLayerManager(map, layers, mapLeft, layersLeft, mapRight, layersRight, addOpacitySliderToMap);
  
  // Initialize the map controls with references and opacity slider functions - after map is created
  initMapControls(map, layers, overlays, mapLeft, layersLeft, mapRight, layersRight, bekasiBounds, isComparisonMode, 
    removeOpacitySliderForLayer, removeAllOpacitySliders);
  
  // Hide loading overlay
  hideLoading();
}

// // Show Water Occurrence
// function showWaterOccurrence() {
//   updateStatus('Loading water occurrence data...');
  
//   // Define Bekasi geometry
//   const bekasiGeometry = ee.Geometry.Rectangle([106.88, -6.45, 107.15, -6.10]);
  
//   // Get water occurrence data
//   const jrcWater = ee.Image("JRC/GSW1_4/GlobalSurfaceWater")
//     .select('occurrence')
//     .clip(bekasiGeometry);
  
//   // Visualization parameters (same as floods.js)
//   const waterVis = {
//     min: 0,
//     max: 100,
//     palette: ['white', 'lightblue', 'blue', 'darkblue']
//   };
  
//   // Add the layer to the map
//   addLayer(jrcWater, waterVis, 'Water Occurrence');
  
//   // Update legend
//   createLegend('Water Occurrence', 
//     ['white', 'lightblue', 'blue', 'darkblue'],
//     ['0%', '25%', '50%', '100%']);
// }

// Calculate flood risk for a specific area (adapted from besaki.js)
// function calculateFloodRisk(area, coords) {
//   const point = ee.Geometry.Point(coords);
//   const bekasiGeometry = ee.Geometry.Rectangle([106.88, -6.45, 107.15, -6.10]);
  
//   // Get datasets (same as besaki.js)
//   const dem = ee.Image("USGS/SRTMGL1_003").clip(bekasiGeometry);
//   const jrcWater = ee.Image("JRC/GSW1_4/GlobalSurfaceWater")
//     .select('occurrence')
//     .clip(bekasiGeometry);
//   const population = ee.ImageCollection("CIESIN/GPWv411/GPW_Population_Count")
//     .filter(ee.Filter.date('2020-01-01', '2020-12-31'))
//     .first()
//     .clip(bekasiGeometry);
  
//   // Sample all data at the point
//   const samples = ee.Image.cat([
//     dem.rename('elevation'),
//     jrcWater.rename('waterOccurrence'),
//     population.rename('population'),
//     ee.Terrain.slope(dem).rename('slope')
//   ]).sample(point, 30);
  
//   // Return a promise that will resolve with the risk data
//   return new Promise((resolve, reject) => {
//     samples.evaluate((result, error) => {
//       if (error) {
//         reject(error);
//         return;
//       }
      
//       // Handle null or incomplete result
//       if (!result || !result.features || result.features.length === 0) {
//         // Instead of using dummy values, calculate risk based on location
//         // Areas closer to the coast and lower latitude tend to be more flood-prone
//         const longitude = coords[0];
//         const latitude = coords[1];
        
//         // Calculate estimated values based on location
//         // Lower elevation for areas closer to the coast (eastern bekasi)
//         const estimatedElevation = Math.max(2, 20 - ((longitude - 80.0) * 100));
        
//         // Higher water occurrence for areas closer to the coast and water bodies
//         const estimatedWaterOcc = Math.min(80, ((longitude - 80.0) * 200) + ((13.1 - latitude) * 100));
        
//         // Population density varies but is generally higher in central bekasi
//         const centralityFactor = 1 - (Math.abs(longitude - 80.22) + Math.abs(latitude - 13.05)) * 5;
//         const estimatedPopulation = Math.max(500, centralityFactor * 5000);
        
//         // Slope is generally low in bekasi
//         const estimatedSlope = Math.max(1, 5 - ((longitude - 80.0) * 10));
        
//         // For estimated values, use JavaScript calculations directly instead of Earth Engine objects
//         // This avoids the need for evaluation which can cause errors
//         const elevationScore = Math.abs((estimatedElevation / 50) - 1) * 25;
//         const slopeScore = Math.abs((estimatedSlope / 10) - 1) * 20;
//         const popScore = (estimatedPopulation / 1000) * 25;
//         const waterScore = (estimatedWaterOcc / 100) * 30;
        
//         // Sum all scores using JavaScript operations
//         const totalScore = elevationScore + slopeScore + popScore + waterScore;
        
//         resolve({
//           area: area,
//           coordinates: coords,
//           riskScore: totalScore, // This is now a JavaScript number
//           elevation: estimatedElevation,
//           population: estimatedPopulation,
//           waterOccurrence: estimatedWaterOcc,
//           slope: estimatedSlope,
//           estimated: true // Flag to indicate these are estimated values
//         });
//         return;
//       }
      
//       // Extract values from the result
//       const properties = result.features[0].properties;
//       const elevation = properties.elevation || 0;
//       const waterOccurrence = properties.waterOccurrence || 0;
//       const population = properties.population || 0;
//       const slope = properties.slope || 0;
      
//       // Calculate risk score (0-100) exactly as in floods.js
//       // Using ee.Number for Earth Engine calculations
//       const elevationScore = ee.Number(elevation).divide(50).subtract(1).abs().multiply(25);
//       const slopeScore = ee.Number(slope).divide(10).subtract(1).abs().multiply(20);
//       const popScore = ee.Number(population).divide(1000).multiply(25);
//       const waterScore = ee.Number(waterOccurrence).divide(100).multiply(30);
      
//       // Sum all scores
//       const totalScore = elevationScore.add(slopeScore).add(popScore).add(waterScore);
      
//       // We need to evaluate the Earth Engine objects to get JavaScript values for use in the UI
//       elevationScore.evaluate((elevValue) => {
//         slopeScore.evaluate((slopeValue) => {
//           popScore.evaluate((popValue) => {
//             waterScore.evaluate((waterValue) => {
//               totalScore.evaluate((riskScoreValue, error) => {
//                 if (error) {
//                   console.error('Error evaluating risk score:', error);
//                   // Fallback to a calculated estimate if evaluation fails
//                   const jsElevationScore = Math.abs((elevation / 50) - 1) * 25;
//                   const jsSlopeScore = Math.abs((slope / 10) - 1) * 20;
//                   const jsPopScore = (population / 1000) * 25;
//                   const jsWaterScore = (waterOccurrence / 100) * 30;
//                   const jsTotalScore = jsElevationScore + jsSlopeScore + jsPopScore + jsWaterScore;
                  
//                   resolve({
//                     area: area,
//                     coordinates: coords,
//                     riskScore: jsTotalScore,
//                     elevation: elevation,
//                     population: population,
//                     waterOccurrence: waterOccurrence,
//                     slope: slope
//                   });
//                 } else {
//                   // Use the evaluated JavaScript values
//                   resolve({
//                     area: area,
//                     coordinates: coords,
//                     riskScore: riskScoreValue,
//                     elevation: elevation,
//                     population: population,
//                     waterOccurrence: waterOccurrence,
//                     slope: slope
//                   });
//                 }
//               });
//             });
//           });
//         });
//       });
//     });
//   });
// }

// // Show Risk Zones
// function showRiskZones() {
//   updateStatus('Calculating flood risk zones...');
  
//   // Define Bekasi geometry (using approach from besaki.js)
//   const bekasiGeometry = ee.Geometry.Rectangle([106.88, -6.45, 107.15, -6.10]);
  
//   // Get datasets (same as besaki.js)
//   const dem = ee.Image("USGS/SRTMGL1_003").clip(bekasiGeometry);
//   const jrcWater = ee.Image("JRC/GSW1_4/GlobalSurfaceWater")
//     .select('occurrence')
//     .clip(bekasiGeometry);
//   const population = ee.ImageCollection("CIESIN/GPWv411/GPW_Population_Count")
//     .filter(ee.Filter.date('2020-01-01', '2020-12-31'))
//     .first()
//     .clip(bekasiGeometry);
//   const historicalRainfall = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
//     .filterDate('2010-01-01', '2023-12-31') // Updated date range from besaki.js
//     .filterBounds(bekasiGeometry)
//     .select('precipitation')
//     .sum()
//     .clip(bekasiGeometry);
  
//   // Calculate high rainfall areas (from besaki.js)
//   const highRainfallAreas = historicalRainfall.gt(2000); // Areas with >2000mm total rainfall
  
//   // Combine factors to create flood proneness (from besaki.js)
//   const floodProneness = jrcWater.divide(100).add(
//     historicalRainfall.unitScale(0, 5000).multiply(0.5)
//   ).add(
//     population.unitScale(0, 10000).multiply(0.3)
//   );
  
//   // Create risk zones (same approach as besaki.js)
//   const riskZones = ee.Image(1)
//     .where(floodProneness.gt(0.3).and(floodProneness.lte(0.6)), 2)
//     .where(floodProneness.gt(0.6).and(floodProneness.lte(0.8)), 3)
//     .where(floodProneness.gt(0.8), 4);
  
//   // Visualization parameters with opacity (from besaki.js)
//   const riskVis = {
//     min: 1,
//     max: 4,
//     palette: ['green', 'yellow', 'orange', 'red'],
//     opacity: 0.5 // Added opacity from besaki.js
//   };
  
//   // Add the layer to the map
//   addLayer(riskZones, riskVis, 'Flood Risk Zones');
  
//   // Also add population density layer (hidden by default)
//   addLayer(population, {
//     min: 0, 
//     max: 5000, 
//     palette: ['white', 'yellow', 'orange', 'red'],
//     opacity: 0.5
//   }, 'Population Density', false);
  
//   // Add historical rainfall layer (hidden by default)
//   addLayer(historicalRainfall, {
//     min: 0, 
//     max: 3000, 
//     palette: ['white', 'lightblue', 'blue', 'darkblue'],
//     opacity: 0.5
//   }, 'Historical Rainfall (2010-2023)', false);
  
//   // Calculate risk scores for all areas (region-wise analysis)
//   const areaRisks = [];
//   const areaPromises = [];
  
//   // Process each area
//   Object.keys(bekasiAreas).forEach(function(area) {
//     const coords = bekasiAreas[area];
//     try {
//       // Get risk data for this area (returns a Promise)
//       const riskPromise = calculateFloodRisk(area, coords);
//       areaPromises.push(riskPromise);
      
//       // When the promise resolves, add a marker
//       riskPromise.then(result => {
//         if (!result) return;
        
//         // Store the risk data
//         areaRisks.push(result);
        
//         // Determine color based on risk score
//         let color = 'green';
//         let size = 5;
        
//         if (result.riskScore >= 75) {
//           color = 'red';
//           size = 10;
//         } else if (result.riskScore >= 60) {
//           color = 'orange';
//           size = 8;
//         } else if (result.riskScore >= 45) {
//           color = 'yellow';
//           size = 6;
//         }
        
//         // Convert any Earth Engine objects to JavaScript values for display
//         const riskScore = typeof result.riskScore === 'number' ? result.riskScore : parseFloat(result.riskScore);
//         const elevation = typeof result.elevation === 'number' ? result.elevation : parseFloat(result.elevation);
//         const population = typeof result.population === 'number' ? result.population : parseFloat(result.population);
//         const waterOccurrence = typeof result.waterOccurrence === 'number' ? result.waterOccurrence : parseFloat(result.waterOccurrence);
        
//         // Add marker to map with properly formatted values
//         L.circleMarker([result.coordinates[1], result.coordinates[0]], {
//           color: color,
//           fillColor: color,
//           fillOpacity: 0.7,
//           radius: size
//         }).addTo(map).bindPopup(`
//           <strong>${result.area}</strong><br>
//           Risk Score: ${isNaN(riskScore) ? '?' : riskScore.toFixed(1)}/100<br>
//           Elevation: ${isNaN(elevation) ? '?' : elevation.toFixed(1)} m<br>
//           Population: ${isNaN(population) ? '?' : Math.round(population)}/km²<br>
//           Water Occurrence: ${isNaN(waterOccurrence) ? '?' : waterOccurrence.toFixed(1)}%
//         `);
//       }).catch(error => {
//         console.error(`Error processing risk data for ${area}:`, error);
//       });
//     } catch (error) {
//       console.error(`Error calculating risk for ${area}:`, error);
//     }
//   });
  
//   // When all promises are resolved, update the status
//   Promise.all(areaPromises)
//     .then(() => {
//       updateStatus(`Risk analysis completed for ${areaRisks.length} areas.`);
//     })
//     .catch(error => {
//       console.error('Error in risk analysis:', error);
//       updateStatus('Risk analysis completed with some errors. Check console for details.');
//     });
  
//   // Update legend
//   createLegend('Flood Risk Zones', 
//     ['green', 'yellow', 'orange', 'red'],
//     ['Low Risk', 'Moderate Risk', 'High Risk', 'Severe Risk']);

//   updateStatus(`Risk analysis completed for ${Object.keys(bekasiAreas).length} areas.`);
// }

// Note: addLayer function moved to layers.js

// Note: createLegend function moved to utils.js

// Note: clearLayer and clearLayers functions moved to layers.js

// Update status message


// Note: toggleComparisonView function moved to map-controls.js

// Note: toggleComparisonFullscreen function moved to map-controls.js









