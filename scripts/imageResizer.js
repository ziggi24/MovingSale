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
    img.onerror = (e) => reject(new Error('Failed to load image: ' + e.message));
    // Note: Don't set crossOrigin for local file uploads - it can cause issues on iOS
    img.src = dataUrl;
  });
}

/**
 * Calculate maximum safe canvas dimensions for iOS
 * iOS has strict limits on canvas size (varies by device, typically 4096x4096 or less)
 * @returns {{ maxWidth: number, maxHeight: number, maxPixels: number }}
 */
function getIOSSafeCanvasLimits() {
  // iOS Safari has a maximum canvas size limit
  // Older devices: ~5 megapixels, Newer devices: ~16 megapixels
  // To be safe, we limit to 4 megapixels (2048x2048) which works on all iOS devices
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  if (isIOS) {
    return {
      maxWidth: 2048,
      maxHeight: 2048,
      maxPixels: 4 * 1024 * 1024, // 4 megapixels
    };
  }
  
  // For other devices, allow larger canvases
  return {
    maxWidth: 4096,
    maxHeight: 4096,
    maxPixels: 16 * 1024 * 1024, // 16 megapixels
  };
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

/**
 * Check if user is on a mobile device
 * @returns {boolean} - True if on mobile/tablet
 */
export function isMobileDevice() {
  // Check for touch support and screen size
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth <= 1024;
  
  // Check user agent for mobile indicators
  const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // iOS detection (more reliable)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  return mobileUA || isIOS || (hasTouch && isSmallScreen);
}

/**
 * Force convert any image to JPEG and compress to target size
 * This ALWAYS processes the image through canvas, ensuring consistent output
 * Specially optimized for iOS with canvas size limits
 * 
 * @param {File|Blob} file - The image file to convert
 * @param {Object} config - Configuration options
 * @returns {Promise<Blob>} - Converted and compressed JPEG blob
 */
export async function forceConvertToJpeg(file, config = {}) {
  const settings = { 
    ...DEFAULT_CONFIG, 
    maxSizeBytes: 5 * 1024 * 1024, // Default to 5MB for mobile safety
    ...config 
  };
  
  if (settings.debug) {
    console.log(`[ImageResizer] Force converting: ${file.name || 'blob'} (${formatBytes(file.size)})`);
  }
  
  // Get iOS-safe canvas limits
  const canvasLimits = getIOSSafeCanvasLimits();
  
  if (settings.debug) {
    console.log(`[ImageResizer] Canvas limits: ${canvasLimits.maxWidth}x${canvasLimits.maxHeight}`);
  }
  
  // Read file and load image
  let dataUrl;
  try {
    dataUrl = await readFileAsDataURL(file);
  } catch (e) {
    console.error('[ImageResizer] Failed to read file:', e);
    throw new Error('Failed to read image file');
  }
  
  let img;
  try {
    img = await loadImage(dataUrl);
  } catch (e) {
    console.error('[ImageResizer] Failed to load image:', e);
    throw new Error('Failed to load image');
  }
  
  if (settings.debug) {
    console.log(`[ImageResizer] Original dimensions: ${img.width}x${img.height}`);
  }
  
  // Use the smaller of configured limits and iOS-safe limits
  const effectiveMaxWidth = Math.min(settings.maxWidth, canvasLimits.maxWidth);
  const effectiveMaxHeight = Math.min(settings.maxHeight, canvasLimits.maxHeight);
  
  // Calculate initial dimensions with iOS-safe limits
  let { width, height } = calculateDimensions(
    img.width, 
    img.height, 
    effectiveMaxWidth, 
    effectiveMaxHeight
  );
  
  // Additional check: ensure total pixels don't exceed iOS limit
  let totalPixels = width * height;
  if (totalPixels > canvasLimits.maxPixels) {
    const scale = Math.sqrt(canvasLimits.maxPixels / totalPixels);
    width = Math.floor(width * scale);
    height = Math.floor(height * scale);
    if (settings.debug) {
      console.log(`[ImageResizer] Scaled for pixel limit: ${width}x${height}`);
    }
  }
  
  // Start with configured quality
  let quality = settings.quality;
  let blob = null;
  let attempts = 0;
  const maxAttempts = 15; // More attempts for mobile
  
  // Iteratively find optimal settings
  while (attempts < maxAttempts) {
    attempts++;
    
    try {
      // Draw image to canvas at current dimensions
      const canvas = drawToCanvas(img, width, height, false); // Disable progressive resize for iOS compatibility
      
      // Convert to JPEG blob
      blob = await canvasToBlob(canvas, 'image/jpeg', quality);
      
      if (settings.debug) {
        console.log(`[ImageResizer] Attempt ${attempts}: ${width}x${height} @ quality ${quality.toFixed(2)} = ${formatBytes(blob.size)}`);
      }
      
      // Check if we're under the limit
      if (blob.size <= settings.maxSizeBytes) {
        break;
      }
      
      // Calculate how much we need to reduce
      const sizeRatio = settings.maxSizeBytes / blob.size;
      
      // More aggressive reduction for mobile
      if (quality > 0.35) {
        // Reduce quality more aggressively
        const qualityReduction = Math.max(0.1, (1 - sizeRatio) * 0.3);
        quality = Math.max(0.35, quality - qualityReduction);
      } else {
        // Quality is already low, reduce dimensions more aggressively
        const dimensionScale = Math.max(0.6, Math.sqrt(sizeRatio * 0.8));
        width = Math.round(width * dimensionScale);
        height = Math.round(height * dimensionScale);
        
        // Don't go below reasonable minimums for mobile
        if (width < 400 || height < 300) {
          if (settings.debug) {
            console.log('[ImageResizer] Reached minimum dimensions');
          }
          break;
        }
      }
    } catch (canvasError) {
      console.error('[ImageResizer] Canvas error at attempt', attempts, ':', canvasError);
      // If canvas fails, try smaller dimensions
      width = Math.round(width * 0.7);
      height = Math.round(height * 0.7);
      if (width < 400 || height < 300) {
        throw new Error('Failed to process image - canvas errors');
      }
    }
  }
  
  if (!blob) {
    throw new Error('Failed to create compressed image');
  }
  
  // Final safety check - if still too large, throw error instead of uploading
  if (blob.size > settings.maxSizeBytes) {
    console.warn(`[ImageResizer] Could not compress below limit: ${formatBytes(blob.size)} > ${formatBytes(settings.maxSizeBytes)}`);
    // Still return the best we could do, but log a warning
  }
  
  if (settings.debug) {
    console.log(`[ImageResizer] Final: ${formatBytes(blob.size)} after ${attempts} attempt(s)`);
  }
  
  return blob;
}

/**
 * Process image for mobile upload - always converts to JPEG and compresses
 * This is the main function to use for mobile/iOS uploads
 * 
 * @param {File} file - The image file to process
 * @param {Object} config - Configuration options
 * @returns {Promise<{ blob: Blob, originalSize: number, finalSize: number, wasProcessed: boolean }>}
 */
export async function processImageForMobile(file, config = {}) {
  const settings = {
    maxSizeBytes: 5 * 1024 * 1024, // 5MB default for mobile
    quality: 0.85, // Slightly lower starting quality for mobile
    maxWidth: 3840, // 4K max width
    maxHeight: 3840,
    debug: false,
    ...config,
  };
  
  const originalSize = file.size;
  
  if (settings.debug) {
    console.log(`[ImageResizer] Processing for mobile: ${file.name} (${formatBytes(originalSize)})`);
  }
  
  try {
    const blob = await forceConvertToJpeg(file, settings);
    
    return {
      blob,
      originalSize,
      finalSize: blob.size,
      wasProcessed: true,
    };
  } catch (error) {
    console.error('[ImageResizer] Mobile processing failed:', error);
    throw error;
  }
}

export default {
  resizeImage,
  prepareImageForUpload,
  needsResize,
  formatBytes,
  isMobileDevice,
  forceConvertToJpeg,
  processImageForMobile,
};

