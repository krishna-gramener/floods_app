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
export function createLegend(title, colors, labels) {
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
