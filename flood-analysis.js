// Flood analysis module for Bekasi Flood Monitoring System
import { updateStatus } from './utils.js';
import { bekasiAreas, bekasiGeoJSON } from './config.js';
import { createComparisonFloodLayers } from './script.js';

// External variables
let map;
let addOpacitySliderToMap;
let overlays = {};
let isComparisonMode = false;

// Analysis state tracking
export const analysisState = {
  pre: false,
  during: false,
  post: false
};

// Function to update analysis state and sync toggles
export function updateAnalysisState(period, completed) {
  analysisState[period] = completed;
  
  // Update all related toggles
  ['', '-left', '-right'].forEach(suffix => {
    const toggle = document.getElementById(`toggle-${period}-flood${suffix}`);
    if (toggle) {
      // Enable the toggle when analysis is completed
      toggle.disabled = !completed;
      
      // Only check the main map toggle, not the comparison map toggles
      if (completed && !toggle.checked && suffix === '') {
        toggle.checked = true;
      }
    }
  });
}

export function initFloodAnalysis(mainMap, opacitySliderFn, overlaysObj, comparisonMode) {
  map = mainMap;
  addOpacitySliderToMap = opacitySliderFn;
  overlays = overlaysObj;
  isComparisonMode = comparisonMode;

  // Set up layer toggle handlers
  const toggles = {
    'toggle-pre-flood': { layerName: 'Pre-Flood Analysis', period: 'pre' },
    'toggle-during-flood': { layerName: 'During-Flood Analysis', period: 'during' },
    'toggle-post-flood': { layerName: 'Post-Flood Analysis', period: 'post' }
  };

  Object.entries(toggles).forEach(([toggleId, config]) => {
    const toggle = document.getElementById(toggleId);
    if (toggle) {
      // Set initial state based on analysis completion
      toggle.checked = analysisState[config.period];
      toggle.disabled = !analysisState[config.period];

      toggle.addEventListener('change', function() {
        const layer = overlays[config.layerName];
        if (layer && analysisState[config.period]) {
          if (this.checked) {
            if (layer instanceof L.LayerGroup) {
              layer.addTo(map);
            } else if (layer instanceof L.TileLayer) {
              layer.addTo(map);
            }
          } else {
            if (layer instanceof L.LayerGroup) {
              map.removeLayer(layer);
            } else if (layer instanceof L.TileLayer) {
              map.removeLayer(layer);
            }
          }
        }
      });
    }
  });
}

// Time periods for analysis
const periods = {
  pre: {
    start: '2019-11-01',
    end: '2019-12-31',
    label: 'Pre-flood'
  },
  during: {
    start: '2020-01-01',
    end: '2020-02-20',
    label: 'During flood'
  },
  post: {
    start: '2020-02-21',
    end: '2020-02-29',
    label: 'Post-flood'
  }
};

function loadS1Median(startDate, endDate) {
  // Use GeoJSON AOI for more precise area definition
  const geometry = ee.FeatureCollection([
    ee.Feature(ee.Geometry.Polygon(bekasiGeoJSON.features[0].geometry.coordinates), {})
  ]).geometry();
  
  // Load Sentinel-1 GRD data with more detailed filtering
  return ee.ImageCollection('COPERNICUS/S1_GRD')
    .filterBounds(geometry)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.eq('instrumentMode', 'IW'))
    .filter(ee.Filter.inList('orbitProperties_pass', ['DESCENDING','ASCENDING']))
    .filter(ee.Filter.eq('resolution_meters', 10))
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
    .select('VV')
    .median()
    .clip(geometry);
}

function toNatural(img) { 
  return ee.Image(10.0).pow(img.divide(10.0)); 
}

function toDB(img) { 
  return ee.Image(img).log10().multiply(10.0); 
}

function refinedLeeSimple(img) {
  const kernel = ee.Kernel.square(1);
  const mean = img.reduceNeighborhood(ee.Reducer.mean(), kernel);
  const variance = img.reduceNeighborhood(ee.Reducer.variance(), kernel);
  const cu = variance.divide(mean.multiply(mean));
  const wl = variance.divide(variance.add(cu));
  return mean.add(wl.multiply(img.subtract(mean)));
}

