/**
 * Image Resizer Utility
 * 
 * A lightweight, browser-based image resizer that uses canvas to compress
 * and resize images before upload. Optimized for mobile and iOS devices.
 * 
 * Features:
 * - Maintains aspect ratio during resize
 * - Handles EXIF orientation (modern browsers handle this automatically)
 * - Uses high-quality image smoothing
 * - Progressive resizing for better quality on large size reductions
 * - iOS/Safari compatible
 */

// Default configuration
const DEFAULT_CONFIG = {
  maxSizeBytes: 8 * 1024 * 1024,  // 8MB target max size
  maxWidth: 4096,                   // Max width in pixels
  maxHeight: 4096,                  // Max height in pixels
  quality: 0.92,                    // JPEG quality (0.0 to 1.0)
  mimeType: 'image/jpeg',           // Output format
  debug: false,                     // Console logging
};

/**
 * Read a File as a data URL
 * @param {File} file - The file to read
 * @returns {Promise<string>} - Data URL of the file
 */
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Load an image from a data URL
 * @param {string} dataUrl - The data URL to load
 * @returns {Promise<HTMLImageElement>} - Loaded image element
 */
function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    // Important for iOS: set crossOrigin before src
    img.crossOrigin = 'anonymous';
    img.src = dataUrl;
  });
}

/**
 * Calculate new dimensions while maintaining aspect ratio
 * @param {number} width - Original width
 * @param {number} height - Original height
 * @param {number} maxWidth - Maximum target width
 * @param {number} maxHeight - Maximum target height
 * @returns {{ width: number, height: number }} - New dimensions
 */
function calculateDimensions(width, height, maxWidth, maxHeight) {
  let newWidth = width;
  let newHeight = height;

  // Scale down if exceeds max dimensions
  if (width > maxWidth || height > maxHeight) {
    const widthRatio = maxWidth / width;
    const heightRatio = maxHeight / height;
    const ratio = Math.min(widthRatio, heightRatio);
    
    newWidth = Math.round(width * ratio);
    newHeight = Math.round(height * ratio);
  }

  return { width: newWidth, height: newHeight };
}

/**
 * Draw image to canvas with high-quality settings
 * @param {HTMLImageElement} img - Source image
 * @param {number} targetWidth - Target width
 * @param {number} targetHeight - Target height
 * @param {boolean} useProgressiveResize - Use multi-step resize for better quality
 * @returns {HTMLCanvasElement} - Canvas with the resized image
 */
function drawToCanvas(img, targetWidth, targetHeight, useProgressiveResize = true) {
  // For large size reductions (more than 2x), use progressive resizing
  // This produces better quality than a single resize step
  const scaleRatio = img.width / targetWidth;
  
  if (useProgressiveResize && scaleRatio > 2) {
    // Progressive resize: step down by halves until close to target
    let currentWidth = img.width;
    let currentHeight = img.height;
    let source = img;
    
    // Create temporary canvases for each step
    while (currentWidth / 2 > targetWidth) {
      currentWidth = Math.round(currentWidth / 2);
      currentHeight = Math.round(currentHeight / 2);
      
      const stepCanvas = document.createElement('canvas');
      stepCanvas.width = currentWidth;
      stepCanvas.height = currentHeight;
      
      const stepCtx = stepCanvas.getContext('2d');
      stepCtx.imageSmoothingEnabled = true;
      stepCtx.imageSmoothingQuality = 'high';
      stepCtx.drawImage(source, 0, 0, currentWidth, currentHeight);
      
      source = stepCanvas;
    }
    
    // Final resize step
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = targetWidth;
    finalCanvas.height = targetHeight;
    
    const finalCtx = finalCanvas.getContext('2d');
    finalCtx.imageSmoothingEnabled = true;
    finalCtx.imageSmoothingQuality = 'high';
    finalCtx.drawImage(source, 0, 0, targetWidth, targetHeight);
    
    return finalCanvas;
  }
  
  // Single-step resize for smaller reductions
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  
  const ctx = canvas.getContext('2d');
  
  // Enable high-quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  // Draw the image
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
  
  return canvas;
}

/**
 * Convert canvas to Blob
 * @param {HTMLCanvasElement} canvas - The canvas to convert
 * @param {string} mimeType - MIME type for output
 * @param {number} quality - Quality setting (0.0 to 1.0)
 * @returns {Promise<Blob>} - The resulting Blob
 */
function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob from canvas'));
        }
      },
      mimeType,
      quality
    );
  });
}

