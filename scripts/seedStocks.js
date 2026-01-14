/**
 * Seed Stocks Script
 * Seeds initial stock/inventory data for branches
 * 
 * Stock Process in David's Salon:
 * 1. Inventory Controller creates PO → status: 'Pending'
 * 2. Branch Manager approves PO → status: 'Approved'
 * 3. Inventory Controller marks as in transit → status: 'In Transit'
 * 4. Inventory Controller receives delivery → status: 'Delivered'
 *    - Creates deliveryReceipts
 *    - Creates product_batches (with expiration dates)
 *    - Creates stocks (batch stock entries for FIFO)
 * 
 * This script simulates the complete flow by creating:
 * - Purchase Orders (already delivered)
 * - Delivery Receipts
 * - Product Batches
 * - Stocks
 */

import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  addDoc,
  query, 
  where,
  Timestamp,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import dotenv from 'dotenv';

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Helper to generate PO ID
const generatePOId = (branchCode, sequence) => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `PO-${branchCode}-${year}${month}-${String(sequence).padStart(3, '0')}`;
};

// Helper to generate batch number
const generateBatchNumber = (poId, batchNum, usageType = 'otc') => {
  const formattedNum = String(batchNum).padStart(3, '0');
  const suffix = usageType === 'salon-use' ? 'SUP' : 'OTC';
  return `${poId}-${suffix}-${formattedNum}`;
};

// Helper to generate receipt number
const generateReceiptNumber = (branchCode, sequence) => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `DR-${branchCode}-${year}${month}-${String(sequence).padStart(3, '0')}`;
};

// Helper to add days to a date
const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

// Helper to add months to a date
const addMonths = (date, months) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