function filteredVV(startDate, endDate) {
  // Use GeoJSON AOI for more precise area definition
  const geometry = ee.FeatureCollection([
    ee.Feature(ee.Geometry.Polygon(bekasiGeoJSON.features[0].geometry.coordinates), {})
  ]).geometry();
  
  // Apply speckle filtering pipeline
  const med = loadS1Median(startDate, endDate);
  const nat = toNatural(med);
  const filtNat = refinedLeeSimple(nat);
  const db = toDB(filtNat).rename('VVf');
  return db.clip(geometry);
}


function detectFlood(preStart, preEnd, duringStart, duringEnd, threshold) {
  threshold = threshold || 1.25;
  
  // Use GeoJSON AOI for more precise area definition
  const geometry = ee.FeatureCollection([
    ee.Feature(ee.Geometry.Polygon(bekasiGeoJSON.features[0].geometry.coordinates), {})
  ]).geometry();
  
  // Get pre and during flood images with speckle filtering
  const preVV = filteredVV(preStart, preEnd);
  const postVV = filteredVV(duringStart, duringEnd);
  
  // Get reference datasets
  const gsw = ee.Image("JRC/GSW1_4/GlobalSurfaceWater").clip(geometry);
  const hydrosheds = ee.Image("WWF/HydroSHEDS/03VFDEM").clip(geometry);
  const terrain = ee.Algorithms.Terrain(hydrosheds);
  const slope = terrain.select('slope');
  
  // Calculate change ratio between pre and post images
  const preSafe = preVV.unmask(1e-6);
  const change = postVV.divide(preSafe).rename('change_ratio');
  
  // Detect potential flood areas
  const floodedRaw = change.gt(threshold).rename('flood_raw').selfMask();
  
  // Apply filters to reduce false positives
  const permWater = gsw.select('seasonality').gte(5).clip(geometry);
  const floodedNoPerm = floodedRaw.where(permWater, 0).selfMask();
  
  // Remove steep slopes from flood detection
  const floodedSlopeMask = floodedNoPerm.updateMask(slope.lt(5));
  
  // Apply connected pixel filter to remove noise
  const connections = floodedSlopeMask.connectedPixelCount(25);
  const floodedClean = floodedSlopeMask.updateMask(connections.gt(8)).rename('flood');
  
  // Return only what's needed
  return {
    floodedClean: floodedClean,
    hydrosheds: hydrosheds,
    slope: slope
  };
}

function generateRiskZones() {
  // Use GeoJSON AOI for more precise area definition
  const geometry = ee.FeatureCollection([
    ee.Feature(ee.Geometry.Polygon(bekasiGeoJSON.features[0].geometry.coordinates), {})
  ]).geometry();
  
  // Get required datasets
  const hydrosheds = ee.Image("WWF/HydroSHEDS/03VFDEM").clip(geometry);
  const population = ee.ImageCollection("CIESIN/GPWv411/GPW_Population_Count")
    .filter(ee.Filter.date('2020-01-01', '2020-12-31'))
    .first()
    .clip(geometry);
  const gsw = ee.Image("JRC/GSW1_4/GlobalSurfaceWater").clip(geometry);
  
  // Convert object to array for Earth Engine
  const subareasArray = Object.entries(bekasiAreas).map(([name, coords]) => ({
    name: name,
    lon: coords[0],
    lat: coords[1]
  }));
  
  // Create feature collection
  const subFeatures = ee.FeatureCollection(subareasArray.map(area => 
    ee.Feature(ee.Geometry.Point([area.lon, area.lat]), {name: area.name})
  ));
  
  // Calculate risk score for each subarea
  const scored = subFeatures.map(function(f) {
    const buff = f.geometry().buffer(3000);
    
    // Get elevation data with error handling
    const elevDict = hydrosheds.reduceRegion({
      reducer: ee.Reducer.mean(), 
      geometry: buff, 
      scale: 90
    });
    // Use ee.Algorithms.If to handle missing keys
    const elev = ee.Algorithms.If(
      elevDict.contains('b1'),
      elevDict.get('b1'),
      50  // Default elevation value if missing
    );
    
    // Get population data with error handling
    const popDict = population.reduceRegion({
      reducer: ee.Reducer.sum(), 
      geometry: buff, 
      scale: 100
    });
    // Use ee.Algorithms.If to handle missing keys
    const popsum = ee.Algorithms.If(
      popDict.contains('population_count'),
      popDict.get('population_count'),
      0
    );
    
    // Get water occurrence data with error handling
    const jrcDict = gsw.select('occurrence').reduceRegion({
      reducer: ee.Reducer.mean(), 
      geometry: buff, 
      scale: 90
    });
    // Use ee.Algorithms.If to handle missing keys
    const jrcmean = ee.Algorithms.If(
      jrcDict.contains('occurrence'),
      jrcDict.get('occurrence'),
      0
    );
    
    // Ensure all values are valid numbers with defaults
    const elevValue = ee.Number(ee.Algorithms.If(elev, elev, 50));
    const popsumValue = ee.Number(ee.Algorithms.If(popsum, popsum, 0));
    const jrcmeanValue = ee.Number(ee.Algorithms.If(jrcmean, jrcmean, 0));
    
    // Calculate risk score with null-safe operations
    const score = ee.Number(100)
      .subtract(elevValue.multiply(1.2))  // Lower elevation = higher risk
      .add(popsumValue.divide(ee.Number(1000)).multiply(10))  // Higher population = higher risk
      .add(jrcmeanValue.divide(ee.Number(10)).multiply(8));  // Higher water occurrence = higher risk
    
    return f.set({
      risk_score: score
    });
  });
  
  // Categorize risk zones and add risk_level property
  const lowRisk = scored.filter(ee.Filter.lt('risk_score', 30))
    .map(feature => feature.set({risk_level: 'low'}));
    
  const medRisk = scored.filter(ee.Filter.and(
    ee.Filter.gte('risk_score', 30),
    ee.Filter.lt('risk_score', 70)
  )).map(feature => feature.set({risk_level: 'medium'}));
  
  const highRisk = scored.filter(ee.Filter.gte('risk_score', 70))
    .map(feature => feature.set({risk_level: 'high'}));
  
  // Merge all features with their risk levels
  const allWithRiskLevel = lowRisk.merge(medRisk).merge(highRisk);
  
  return {
    low: lowRisk,
    medium: medRisk,
    high: highRisk,
    all: allWithRiskLevel
  };
}