/**
 * Resize image to meet file size requirements
 * Uses binary search to find optimal quality/dimensions
 * 
 * @param {File} file - The image file to resize
 * @param {Object} config - Configuration options
 * @returns {Promise<Blob>} - Resized image as Blob
 */
export async function resizeImage(file, config = {}) {
  const settings = { ...DEFAULT_CONFIG, ...config };
  
  if (settings.debug) {
    console.log(`[ImageResizer] Processing: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
  }
  
  // If file is already under the size limit, return it as-is
  if (file.size <= settings.maxSizeBytes) {
    if (settings.debug) {
      console.log('[ImageResizer] File already under size limit, no resize needed');
    }
    return file;
  }
  
  // Read file and load image
  const dataUrl = await readFileAsDataURL(file);
  const img = await loadImage(dataUrl);
  
  if (settings.debug) {
    console.log(`[ImageResizer] Original dimensions: ${img.width}x${img.height}`);
  }
  
  // Calculate initial dimensions (respect max dimension limits)
  let { width, height } = calculateDimensions(
    img.width, 
    img.height, 
    settings.maxWidth, 
    settings.maxHeight
  );
  
  // Start with configured quality
  let quality = settings.quality;
  let blob = null;
  let attempts = 0;
  const maxAttempts = 10;
  
  // Binary search for optimal settings
  while (attempts < maxAttempts) {
    attempts++;
    
    // Draw image to canvas at current dimensions
    const canvas = drawToCanvas(img, width, height);
    
    // Convert to blob
    blob = await canvasToBlob(canvas, settings.mimeType, quality);
    
    if (settings.debug) {
      console.log(`[ImageResizer] Attempt ${attempts}: ${width}x${height} @ quality ${quality.toFixed(2)} = ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
    }
    
    // Check if we're under the limit
    if (blob.size <= settings.maxSizeBytes) {
      break;
    }
    
    // Calculate how much we need to reduce
    const sizeRatio = settings.maxSizeBytes / blob.size;
    
    // First try reducing quality
    if (quality > 0.5) {
      // Reduce quality more aggressively based on how far over we are
      const qualityReduction = Math.max(0.1, (1 - sizeRatio) * 0.3);
      quality = Math.max(0.5, quality - qualityReduction);
    } else {
      // Quality is already low, reduce dimensions
      // Use sqrt because file size roughly scales with area (width * height)
      const dimensionScale = Math.max(0.7, Math.sqrt(sizeRatio * 0.9));
      width = Math.round(width * dimensionScale);
      height = Math.round(height * dimensionScale);
      
      // Don't go below reasonable minimums
      if (width < 800 || height < 600) {
        // We've reduced as much as we can
        if (settings.debug) {
          console.log('[ImageResizer] Reached minimum dimensions, using best result');
        }
        break;
      }
    }
  }
  
  if (settings.debug) {
    console.log(`[ImageResizer] Final size: ${(blob.size / 1024 / 1024).toFixed(2)} MB after ${attempts} attempt(s)`);
  }
  
  return blob;
}

/**
 * Main function to read, compress, and prepare an image for upload
 * Handles the full workflow from File to upload-ready Blob
 * 
 * @param {File} file - The image file to process
 * @param {Object} config - Configuration options
 * @returns {Promise<{ blob: Blob, originalSize: number, finalSize: number, wasResized: boolean }>}
 */
export async function prepareImageForUpload(file, config = {}) {
  const settings = { ...DEFAULT_CONFIG, ...config };
  const originalSize = file.size;
  
  // Only process if file is over the limit or if we want to ensure JPEG format
  const needsProcessing = file.size > settings.maxSizeBytes;
  
  if (!needsProcessing) {
    return {
      blob: file,
      originalSize,
      finalSize: file.size,
      wasResized: false,
    };
  }
  
  const blob = await resizeImage(file, settings);
  
  return {
    blob,
    originalSize,
    finalSize: blob.size,
    wasResized: blob !== file,
  };
}

/**
 * Check if a file needs resizing based on size
 * @param {File} file - The file to check
 * @param {number} maxSizeBytes - Maximum allowed size in bytes
 * @returns {boolean} - True if file needs resizing
 */
export function needsResize(file, maxSizeBytes = DEFAULT_CONFIG.maxSizeBytes) {
  return file.size > maxSizeBytes;
}

/**
 * Format bytes to human-readable string
 * @param {number} bytes - Size in bytes
 * @returns {string} - Formatted string (e.g., "2.5 MB")
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default {
  resizeImage,
  prepareImageForUpload,
  needsResize,
  formatBytes,
};

