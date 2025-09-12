// Functions for handling layers in comparison view

/**
 * Add a layer to the left comparison map
 * @param {string} layerType - The type of layer to add (Elevation, Population, etc.)
 */
export function addLayerToLeftMap(layerType) {
  switch (layerType) {
    case 'Elevation':
      showDEMOnMap(mapLeft, layersLeft, 'Left Elevation');
      break;
    case 'Population':
      showPopulationOnMap(mapLeft, layersLeft, 'Left Population');
      break;
    // Add more layer types as needed
  }
}

/**
 * Add a layer to the right comparison map
 * @param {string} layerType - The type of layer to add (Elevation, Population, etc.)
 */
export function addLayerToRightMap(layerType) {
  switch (layerType) {
    case 'Elevation':
      showDEMOnMap(mapRight, layersRight, 'Right Elevation');
      break;
    case 'Population':
      showPopulationOnMap(mapRight, layersRight, 'Right Population');
      break;
    // Add more layer types as needed
  }
}

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
      console.log(`Layer created for comparison map: ${name}`, tileLayer);
      
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
      
      console.log(`${name} layer added to comparison map`);
    });
  } catch (e) {
    console.error(`Error processing ${name} for comparison map:`, e);
  }
}