export function runFloodAnalysis(period) {
  // Show loader
  document.getElementById('analysis-loader').classList.remove('d-none');
  updateStatus(`Running ${periods[period].label} analysis...`);
  
  // Show layer toggles if not already visible
  const layerToggles = document.getElementById('layer-toggles');
  if (layerToggles && layerToggles.classList.contains('d-none')) {
    layerToggles.classList.remove('d-none');
  }
  
  return new Promise((resolve, reject) => {
    try {
      
      if (period === 'pre') {
        // Run pre-flood analysis (risk assessment)

        // Generate risk zones for all periods
        const riskZones = generateRiskZones();
        
        // Add risk zones to the main map
        addRiskZonesToMap(riskZones);
        
        try {
          riskZones.all.evaluate(function(riskData) {
            // Hide loader
            document.getElementById('analysis-loader').classList.add('d-none');
            
            try {
              // Check if riskData exists and has features
              if (riskData && riskData.features && riskData.features.length > 0) {
                // Create results panel for pre-flood analysis
                createPreFloodPanel(riskData.features);
                
                // Store risk data for comparison maps
                window.riskData = riskData;
                
                // Update analysis state and sync all toggles
                updateAnalysisState('pre', true);
                
                // Always create flood analysis layers for comparison maps
                // This ensures layers are ready even if we're not in comparison mode yet
                createComparisonFloodLayers();
                
                updateStatus('Pre-flood risk analysis complete');
              } else {
                // Handle the error case
                updateStatus('Error: Could not retrieve risk data');
                console.error('Risk data is undefined or missing features', riskData);
                createErrorPanel('Could not retrieve risk zone data. Please try again.');
              }
            } catch (innerError) {
              console.error('Error processing risk data:', innerError);
              updateStatus('Error processing risk data');
              createErrorPanel('Error processing risk zone data: ' + innerError.message);
            }
            
            resolve();
          }, function(error) {
            // Error callback for evaluate
            document.getElementById('analysis-loader').classList.add('d-none');
            console.error('Earth Engine error:', error);
            updateStatus('Earth Engine error: ' + error.message);
            createErrorPanel('Earth Engine error: ' + error.message);
            resolve();
          });
        } catch (outerError) {
          document.getElementById('analysis-loader').classList.add('d-none');
          console.error('Error in pre-flood analysis:', outerError);
          updateStatus('Error in pre-flood analysis');
          createErrorPanel('Error in pre-flood analysis: ' + outerError.message);
          resolve();
        }
      } else if (period === 'during') {
        // Run during-flood analysis
        const result = detectFlood(
          periods.pre.start, 
          periods.pre.end, 
          periods.during.start, 
          periods.during.end, 
          1.25
        );
        
        // Create the flood layer
        const layerName = 'Flooded Areas (During)';
        
        // Add the layer to the map control instead of directly to the map
        result.floodedClean.getMap({min: 0, max: 1, palette: ['#ff0000']}, function(tileLayer) {
          // Create a Leaflet tile layer from the Earth Engine tiles
          const floodTileLayer = L.tileLayer(tileLayer.urlFormat, {
            attribution: "Google Earth Engine",
            opacity: 0.7,
          });
          
          // Set the layer in overlays
          const layerName = period === 'during' ? 'During-Flood Analysis' : 'Post-Flood Analysis';
          
          // Remove existing layer if it exists
          if (overlays[layerName] && overlays[layerName] instanceof L.TileLayer) {
            map.removeLayer(overlays[layerName]);
          }
          
          overlays[layerName] = floodTileLayer;
          
          // Update analysis state and sync all toggles
          updateAnalysisState(period, true);
          floodTileLayer.addTo(map);
          
          // Always create flood analysis layers for comparison maps
          // This ensures layers are ready even if we're not in comparison mode yet
          createComparisonFloodLayers();
          
          // Add opacity slider
          if (addOpacitySliderToMap) {
            addOpacitySliderToMap(map, floodTileLayer, layerName);
          }
          
          // Calculate hotspots
          const population = ee.ImageCollection("CIESIN/GPWv411/GPW_Population_Count")
            .filter(ee.Filter.date('2020-01-01', '2020-12-31'))
            .first();
          
          const floodedArea = result.floodedClean.multiply(ee.Image.pixelArea()).divide(1e6);
          const affectedPop = population.multiply(result.floodedClean);
          
          // Convert bekasiAreas object to array of features
          const subareasArray = Object.entries(bekasiAreas).map(([name, coords]) => {
            return {
              name: name,
              lon: coords[0],
              lat: coords[1]
            };
          });
          
          // Create feature collection for subareas
          const subFeatures = ee.FeatureCollection(subareasArray.map(area => {
            return ee.Feature(
              ee.Geometry.Point([area.lon, area.lat]), 
              {name: area.name}
            );
          }));
          
          // Calculate hotspots
          const hotspots = subFeatures.map(function(f) {
            const buff = f.geometry().buffer(3000);
            const frac = result.floodedClean.unmask(0).reduceRegion({
              reducer: ee.Reducer.mean(), 
              geometry: buff, 
              scale: 30, 
              maxPixels: 1e9
            }).get('flood');
            
            const popExposed = affectedPop.reduceRegion({
              reducer: ee.Reducer.sum(), 
              geometry: buff, 
              scale: 30, 
              maxPixels: 1e9
            }).get('population_count');
            
            return f.set({
              flood_frac: ee.Algorithms.If(frac, frac, 0),
              pop_exposed: ee.Algorithms.If(popExposed, popExposed, 0)
            });
          }).sort('flood_frac', false);
          
          // Calculate total stats
          const totalStats = {
            floodArea: floodedArea.reduceRegion({
              reducer: ee.Reducer.sum(),
              geometry: result.floodedClean.geometry(),
              scale: 30,
              maxPixels: 1e9
            }),
            affectedPop: affectedPop.reduceRegion({
              reducer: ee.Reducer.sum(),
              geometry: result.floodedClean.geometry(),
              scale: 30,
              maxPixels: 1e9
            })
          };
          
          // Evaluate and display results
          totalStats.floodArea.evaluate(function(floodArea) {
            totalStats.affectedPop.evaluate(function(affectedPop) {
              hotspots.limit(3).evaluate(function(hotspotData) {
                // Hide loader
                document.getElementById('analysis-loader').classList.add('d-none');
                
                try {
                  // Check if we have valid data
                  if (!hotspotData || !hotspotData.features || hotspotData.features.length === 0) {
                    throw new Error('No flood hotspot data available');
                  }
                  
                  // Create results panel for during-flood
                  createResultsPanel({
                    floodArea: floodArea && floodArea.flood ? floodArea.flood : 0,
                    affectedPop: affectedPop && affectedPop.population_count ? affectedPop.population_count : 0,
                    hotspots: hotspotData.features.map(f => ({
                      name: f.properties.name,
                      floodFrac: f.properties.flood_frac || 0,
                      popExposed: f.properties.pop_exposed || 0
                    }))
                  });
                  
                  updateStatus('Flood analysis complete');
                } catch (error) {
                  console.error('Error in during-flood analysis:', error);
                  updateStatus('Error in flood analysis');
                  createErrorPanel('Could not process flood data. Please try again.');
                }
                
                resolve();
              });
            });
          });
        });
      } else if (period === 'post') {
        // Run post-flood analysis
        const result = detectFlood(
          periods.pre.start, 
          periods.pre.end, 
          periods.post.start, 
          periods.post.end, 
          1.35 // Higher threshold for post-flood to reduce false positives
        );
        
        // Create the flood layer
        const layerName = 'Flooded Areas (Post)';
        
        // Add the layer to the map
        result.floodedClean.getMap({min: 0, max: 1, palette: ['#0000ff']}, function(tileLayer) {
          // Create a Leaflet tile layer
          const floodTileLayer = L.tileLayer(tileLayer.urlFormat, {
            attribution: "Google Earth Engine",
            opacity: 0.7,
            zIndex: 10
          });
          
          // Set the layer in overlays
          const layerName = 'Post-Flood Analysis';
          
          // Remove existing layer if it exists
          if (overlays[layerName] && overlays[layerName] instanceof L.TileLayer) {
            map.removeLayer(overlays[layerName]);
          }
          
          // Set new layer and add to map
          overlays[layerName] = floodTileLayer;
          
          // Update analysis state and sync all toggles
          updateAnalysisState('post', true);
          
          // Add layer to map
          overlays[layerName].addTo(map);
          
          // Always create flood analysis layers for comparison maps
          // This ensures layers are ready even if we're not in comparison mode yet
          createComparisonFloodLayers();
          
          // Add opacity slider
          if (addOpacitySliderToMap) {
            addOpacitySliderToMap(map, floodTileLayer, layerName);
          }
          
          // Calculate hotspots
          const population = ee.ImageCollection("CIESIN/GPWv411/GPW_Population_Count")
            .filter(ee.Filter.date('2020-01-01', '2020-12-31'))
            .first();
          
          const floodedArea = result.floodedClean.multiply(ee.Image.pixelArea()).divide(1e6);
          const affectedPop = population.multiply(result.floodedClean);
          
          // Convert bekasiAreas object to array of features
          const subareasArray = Object.entries(bekasiAreas).map(([name, coords]) => {
            return {
              name: name,
              lon: coords[0],
              lat: coords[1]
            };
          });
          
          // Create feature collection for subareas
          const subFeatures = ee.FeatureCollection(subareasArray.map(area => {
            return ee.Feature(
              ee.Geometry.Point([area.lon, area.lat]), 
              {name: area.name}
            );
          }));
          
          // Calculate hotspots
          const hotspots = subFeatures.map(function(f) {
            const buff = f.geometry().buffer(3000);
            const frac = result.floodedClean.unmask(0).reduceRegion({
              reducer: ee.Reducer.mean(), 
              geometry: buff, 
              scale: 30, 
              maxPixels: 1e9
            }).get('flood');
            
            return f.set({
              flood_frac: ee.Algorithms.If(frac, frac, 0)
            });
          }).sort('flood_frac', false).filter(ee.Filter.gt('flood_frac', 0));
          
          // Calculate total stats
          const totalStats = {
            floodArea: floodedArea.reduceRegion({
              reducer: ee.Reducer.sum(),
              geometry: result.floodedClean.geometry(),
              scale: 30,
              maxPixels: 1e9
            }),
            affectedPop: affectedPop.reduceRegion({
              reducer: ee.Reducer.sum(),
              geometry: result.floodedClean.geometry(),
              scale: 30,
              maxPixels: 1e9
            })
          };
          
          // Evaluate and display results
          totalStats.floodArea.evaluate(function(floodArea) {
            totalStats.affectedPop.evaluate(function(affectedPop) {
              hotspots.limit(3).evaluate(function(hotspotData) {
                // Hide loader
                document.getElementById('analysis-loader').classList.add('d-none');
                
                try {
                  // Check if we have valid data
                  if (!hotspotData || !hotspotData.features) {
                    throw new Error('No post-flood data available');
                  }
                  
                  // Create results panel for post-flood
                  createPostFloodPanel({
                    floodArea: floodArea && floodArea.flood ? floodArea.flood : 0,
                    affectedPop: affectedPop && affectedPop.population_count ? affectedPop.population_count : 0,
                    hotspots: hotspotData.features.map(f => ({
                      name: f.properties.name,
                      floodFrac: f.properties.flood_frac || 0
                    }))
                  });
                  
                  updateStatus('Post-flood analysis complete');
                } catch (error) {
                  console.error('Error in post-flood analysis:', error);
                  updateStatus('Error in post-flood analysis');
                  createErrorPanel('Could not process post-flood data. Please try again.');
                }
                
                resolve();
              });
            });
          });
        });
      } else {
        // Invalid period
        document.getElementById('analysis-loader').classList.add('d-none');
        updateStatus(`Invalid analysis period: ${period}`);
        reject(new Error(`Invalid analysis period: ${period}`));
      }
    } catch (error) {
      document.getElementById('analysis-loader').classList.add('d-none');
      updateStatus(`Error in flood analysis: ${error.message}`);
      reject(error);
    }
  });
}

