// src/services/productService.js
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  startAfter,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';

class ProductService {
  constructor() {
    this.collectionName = 'products';
  }

  // Get all products
  async getAllProducts() {
    try {
      const productsRef = collection(db, this.collectionName);

      // Try to get products with orderBy, but fallback to simple query if index is missing
      let querySnapshot;
      try {
        const q = query(productsRef, orderBy('createdAt', 'desc'));
        querySnapshot = await getDocs(q);
      } catch (orderError) {
        // If orderBy fails (missing index), just get all products without ordering
        console.warn('Could not order by createdAt, fetching without order:', orderError.message);
        querySnapshot = await getDocs(productsRef);
      }

      const products = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        products.push({
          id: doc.id,
          ...data,
          // Handle createdAt - could be Timestamp, Date, or string
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() :
                     data.createdAt instanceof Date ? data.createdAt :
                     data.createdAt ? new Date(data.createdAt) : new Date(),
          // Handle updatedAt - could be Timestamp, Date, or string
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() :
                     data.updatedAt instanceof Date ? data.updatedAt :
                     data.updatedAt ? new Date(data.updatedAt) : new Date()
        });
      });

      // Sort by createdAt descending if we didn't use orderBy
      products.sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
        const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });

      return {
        success: true,
        products
      };
    } catch (error) {
      console.error('Error getting products:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Get products offered by a specific branch
  async getBranchProducts(branchId) {
    try {
      console.log(`🔍 Fetching products for branch: ${branchId}`);
      const productsRef = collection(db, this.collectionName);

      // Query products where branches array contains the branchId
      const q = query(productsRef, where('branches', 'array-contains', branchId));
      const querySnapshot = await getDocs(q);

      const products = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        products.push({
          id: doc.id,
          ...data,
          // Handle createdAt - could be Timestamp, Date, or string
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() :
                     data.createdAt instanceof Date ? data.createdAt :
                     data.createdAt ? new Date(data.createdAt) : new Date(),
          // Handle updatedAt - could be Timestamp, Date, or string
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() :
                     data.updatedAt instanceof Date ? data.updatedAt :
                     data.updatedAt ? new Date(data.updatedAt) : new Date()
        });
      });

      console.log(`✅ Found ${products.length} products configured for branch ${branchId}`);

      // Sort by createdAt descending
      products.sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
        const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });

      return {
        success: true,
        products
      };
    } catch (error) {
      console.error('Error getting branch products:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Get product by ID
  async getProductById(productId) {
    try {
      const productRef = doc(db, this.collectionName, productId);
      const productSnap = await getDoc(productRef);
      
      if (productSnap.exists()) {
        return {
          success: true,
          product: {
            id: productSnap.id,
            ...productSnap.data(),
            createdAt: productSnap.data().createdAt?.toDate?.() || new Date(),
            updatedAt: productSnap.data().updatedAt?.toDate?.() || new Date()
          }
        };
      } else {
        return {
          success: false,
          message: 'Product not found'
        };
      }
    } catch (error) {
      console.error('Error getting product:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Get products by category
  async getProductsByCategory(category) {
    try {
      const productsRef = collection(db, this.collectionName);
      const q = query(
        productsRef, 
        where('category', '==', category),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      const products = [];
      querySnapshot.forEach((doc) => {
        products.push({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate?.() || new Date()
        });
      });

      return {
        success: true,
        products
      };
    } catch (error) {
      console.error('Error getting products by category:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Get products by supplier (suppliers is now an array)
  async getProductsBySupplier(supplierId) {
    try {
      const productsRef = collection(db, this.collectionName);
      // Query products where the supplier ID is in the suppliers array
      const q = query(
        productsRef, 
        where('suppliers', 'array-contains', supplierId)
      );
      const querySnapshot = await getDocs(q);
      
      const products = [];
      querySnapshot.forEach((doc) => {
        products.push({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate?.() || new Date()
        });
      });

      // Sort by createdAt descending
      products.sort((a, b) => {
        const aDate = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
        const bDate = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
        return bDate - aDate;
      });

      return {
        success: true,
        products
      };
    } catch (error) {
      console.error('Error getting products by supplier:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Get products by status
  async getProductsByStatus(status) {
    try {
      const productsRef = collection(db, this.collectionName);
      const q = query(
        productsRef, 
        where('status', '==', status),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      const products = [];
      querySnapshot.forEach((doc) => {
        products.push({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate?.() || new Date()
        });
      });

      return {
        success: true,
        products
      };
    } catch (error) {
      console.error('Error getting products by status:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Search products
  async searchProducts(searchTerm) {
    try {
      const productsRef = collection(db, this.collectionName);
      const q = query(productsRef, orderBy('name'));
      const querySnapshot = await getDocs(q);
      
      const products = [];
      querySnapshot.forEach((doc) => {
        const productData = doc.data();
        const searchLower = searchTerm.toLowerCase();
        
        if (
          productData.name.toLowerCase().includes(searchLower) ||
          productData.brand.toLowerCase().includes(searchLower) ||
          productData.description.toLowerCase().includes(searchLower) ||
          productData.category.toLowerCase().includes(searchLower) ||
          (productData.supplier && productData.supplier.toLowerCase().includes(searchLower))
        ) {
          products.push({
            id: doc.id,
            ...productData,
            createdAt: productData.createdAt?.toDate?.() || new Date(),
            updatedAt: productData.updatedAt?.toDate?.() || new Date()
          });
        }
      });

      return {
        success: true,
        products
      };
    } catch (error) {
      console.error('Error searching products:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Create new product
  async createProduct(productData) {
    try {
      const productsRef = collection(db, this.collectionName);
      const newProduct = {
        ...productData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      
      const docRef = await addDoc(productsRef, newProduct);
      
      return {
        success: true,
        productId: docRef.id,
        message: 'Product created successfully'
      };
    } catch (error) {
      console.error('Error creating product:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Update product
  async updateProduct(productId, updateData) {
    try {
      const productRef = doc(db, this.collectionName, productId);
      const updatePayload = {
        ...updateData,
        updatedAt: Timestamp.now()
      };
      
      await updateDoc(productRef, updatePayload);
      
      return {
        success: true,
        message: 'Product updated successfully'
      };
    } catch (error) {
      console.error('Error updating product:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Delete product
  async deleteProduct(productId) {
    try {
      const productRef = doc(db, this.collectionName, productId);
      await deleteDoc(productRef);
      
      return {
        success: true,
        message: 'Product deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting product:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Get product statistics
  async getProductStatistics() {
    try {
      const productsRef = collection(db, this.collectionName);
      const querySnapshot = await getDocs(productsRef);
      
      let totalProducts = 0;
      let activeProducts = 0;
      let inactiveProducts = 0;
      let discontinuedProducts = 0;
      let totalValue = 0;
      const categories = {};
      const suppliers = {};

      querySnapshot.forEach((doc) => {
        const product = doc.data();
        totalProducts++;
        
        // Count by status
        switch (product.status) {
          case 'Active':
            activeProducts++;
            break;
          case 'Inactive':
            inactiveProducts++;
            break;
          case 'Discontinued':
            discontinuedProducts++;
            break;
        }
        
        // Calculate total value (using OTC price as reference)
        totalValue += product.otcPrice || 0;
        
        // Count categories
        if (product.category) {
          categories[product.category] = (categories[product.category] || 0) + 1;
        }
        
        // Count suppliers
        if (product.supplier) {
          suppliers[product.supplier] = (suppliers[product.supplier] || 0) + 1;
        }
        // Also handle suppliers array
        if (product.suppliers && Array.isArray(product.suppliers)) {
          product.suppliers.forEach(supplierId => {
            suppliers[supplierId] = (suppliers[supplierId] || 0) + 1;
          });
        }
      });

      return {
        success: true,
        statistics: {
          totalProducts,
          activeProducts,
          inactiveProducts,
          discontinuedProducts,
          totalValue,
          categories,
          suppliers
        }
      };
    } catch (error) {
      console.error('Error getting product statistics:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Get low stock products (if you have stock tracking)
  async getLowStockProducts(threshold = 10) {
    try {
      // This would need to be implemented based on your stock tracking system
      // For now, returning empty array
      return {
        success: true,
        products: []
      };
    } catch (error) {
      console.error('Error getting low stock products:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Get expiring products (if you have expiry tracking)
  async getExpiringProducts(daysAhead = 30) {
    try {
      // This would need to be implemented based on your expiry tracking system
      // For now, returning empty array
      return {
        success: true,
        products: []
      };
    } catch (error) {
      console.error('Error getting expiring products:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}

export const productService = new ProductService();
export default productService;

