import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { marketingContentService } from './marketingContentService';

class MarketingBranchService {
  constructor() {
    this.collection = 'marketingBranch';
  }

  async getContent(contentId, type = 'branch') {
    try {
      const contentRef = doc(db, this.collection, contentId);
      const contentDoc = await getDoc(contentRef);

      if (contentDoc.exists()) {
        const data = contentDoc.data();
        if (!data.type || data.type === type) {
          return {
            success: true,
            content: {
              id: contentDoc.id,
              ...data
            }
          };
        }
      }

      return {
        success: true,
        content: marketingContentService.getDefaultBranchContent(contentId)
      };
    } catch (error) {
      console.error('Error getting marketing branch content:', error);
      return {
        success: false,
        message: error.message,
        content: marketingContentService.getDefaultBranchContent(contentId)
      };
    }
  }

  subscribeToContent(contentId, type, callback) {
    const contentRef = doc(db, this.collection, contentId);

    return onSnapshot(
      contentRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (!data.type || data.type === type) {
            callback({
              success: true,
              content: {
                id: snapshot.id,
                ...data
              }
            });
            return;
          }
        }

        callback({
          success: true,
          content: marketingContentService.getDefaultBranchContent(contentId)
        });
      },
      (error) => {
        console.error('Error in marketing branch content subscription:', error);
        callback({
          success: false,
          message: error.message,
          content: marketingContentService.getDefaultBranchContent(contentId)
        });
      }
    );
  }

  async saveContent(contentId, type, contentData) {
    try {
      const contentRef = doc(db, this.collection, contentId);

      await setDoc(
        contentRef,
        {
          ...contentData,
          type,
          contentId,
          updatedAt: serverTimestamp(),
          updatedBy: contentData.updatedBy || null
        },
        { merge: true }
      );

      return { success: true };
    } catch (error) {
      console.error('Error saving marketing branch content:', error);
      return { success: false, message: error.message };
    }
  }

  async updateContent(contentId, type, contentData) {
    const contentRef = doc(db, this.collection, contentId);

    try {
      await updateDoc(contentRef, {
        ...contentData,
        type,
        contentId,
        updatedAt: serverTimestamp(),
        updatedBy: contentData.updatedBy || null
      });
      return { success: true };
    } catch (error) {
      if (error?.code === 'not-found') {
        try {
          await setDoc(
            contentRef,
            {
              ...contentData,
              type,
              contentId,
              updatedAt: serverTimestamp(),
              updatedBy: contentData.updatedBy || null
            },
            { merge: true }
          );
          return { success: true };
        } catch (innerError) {
          console.error('Error updating marketing branch content:', innerError);
          return { success: false, message: innerError.message };
        }
      }

      console.error('Error updating marketing branch content:', error);
      return { success: false, message: error.message };
    }
  }

  async getBranchContent(branchId) {
    return this.getContent(branchId, 'branch');
  }
}

export const marketingBranchService = new MarketingBranchService();
export default marketingBranchService;
