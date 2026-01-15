import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';
import { compressImage } from './imageService';

class FirebaseStorageService {
  async uploadImage(file, folder = 'cms', { compress = true } = {}) {
    if (!file) {
      return { success: false, message: 'No file provided' };
    }

    if (!file.type?.startsWith('image/')) {
      return { success: false, message: 'File must be an image' };
    }

    if (file.size > 10 * 1024 * 1024) {
      return { success: false, message: 'Image size must be less than 10MB' };
    }

    try {
      const processedFile = compress ? await compressImage(file, 1600, 1600, 0.85) : file;
      const safeName = (processedFile.name || 'image').replace(/[^a-zA-Z0-9._-]/g, '_');
      const objectPath = `${folder}/${Date.now()}_${safeName}`;
      const objectRef = ref(storage, objectPath);

      await uploadBytes(objectRef, processedFile);
      const url = await getDownloadURL(objectRef);

      return { success: true, url, path: objectPath };
    } catch (error) {
      console.error('Firebase Storage upload error:', error);
      return { success: false, message: error.message };
    }
  }
}

export const firebaseStorageService = new FirebaseStorageService();
