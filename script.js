// Import authentication module and utilities
import { authenticate } from './auth.js';
import { hideLoading, updateStatus } from './utils.js';
import { initLayerManager} from './layers.js';
import { initMapControls, initMap, initComparisonMaps, toggleComparisonView, toggleComparisonFullscreen} from './map-controls.js';
import { bekasiBounds, bekasiAreas } from './config.js';
import { initFloodAnalysis, runFloodAnalysis, analysisState } from './flood-analysis.js';

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
  document.getElementById('compare-button').addEventListener('click', function() {
    const container = document.getElementById('comparison-container');
    const mapContainer = document.getElementById('map-container');
    
    if (container.style.display === 'none') {
      container.style.display = 'flex';
      mapContainer.style.display = 'none';
      
      // Show fullscreen button
      document.getElementById('compare-fullscreen-button').classList.remove('d-none');
      
      // Initialize comparison maps
      try {
        // Clean up existing maps
        if (mapLeft) {
          mapLeft.remove();
          mapLeft = null;
        }
        if (mapRight) {
          mapRight.remove();
          mapRight = null;
        }

        // Initialize new maps
        // Initialize comparison maps
        const maps = initComparisonMaps();
        mapLeft = maps.mapLeft;
        mapRight = maps.mapRight;
        
        // Reset comparison map state
        
        // Reset overlay objects
        layersLeft = {};
        layersRight = {};
        
        // Setup for both left and right maps
        ['left', 'right'].forEach(side => {
          const targetMap = side === 'left' ? mapLeft : mapRight;
          const targetOverlays = side === 'left' ? layersLeft : layersRight;
          
          // Create layers for each analysis period
          ['pre', 'during', 'post'].forEach(period => {
            const layerName = `${period === 'pre' ? 'Pre' : period === 'during' ? 'During' : 'Post'}-Flood Analysis`;
            
            // Skip if analysis not completed
            if (!analysisState[period]) {
              return;
            }
            
            try {
              // Create appropriate layer based on period
              if (period === 'pre') {
                // Create risk zone layer group
                if (window.riskData && window.riskData.features) {
                  const riskZoneGroup = L.layerGroup();
                  
                  window.riskData.features.forEach(feature => {
                    const coords = [feature.geometry.coordinates[1], feature.geometry.coordinates[0]];
                    let color;
                    switch (feature.properties.risk_level) {
                      case 'low': color = '#00ff00'; break;
                      case 'medium': color = '#ffff00'; break;
                      case 'high': color = '#ff0000'; break;
                      default: color = '#00ff00';
                    }
                    
                    const markerIcon = L.divIcon({
                      className: 'custom-marker',
                      html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
                      iconSize: [16, 16],
                      iconAnchor: [8, 8]
                    });
                    
                    const marker = L.marker(coords, {
                      icon: markerIcon,
                      title: feature.properties.name
                    }).bindPopup(`<div class="area-popup"><h5>${feature.properties.name}</h5><p><strong>Risk Level:</strong> ${feature.properties.risk_level}</p><p><strong>Risk Score:</strong> ${feature.properties.risk_score.toFixed(1)}</p></div>`);
                    
                    riskZoneGroup.addLayer(marker);
                  });
                  
                  // Store layer in overlays
                  targetOverlays[layerName] = riskZoneGroup;
                }
              } else {
                // Create flood tile layer
                const originalLayer = overlays[layerName];
                if (originalLayer && originalLayer._url) {
                  const floodTileLayer = L.tileLayer(originalLayer._url, {
                    attribution: originalLayer.options.attribution || 'Google Earth Engine',
                    opacity: originalLayer.options.opacity || 0.7,
                    zIndex: 1000
                  });
                  
                  // Store layer in overlays
                  targetOverlays[layerName] = floodTileLayer;
                }
              }
            } catch (error) {
              console.error(`Error creating ${layerName} for ${side} map:`, error);
            }
          });
        });
        
        // Set up toggle handlers using a simpler class-based approach
        
        // Add a class to all comparison map toggles for easier selection
        document.querySelectorAll('[id^="toggle-"][id$="-left"], [id^="toggle-"][id$="-right"]').forEach(toggle => {
          toggle.classList.add('comparison-toggle');
          toggle.disabled = false; // Enable toggles that have layers
        });
        
        // Add a single event listener for all comparison toggles
        document.addEventListener('change', function(event) {
          // Check if this is a comparison toggle
          if (event.target.classList.contains('comparison-toggle')) {
            const toggleId = event.target.id;
            
            // Parse the toggle ID to get period and side
            const matches = toggleId.match(/toggle-(\w+)-flood-(\w+)/);
            if (!matches) return;
            
            const period = matches[1]; // pre, during, or post
            const side = matches[2];   // left or right
            
            // Get the map and overlays
            const targetMap = side === 'left' ? mapLeft : mapRight;
            const targetOverlays = side === 'left' ? layersLeft : layersRight;
            
            // Get the layer name
            const layerName = `${period === 'pre' ? 'Pre' : period === 'during' ? 'During' : 'Post'}-Flood Analysis`;
            const layer = targetOverlays[layerName];
            
            if (!targetMap || !layer) return;
            
            try {
              if (event.target.checked) {
                layer.addTo(targetMap);
              } else {
                targetMap.removeLayer(layer);
              }
            } catch (error) {
              console.error(`Error toggling ${layerName} on ${side} map:`, error);
            }
          }
        });
      } catch (error) {
        console.error('Failed to initialize comparison maps:', error);
        container.style.display = 'none';
        mapContainer.style.display = 'block';
        return;
      }
    } else {
      container.style.display = 'none';
      mapContainer.style.display = 'block';
      
      // Hide fullscreen button
      document.getElementById('compare-fullscreen-button').classList.add('d-none');
      
      // Uncheck all comparison toggles
      ['left', 'right'].forEach(side => {
        ['pre', 'during', 'post'].forEach(period => {
          const toggle = document.getElementById(`toggle-${period}-flood-${side}`);
          if (toggle) toggle.checked = false;
        });
      });
      
      // Force map to refresh by invalidating size
      setTimeout(() => {
        if (map) {
          map.invalidateSize();
          
          // Re-add any active layers that might have been affected
          Object.keys(overlays).forEach(layerName => {
            const layer = overlays[layerName];
            const toggleId = layerName === 'Pre-Flood Analysis' ? 'toggle-pre-flood' :
                          layerName === 'During-Flood Analysis' ? 'toggle-during-flood' :
                          layerName === 'Post-Flood Analysis' ? 'toggle-post-flood' : null;
            
            if (toggleId) {
              const toggle = document.getElementById(toggleId);
              if (toggle && toggle.checked && layer) {
                if (!map.hasLayer(layer)) {
                  layer.addTo(map);
                }
              }
            }
          });
        }
      }, 100);
    }
  });
  
  // Set up fullscreen comparison button
  document.getElementById('compare-fullscreen-button').addEventListener('click', toggleComparisonFullscreen);
  
  // Set up flood analysis button
  document.getElementById('run-analysis').addEventListener('click', function() {
    const period = document.getElementById('flood-period').value;
    const floodResults = document.getElementById('flood-results');

    if(floodResults)floodResults.innerHTML='';
    
    if (period !== 'none') {
      runFloodAnalysis(period);
    } else {
      updateStatus('Please select a flood period first');
    }
  });
  
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
  
  // Initialize the main map
  map = initMap();
  
  // Initialize the layer manager with main map reference
  initLayerManager(map, layers, null, layersLeft, null, layersRight, addOpacitySliderToMap);
  
  // Initialize the map controls with main map reference
  initMapControls(map, layers, overlays, null, layersLeft, null, layersRight, bekasiBounds, isComparisonMode, 
    removeOpacitySliderForLayer, removeAllOpacitySliders);
  
  // Initialize the flood analysis module
  initFloodAnalysis(map, addOpacitySliderToMap, overlays);
  
  // Hide loading overlay
  hideLoading();
}