function addRiskZonesToMap(riskZones) {
  // Create a single layer group for all risk zones
  const riskZoneGroup = L.layerGroup();
  
  /**
   * Helper function to add markers to the risk zone group
   * @param {ee.FeatureCollection} features - Features to add
   * @param {string} color - Color for the zone
   * @param {string} riskLevel - Risk level (Low, Medium, High)
   */
  function addRiskMarkers(features, color, riskLevel) {
    features.evaluate(function(data) {
      if (!data || !data.features || data.features.length === 0) return;
      
      // Add each feature to the layer group
      data.features.forEach(feature => {
        // Get coordinates
        const coords = [feature.geometry.coordinates[1], feature.geometry.coordinates[0]];
        
        // Create marker with custom icon based on risk level
        const markerIcon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });
        
        // Create marker
        const marker = L.marker(coords, {
          icon: markerIcon,
          title: feature.properties.name
        });
        
        // Format coordinates for display
        const lat = coords[0].toFixed(6);
        const lon = coords[1].toFixed(6);
        
        // Add popup with detailed information
        marker.bindPopup(`
          <div class="area-popup">
            <h5>${feature.properties.name}</h5>
            <p><strong>Risk Level:</strong> ${riskLevel}</p>
            <p><strong>Coordinates:</strong> ${lat}, ${lon}</p>
            <p><strong>Risk Score:</strong> ${feature.properties.risk_score.toFixed(1)}</p>
          </div>
        `);
        
        // Add marker to the risk zone group
        marker.addTo(riskZoneGroup);
      });
    });
  }

  
  // Add all risk zones to the single layer group
  addRiskMarkers(riskZones.low, '#00ff00', 'Low');
  addRiskMarkers(riskZones.medium, '#ffff00', 'Medium');
  addRiskMarkers(riskZones.high, '#ff0000', 'High');
  
  // Set the layer in overlays
  const layerName = 'Pre-Flood Analysis';
  
  // Remove existing layer if it exists
  if (overlays[layerName]) {
    map.removeLayer(overlays[layerName]);
  }
  
  // Set new layer and add to map
  overlays[layerName] = riskZoneGroup;
  overlays[layerName].addTo(map);
  
  // Check the toggle
  const toggle = document.getElementById('toggle-pre-flood');
  if (toggle) {
    toggle.checked = true;
  }
}

