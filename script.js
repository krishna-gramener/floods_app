// Import authentication module and utilities
import { authenticate } from './auth.js';
import { hideLoading } from './utils.js';
import { initLayerManager} from './layers.js';
import { initMapControls, initMap, initComparisonMaps, toggleComparisonView, toggleComparisonFullscreen} from './map-controls.js';
import { bekasiBounds, bekasiAreas } from './config.js';
import { initFloodAnalysis, runFloodAnalysis, analysisState } from './flood-analysis.js';

/**
 * Creates flood analysis layers for comparison maps
 * This function should be called when analysis is completed,
 * regardless of whether we're in comparison mode or not
 */

// --- Risk pin helpers ---
const RISK_STYLES = {
  low:    { color: '#2ECC71', label: 'Low'    },
  medium: { color: '#F1C40F', label: 'Medium' },
  high:   { color: '#E74C3C', label: 'High'   }
};

// REPLACE your makeRiskIcon with this IMG-based L.icon (stable on zoom)
function makeRiskIcon(level = 'low') {
  const { color } = RISK_STYLES[level] || RISK_STYLES.low;

  // 28x40 pin; using data-URI avoids DOM reflow issues from divIcon
  const svg = `
  <svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" style="display:block">
    <defs>
      <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.25"/>
      </filter>
    </defs>
    <g filter="url(#shadow)">
      <path d="M14 0C6.82 0 1 5.82 1 13c0 9.53 11.1 21.5 12.05 22.54a1.3 1.3 0 0 0 1.9 0C15.9 34.5 27 22.53 27 13 27 5.82 21.18 0 14 0z"
            fill="${color}" stroke="white" stroke-width="2"/>
      <circle cx="14" cy="13" r="4.5" fill="white"/>
    </g>
  </svg>`.trim();

  const dataUri = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);

  return L.icon({
    iconUrl: dataUri,
    iconSize: [28, 40],
    iconAnchor: [14, 38],   // pin tip
    popupAnchor: [0, -34],
    className: 'risk-pin-img'
  });
}


