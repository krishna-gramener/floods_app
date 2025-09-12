# Chennai Flood Monitoring System

A web-based application for analyzing historical flood data in Chennai, India using Google Earth Engine. This system provides tools for pre-disaster risk assessment, during-disaster monitoring, and post-disaster assessment.

## Features

- **Pre-Disaster Analysis**: Historical risk assessment based on elevation, population density, and water occurrence data
- **During-Disaster Monitoring**: Real-time flood monitoring using satellite imagery
- **Post-Disaster Assessment**: Damage assessment and recovery planning tools
- **Interactive Maps**: Visualize flood risk zones, current flood extent, and impact areas
- **Detailed Statistics**: View population affected, area impacted, and other critical metrics

## Technologies Used

- HTML, CSS, JavaScript
- Bootstrap 5 for UI components
- Leaflet.js for interactive maps
- Google Earth Engine API for satellite imagery and geospatial analysis

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

## Usage

1. Select an analysis module (Pre-Disaster, During-Disaster, or Post-Disaster)
2. Choose a historical flood event from the dropdown menu
3. Click "Run Analysis" to generate maps and statistics
4. Use the map controls to explore different layers and data visualizations
5. View detailed information in the right panel

## Data Sources

This application uses the following Google Earth Engine datasets:

- USGS/SRTMGL1_003: Digital Elevation Model
- CIESIN/GPWv411/GPW_Population_Count: Population density
- UCSB-CHG/CHIRPS/DAILY: Rainfall data
- JAXA/GPM_L3/GSMaP/v6/operational: Additional rainfall data
- COPERNICUS/S1_GRD: Sentinel-1 radar imagery for flood detection
- JRC/GSW1_4/GlobalSurfaceWater: Water occurrence data

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Based on the original Google Earth Engine script for Chennai flood analysis
- Inspired by the devastating Chennai floods of 2015 and subsequent events
- Thanks to the Google Earth Engine team for providing access to satellite imagery and geospatial datasets
