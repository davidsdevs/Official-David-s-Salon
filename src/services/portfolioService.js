/**
 * Portfolio Service
 * Handles portfolio-related operations for stylists
 */

import {
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  updateDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import toast from 'react-hot-toast';

const PORTFOLIO_COLLECTION = 'portfolio';

/**
 * Get all portfolios for a specific stylist
 * @param {string} stylistId - Stylist user ID
 * @returns {Promise<Array>} Array of portfolio items
 */
export const getPortfoliosByStylist = async (stylistId) => {
  try {
    if (!stylistId) {
      console.warn('No stylistId provided');
      return [];
    }

    const portfoliosRef = collection(db, PORTFOLIO_COLLECTION);
    
    // Try with orderBy first, fallback to simple query if index doesn't exist
    let snapshot;
    try {
      const q = query(
        portfoliosRef,
        where('stylistId', '==', stylistId),
        orderBy('createdAt', 'desc')
      );
      snapshot = await getDocs(q);
    } catch (orderByError) {
      // If orderBy fails (index missing), fetch without it and sort in memory
      console.warn('OrderBy failed for portfolios, fetching without orderBy:', orderByError.message);
      const q = query(
        portfoliosRef,
        where('stylistId', '==', stylistId)
      );
      snapshot = await getDocs(q);
    }

    const portfolios = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : null),
        approvedAt: data.approvedAt?.toDate ? data.approvedAt.toDate() : (data.approvedAt ? new Date(data.approvedAt) : null),
        rejectedAt: data.rejectedAt?.toDate ? data.rejectedAt.toDate() : (data.rejectedAt ? new Date(data.rejectedAt) : null),
      };
    });

    // Sort by createdAt descending if orderBy wasn't used
    if (portfolios.length > 0 && portfolios[0].createdAt) {
      portfolios.sort((a, b) => {
        const aTime = a.createdAt?.getTime() || 0;
        const bTime = b.createdAt?.getTime() || 0;
        return bTime - aTime;
      });
    }

    return portfolios;
  } catch (error) {
    console.error('Error fetching portfolios:', error);
    toast.error('Failed to load portfolios');
    return [];
  }
};

/**
 * Create a new portfolio entry
 * @param {Object} portfolioData - Portfolio data
 * @param {string} portfolioData.stylistId - Stylist user ID
 * @param {string} portfolioData.title - Portfolio title
 * @param {string} portfolioData.category - Portfolio category
 * @param {string} portfolioData.description - Portfolio description
 * @param {string} portfolioData.imageUrl - Image URL
 * @param {string} portfolioData.thumbnailUrl - Thumbnail URL
 * @returns {Promise<string>} Portfolio document ID
 */
export const createPortfolio = async (portfolioData) => {
  try {
    if (!portfolioData.stylistId) {
      throw new Error('Stylist ID is required');
    }

    if (!portfolioData.imageUrl) {
      throw new Error('Image URL is required');
    }

    const portfoliosRef = collection(db, PORTFOLIO_COLLECTION);
    
    const newPortfolio = {
      stylistId: portfolioData.stylistId,
      title: portfolioData.title || 'Untitled',
      category: portfolioData.category || 'Uncategorized',
      description: portfolioData.description || '',
      imageUrl: portfolioData.imageUrl,
      thumbnailUrl: portfolioData.thumbnailUrl || portfolioData.imageUrl,
      status: 'pending', // Default status
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await addDoc(portfoliosRef, newPortfolio);
    
    toast.success('Portfolio uploaded successfully! It will be reviewed by your branch manager.');
    
    return docRef.id;
  } catch (error) {
    console.error('Error creating portfolio:', error);
    toast.error(error.message || 'Failed to upload portfolio');
    throw error;
  }
};

/**
 * Delete a portfolio entry
 * @param {string} portfolioId - Portfolio document ID
 * @returns {Promise<void>}
 */
export const deletePortfolio = async (portfolioId) => {
  try {
    if (!portfolioId) {
      throw new Error('Portfolio ID is required');
    }

    const portfolioRef = doc(db, PORTFOLIO_COLLECTION, portfolioId);
    await deleteDoc(portfolioRef);
    
    toast.success('Portfolio deleted successfully');
  } catch (error) {
    console.error('Error deleting portfolio:', error);
    toast.error('Failed to delete portfolio');
    throw error;
  }
};

/**
 * Update portfolio status (for branch managers)
 * @param {string} portfolioId - Portfolio document ID
 * @param {string} status - New status ('approved', 'rejected', 'pending')
 * @param {string} reviewedBy - User ID who reviewed
 * @param {string} reviewedByName - Name of reviewer
 * @param {string} rejectionRemark - Rejection reason (if rejected)
 * @returns {Promise<void>}
 */
export const updatePortfolioStatus = async (
  portfolioId,
  status,
  reviewedBy,
  reviewedByName,
  rejectionRemark = ''
) => {
  try {
    if (!portfolioId) {
      throw new Error('Portfolio ID is required');
    }

    const portfolioRef = doc(db, PORTFOLIO_COLLECTION, portfolioId);
    const updateData = {
      status,
      updatedAt: Timestamp.now(),
    };

    if (status === 'approved' || status === 'active') {
      updateData.approvedAt = Timestamp.now();
      updateData.approvedBy = reviewedBy;
      updateData.approvedByName = reviewedByName;
      updateData.rejectedAt = null;
      updateData.rejectedBy = null;
      updateData.rejectedByName = null;
      updateData.rejectionRemark = null;
    } else if (status === 'rejected') {
      updateData.rejectedAt = Timestamp.now();
      updateData.rejectedBy = reviewedBy;
      updateData.rejectedByName = reviewedByName;
      updateData.rejectionRemark = rejectionRemark || '';
      updateData.approvedAt = null;
      updateData.approvedBy = null;
      updateData.approvedByName = null;
    }

    await updateDoc(portfolioRef, updateData);
    
    toast.success(`Portfolio ${status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'updated'} successfully`);
  } catch (error) {
    console.error('Error updating portfolio status:', error);
    toast.error('Failed to update portfolio status');
    throw error;
  }
};

/**
 * Get portfolio by ID
 * @param {string} portfolioId - Portfolio document ID
 * @returns {Promise<Object|null>} Portfolio data or null
 */
export const getPortfolioById = async (portfolioId) => {
  try {
    if (!portfolioId) {
      return null;
    }

    const portfolioRef = doc(db, PORTFOLIO_COLLECTION, portfolioId);
    const portfolioSnap = await getDoc(portfolioRef);
    
    if (!portfolioSnap.exists()) {
      return null;
    }

    const data = portfolioSnap.data();
    return {
      id: portfolioSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : null),
      approvedAt: data.approvedAt?.toDate ? data.approvedAt.toDate() : (data.approvedAt ? new Date(data.approvedAt) : null),
      rejectedAt: data.rejectedAt?.toDate ? data.rejectedAt.toDate() : (data.rejectedAt ? new Date(data.rejectedAt) : null),
    };
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    return null;
  }
};