async function seedStocks() {
  console.log('🚀 Starting stock seeding...\n');

  try {
    // 1. Get Ayala Harbor Point branch only
    console.log('📍 Fetching Ayala Harbor Point branch...');
    const branchesSnap = await getDocs(collection(db, 'branches'));
    const branches = [];
    branchesSnap.forEach(doc => {
      const data = doc.data();
      const branchName = (data.name || data.branchName || '').toLowerCase();
      // Only include Ayala Harbor Point branch
      if (branchName.includes('ayala') && branchName.includes('harbor')) {
        branches.push({ id: doc.id, ...data });
      }
    });
    
    if (branches.length === 0) {
      console.log('❌ Ayala Harbor Point branch not found. Please check the branch name.');
      process.exit(1);
    }
    console.log(`   Found branch: ${branches[0].name || branches[0].branchName}\n`);

    // 2. Get all products (check both master_products and products collections)
    console.log('📦 Fetching products...');
    let products = [];
    
    // Try master_products first
    const masterProductsSnap = await getDocs(collection(db, 'master_products'));
    masterProductsSnap.forEach(doc => {
      const data = doc.data();
      // Accept Active, active, or no status field
      if (!data.status || data.status === 'Active' || data.status === 'active') {
        products.push({ id: doc.id, ...data });
      }
    });
    console.log(`   Found ${products.length} products in master_products`);
    
    // If no master_products, try products collection
    if (products.length === 0) {
      const productsSnap = await getDocs(collection(db, 'products'));
      productsSnap.forEach(doc => {
        const data = doc.data();
        if (!data.status || data.status === 'Active' || data.status === 'active') {
          products.push({ id: doc.id, ...data });
        }
      });
      console.log(`   Found ${products.length} products in products collection`);
    }
    console.log(`   Total products: ${products.length}\n`);

    if (products.length === 0) {
      console.log('❌ No products found. Please seed products first.');
      process.exit(1);
    }

    // 3. Get suppliers (or create a default one)
    console.log('🏭 Fetching suppliers...');
    const suppliersSnap = await getDocs(collection(db, 'suppliers'));
    const suppliers = [];
    suppliersSnap.forEach(doc => {
      const data = doc.data();
      if (!data.status || data.status === 'Active' || data.status === 'active') {
        suppliers.push({ id: doc.id, ...data });
      }
    });
    
    // If no suppliers, create a default one for seeding
    if (suppliers.length === 0) {
      suppliers.push({ id: 'default-supplier', name: 'Default Supplier' });
      console.log('   No suppliers found, using default supplier');
    } else {
      console.log(`   Found ${suppliers.length} active suppliers\n`);
    }

    // 4. Get users for createdBy/receivedBy (flexible role matching)
    console.log('👤 Fetching users...');
    const usersSnap = await getDocs(collection(db, 'users'));
    const users = { inventoryControllers: [], branchManagers: [], allUsers: [] };
    
    usersSnap.forEach(doc => {
      const data = doc.data();
      if (data.isActive !== false) { // Include if isActive is true or undefined
        const userData = { id: doc.id, ...data };
        users.allUsers.push(userData);
        
        const roles = data.roles || (data.role ? [data.role] : []);
        const roleStr = roles.join(',').toLowerCase();
        
        if (roleStr.includes('inventory') || roleStr.includes('controller')) {
          users.inventoryControllers.push(userData);
        }
        if (roleStr.includes('branch') && roleStr.includes('manager')) {
          users.branchManagers.push(userData);
        }
        // Also check single role field
        if (data.role) {
          const singleRole = data.role.toLowerCase();
          if (singleRole.includes('inventory') || singleRole === 'inventory_controller') {
            if (!users.inventoryControllers.find(u => u.id === userData.id)) {
              users.inventoryControllers.push(userData);
            }
          }
          if (singleRole.includes('branch_manager') || singleRole === 'branch-manager') {
            if (!users.branchManagers.find(u => u.id === userData.id)) {
              users.branchManagers.push(userData);
            }
          }
        }
      }
    });
    
    console.log(`   Found ${users.inventoryControllers.length} inventory controllers`);
    console.log(`   Found ${users.branchManagers.length} branch managers`);
    console.log(`   Found ${users.allUsers.length} total users\n`);
    
    // If no specific roles found, use any available user
    if (users.inventoryControllers.length === 0 && users.allUsers.length > 0) {
      users.inventoryControllers = [users.allUsers[0]];
      console.log(`   Using fallback user: ${users.allUsers[0].firstName || users.allUsers[0].email || 'Unknown'}\n`);
    }
    
    if (users.inventoryControllers.length === 0) {
      // Create a system user for seeding
      users.inventoryControllers = [{ 
        id: 'system', 
        firstName: 'System', 
        lastName: 'Admin',
        email: 'system@davidsalon.com'
      }];
      users.branchManagers = users.inventoryControllers;
      console.log('   No users found, using system user for seeding\n');
    }

    // 5. Seed stocks for each branch
    const today = new Date();
    let totalPOs = 0;
    let totalReceipts = 0;
    let totalBatches = 0;
    let totalStocks = 0;

    for (const branch of branches) {
      console.log(`\n🏪 Seeding stocks for branch: ${branch.name || branch.branchName}`);
      
      const branchCode = (branch.name || branch.branchName || 'BR').substring(0, 3).toUpperCase();
      
      // Find users for this branch or use any available
      const branchIC = users.inventoryControllers.find(u => u.branchId === branch.id) || users.inventoryControllers[0];
      const branchMgr = users.branchManagers.find(u => u.branchId === branch.id) || users.branchManagers[0] || branchIC;

      // Create 2 POs per branch (simulating different delivery dates)
      for (let poSeq = 1; poSeq <= 2; poSeq++) {
        const batch = writeBatch(db);
        
        const poId = generatePOId(branchCode, poSeq);
        const receiptNumber = generateReceiptNumber(branchCode, poSeq);
        
        // Select a random supplier
        const supplier = suppliers[Math.floor(Math.random() * suppliers.length)] || { id: 'unknown', name: 'Unknown Supplier' };
        
        // Select products for this PO (5-10 products)
        const numProducts = Math.floor(Math.random() * 6) + 5;
        const shuffledProducts = [...products].sort(() => Math.random() - 0.5);
        const poProducts = shuffledProducts.slice(0, numProducts);
        
        // Dates
        const orderDate = addDays(today, -(poSeq * 7 + Math.floor(Math.random() * 5)));
        const approvedDate = addDays(orderDate, 1);
        const receivedDate = addDays(approvedDate, 2 + Math.floor(Math.random() * 3));
        
        // Build PO items
        const poItems = poProducts.map((product, idx) => {
          const quantity = Math.floor(Math.random() * 30) + 10; // 10-40 units
          const usageType = product.category?.toLowerCase().includes('treatment') || 
                           product.category?.toLowerCase().includes('color') 
                           ? 'salon-use' : 'otc';
          return {
            productId: product.id,
            productName: product.name,
            brand: product.brand || '',
            category: product.category || '',
            quantity: quantity,
            unitPrice: product.unitCost || 0,
            total: quantity * (product.unitCost || 0),
            usageType: usageType
          };
        });
        
        const totalAmount = poItems.reduce((sum, item) => sum + item.total, 0);

        // Create Purchase Order (already delivered)
        const poRef = doc(collection(db, 'purchaseOrders'));
        const poData = {
          orderId: poId,
          branchId: branch.id,
          branchName: branch.name || branch.branchName,
          supplierId: supplier.id,
          supplierName: supplier.name,
          items: poItems,
          totalAmount: totalAmount,
          status: 'Delivered',
          orderDate: Timestamp.fromDate(orderDate),
          expectedDelivery: Timestamp.fromDate(addDays(orderDate, 5)),
          createdBy: branchIC.id,
          createdByName: `${branchIC.firstName} ${branchIC.lastName}`,
          createdAt: Timestamp.fromDate(orderDate),
          approvedBy: branchMgr?.id || branchIC.id,
          approvedByName: branchMgr ? `${branchMgr.firstName} ${branchMgr.lastName}` : `${branchIC.firstName} ${branchIC.lastName}`,
          approvedAt: Timestamp.fromDate(approvedDate),
          receivedAt: Timestamp.fromDate(receivedDate),
          receivedBy: branchIC.id,
          receivedByName: `${branchIC.firstName} ${branchIC.lastName}`,
          notes: `Seeded PO for testing - ${poId}`
        };
        batch.set(poRef, poData);
        totalPOs++;

        // Create Delivery Receipt
        const receiptRef = doc(collection(db, 'deliveryReceipts'));
        const receiptData = {
          receiptNumber: receiptNumber,
          purchaseOrderId: poRef.id,
          purchaseOrderNumber: poId,
          branchId: branch.id,
          branchName: branch.name || branch.branchName,
          supplierId: supplier.id,
          supplierName: supplier.name,
          items: poItems.map(item => ({
            ...item,
            orderedQuantity: item.quantity,
            receivedQuantity: item.quantity,
            discrepancy: 0
          })),
          orderedTotal: totalAmount,
          receivedTotal: totalAmount,
          discrepancyAmount: 0,
          totalAmount: totalAmount,
          receivedDate: Timestamp.fromDate(receivedDate),
          receivedBy: branchIC.id,
          receivedByName: `${branchIC.firstName} ${branchIC.lastName}`,
          createdAt: Timestamp.fromDate(receivedDate),
          notes: `Seeded delivery receipt - ${receiptNumber}`
        };
        batch.set(receiptRef, receiptData);
        totalReceipts++;

        // Create Product Batches and Stocks for each item
        for (let i = 0; i < poItems.length; i++) {
          const item = poItems[i];
          const batchNum = i + 1;
          const batchNumber = generateBatchNumber(poId, batchNum, item.usageType);
          
          // Expiration date: 6-24 months from received date
          const monthsToExpiry = Math.floor(Math.random() * 19) + 6;
          const expirationDate = addMonths(receivedDate, monthsToExpiry);

          // Create product_batch entry
          const batchRef = doc(collection(db, 'product_batches'));
          const batchData = {
            batchNumber: batchNumber,
            baseBatchNumber: batchNum,
            productId: item.productId,
            productName: item.productName,
            branchId: branch.id,
            purchaseOrderId: poRef.id,
            quantity: item.quantity,
            remainingQuantity: item.quantity,
            unitCost: item.unitPrice,
            expirationDate: Timestamp.fromDate(expirationDate),
            receivedDate: Timestamp.fromDate(receivedDate),
            receivedBy: branchIC.id,
            usageType: item.usageType,
            status: 'active',
            createdAt: Timestamp.fromDate(receivedDate),
            updatedAt: serverTimestamp()
          };
          batch.set(batchRef, batchData);
          totalBatches++;

          // Create stocks entry (batch_stock for FIFO tracking)
          const stockRef = doc(collection(db, 'stocks'));
          const stockData = {
            batchId: batchRef.id,
            batchNumber: batchNumber,
            baseBatchNumber: batchNum,
            productId: item.productId,
            productName: item.productName,
            branchId: branch.id,
            purchaseOrderId: poRef.id,
            beginningStock: item.quantity,
            realTimeStock: item.quantity,
            remainingQuantity: item.quantity,
            unitCost: item.unitPrice,
            expirationDate: Timestamp.fromDate(expirationDate),
            receivedDate: Timestamp.fromDate(receivedDate),
            receivedBy: branchIC.id,
            receivedByName: `${branchIC.firstName} ${branchIC.lastName}`,
            usageType: item.usageType,
            createdAt: Timestamp.fromDate(receivedDate),
            updatedAt: serverTimestamp(),
            createdBy: branchIC.id,
            status: 'active',
            stockType: 'batch'
          };
          batch.set(stockRef, stockData);
          totalStocks++;
        }

        await batch.commit();
        console.log(`   ✅ Created PO ${poId} with ${poItems.length} items`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ Stock seeding completed!');
    console.log(`   Purchase Orders created: ${totalPOs}`);
    console.log(`   Delivery Receipts created: ${totalReceipts}`);
    console.log(`   Product Batches created: ${totalBatches}`);
    console.log(`   Stock entries created: ${totalStocks}`);
    console.log('='.repeat(50));

  } catch (error) {
    console.error('❌ Error seeding stocks:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the seed
seedStocks();
