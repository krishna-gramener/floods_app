// Utility functions for the Bekasi Flood Monitoring System

// Hide loading overlay
export function hideLoading() {
  document.getElementById('loading').style.display = 'none';
}
/**
 * Creates an opacity slider for a layer
 * @param {string} layerName - The name of the layer
 * @param {L.Layer} layer - The Leaflet layer object
 */
export function createOpacitySlider(layerName, layer) {
  // Create a unique ID for the slider based on the layer name
  const sliderId = `opacity-${layerName.replace(/\s+/g, '-').toLowerCase()}`;
  
  // Check if slider already exists
  if (document.getElementById(sliderId)) {
    return;
  }
  
  // Create container for the slider
  const sliderContainer = document.createElement('div');
  sliderContainer.className = 'opacity-slider-container';
  sliderContainer.style.marginTop = '10px';
  sliderContainer.style.marginBottom = '15px';
  
  // Create label
  const label = document.createElement('label');
  label.htmlFor = sliderId;
  label.textContent = `${layerName} Opacity: `;
  label.style.display = 'block';
  label.style.marginBottom = '5px';
  label.style.fontSize = '14px';
  
  // Create slider
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.id = sliderId;
  slider.min = '0';
  slider.max = '100';
  slider.value = layer.options.opacity * 100;
  slider.style.width = '100%';
  
  // Add event listener to update opacity
  slider.addEventListener('input', function() {
    const opacity = parseInt(this.value) / 100;
    layer.setOpacity(opacity);
  });
  
  // Append elements to container
  sliderContainer.appendChild(label);
  sliderContainer.appendChild(slider);
  
  // Add the slider to the layer controls section
  const layerControls = document.querySelector('.layer-checkboxes');
  if (layerControls) {
    layerControls.appendChild(sliderContainer);
  }
}

/**
 * Updates the opacity slider value for a layer
 * @param {string} layerName - The name of the layer
 * @param {number} opacity - The opacity value (0-1)
 */
export function updateOpacitySlider(layerName, opacity) {
  const sliderId = `opacity-${layerName.replace(/\s+/g, '-').toLowerCase()}`;
  const slider = document.getElementById(sliderId);
  if (slider) {
    slider.value = opacity * 100;
  }
}

/**
 * Removes the opacity slider for a layer
 * @param {string} layerName - The name of the layer
 */
export function removeOpacitySlider(layerName) {
  const sliderId = `opacity-${layerName.replace(/\s+/g, '-').toLowerCase()}`;
  const slider = document.getElementById(sliderId);
  if (slider) {
    const container = slider.parentElement;
    if (container) {
      container.remove();
    }
  }
}
