// src/services/transactionApiService.js
import { collection, query, where, limit, getDocs, getCountFromServer } from 'firebase/firestore';
import { db } from '../config/firebase';

// Helper function to map transaction status
function mapTransactionStatus(status) {
  if (!status) return 'In Service';
  const statusLower = status.toLowerCase();
  const statusMap = {
    'in_service': 'In Service',
    'paid': 'Paid',
    'voided': 'Voided',
    'pending': 'In Service',
    'completed': 'Paid',
    'cancelled': 'Voided',
    'refunded': 'Voided'
  };
  return statusMap[statusLower] || status;
}

// Helper function to calculate commission
function calculateCommission(total) {
  return Math.round(total * 0.15 * 100) / 100;
}

// Helper function to calculate duration
function calculateDuration(services) {
  if (!services || services.length === 0) return '0 mins';
  const totalDuration = services.reduce((sum, service) => sum + (service.duration || 0), 0);
  return totalDuration > 0 ? `${totalDuration} mins` : '30 mins';
}

// Helper function to determine customer type
function determineCustomerType(clientInfo) {
  if (!clientInfo) return 'New';
  if (clientInfo.isVip) return 'VIP';
  if (clientInfo.isRegular) return 'Regular';
  return 'New';
}

// Helper function to transform services to items
function transformServicesToItems(services) {
  if (!services || services.length === 0) return [];
  return services.map(service => ({
    name: service.serviceName || 'Service',
    price: service.price || 0,
    quantity: 1
  }));
}

