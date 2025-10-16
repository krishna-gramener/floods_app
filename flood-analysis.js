// Flood analysis module for Bekasi Flood Monitoring System
import { bekasiAreas, bekasiGeoJSON } from './config.js';
import { createComparisonFloodLayers } from './script.js';

// External variables
let map;
let addOpacitySliderToMap;
let overlays = {};
let isComparisonMode = false;
let persistentHighAlertLayer = null; // Store high alert markers permanently

const TOGGLE_BY_PERIOD = {
  pre: 'toggle-pre-flood',
  during: 'toggle-during-flood',
  post: 'toggle-post-flood',
};

const LAYER_BY_PERIOD = {
  pre: 'Pre-Flood Analysis',
  during: 'During-Flood Analysis',
  post: 'Post-Flood Analysis',
};

// Analysis state tracking
export const analysisState = {
  pre: false,
  during: false,
  post: false
};

export function showOnlyActivePeriod(activePeriod) {
  ['pre', 'during', 'post'].forEach((p) => {
    const toggleId = TOGGLE_BY_PERIOD[p];
    const layerName = LAYER_BY_PERIOD[p];

    // Handle main map toggle
    const mainToggle = document.getElementById(toggleId);
    if (mainToggle) {
      if (p === activePeriod) {
        mainToggle.style.display = '';
        mainToggle.disabled = false;
        if (!mainToggle.checked) mainToggle.checked = true;
      } else {
        mainToggle.checked = false;
        mainToggle.disabled = true;
        mainToggle.style.display = 'none';
      }
    }

    // Handle comparison toggles (only if in comparison mode)
    if (isComparisonMode) {
      ['left', 'right'].forEach((suffix) => {
        const compToggle = document.getElementById(`${toggleId}-${suffix}`);
        if (compToggle) {
          compToggle.disabled = !analysisState[p];
          compToggle.style.display = analysisState[p] ? '' : 'none';
        }
      });
    }

    // Handle main map layers
    const layer = overlays[layerName];
    if (!layer) return;

    if (p === activePeriod) {
      // Ensure the active layer is on the main map
      if (!map.hasLayer(layer)) {
        layer.addTo(map);
      }
    } else {
      // Remove inactive layers from main map
      if (map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    }
    
    // **NEW: Handle hotspot markers for each period**
    const hotspotLayerName = `${layerName.replace(' Analysis', '')} Hotspots`;
    const hotspotLayer = overlays[hotspotLayerName];
    
    if (hotspotLayer) {
      if (p === activePeriod) {
        // Show hotspots for active period
        if (!map.hasLayer(hotspotLayer)) {
          hotspotLayer.addTo(map);
        }
      } else {
        // Hide hotspots for inactive periods
        if (map.hasLayer(hotspotLayer)) {
          map.removeLayer(hotspotLayer);
        }
      }
    }
  });

  // Ensure the master toggles container is visible
  const layerToggles = document.getElementById('layer-toggles');
  if (layerToggles) layerToggles.classList.remove('d-none');
}

// Function to update analysis state and sync toggles
export function updateAnalysisState(period, completed) {
  analysisState[period] = completed;
  
  // Show layer toggles when any analysis completes
  if (completed) {
    const layerToggles = document.getElementById('layer-toggles');
    if (layerToggles) {
      layerToggles.classList.remove('d-none');
    }
  }
  
  // Update all related toggles
  ['', '-left', '-right'].forEach(suffix => {
    const toggle = document.getElementById(`toggle-${period}-flood${suffix}`);
    if (toggle) {
      toggle.disabled = !completed;
      
      // Only check the main map toggle automatically
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

  // Set up layer toggle handlers for main map
  const toggles = {
    'toggle-pre-flood': { layerName: 'Pre-Flood Analysis', period: 'pre' },
    'toggle-during-flood': { layerName: 'During-Flood Analysis', period: 'during' },
    'toggle-post-flood': { layerName: 'Post-Flood Analysis', period: 'post' }
  };

  Object.entries(toggles).forEach(([toggleId, config]) => {
    const toggle = document.getElementById(toggleId);
    if (toggle) {
      toggle.checked = analysisState[config.period];
      toggle.disabled = !analysisState[config.period];

      toggle.addEventListener('change', function() {
        if (this.checked && analysisState[config.period]) {
          showOnlyActivePeriod(config.period);
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
  const geometry = ee.FeatureCollection([
    ee.Feature(ee.Geometry.Polygon(bekasiGeoJSON.features[0].geometry.coordinates), {})
  ]).geometry();
  
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
  const geometry = ee.FeatureCollection([
    ee.Feature(ee.Geometry.Polygon(bekasiGeoJSON.features[0].geometry.coordinates), {})
  ]).geometry();
  
  const med = loadS1Median(startDate, endDate);
  const nat = toNatural(med);
  const filtNat = refinedLeeSimple(nat);
  const db = toDB(filtNat).rename('VVf');
  return db.clip(geometry);
}

function detectFlood(preStart, preEnd, duringStart, duringEnd, threshold) {
  threshold = threshold || 1.25;
  
  const geometry = ee.FeatureCollection([
    ee.Feature(ee.Geometry.Polygon(bekasiGeoJSON.features[0].geometry.coordinates), {})
  ]).geometry();
  
  const preVV = filteredVV(preStart, preEnd);
  const postVV = filteredVV(duringStart, duringEnd);
  
  const gsw = ee.Image("JRC/GSW1_4/GlobalSurfaceWater").clip(geometry);
  const hydrosheds = ee.Image("WWF/HydroSHEDS/03VFDEM").clip(geometry);
  const terrain = ee.Algorithms.Terrain(hydrosheds);
  const slope = terrain.select('slope');
  
  const preSafe = preVV.unmask(1e-6);
  const change = postVV.divide(preSafe).rename('change_ratio');
  
  const floodedRaw = change.gt(threshold).rename('flood_raw').selfMask();
  
  const permWater = gsw.select('seasonality').gte(5).clip(geometry);
  const floodedNoPerm = floodedRaw.where(permWater, 0).selfMask();
  
  const floodedSlopeMask = floodedNoPerm.updateMask(slope.lt(5));
  
  const connections = floodedSlopeMask.connectedPixelCount(25);
  const floodedClean = floodedSlopeMask.updateMask(connections.gt(8)).rename('flood');
  
  return {
    floodedClean: floodedClean,
    hydrosheds: hydrosheds,
    slope: slope
  };
}

function generateRiskZones() {
  const geometry = ee.FeatureCollection([
    ee.Feature(ee.Geometry.Polygon(bekasiGeoJSON.features[0].geometry.coordinates), {})
  ]).geometry();
  
  const hydrosheds = ee.Image("WWF/HydroSHEDS/03VFDEM").clip(geometry);
  const population = ee.ImageCollection("CIESIN/GPWv411/GPW_Population_Count")
    .filter(ee.Filter.date('2020-01-01', '2020-12-31'))
    .first()
    .clip(geometry);
  const gsw = ee.Image("JRC/GSW1_4/GlobalSurfaceWater").clip(geometry);
  
  const subareasArray = Object.entries(bekasiAreas).map(([name, coords]) => ({
    name: name,
    lon: coords[0],
    lat: coords[1]
  }));
  
  const subFeatures = ee.FeatureCollection(subareasArray.map(area => 
    ee.Feature(ee.Geometry.Point([area.lon, area.lat]), {name: area.name})
  ));
  
  const scored = subFeatures.map(function(f) {
    const buff = f.geometry().buffer(3000);
    
    const elevDict = hydrosheds.reduceRegion({
      reducer: ee.Reducer.mean(), 
      geometry: buff, 
      scale: 90
    });
    const elev = ee.Algorithms.If(
      elevDict.contains('b1'),
      elevDict.get('b1'),
      50
    );
    
    const popDict = population.reduceRegion({
      reducer: ee.Reducer.sum(), 
      geometry: buff, 
      scale: 100
    });
    const popsum = ee.Algorithms.If(
      popDict.contains('population_count'),
      popDict.get('population_count'),
      0
    );
    
    const jrcDict = gsw.select('occurrence').reduceRegion({
      reducer: ee.Reducer.mean(), 
      geometry: buff, 
      scale: 90
    });
    const jrcmean = ee.Algorithms.If(
      jrcDict.contains('occurrence'),
      jrcDict.get('occurrence'),
      0
    );
    
    const elevValue = ee.Number(ee.Algorithms.If(elev, elev, 50));
    const popsumValue = ee.Number(ee.Algorithms.If(popsum, popsum, 0));
    const jrcmeanValue = ee.Number(ee.Algorithms.If(jrcmean, jrcmean, 0));
    
    const score = ee.Number(100)
      .subtract(elevValue.multiply(1.2))
      .add(popsumValue.divide(ee.Number(1000)).multiply(10))
      .add(jrcmeanValue.divide(ee.Number(10)).multiply(8));
    
    return f.set({
      risk_score: score
    });
  });
  
  const lowRisk = scored.filter(ee.Filter.lt('risk_score', 30))
    .map(feature => feature.set({risk_level: 'low'}));
    
  const medRisk = scored.filter(ee.Filter.and(
    ee.Filter.gte('risk_score', 30),
    ee.Filter.lt('risk_score', 70)
  )).map(feature => feature.set({risk_level: 'medium'}));
  
  const highRisk = scored.filter(ee.Filter.gte('risk_score', 70))
    .map(feature => feature.set({risk_level: 'high'}));
  
  const allWithRiskLevel = lowRisk.merge(medRisk).merge(highRisk);
  
  return {
    low: lowRisk,
    medium: medRisk,
    high: highRisk,
    all: allWithRiskLevel
  };
}

export function runFloodAnalysis(period) {
  document.getElementById('analysis-loader').classList.remove('d-none');
  console.log(`Running ${periods[period].label} analysis...`);
  
  const layerToggles = document.getElementById('layer-toggles');
  if (layerToggles && layerToggles.classList.contains('d-none')) {
    layerToggles.classList.remove('d-none');
  }
  
  return new Promise((resolve, reject) => {
    try {
      if (period === 'pre') {
        const riskZones = generateRiskZones();
        
        addRiskZonesToMap(riskZones);
        
        try {
          riskZones.all.evaluate(function(riskData) {
            document.getElementById('analysis-loader').classList.add('d-none');
            
            try {
              if (riskData && riskData.features && riskData.features.length > 0) {
                createPreFloodPanel(riskData.features);
                window.riskData = riskData;
                
                // Update state first
                updateAnalysisState('pre', true);
                
                // Then show only this period
                showOnlyActivePeriod('pre');
                
                createComparisonFloodLayers();
                
                console.log('Pre-flood risk analysis complete');
              } else {
                console.error('Risk data is undefined or missing features', riskData);
                createErrorPanel('Could not retrieve risk zone data. Please try again.');
              }
            } catch (innerError) {
              console.error('Error processing risk data:', innerError);
              createErrorPanel('Error processing risk zone data: ' + innerError.message);
            }
            
            resolve();
          }, function(error) {
            document.getElementById('analysis-loader').classList.add('d-none');
            console.error('Earth Engine error:', error);
            createErrorPanel('Earth Engine error: ' + error.message);
            resolve();
          });
        } catch (outerError) {
          document.getElementById('analysis-loader').classList.add('d-none');
          console.error('Error in pre-flood analysis:', outerError);
          createErrorPanel('Error in pre-flood analysis: ' + outerError.message);
          resolve();
        }
      } else if (period === 'during') {
        const result = detectFlood(
          periods.pre.start, 
          periods.pre.end, 
          periods.during.start, 
          periods.during.end, 
          1.25
        );
        
        result.floodedClean.getMap({min: 0, max: 1, palette: ['#ff0000']}, function(tileLayer) {
          const floodTileLayer = L.tileLayer(tileLayer.urlFormat, {
            attribution: "Google Earth Engine",
            opacity: 0.7,
            zIndex: 1000, // High z-index to ensure visibility above basemap
            pane: 'overlayPane' // Use overlay pane
          });
          
          const layerName = 'During-Flood Analysis';
          
          if (overlays[layerName] && overlays[layerName] instanceof L.TileLayer) {
            map.removeLayer(overlays[layerName]);
          }
          
          overlays[layerName] = floodTileLayer;
          
          // Update state first
          updateAnalysisState('during', true);
          
          // Then show only this period
          showOnlyActivePeriod('during');
          
          // Add to map and bring to front
          floodTileLayer.addTo(map);
          setTimeout(() => {
            if (map.hasLayer(floodTileLayer)) {
              floodTileLayer.bringToFront();
            }
          }, 100);
          
          createComparisonFloodLayers();
          
          if (addOpacitySliderToMap) {
            addOpacitySliderToMap(map, floodTileLayer, layerName);
          }
          
          const population = ee.ImageCollection("CIESIN/GPWv411/GPW_Population_Count")
            .filter(ee.Filter.date('2020-01-01', '2020-12-31'))
            .first();

          const floodedArea = result.floodedClean.multiply(ee.Image.pixelArea()).divide(1e6);
          const affectedPop = population.multiply(result.floodedClean);
          
          const subareasArray = Object.entries(bekasiAreas).map(([name, coords]) => ({
            name: name,
            lon: coords[0],
            lat: coords[1]
          }));
          
          const subFeatures = ee.FeatureCollection(subareasArray.map(area => 
            ee.Feature(ee.Geometry.Point([area.lon, area.lat]), {name: area.name})
          ));
          
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

          totalStats.floodArea.evaluate(function(floodArea) {
            totalStats.affectedPop.evaluate(function(affectedPop) {
              hotspots.limit(3).evaluate(function(hotspotData) {
              document.getElementById('analysis-loader').classList.add('d-none');
              
              try {
                if (!hotspotData || !hotspotData.features || hotspotData.features.length === 0) {
                  throw new Error('No flood hotspot data available');
                }
                
                // Create markers for flooded hotspots during flood period
                const duringFloodHotspotMarkers = L.layerGroup();
                
                hotspotData.features.forEach(feature => {
                  if (feature.properties.flood_frac > 0) {
                    const coords = [feature.geometry.coordinates[1], feature.geometry.coordinates[0]];
                    
                    // Get risk level from pre-flood data if available
                    let riskLevel = 'unknown';
                    let riskColor = '#ff0000'; // Default red for during-flood
                    
                    if (window.riskData && window.riskData.features) {
                      const matchingRisk = window.riskData.features.find(
                        rf => rf.properties.name === feature.properties.name
                      );
                      if (matchingRisk) {
                        riskLevel = matchingRisk.properties.risk_level || 'unknown';
                        // Use different shades of red/orange based on risk level
                        if (riskLevel === 'high') riskColor = '#cc0000'; // Dark red
                        else if (riskLevel === 'medium') riskColor = '#ff6600'; // Orange-red
                        else riskColor = '#ff0000'; // Standard red
                      }
                    }
                    
                    const pinSvg = `
                      <svg width="24" height="36" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 0C5.4 0 0 5.4 0 12c0 8 10 20 11 21.5a1 1 0 0 0 2 0C14 32 24 20 24 12 24 5.4 18.6 0 12 0z" 
                              fill="${riskColor}" stroke="white" stroke-width="2"/>
                        <circle cx="12" cy="12" r="4" fill="white"/>
                      </svg>
                    `;
                    
                    const markerIcon = L.divIcon({
                      className: 'custom-flooded-marker',
                      html: pinSvg,
                      iconSize: [24, 36],
                      iconAnchor: [12, 36],
                      popupAnchor: [0, -36]
                    });
                    
                    const marker = L.marker(coords, {
                      icon: markerIcon,
                      title: feature.properties.name
                    });
                    
                    const floodPercent = (feature.properties.flood_frac * 100).toFixed(1);
                    const popExposed = Math.round(feature.properties.pop_exposed || 0).toLocaleString();
                    
                    marker.bindPopup(`
                      <div class="area-popup">
                        <h5>${feature.properties.name}</h5>
                        <p><strong>Status:</strong> <span class="text-danger">Currently Flooded</span></p>
                        <p><strong>Flooded Area:</strong> ${floodPercent}%</p>
                        <p><strong>People Affected:</strong> ${popExposed}</p>
                        ${riskLevel !== 'unknown' ? `<p><strong>Pre-Flood Risk:</strong> <span style="color: ${riskColor}; font-weight: bold; text-transform: uppercase;">${riskLevel}</span></p>` : ''}
                        ${riskLevel === 'high' ? '<p class="text-danger"><small><strong>⚠️ CRITICAL PRIORITY AREA</strong></small></p>' : ''}
                      </div>
                    `);
                    
                    marker.addTo(duringFloodHotspotMarkers);
                  }
                });
                
                // Add during-flood hotspot markers to overlays and map
                overlays['During-Flood Hotspots'] = duringFloodHotspotMarkers;
                duringFloodHotspotMarkers.addTo(map);
                
                createResultsPanel({
                  floodArea: floodArea && floodArea.flood ? floodArea.flood : 0,
                  affectedPop: affectedPop && affectedPop.population_count ? affectedPop.population_count : 0,
                  hotspots: hotspotData.features.map(f => ({
                    name: f.properties.name,
                    floodFrac: f.properties.flood_frac || 0,
                    popExposed: f.properties.pop_exposed || 0
                  }))
                });
                
                console.log('Flood analysis complete');
              } catch (error) {
                console.error('Error in during-flood analysis:', error);
                createErrorPanel('Could not process flood data. Please try again.');
              }
              
              resolve();
            });
            });
          });
        });
      } else if (period === 'post') {
        // Remove during-flood hotspot markers when switching to post-flood
        if (overlays['During-Flood Hotspots']) {
          map.removeLayer(overlays['During-Flood Hotspots']);
        }
        
        const result = detectFlood(
          periods.pre.start, 
          periods.pre.end, 
          periods.post.start, 
          periods.post.end, 
          1.35
        );
        
        result.floodedClean.getMap({min: 0, max: 1, palette: ['#0000ff']}, function(tileLayer) {
          const floodTileLayer = L.tileLayer(tileLayer.urlFormat, {
            attribution: "Google Earth Engine",
            opacity: 0.7,
            zIndex: 1000, // High z-index to ensure visibility above basemap
            pane: 'overlayPane' // Use overlay pane
          });
          
          const layerName = 'Post-Flood Analysis';
          
          if (overlays[layerName] && overlays[layerName] instanceof L.TileLayer) {
            map.removeLayer(overlays[layerName]);
          }
          
          overlays[layerName] = floodTileLayer;
          
          // Update state first
          updateAnalysisState('post', true);
          
          // Then show only this period
          showOnlyActivePeriod('post');
          
          // Add to map and bring to front
          floodTileLayer.addTo(map);
          setTimeout(() => {
            if (map.hasLayer(floodTileLayer)) {
              floodTileLayer.bringToFront();
            }
          }, 100);
          
          createComparisonFloodLayers();
          
          if (addOpacitySliderToMap) {
            addOpacitySliderToMap(map, floodTileLayer, layerName);
          }
          
          const population = ee.ImageCollection("CIESIN/GPWv411/GPW_Population_Count")
            .filter(ee.Filter.date('2020-01-01', '2020-12-31'))
            .first();
          
          const floodedArea = result.floodedClean.multiply(ee.Image.pixelArea()).divide(1e6);
          const affectedPop = population.multiply(result.floodedClean);
          
          const subareasArray = Object.entries(bekasiAreas).map(([name, coords]) => ({
            name: name,
            lon: coords[0],
            lat: coords[1]
          }));
          
          const subFeatures = ee.FeatureCollection(subareasArray.map(area => 
            ee.Feature(ee.Geometry.Point([area.lon, area.lat]), {name: area.name})
          ));
          
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
          
          totalStats.floodArea.evaluate(function(floodArea) {
            totalStats.affectedPop.evaluate(function(affectedPop) {
              hotspots.limit(5).evaluate(function(hotspotData) {
                document.getElementById('analysis-loader').classList.add('d-none');
                
                try {
                  if (!hotspotData || !hotspotData.features) {
                    throw new Error('No post-flood data available');
                  }
                  
                  // Create markers for flooded hotspots
                  const floodedHotspotMarkers = L.layerGroup();
                  
                  hotspotData.features.forEach(feature => {
                    if (feature.properties.flood_frac > 0) {
                      const coords = [feature.geometry.coordinates[1], feature.geometry.coordinates[0]];
                      
                      // Get risk level from pre-flood data if available
                      let riskLevel = 'unknown';
                      let riskColor = '#0000ff'; // Default blue for flooded areas
                      
                      if (window.riskData && window.riskData.features) {
                        const matchingRisk = window.riskData.features.find(
                          rf => rf.properties.name === feature.properties.name
                        );
                        if (matchingRisk) {
                          riskLevel = matchingRisk.properties.risk_level || 'unknown';
                          // Use different colors based on risk level
                          if (riskLevel === 'high') riskColor = '#ff0000';
                          else if (riskLevel === 'medium') riskColor = '#ff9900';
                          else riskColor = '#0000ff';
                        }
                      }
                      
                      const pinSvg = `
                        <svg width="24" height="36" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 0C5.4 0 0 5.4 0 12c0 8 10 20 11 21.5a1 1 0 0 0 2 0C14 32 24 20 24 12 24 5.4 18.6 0 12 0z" 
                                fill="${riskColor}" stroke="white" stroke-width="2"/>
                          <circle cx="12" cy="12" r="4" fill="white"/>
                        </svg>
                      `;
                      
                      const markerIcon = L.divIcon({
                        className: 'custom-flooded-marker',
                        html: pinSvg,
                        iconSize: [24, 36],
                        iconAnchor: [12, 36],
                        popupAnchor: [0, -36]
                      });
                      
                      const marker = L.marker(coords, {
                        icon: markerIcon,
                        title: feature.properties.name
                      });
                      
                      const floodPercent = (feature.properties.flood_frac * 100).toFixed(1);
                      
                      marker.bindPopup(`
                        <div class="area-popup">
                          <h5>${feature.properties.name}</h5>
                          <p><strong>Status:</strong> <span class="text-danger">Still Flooded</span></p>
                          <p><strong>Flooded Area:</strong> ${floodPercent}%</p>
                          ${riskLevel !== 'unknown' ? `<p><strong>Pre-Flood Risk:</strong> <span style="color: ${riskColor}; font-weight: bold; text-transform: uppercase;">${riskLevel}</span></p>` : ''}
                          ${riskLevel === 'high' ? '<p class="text-danger"><small><strong>⚠️ HIGH PRIORITY FOR RECOVERY</strong></small></p>' : ''}
                        </div>
                      `);
                      
                      marker.addTo(floodedHotspotMarkers);
                    }
                  });
                  
                  // Add flooded hotspot markers to overlays and map
                  overlays['Post-Flood Hotspots'] = floodedHotspotMarkers;
                  floodedHotspotMarkers.addTo(map);
                  const totalFloodedArea = floodArea && floodArea.flood ? floodArea.flood : 0;
                  const totalAffectedPop = affectedPop && affectedPop.population_count ? affectedPop.population_count : 0;
                  const populationDensity = totalFloodedArea > 0 ? (totalAffectedPop / totalFloodedArea) : 0;
      
                  createPostFloodPanel({
                    floodArea: floodArea && floodArea.flood ? floodArea.flood : 0,
                    affectedPop: affectedPop && affectedPop.population_count ? affectedPop.population_count : 0,
                    popDensity: populationDensity,
                    hotspots: hotspotData.features.map(f => ({
                      name: f.properties.name,
                      floodFrac: f.properties.flood_frac || 0
                    }))
                  });
                  
                  console.log('Post-flood analysis complete');
                } catch (error) {
                  console.error('Error in post-flood analysis:', error);
                  createErrorPanel('Could not process post-flood data. Please try again.');
                }
                
                resolve();
              });
            });
          });
        });
      } else {
        document.getElementById('analysis-loader').classList.add('d-none');
        console.log(`Invalid analysis period: ${period}`);
        reject(new Error(`Invalid analysis period: ${period}`));
      }
    } catch (error) {
      document.getElementById('analysis-loader').classList.add('d-none');
      console.log(`Error in flood analysis: ${error.message}`);
      reject(error);
    }
  });
}


function addRiskZonesToMap(riskZones) {
  const riskZoneGroup = L.layerGroup();
  const highAlertGroup = L.layerGroup(); // Separate layer for high-risk markers
  
  function addRiskMarkers(features, color, riskLevel, addToHighAlert = false) {
    features.evaluate(function(data) {
      if (!data || !data.features || data.features.length === 0) return;
      
      data.features.forEach(feature => {
        const coords = [feature.geometry.coordinates[1], feature.geometry.coordinates[0]];
        
        // Create a custom pin-shaped SVG icon
        const pinSvg = `
          <svg width="24" height="36" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 0C5.4 0 0 5.4 0 12c0 8 10 20 11 21.5a1 1 0 0 0 2 0C14 32 24 20 24 12 24 5.4 18.6 0 12 0z" 
                  fill="${color}" stroke="white" stroke-width="2"/>
            <circle cx="12" cy="12" r="4" fill="white"/>
          </svg>
        `;
        
        const markerIcon = L.divIcon({
          className: 'custom-risk-marker',
          html: pinSvg,
          iconSize: [24, 36],
          iconAnchor: [12, 36],
          popupAnchor: [0, -36]
        });
        
        const marker = L.marker(coords, {
          icon: markerIcon,
          title: feature.properties.name
        });
        
        const lat = coords[0].toFixed(6);
        const lon = coords[1].toFixed(6);
        
        const popupContent = `
          <div class="area-popup">
            <h5>${feature.properties.name}</h5>
            <p><strong>Risk Level:</strong> <span style="color: ${color}; font-weight: bold;">${riskLevel}</span></p>
            <p><strong>Coordinates:</strong> ${lat}, ${lon}</p>
            <p><strong>Risk Score:</strong> ${feature.properties.risk_score.toFixed(1)}</p>
            ${addToHighAlert ? '<p class="text-danger"><small><strong>⚠️ HIGH ALERT AREA</strong></small></p>' : ''}
          </div>
        `;
        
        marker.bindPopup(popupContent);
        
        // Add to main risk zone group
        marker.addTo(riskZoneGroup);
        
        // Also add high-risk markers to persistent high alert layer
        if (addToHighAlert) {
          const highAlertMarker = L.marker(coords, {
            icon: markerIcon,
            title: feature.properties.name + ' (High Alert)'
          });
          highAlertMarker.bindPopup(popupContent);
          highAlertMarker.addTo(highAlertGroup);
        }
      });
    });
  }
  
  // Add markers - only high-risk markers go to both layers
  addRiskMarkers(riskZones.low, '#00ff00', 'Low', false);
  addRiskMarkers(riskZones.medium, '#ffbb00ff', 'Medium', false);
  addRiskMarkers(riskZones.high, '#ff0000', 'High', true); // Add to both layers
  
  const layerName = 'Pre-Flood Analysis';
  
  if (overlays[layerName]) {
    map.removeLayer(overlays[layerName]);
  }
  
  overlays[layerName] = riskZoneGroup;
  
  // Store high alert layer globally and add to overlays
  persistentHighAlertLayer = highAlertGroup;
  overlays['High Alert Areas'] = highAlertGroup;
  
  // Don't add to map yet - let showOnlyActivePeriod handle it
  const toggle = document.getElementById('toggle-pre-flood');
  if (toggle) {
    toggle.checked = true;
  }
}

function createPreFloodPanel(riskData) {
  let resultsPanel = document.getElementById('flood-results');
  if (!resultsPanel) {
    resultsPanel = document.createElement('div');
    resultsPanel.style.position = 'relative';
    resultsPanel.id = 'flood-results';
    resultsPanel.className = 'mt-3 p-3 border rounded bg-body text-body';
    resultsPanel.style.height = '100%';
    document.querySelector('#analysis-sidebar').appendChild(resultsPanel);
  }
  
  riskData.sort((a, b) => b.properties.risk_score - a.properties.risk_score);

  const highRiskAreas = riskData.filter(area => area.properties.risk_level === 'high');
  
  // ⬇️ Replace from: let html = ` ... ` up to before resultsPanel.innerHTML
  let html = `
    <h5 class="d-flex align-items-center">
      <i class="bi bi-water me-2"></i>Pre-Flood Risk Assessment
    </h5>

    <div class="alert alert-warning d-flex align-items-center">
      <i class="bi bi-exclamation-triangle-fill me-2"></i>
      <div><strong>Risk Assessment Complete</strong></div>
    </div>

    <p>This analysis identifies areas at risk of flooding based on:</p>
    <ul class="list-unstyled ps-0">
      <li class="mb-1">
        <i class="bi bi-layers-fill me-2"></i>Elevation Data
      </li>
      <li class="mb-1">
        <i class="bi bi-people-fill me-2"></i>Population Density
      </li>
      <li class="mb-1">
        <i class="bi bi-moisture me-2"></i>Topographic Wetness Index
      </li>
      <li class="mb-1">
        <i class="bi bi-buildings-fill me-2"></i>Building Footprints
      </li>
      <li class="mb-1">
        <i class="bi bi-distribute-vertical me-2"></i>Flow Accumulation
      </li>
      <li class="mb-1">
        <i class="bi bi-tsunami me-2"></i>Historical Flood Occurrence
      </li>
    </ul>

    <h6 class="mt-3 text-danger d-flex align-items-center">
      <i class="bi bi-exclamation-octagon-fill me-2"></i>High Risk Areas:
    </h6>
    <ul class="mb-0">
  `;

  // ⬇️ Replace your forEach item template
  highRiskAreas.forEach(area => {
    html += `<li><i class="bi bi-geo-alt-fill text-danger me-1"></i><strong>${area.properties.name}</strong></li>`;
  });

  // ⬇️ Replace your "no items" fallback
  if (highRiskAreas.length === 0) {
    html += '<li><i class="bi bi-check-circle text-success me-1"></i>No high risk areas identified</li>';
  }

  html += `
    </ul>

    <h6 class="mt-3 text-primary d-flex align-items-center">
      <i class="bi bi-lightbulb-fill me-2"></i>Preparedness Recommendations:
    </h6>
    <div class="recommendations p-2 border-start border-4 border-primary">
      <ul class="mb-0">
        <li class="mb-1"><i class="bi bi-bell-fill me-2"></i><strong>Early Warning:</strong> Establish early warning systems in high risk areas.</li>
        <li class="mb-1"><i class="bi bi-signpost-2-fill me-2"></i><strong>Evacuation Planning:</strong> Develop evacuation routes and safe zones.</li>
        <li class="mb-1"><i class="bi bi-tools me-2"></i><strong>Infrastructure:</strong> Reinforce flood defenses in high risk areas.</li>
        <li class="mb-1"><i class="bi bi-mortarboard-fill me-2"></i><strong>Community Education:</strong> Conduct flood preparedness training.</li>
        <li class="mb-1"><i class="bi bi-box-seam-fill me-2"></i><strong>Emergency Supplies:</strong> Pre-position emergency supplies in strategic locations.</li>
      </ul>
    </div>
  `;

  resultsPanel.innerHTML = html;
}

function createErrorPanel(errorMessage) {
  let resultsPanel = document.getElementById('flood-results');
  if (!resultsPanel) {
    resultsPanel = document.createElement('div');
    resultsPanel.id = 'flood-results';
    resultsPanel.className = 'mt-3 p-3 border rounded bg-body text-body';
    document.querySelector('#analysis-sidebar').appendChild(resultsPanel);
  }
  
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
  let resultsPanel = document.getElementById('flood-results');
  if (!resultsPanel) {
    resultsPanel = document.createElement('div');
    resultsPanel.id = 'flood-results';
    resultsPanel.className = 'mt-3 p-3 border rounded bg-body text-body';
    document.querySelector('#analysis-sidebar').appendChild(resultsPanel);
  }
  
  const floodAreaKm2 = results.floodArea.toFixed(2);
  const affectedPopulation = Math.round(results.affectedPop).toLocaleString();
  const populationDensity = results.popDensity ? results.popDensity.toFixed(2) : '0.00'; // ✅ Calculate density
  
  // Count high-risk flooded areas
  let highRiskFloodedCount = 0;
  if (window.riskData && window.riskData.features) {
    highRiskFloodedCount = results.hotspots.filter(hotspot => {
      const matchingRisk = window.riskData.features.find(
        rf => rf.properties.name === hotspot.name
      );
      return matchingRisk && matchingRisk.properties.risk_level === 'high' && hotspot.floodFrac > 0;
    }).length;
  }
  
  let html = `
    <h5 class="d-flex align-items-center">
      <i class="bi bi-water me-2"></i>Post-Flood Analysis Results
    </h5>
    <div class="alert alert-info">
      <strong>Recovery Phase</strong>
    </div>
    
    ${highRiskFloodedCount > 0 ? `
    <div class="alert alert-danger mb-3">
      <strong>⚠️ ${highRiskFloodedCount} High-Risk Area${highRiskFloodedCount > 1 ? 's' : ''} Still Flooded</strong>
      <p class="mb-0 small">Red markers indicate high-priority areas that need immediate attention.</p>
    </div>
    ` : ''}
    <p><strong>Remaining Flooded Area:</strong> ${floodAreaKm2} km²</p>
  `;
  //<p><strong>People Still Affected:</strong> ${affectedPopulation}</p>
  //<p><strong>Population Count on Flooded Zone:</strong> ${populationDensity} people/km²</p>
  if (results.hotspots && results.hotspots.length > 0) {
    const floodedAreas = results.hotspots.filter(h => h.floodFrac > 0);
    if (floodedAreas.length > 0) {
      html += `<h6>Areas Still Flooded:</h6><ul>`;
      floodedAreas.forEach(hotspot => {
        const floodPercent = (hotspot.floodFrac * 100).toFixed(1);
        
        // Check if this area is high-risk
        let isHighRisk = false;
        if (window.riskData && window.riskData.features) {
          const matchingRisk = window.riskData.features.find(
            rf => rf.properties.name === hotspot.name
          );
          isHighRisk = matchingRisk && matchingRisk.properties.risk_level === 'high';
        }
        
        html += `<li><strong>${hotspot.name}</strong>: ${floodPercent}% still flooded${isHighRisk ? ' <span class="text-danger">⚠️ HIGH RISK</span>' : ''}</li>`;
      });
      html += '</ul>';
    } else {
      html += '<p class="text-success"><strong>✓ No significant flooding detected in monitored areas</strong></p>';
    }
  }
  
  html += `
    <h6 class="mt-4 text-primary">Recovery Recommendations:</h6>
    <div class="recommendations p-2 border-start border-4 border-primary">
      <ul class="mb-0">
        <li><strong>Priority Areas:</strong> Focus on areas marked with blue pins (high-risk + still flooded).</li>
        <li><strong>Infrastructure Repair:</strong> Prioritize repair of critical infrastructure in ${results.hotspots.filter(h => h.floodFrac > 0)[0]?.name || 'affected areas'}.</li>
        <li><strong>Health Monitoring:</strong> Monitor for waterborne diseases in recently flooded areas.</li>
        <li><strong>Damage Assessment:</strong> Complete detailed damage assessments for insurance and aid.</li>
        <li><strong>Debris Removal:</strong> Organize community cleanup efforts in flooded zones.</li>
        <li><strong>Financial Assistance:</strong> Provide information on available disaster relief programs.</li>
      </ul>
    </div>
  `;
  
  resultsPanel.innerHTML = html;
}

function createResultsPanel(results) {
  let resultsPanel = document.getElementById('flood-results');
  if (!resultsPanel) {
    resultsPanel = document.createElement('div');
    resultsPanel.id = 'flood-results';
    resultsPanel.className = 'mt-3 p-3 border rounded bg-body text-body';
    document.getElementById('analysis-sidebar').appendChild(resultsPanel);
    
    document.getElementById('analysis-sidebar').classList.add('show');
  }
  
  const floodAreaKm2 = results.floodArea.toFixed(2);
  const affectedPopulation = Math.round(results.affectedPop).toLocaleString();
  
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
  
  let html = `
    <h5 class="d-flex align-items-center">
      <i class="bi bi-water me-2"></i>Flood Analysis Results
    </h5>
    <div class="alert alert-${severityClass === 'text-danger' ? 'danger' : (severityClass === 'text-warning' ? 'warning' : 'info')}">
      <strong>Severity Level: <span class="${severityClass}">${severityLevel}</span></strong>
    </div>
    <p><strong>Total Flooded Area:</strong> ${floodAreaKm2} km²</p>

    <h6>Top Affected Areas:</h6>
    <ul>
  `;
  // people affected removed
  // <p><strong>Estimated Affected Population:</strong> ${affectedPopulation}</p>
  
  results.hotspots.forEach(hotspot => {
    const floodPercent = (hotspot.floodFrac * 100).toFixed(1);
    const popExposed = Math.round(hotspot.popExposed).toLocaleString();
    html += `<li><strong>${hotspot.name}</strong>: ${floodPercent}% flooded</li>`;
  });
  // people affected removed
  ///* , ${popExposed} people affected */
  
  html += '</ul>';
  
  html += `
    <h6 class="mt-4 text-primary">Recommendations:</h6>
    <div class="recommendations p-2 border-start border-4 border-primary">
      <ul class="mb-0">
  `;
  
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