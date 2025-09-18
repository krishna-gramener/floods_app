// Utility functions for the Bekasi Flood Monitoring System

// Hide loading overlay
export function hideLoading() {
  document.getElementById('loading').style.display = 'none';
}

// Update status message
export function updateStatus(message) {
  document.getElementById('status').textContent = message;
  console.log(message);
}

/**
 * Creates or updates the legend for the current layer
 * @param {string} title - The title for the legend
 * @param {string[]} colors - Array of color values
 * @param {string[]} labels - Array of labels corresponding to colors
 */
// Track active legends and their visibility state
const activeLegends = {};
const legendVisibility = {};

/**
 * Create or update a legend for a specific layer
 * @param {string} title - Legend title
 * @param {Array} colors - Array of colors
 * @param {Array} labels - Array of labels
 * @param {string} layerName - Name of the layer this legend belongs to
 */
export function createLegend(title, colors, labels, layerName) {
  // Create legend HTML
  let legendHtml = `<div id="legend-${layerName}" class="legend-section">
    <h5>${title}</h5>`;
  
  for (let i = 0; i < colors.length; i++) {
    legendHtml += `
      <div class="legend-item">
        <div class="color-box" style="background-color: ${colors[i]}"></div>
        <div>${labels[i]}</div>
      </div>
    `;
  }
  
  legendHtml += '</div>';
  
  // Store the legend HTML
  activeLegends[layerName] = legendHtml;
  
  // Initialize visibility state if not already set
  if (legendVisibility[layerName] === undefined) {
    legendVisibility[layerName] = false;
  }
  
  // Update the legend display
  updateLegendDisplay();
}

/**
 * Show a specific legend
 * @param {string} layerName - Name of the layer whose legend to show
 */
export function showLegend(layerName) {
  if (activeLegends[layerName]) {
    console.log(`Showing legend for ${layerName}`);
    legendVisibility[layerName] = true;
    updateLegendDisplay();
  }
}

/**
 * Hide a specific legend
 * @param {string} layerName - Name of the layer whose legend to hide
 */
export function hideLegend(layerName) {
  if (activeLegends[layerName]) {
    console.log(`Hiding legend for ${layerName}`);
    legendVisibility[layerName] = false;
    updateLegendDisplay();
  }
}

/**
 * Update the legend display with all active legends
 */
function updateLegendDisplay() {
  const legendContent = document.getElementById('legend-content');
  if (!legendContent) return;
  
  let allLegendsHtml = '';
  
  // Only include visible legends
  Object.keys(activeLegends).forEach(layerName => {
    if (legendVisibility[layerName]) {
      allLegendsHtml += activeLegends[layerName];
    }
  });
  
  // Update the legend container
  legendContent.innerHTML = allLegendsHtml;
  
  // Show or hide the entire legend container based on whether any legends are visible
  const legendContainer = document.querySelector('.legend');
  if (legendContainer) {
    if (allLegendsHtml === '') {
      legendContainer.style.display = 'none';
    } else {
      legendContainer.style.display = 'block';
    }
  }
}