/**
 * Create results panel for pre-flood analysis
 * @param {Array} riskData - Risk data features
 */
function createPreFloodPanel(riskData) {
  // Create or get results panel
  let resultsPanel = document.getElementById('flood-results');
  if (!resultsPanel) {
    resultsPanel = document.createElement('div');
    resultsPanel.id = 'flood-results';
    resultsPanel.className = 'mt-3 p-3 bg-light border rounded';
    document.querySelector('.controls').appendChild(resultsPanel);
  }
  
  // Sort risk data by risk score
  riskData.sort((a, b) => b.properties.risk_score - a.properties.risk_score);
  
  // Create HTML content
  let html = `
    <h5>Pre-Flood Risk Assessment</h5>
    <div class="alert alert-warning">
      <strong>Risk Assessment Complete</strong>
    </div>
    <p>This analysis identifies areas at risk of flooding based on:</p>
    <ul>
      <li>Elevation data</li>
      <li>Population density</li>
      <li>Historical water occurrence</li>
    </ul>
    
    <h6 class="mt-3">High Risk Areas:</h6>
    <ul>
  `;
  
  // Add high risk areas
  const highRiskAreas = riskData.filter(f => f.properties.risk_score >= 70);
  highRiskAreas.forEach(area => {
    html += `<li><strong>${area.properties.name}</strong></li>`;
  });
  
  if (highRiskAreas.length === 0) {
    html += '<li>No high risk areas identified</li>';
  }
  
  html += `
    </ul>
    
    <h6 class="mt-3 text-primary">Preparedness Recommendations:</h6>
    <div class="recommendations p-2 border-start border-4 border-primary">
      <ul class="mb-0">
        <li><strong>Early Warning:</strong> Establish early warning systems in high risk areas.</li>
        <li><strong>Evacuation Planning:</strong> Develop evacuation routes and safe zones.</li>
        <li><strong>Infrastructure:</strong> Reinforce flood defenses in high risk areas.</li>
        <li><strong>Community Education:</strong> Conduct flood preparedness training.</li>
        <li><strong>Emergency Supplies:</strong> Pre-position emergency supplies in strategic locations.</li>
      </ul>
    </div>
  `;
  
  resultsPanel.innerHTML = html;
}