export function createComparisonFloodLayers() {
  // If comparison maps don't exist yet, just store the data for later
  // They will be created when switching to comparison mode
  if (!mapLeft || !mapRight) {
    console.log('Comparison maps not initialized yet, data will be used when they are created');
    return;
  }
  
  console.log('Creating flood analysis layers for comparison maps');
  
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
              const level = String(feature.properties.risk_level || 'low').toLowerCase();

              const marker = L.marker(coords, {
                icon: makeRiskIcon(level),
                title: feature.properties.name
              }).bindPopup(`
                <div class="area-popup">
                  <h5 class="mb-1">${feature.properties.name}</h5>
                  <p class="mb-1"><strong>Risk Level:</strong> 
                    <span class="risk-badge risk-${level}">${(RISK_STYLES[level]?.label) || 'Low'}</span>
                  </p>
                  <p class="mb-0"><strong>Risk Score:</strong> ${Number(feature.properties.risk_score).toFixed(1)}</p>
                </div>
              `);
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
}

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
        const maps = initComparisonMaps();
        mapLeft = maps.mapLeft;
        mapRight = maps.mapRight;
        
        // Reset comparison map state
        
        // Reset overlay objects
        layersLeft = {};
        layersRight = {};
        
        // Create flood analysis layers for comparison maps
        createComparisonFloodLayers();
        
        // Set up toggle handlers for comparison maps
        
        // Add a class to all comparison map toggles for easier selection
        document.querySelectorAll('[id^="toggle-"][id$="-left"], [id^="toggle-"][id$="-right"]').forEach(toggle => {
          toggle.classList.add('comparison-toggle');
          
          // Make sure flood analysis toggles are not checked by default
          if (toggle.id.includes('-flood-')) {
            toggle.checked = false;
          } else {
            toggle.disabled = false; // Enable non-flood toggles that have layers
          }
        });
        
        // Add a single event listener for all comparison toggles
        document.addEventListener('change', function(event) {
          // Check if this is a comparison toggle
          if (event.target.classList.contains('comparison-toggle')) {
            const toggleId = event.target.id;
            const side = toggleId.endsWith('-left') ? 'left' : 'right';
            
            // Get the map and overlays
            const targetMap = side === 'left' ? mapLeft : mapRight;
            const targetOverlays = side === 'left' ? layersLeft : layersRight;
            
            let layerName;
            
            // Handle different toggle types
            if (toggleId.includes('-flood-')) {
              // Parse the toggle ID to get period for flood analysis toggles
              const matches = toggleId.match(/toggle-(\w+)-flood/);
              if (!matches) return;
              
              const period = matches[1]; // pre, during, or post
              layerName = `${period === 'pre' ? 'Pre' : period === 'during' ? 'During' : 'Post'}-Flood Analysis`;
            } else {
              // For non-flood toggles, extract the layer name from the toggle ID
              const parts = toggleId.split('-');
              layerName = parts[1]; // The layer name part
            }
            
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
      console.log('Please select a flood period first');
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
  console.log('Authenticating the user...');
  authenticate(initApp);
});

// Initialize the app after authentication
function initApp() {
  // updateStatus('User initialized successfully');
  console.log('User initialized successfully');
  
  // Initialize the main map
  map = initMap();
  
  // Initialize the layer manager with main map reference
  initLayerManager(map, layers, null, layersLeft, null, layersRight, addOpacitySliderToMap);
  
  // Initialize the map controls with main map reference
  initMapControls(map, layers, overlays, null, layersLeft, null, layersRight, bekasiBounds, isComparisonMode, 
    removeOpacitySliderForLayer, removeAllOpacitySliders);
  
  // Initialize the flood analysis module
  initFloodAnalysis(map, addOpacitySliderToMap, overlays, isComparisonMode);
  
  // Export function to update comparison mode in flood-analysis module
  window.updateFloodAnalysisComparisonMode = function(mode) {
    isComparisonMode = mode;
    // Re-initialize flood analysis with updated comparison mode
    initFloodAnalysis(map, addOpacitySliderToMap, overlays, isComparisonMode);
    
    // If switching to comparison mode, create flood analysis layers for comparison maps
    if (mode && mapLeft && mapRight) {
      createComparisonFloodLayers();
    }
  };

  // Hide loading overlay
  hideLoading();
  
// Initialize sidebar toggle functionality
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebar = document.getElementById('analysis-sidebar');
const toggleIcon = document.getElementById('sidebar-toggle-icon');

// MUST match your CSS width
const SIDEBAR_W = 350;

if (sidebarToggle && sidebar && toggleIcon) {
  function positionToggleButton() {
    const isOpen = !sidebar.classList.contains('closed');
    // keep the button just outside the sidebar when open; dock to edge when closed
    sidebarToggle.style.right = isOpen ? (SIDEBAR_W + 10) + 'px' : '10px';
  }

  // Update icon + title
  function updateToggleIcon(isOpen) {
    // tiny fade-out/in
    toggleIcon.classList.add('icon-animate-out');

    setTimeout(() => {
      toggleIcon.classList.remove('bi-chevron-left', 'bi-chevron-right', 'icon-animate-out');
      toggleIcon.classList.add(isOpen ? 'bi-chevron-right' : 'bi-chevron-left', 'icon-animate-in');
      sidebarToggle.title = isOpen ? 'Hide Analysis Panel' : 'Show Analysis Panel';
    }, 150);
  }

  function applyState(isOpen) {
    // CSS uses .closed to slide out; remove it to open
    sidebar.classList.toggle('closed', !isOpen);
    positionToggleButton();

    // after slide completes, refresh map sizes if they exist
    setTimeout(() => {
      try { 
        if (map) map.invalidateSize(); 
      } catch {}
      try { 
        if (mapLeft) mapLeft.invalidateSize(); 
        if (mapRight) mapRight.invalidateSize(); 
      } catch {}
    }, 300);

    updateToggleIcon(isOpen);
  }

  // Click handler - toggle between open and closed
  sidebarToggle.addEventListener('click', () => {
    const willOpen = sidebar.classList.contains('closed');
    applyState(willOpen);
  });

  // Initialize: sidebar OPEN by default (remove 'closed' class)
  sidebar.classList.remove('closed');
  applyState(true);
}
}

function showLayerToggles() {
  const desktopToggles = document.getElementById('layer-toggles');
  const mobileToggles = document.getElementById('layer-toggles-mobile');
  
  if (desktopToggles) {
    desktopToggles.classList.remove('d-none');
    desktopToggles.classList.add('d-lg-flex');
  }
  
  if (mobileToggles) {
    mobileToggles.classList.remove('d-none');
  }
}

/**
 * Sync mobile and desktop toggles
 * Call this function when setting up event listeners
 */
function syncLayerToggles() {
  // Desktop to Mobile sync
  ['pre', 'during', 'post'].forEach(period => {
    const desktopToggle = document.getElementById(`toggle-${period}-flood`);
    const mobileToggle = document.getElementById(`toggle-${period}-flood-mobile`);
    
    if (desktopToggle && mobileToggle) {
      desktopToggle.addEventListener('change', function() {
        mobileToggle.checked = this.checked;
      });
      
      mobileToggle.addEventListener('change', function() {
        desktopToggle.checked = this.checked;
        // Trigger the desktop toggle's change event to update the map
        desktopToggle.dispatchEvent(new Event('change'));
      });
    }
  });
}

// Call this when analysis is complete
// Add to your updateAnalysisState function or after analysis completes
function onAnalysisComplete() {
  showLayerToggles();
  syncLayerToggles();
}

// Example: Update your existing code
// In flood-analysis.js, modify updateAnalysisState function:
export function updateAnalysisState(period, completed) {
  analysisState[period] = completed;
  
  // Show layer toggles when first analysis completes
  const anyCompleted = Object.values(analysisState).some(state => state);
  if (anyCompleted) {
    showLayerToggles();
    syncLayerToggles();
  }
  
  // Update all related toggles
  ['', '-left', '-right', '-mobile'].forEach(suffix => {
    const toggle = document.getElementById(`toggle-${period}-flood${suffix}`);
    if (toggle) {
      toggle.disabled = !completed;
      if (completed && !toggle.checked && suffix === '') {
        toggle.checked = true;
      }
    }
  });
}