class TransactionApiService {
  /**
   * Get all transactions for a specific branch with pagination and filtering
   * DIRECT FIRESTORE QUERY
   * @param {string} branchId - The branch ID to fetch transactions for
   * @param {string} currentUserRole - The current user's role
   * @param {Object} options - Pagination and filtering options
   * @returns {Promise<Object>} - Response with success status and transactions array
   */
  async getBranchTransactions(branchId, currentUserRole, options = {}) {
    try {
      const {
        page = 1,
        limit: limitCount = 50,
        search = '',
        typeFilter = 'All',
        statusFilter = 'All',
        lastDoc = null
      } = options;

      // Check permissions
      const allowedRoles = ['systemAdmin', 'operationalManager', 'branchAdmin', 'branchManager'];
      if (!allowedRoles.includes(currentUserRole)) {
        throw new Error('Insufficient permissions to view transactions');
      }

      console.log(`[Direct Query] Fetching transactions for branchId=${branchId}, page=${page}, limit=${limitCount}`);

      // Build query - direct Firestore query
      let transactionsQuery = query(
        collection(db, 'transactions'),
        where('branchId', '==', branchId)
      );

      // Map status filter to database values
      let dbStatusFilter = statusFilter;
      if (statusFilter !== 'All' && statusFilter) {
        const statusMap = {
          'in service': 'in_service',
          'paid': 'paid',
          'voided': 'voided',
          'completed': 'paid',
          'pending': 'in_service',
          'cancelled': 'voided',
          'refunded': 'voided'
        };
        const statusLower = statusFilter.toLowerCase().trim();
        dbStatusFilter = statusMap[statusLower] || statusLower.replace(' ', '_');
        transactionsQuery = query(transactionsQuery, where('status', '==', dbStatusFilter));
      }

      // Add type filter if specified
      if (typeFilter !== 'All' && typeFilter) {
        transactionsQuery = query(transactionsQuery, where('transactionType', '==', typeFilter.toLowerCase()));
      }

      // Fetch transactions (fetch more for client-side pagination)
      const fetchLimit = Math.min(limitCount * 3, 200);
      transactionsQuery = query(transactionsQuery, limit(fetchLimit));

      const transactionsSnapshot = await getDocs(transactionsQuery);
      console.log(`[Direct Query] Found ${transactionsSnapshot.size} documents`);

      const transactions = [];
      let processedCount = 0;

      transactionsSnapshot.forEach((doc) => {
        try {
          const transactionData = doc.data();
          
          if (!transactionData) {
            console.warn(`Document ${doc.id} has no data, skipping`);
            return;
          }

          // Apply client-side search filter
          if (search && search.trim() !== '') {
            const searchLower = search.toLowerCase();
            const customerName = transactionData.clientInfo?.name || '';
            const serviceName = transactionData.services?.[0]?.serviceName || '';
            const stylistName = transactionData.services?.[0]?.stylistName || '';
            const transactionId = doc.id;
            
            if (!customerName.toLowerCase().includes(searchLower) &&
                !serviceName.toLowerCase().includes(searchLower) &&
                !stylistName.toLowerCase().includes(searchLower) &&
                !transactionId.toLowerCase().includes(searchLower)) {
              return;
            }
          }

          // Handle dates
          let createdAtDate = null;
          if (transactionData.createdAt) {
            if (transactionData.createdAt.toDate) {
              createdAtDate = transactionData.createdAt.toDate();
            } else if (transactionData.createdAt.seconds) {
              createdAtDate = new Date(transactionData.createdAt.seconds * 1000);
            } else if (transactionData.createdAt instanceof Date) {
              createdAtDate = transactionData.createdAt;
            } else {
              createdAtDate = new Date(transactionData.createdAt);
            }
          }

          let updatedAtDate = null;
          if (transactionData.updatedAt) {
            if (transactionData.updatedAt.toDate) {
              updatedAtDate = transactionData.updatedAt.toDate();
            } else if (transactionData.updatedAt.seconds) {
              updatedAtDate = new Date(transactionData.updatedAt.seconds * 1000);
            } else if (transactionData.updatedAt instanceof Date) {
              updatedAtDate = transactionData.updatedAt;
            } else {
              updatedAtDate = new Date(transactionData.updatedAt);
            }
          }

          const originalStatus = transactionData.status || 'in_service';
          
          // Transform transaction data
          const transformedTransaction = {
            id: doc.id,
            type: transactionData.transactionType || 'service',
            customerName: transactionData.clientInfo?.name || 'Unknown Customer',
            serviceName: transactionData.services?.[0]?.serviceName || 'Service',
            stylistName: transactionData.services?.[0]?.stylistName || 'Unknown Stylist',
            appointmentId: transactionData.appointmentId || null,
            amount: transactionData.total || transactionData.totalAmount || 0,
            commission: calculateCommission(transactionData.total || transactionData.totalAmount || 0),
            status: mapTransactionStatus(originalStatus),
            originalStatus: originalStatus,
            date: createdAtDate ? createdAtDate.toISOString() : new Date().toISOString(),
            paymentMethod: transactionData.paymentMethod || 'Cash',
            duration: calculateDuration(transactionData.services || []),
            customerType: determineCustomerType(transactionData.clientInfo),
            satisfaction: 5,
            items: transformServicesToItems(transactionData.services || []),
            branchId: transactionData.branchId,
            clientId: transactionData.clientId,
            clientInfo: transactionData.clientInfo || {},
            createdBy: transactionData.createdBy,
            discount: transactionData.discount || 0,
            loyaltyEarned: transactionData.loyaltyEarned || 0,
            notes: transactionData.notes || '',
            subtotal: transactionData.subtotal || 0,
            tax: transactionData.tax || 0,
            total: transactionData.total || transactionData.totalAmount || 0,
            totalAmount: transactionData.totalAmount || transactionData.total || 0,
            transactionType: transactionData.transactionType,
            services: transactionData.services || [],
            products: transactionData.products || [],
            createdAt: createdAtDate || transactionData.createdAt,
            updatedAt: updatedAtDate || transactionData.updatedAt
          };

          transactions.push(transformedTransaction);
          processedCount++;
        } catch (docError) {
          console.error(`Error processing document ${doc.id}:`, docError);
        }
      });

      console.log(`[Direct Query] Processed ${processedCount} transactions`);

      // Sort by createdAt (descending)
      transactions.sort((a, b) => {
        try {
          let aTime = a.createdAt instanceof Date ? a.createdAt : new Date(0);
          let bTime = b.createdAt instanceof Date ? b.createdAt : new Date(0);
          
          if (!(a.createdAt instanceof Date) && a.createdAt) {
            if (a.createdAt.toDate) {
              aTime = a.createdAt.toDate();
            } else if (a.createdAt.seconds) {
              aTime = new Date(a.createdAt.seconds * 1000);
            } else {
              aTime = new Date(a.createdAt);
            }
          }
          
          if (!(b.createdAt instanceof Date) && b.createdAt) {
            if (b.createdAt.toDate) {
              bTime = b.createdAt.toDate();
            } else if (b.createdAt.seconds) {
              bTime = new Date(b.createdAt.seconds * 1000);
            } else {
              bTime = new Date(b.createdAt);
            }
          }

          return bTime.getTime() - aTime.getTime();
        } catch (sortError) {
          return 0;
        }
      });

      // Client-side pagination
      const startIndex = (page - 1) * limitCount;
      const endIndex = startIndex + limitCount;
      const paginatedTransactions = transactions.slice(startIndex, endIndex);

      // Get total count
      let totalCount = transactions.length;
      if (page === 1) {
        try {
          const countQuery = query(
            collection(db, 'transactions'),
            where('branchId', '==', branchId)
          );
          const countSnapshot = await getCountFromServer(countQuery);
          totalCount = countSnapshot.data().count;
        } catch (error) {
          console.warn('Could not get total count, using fetched count:', error);
          if (transactions.length < fetchLimit) {
            totalCount = transactions.length;
          }
        }
      }

      console.log(`[Direct Query] Returning ${paginatedTransactions.length} transactions (page ${page})`);

      return {
        success: true,
        transactions: paginatedTransactions,
        count: paginatedTransactions.length,
        totalCount: totalCount,
        hasMore: endIndex < transactions.length,
        lastDoc: paginatedTransactions.length > 0 ? paginatedTransactions[paginatedTransactions.length - 1].id : null,
        page,
        limit: limitCount
      };
    } catch (error) {
      console.error('Error fetching branch transactions:', error);
      
      // Extract detailed error message
      let errorMessage = 'Unknown error occurred';
      
      if (error.code) {
        switch (error.code) {
          case 'failed-precondition':
            errorMessage = 'Firestore index is missing. Please check the Firebase console to create the required index.';
            break;
          case 'permission-denied':
            errorMessage = 'You do not have permission to view transactions.';
            break;
          case 'invalid-argument':
            errorMessage = 'Invalid request parameters: ' + (error.message || 'Check your branch ID and role');
            break;
          case 'internal':
            errorMessage = 'Server error: ' + (error.message || error.details || 'Please check the function logs');
            break;
          default:
            errorMessage = `Error (${error.code}): ${error.message || error.details || 'Unknown error'}`;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return { 
        success: false, 
        error: errorMessage,
        errorCode: error.code,
        errorDetails: error.details,
        transactions: [],
        count: 0,
        totalCount: 0,
        hasMore: false
      };
    }
  }
}

export const transactionApiService = new TransactionApiService();