/**
 * Create results panel for post-flood analysis
 * @param {Object} results - Analysis results
 */
/**
 * Create error panel to display error messages
 * @param {string} errorMessage - Error message to display
 */
function createErrorPanel(errorMessage) {
  // Create or get results panel
  let resultsPanel = document.getElementById('flood-results');
  if (!resultsPanel) {
    resultsPanel = document.createElement('div');
    resultsPanel.id = 'flood-results';
    resultsPanel.className = 'mt-3 p-3 bg-light border rounded';
    document.querySelector('.controls').appendChild(resultsPanel);
  }
  
  // Create HTML content with error message
  const html = `
    <h5>Analysis Error</h5>
    <div class="alert alert-danger">
      <strong>Error:</strong> ${errorMessage}
    </div>
    <p>Suggestions to resolve this issue:</p>
    <ul>
      <li>Check your internet connection</li>
      <li>Refresh the page and try again</li>
      <li>Try selecting a different time period</li>
    </ul>
  `;
  
  resultsPanel.innerHTML = html;
}

function createPostFloodPanel(results) {
  // Create or get results panel
  let resultsPanel = document.getElementById('flood-results');
  if (!resultsPanel) {
    resultsPanel = document.createElement('div');
    resultsPanel.id = 'flood-results';
    resultsPanel.className = 'mt-3 p-3 bg-light border rounded';
    document.querySelector('.controls').appendChild(resultsPanel);
  }
  
  // Format results
  const floodAreaKm2 = results.floodArea.toFixed(2);
  const affectedPopulation = Math.round(results.affectedPop).toLocaleString();
  
  // Create HTML content
  let html = `
    <h5>Post-Flood Analysis Results</h5>
    <div class="alert alert-info">
      <strong>Recovery Phase</strong>
    </div>
    <p><strong>Remaining Flooded Area:</strong> ${floodAreaKm2} km²</p>
    <p><strong>People Still Affected:</strong> ${affectedPopulation}</p>
  `;
  
  // Add areas still flooded
  if (results.hotspots && results.hotspots.length > 0) {
    html += `<h6>Areas Still Flooded:</h6><ul>`;
    results.hotspots.forEach(hotspot => {
      const floodPercent = (hotspot.floodFrac * 100).toFixed(1);
      html += `<li><strong>${hotspot.name}</strong>: ${floodPercent}% still flooded</li>`;
    });
    html += '</ul>';
  }
  
  // Add recovery recommendations
  html += `
    <h6 class="mt-4 text-primary">Recovery Recommendations:</h6>
    <div class="recommendations p-2 border-start border-4 border-primary">
      <ul class="mb-0">
        <li><strong>Infrastructure Repair:</strong> Prioritize repair of critical infrastructure in ${results.hotspots[0]?.name || 'affected areas'}.</li>
        <li><strong>Health Monitoring:</strong> Monitor for waterborne diseases in recently flooded areas.</li>
        <li><strong>Damage Assessment:</strong> Complete detailed damage assessments for insurance and aid.</li>
        <li><strong>Debris Removal:</strong> Organize community cleanup efforts.</li>
        <li><strong>Financial Assistance:</strong> Provide information on available disaster relief programs.</li>
      </ul>
    </div>
  `;
  
  resultsPanel.innerHTML = html;
}

