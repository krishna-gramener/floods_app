# Bekasi Flood Monitoring System

A web-based application for analyzing flood data in Bekasi, Indonesia using Google Earth Engine. This system provides tools for visualizing elevation, population density, and water occurrence data to support flood risk assessment and monitoring.

## Features

- **Interactive Maps**: Visualize elevation data, population density, and water occurrence
- **Comparison View**: Compare different layers side by side
- **Layer Controls**: Toggle layers on/off and adjust opacity
- **Fullscreen Mode**: View maps in fullscreen for better analysis
- **Coordinate Display**: View precise coordinates as you move the cursor
- **Responsive Design**: Works on desktop and mobile devices

## Technologies Used

- HTML, CSS, JavaScript (ES6 Modules)
- Bootstrap 5 for UI components and responsive design
- Leaflet.js for interactive maps
- Google Earth Engine API for satellite imagery and geospatial analysis
- Leaflet.fullscreen for fullscreen map capabilities

## Setup Instructions

### Prerequisites

1. A Google account with access to Google Earth Engine
2. Google Earth Engine API credentials

### Google Earth Engine Setup

1. Visit [Google Earth Engine](https://earthengine.google.com/) and sign up for an account
2. Create a new project in the [Google Cloud Console](https://console.cloud.google.com/)
3. Enable the Earth Engine API for your project
4. Create OAuth credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Select "Web application" as the application type
   - Add your application's domain to the authorized JavaScript origins
   - Note the Client ID (it will look like `your-project-id.apps.googleusercontent.com`)

### Application Setup

1. Clone this repository to your local machine
2. Open `gee-api.js` and replace the placeholder client ID with your actual Google Earth Engine OAuth client ID:
   ```javascript
   const GEE_CONFIG = {
     clientId: 'YOUR_ACTUAL_CLIENT_ID.apps.googleusercontent.com',
     // ...
   };
   ```
3. Start a local web server (e.g., `python -m http.server 8000`)
4. Open a browser and navigate to `http://localhost:8000`
5. When prompted, sign in with your Google account that has Earth Engine access

## Code Structure

The application follows a modular architecture with the following files:

### Core Files

- **index.html**: Main HTML file with the application structure and UI elements
- **script.js**: Main entry point that initializes the application and handles opacity sliders
- **config.js**: Configuration file with shared constants like map boundaries

### Modules

- **auth.js**: Handles Google Earth Engine authentication
- **utils.js**: Utility functions for UI updates, loading indicators, and legends
- **layers.js**: Manages map layers including Earth Engine data visualization
- **map-controls.js**: Handles map initialization, controls, and comparison views

## Module Functions

### script.js
- `addOpacitySliderToMap`: Creates opacity slider controls for map layers
- `removeOpacitySliderForLayer`: Removes opacity slider for a specific layer
- `removeAllOpacitySliders`: Removes all opacity sliders from a map
- `initApp`: Initializes the application after authentication

### layers.js
- `initLayerManager`: Initializes the layer management module
- `showDEM`: Shows Digital Elevation Model on the main map
- `showPopulation`: Shows population density on the main map
- `showDEMOnMap`: Shows DEM on a specific map (main, left, or right)
- `showPopulationOnMap`: Shows population on a specific map (main, left, or right)
- `addLayer`: Adds Earth Engine layer to the main map
- `addLayerToMap`: Adds Earth Engine layer to a specific map
- `clearLayer`: Removes a specific layer from a map
- `refreshMainMapLayers`: Refreshes all layers on the main map

### map-controls.js
- `initMapControls`: Initializes the map controls module
- `initMap`: Creates and configures the main map
- `addBaseLayers`: Adds base map layers (Normal, Satellite)
- `toggleComparisonView`: Switches between single and comparison views
- `toggleComparisonFullscreen`: Toggles fullscreen mode for comparison view
- `initComparisonMaps`: Creates and configures the comparison maps
- `addBaseLayersToComparisonMaps`: Adds base layers to comparison maps
- `addCoordinatesDisplay`: Adds coordinate display to maps
- `createDummyLayer`: Creates placeholder layer for layer control

### utils.js
- `updateStatus`: Updates the status message in the UI
- `hideLoading`: Hides the loading overlay
- `createLegend`: Creates or updates the map legend

### auth.js
- `authenticate`: Handles Google Earth Engine authentication process

## Data Sources

This application uses the following Google Earth Engine datasets:

- USGS/SRTMGL1_003: Digital Elevation Model for Bekasi region
- CIESIN/GPWv411/GPW_Population_Count: Population density data
- JRC/GSW1_4/GlobalSurfaceWater: Historical water occurrence data

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Based on Google Earth Engine's geospatial analysis capabilities
- Designed for monitoring and analyzing flood risks in the Bekasi region of Indonesia
- Thanks to the Google Earth Engine team for providing access to satellite imagery and geospatial datasets

## Project Structure Benefits

- **Modular Design**: Each file has a clear, single responsibility
- **Maintainability**: Easier to update and extend individual components
- **Reusability**: Functions are organized by purpose and can be reused
- **Separation of Concerns**: Configuration, UI, data handling, and map controls are separated
- **Scalability**: New features can be added with minimal changes to existing code
