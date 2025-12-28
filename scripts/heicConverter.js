/**
 * HEIC/HEIF Converter Utility
 * 
 * Converts HEIC/HEIF images (common on iOS) to JPEG format
 * before processing through the image resizer pipeline.
 * 
 * Uses heic2any library for conversion.
 */

// Try to load heic2any - it might be available as a global or need dynamic import
let heic2any = null;

// Check if heic2any is available globally (loaded via script tag)
if (typeof window !== 'undefined' && window.heic2any) {
  heic2any = window.heic2any;
}

/**
 * Load heic2any library dynamically if not already loaded
 * @returns {Promise<Function>} The heic2any function
 */
async function loadHeic2any() {
  if (heic2any) {
    return heic2any;
  }
  
  // Try dynamic import from CDN (ES module version)
  try {
    const module = await import('https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js');
    heic2any = module.default || module;
    return heic2any;
  } catch (e) {
    console.warn('[HeicConverter] Dynamic import failed, trying script injection');
  }
  
  // Fallback: inject script tag and wait for it to load
  return new Promise((resolve, reject) => {
    // Check if already loaded globally
    if (window.heic2any) {
      heic2any = window.heic2any;
      resolve(heic2any);
      return;
    }
    
    // Load the local script
    const script = document.createElement('script');
    script.src = './scripts/heic2any.min.js';
    script.onload = () => {
      if (window.heic2any) {
        heic2any = window.heic2any;
        resolve(heic2any);
      } else {
        reject(new Error('heic2any not available after script load'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load heic2any script'));
    document.head.appendChild(script);
  });
}

/**
 * Check if a file is a HEIC/HEIF image
 * @param {File} file - The file to check
 * @returns {boolean} - True if the file is HEIC/HEIF
 */
export function isHeicFile(file) {
  if (!file) return false;
  
  // Check MIME type
  const mimeType = file.type.toLowerCase();
  if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    return true;
  }
  
  // Check file extension (iOS sometimes doesn't set proper MIME type)
  const fileName = file.name.toLowerCase();
  if (fileName.endsWith('.heic') || fileName.endsWith('.heif')) {
    return true;
  }
  
  // Check for empty MIME type with HEIC extension (common on iOS)
  if (!mimeType && (fileName.endsWith('.heic') || fileName.endsWith('.heif'))) {
    return true;
  }
  
  return false;
}

/**
 * Convert a HEIC/HEIF file to JPEG
 * @param {File} file - The HEIC/HEIF file to convert
 * @param {Object} options - Conversion options
 * @param {number} options.quality - JPEG quality (0-1), default 0.7 for smaller output
 * @param {boolean} options.debug - Enable debug logging
 * @returns {Promise<File>} - Converted JPEG file
 */
export async function convertHeicToJpeg(file, options = {}) {
  // Use lower quality by default since we'll compress again later if needed
  const { quality = 0.7, debug = false } = options;
  
  if (debug) {
    console.log(`[HeicConverter] Converting ${file.name} (${file.type}) to JPEG at quality ${quality}`);
  }
  
  // Load the library
  let converter;
  try {
    converter = await loadHeic2any();
  } catch (loadError) {
    console.error('[HeicConverter] Failed to load heic2any:', loadError);
    throw new Error('Could not load HEIC converter library');
  }
  
  if (!converter) {
    throw new Error('heic2any library not available');
  }
  
  try {
    // Convert HEIC to JPEG blob with lower quality
    const jpegBlob = await converter({
      blob: file,
      toType: 'image/jpeg',
      quality: quality,
    });
    
    // heic2any can return a single blob or array of blobs
    const resultBlob = Array.isArray(jpegBlob) ? jpegBlob[0] : jpegBlob;
    
    if (!resultBlob || resultBlob.size === 0) {
      throw new Error('HEIC conversion produced empty result');
    }
    
    // Create a new File object with .jpg extension
    const newFileName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
    const jpegFile = new File([resultBlob], newFileName, { 
      type: 'image/jpeg',
      lastModified: file.lastModified 
    });
    
    if (debug) {
      console.log(`[HeicConverter] Converted: ${file.name} (${formatFileSize(file.size)}) → ${newFileName} (${formatFileSize(jpegFile.size)})`);
    }
    
    return jpegFile;
  } catch (error) {
    console.error('[HeicConverter] Conversion failed:', error);
    throw new Error(`Failed to convert HEIC image: ${error.message}`);
  }
}

/**
 * Process a file, converting from HEIC if necessary
 * @param {File} file - The file to process
 * @param {Object} options - Processing options
 * @returns {Promise<File>} - Original file or converted file
 */
export async function processFile(file, options = {}) {
  if (isHeicFile(file)) {
    return convertHeicToJpeg(file, options);
  }
  return file;
}

/**
 * Format file size to human-readable string
 * @param {number} bytes - Size in bytes
 * @returns {string} - Formatted string
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default {
  isHeicFile,
  convertHeicToJpeg,
  processFile,
};