/**
 * Create results panel to display flood analysis results
 * @param {Object} results - Analysis results
 */
function createResultsPanel(results) {
  // Create or get results panel
  let resultsPanel = document.getElementById('flood-results');
  if (!resultsPanel) {
    resultsPanel = document.createElement('div');
    resultsPanel.id = 'flood-results';
    resultsPanel.className = 'mt-3 p-3 bg-light border rounded';
    document.querySelector('.controls').appendChild(resultsPanel);
  }
  
  // Format results
  const floodAreaKm2 = results.floodArea.toFixed(2);
  const affectedPopulation = Math.round(results.affectedPop).toLocaleString();
  
  // Determine severity level based on affected population
  let severityLevel = 'Low';
  let severityClass = 'text-success';
  
  if (results.affectedPop > 10000) {
    severityLevel = 'Critical';
    severityClass = 'text-danger';
  } else if (results.affectedPop > 5000) {
    severityLevel = 'High';
    severityClass = 'text-warning';
  } else if (results.affectedPop > 1000) {
    severityLevel = 'Moderate';
    severityClass = 'text-primary';
  }
  
  // Create HTML content
  let html = `
    <h5>Flood Analysis Results</h5>
    <div class="alert alert-${severityClass === 'text-danger' ? 'danger' : (severityClass === 'text-warning' ? 'warning' : 'info')}">
      <strong>Severity Level: <span class="${severityClass}">${severityLevel}</span></strong>
    </div>
    <p><strong>Total Flooded Area:</strong> ${floodAreaKm2} km²</p>
    <p><strong>Estimated Affected Population:</strong> ${affectedPopulation}</p>
    <h6>Top Affected Areas:</h6>
    <ul>
  `;
  
  // Add hotspots
  results.hotspots.forEach(hotspot => {
    const floodPercent = (hotspot.floodFrac * 100).toFixed(1);
    const popExposed = Math.round(hotspot.popExposed).toLocaleString();
    html += `<li><strong>${hotspot.name}</strong>: ${floodPercent}% flooded, ${popExposed} people affected</li>`;
  });
  
  html += '</ul>';
  
  // Add recommendations section
  html += `
    <h6 class="mt-4 text-primary">Recommendations:</h6>
    <div class="recommendations p-2 border-start border-4 border-primary">
      <ul class="mb-0">
  `;
  
  // Add hardcoded recommendations based on severity
  if (severityLevel === 'Critical') {
    html += `
        <li><strong>Immediate Evacuation:</strong> Coordinate evacuation of ${results.hotspots[0].name} and ${results.hotspots.length > 1 ? results.hotspots[1].name : ''} areas.</li>
        <li><strong>Emergency Shelters:</strong> Activate all emergency shelters in non-flooded areas.</li>
        <li><strong>Medical Response:</strong> Deploy medical teams to affected areas.</li>
        <li><strong>Infrastructure:</strong> Close flooded roads and monitor critical infrastructure.</li>
        <li><strong>Resources:</strong> Distribute emergency supplies including clean water, food, and medicine.</li>
    `;
  } else if (severityLevel === 'High') {
    html += `
        <li><strong>Partial Evacuation:</strong> Consider evacuating low-lying areas in ${results.hotspots[0].name}.</li>
        <li><strong>Shelter Preparation:</strong> Prepare emergency shelters for potential evacuees.</li>
        <li><strong>Infrastructure:</strong> Monitor flood defenses and critical infrastructure.</li>
        <li><strong>Resources:</strong> Prepare emergency supplies for distribution.</li>
        <li><strong>Communication:</strong> Issue flood warnings to residents in affected areas.</li>
    `;
  } else {
    html += `
        <li><strong>Monitoring:</strong> Continue monitoring water levels in ${results.hotspots[0].name} area.</li>
        <li><strong>Preparation:</strong> Review emergency response plans.</li>
        <li><strong>Infrastructure:</strong> Check drainage systems and flood defenses.</li>
        <li><strong>Communication:</strong> Issue precautionary advisories to residents.</li>
        <li><strong>Resources:</strong> Ensure emergency supplies are adequately stocked.</li>
    `;
  }
  
  html += `
      </ul>
    </div>
  `;
  
  resultsPanel.innerHTML = html;
}
