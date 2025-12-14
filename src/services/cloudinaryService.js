// Cloudinary configuration
const CLOUDINARY_CONFIG = {
  cloudName: 'dn0jgdjts',
  apiKey: '496699486588812',
  apiSecret: 'OVsmLIp23pkC-jwKFIL2s34Js4M',
  uploadPreset: 'daviddevs_images' // Updated to match your preset name
};

export const cloudinaryService = {
  /**
   * Test Cloudinary connection and preset
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  testConnection: async () => {
    try {
      console.log('🧪 Testing Cloudinary connection...');
      console.log('Cloud name:', CLOUDINARY_CONFIG.cloudName);
      console.log('Upload preset:', CLOUDINARY_CONFIG.uploadPreset);
      
      // Create a simple 1x1 pixel PNG image for testing
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, 1, 1);
      
      // Convert canvas to blob
      const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/png');
      });
      
      // Test with the image blob
      const testData = new FormData();
      testData.append('file', blob, 'test.png');
      testData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
      
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
        {
          method: 'POST',
          body: testData,
        }
      );
      
      console.log('Test response status:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Cloudinary connection test successful:', result);
        return { success: true };
      } else {
        const errorText = await response.text();
        console.error('❌ Cloudinary connection test failed:', errorText);
        return { success: false, error: errorText };
      }
    } catch (error) {
      console.error('❌ Cloudinary connection test error:', error);
      return { success: false, error: error.message };
    }
  },
  /**
   * Uploads an image file to Cloudinary
   * @param {File} file - The image file to upload
   * @param {string} folder - Optional folder name for organization
   * @returns {Promise<{success: boolean, url?: string, error?: string}>}
   */
  uploadImage: async (file, folder = 'salon-products') => {
    try {
      console.log('🔄 Starting Cloudinary upload...');
      console.log('File details:', {
        name: file.name,
        type: file.type,
        size: file.size
      });

      // Validate file type
      if (!file.type.startsWith('image/')) {
        console.error('❌ Invalid file type:', file.type);
        return { success: false, error: 'Please select a valid image file' };
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB in bytes
      if (file.size > maxSize) {
        console.error('❌ File too large:', file.size, 'bytes');
        return { success: false, error: 'Image size must be less than 5MB' };
      }

      // Create form data for upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
      // Don't send folder parameter if your preset doesn't use it
      // formData.append('folder', folder);

      console.log('📤 Uploading to Cloudinary...');
      console.log('Upload preset:', CLOUDINARY_CONFIG.uploadPreset);
      console.log('Cloud name:', CLOUDINARY_CONFIG.cloudName);

      // Debug FormData contents
      console.log('FormData contents:');
      for (let [key, value] of formData.entries()) {
        console.log(`  ${key}:`, value);
      }

      // Upload to Cloudinary
      const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`;
      console.log('Upload URL:', uploadUrl);

      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });

      console.log('📡 Response status:', response.status);
      console.log('📡 Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Upload failed - Response text:', errorText);
        
        // Try to parse as JSON
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: { message: errorText } };
        }
        
        console.error('❌ Upload failed - Parsed error:', errorData);
        throw new Error(errorData.error?.message || `Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Upload successful:', result);
      
      return {
        success: true,
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height
      };
    } catch (error) {
      console.error('❌ Cloudinary upload error:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to upload image' 
      };
    }
  },

  /**
   * Deletes an image from Cloudinary
   * Note: This requires server-side implementation for security
   * For now, we'll just return success as deletion is optional
   * @param {string} publicId - The public ID of the image to delete
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  deleteImage: async (publicId) => {
    try {
      // For client-side applications, image deletion should be handled server-side
      // This is a placeholder implementation
      console.log(`Image deletion requested for: ${publicId}`);
      console.log('Note: Image deletion should be implemented server-side for security');
      
      return {
        success: true,
        error: null
      };
    } catch (error) {
      console.error('Cloudinary delete error:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to delete image' 
      };
    }
  },

  /**
   * Generates a Cloudinary URL with transformations
   * @param {string} publicId - The public ID of the image
   * @param {object} transformations - Cloudinary transformation options
   * @returns {string} - The transformed image URL
   */
  getTransformedUrl: (publicId, transformations = {}) => {
    const defaultTransformations = {
      width: 300,
      height: 300,
      crop: 'fill',
      quality: 'auto',
      format: 'auto'
    };

    const finalTransformations = { ...defaultTransformations, ...transformations };
    
    // Build transformation string
    const transformString = Object.entries(finalTransformations)
      .map(([key, value]) => `${key}_${value}`)
      .join(',');

    return `https://res.cloudinary.com/${CLOUDINARY_CONFIG.cloudName}/image/upload/${transformString}/${publicId}`;
  }
};

export default cloudinaryService;

