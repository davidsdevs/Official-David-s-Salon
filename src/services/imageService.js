/**
 * Image Upload Service using Cloudinary
 * Handles profile image uploads with optimization
 */

import axios from 'axios';
import toast from 'react-hot-toast';

// Cloudinary configuration (Vite environment variables)
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'demo';
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'demo_preset';
const CLOUDINARY_API_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

/**
 * Compress and resize image before upload
 * @param {File} file - Image file to compress
 * @param {number} maxWidth - Maximum width
 * @param {number} maxHeight - Maximum height
 * @param {number} quality - Image quality (0-1)
 * @returns {Promise<File>} Compressed image file
 */
export const compressImage = (file, maxWidth = 400, maxHeight = 400, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Calculate new dimensions
        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };
      
      img.onerror = reject;
    };
    
    reader.onerror = reject;
  });
};

/**
 * Upload image to Cloudinary
 * @param {File} file - Image file to upload
 * @param {string} folder - Cloudinary folder name
 * @returns {Promise<string>} Image URL
 */
export const uploadToCloudinary = async (file, folder = 'avatars') => {
  try {
    // Validate file
    if (!file) {
      throw new Error('No file provided');
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Image size must be less than 5MB');
    }
    
    // Compress image before upload (different sizes for different folders)
    const maxSize = folder === 'services' ? 800 : 400;
    const compressedFile = await compressImage(file, maxSize, maxSize, 0.8);
    
    // Prepare form data
    const formData = new FormData();
    formData.append('file', compressedFile);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder', folder);
    
    // Upload to Cloudinary
    const response = await axios.post(CLOUDINARY_API_URL, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    // Return secure URL
    return response.data.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    
    if (error.response) {
      toast.error(`Upload failed: ${error.response.data.error.message}`);
    } else if (error.message) {
      toast.error(error.message);
    } else {
      toast.error('Failed to upload image');
    }
    
    throw error;
  }
};

/**
 * Delete image from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<void>}
 */
export const deleteFromCloudinary = async (publicId) => {
  try {
    // Note: Deletion requires authentication
    // For now, we'll just remove the reference
    // In production, implement server-side deletion
    console.log('Image deletion requested:', publicId);
  } catch (error) {
    console.error('Delete error:', error);
  }
};

/**
 * Get optimized image URL from Cloudinary
 * @param {string} url - Original image URL
 * @param {object} transformations - Cloudinary transformations
 * @returns {string} Optimized URL
 */
export const getOptimizedImageUrl = (url, transformations = {}) => {
  if (!url || !url.includes('cloudinary')) {
    return url;
  }
  
  // Default transformations
  const defaultTransforms = {
    quality: 'auto',
    fetch_format: 'auto',
    ...transformations
  };
  
  // Build transformation string
  const transformString = Object.entries(defaultTransforms)
    .map(([key, value]) => `${key}_${value}`)
    .join(',');
  
  // Insert transformation into URL
  return url.replace('/upload/', `/upload/${transformString}/`);
};

/**
 * Validate image file
 * @param {File} file - File to validate
 * @returns {boolean} Is valid
 */
export const validateImageFile = (file) => {
  // Check file exists
  if (!file) {
    toast.error('Please select an image');
    return false;
  }
  
  // Check file type
  if (!file.type.startsWith('image/')) {
    toast.error('File must be an image');
    return false;
  }
  
  // Check file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    toast.error('Image size must be less than 5MB');
    return false;
  }
  
  // Check dimensions (optional - requires reading image)
  return true;
};

/**
 * Upload image - Alias for uploadToCloudinary for backward compatibility
 * @param {File} file - Image file to upload
 * @param {string} folder - Cloudinary folder name (default: 'inventory')
 * @returns {Promise<string>} Image URL
 */
export const uploadImage = async (file, folder = 'inventory') => {
  return uploadToCloudinary(file, folder);
};
