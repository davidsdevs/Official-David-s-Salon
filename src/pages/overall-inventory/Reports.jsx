// src/pages/overall-inventory/Reports.jsx
import { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { getAllBranches } from '../../services/branchService';
import { productService } from '../../services/productService';
import { inventoryService } from '../../services/inventoryService';
import { db } from '../../config/firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import {
  BarChart3,
  Download,
  Printer,
  Calendar,
  Banknote,
  Package,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ShoppingCart,
  Building,
  RefreshCw,
  Filter,
  FileText,
  PieChart,
  LineChart,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

const Reports = () => {
  const printRef = useRef();
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Overall_Inventory_Report_${format(new Date(), 'yyyy-MM-dd')}`,
  });

  const [reportType, setReportType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState([]);
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [reportData, setReportData] = useState(null);

  useEffect(() => {
    loadBranches();
  }, []);

  const loadBranches = async () => {
    try {
      const branchesData = await getAllBranches();
      setBranches(branchesData.filter(b => b.isActive !== false));
    } catch (err) {
      console.error('Error loading branches:', err);
    }
  };

  const generateStockValuationReport = async () => {
    setLoading(true);
    try {
      const productsResult = await productService.getAllProducts();
      const productsMap = {};
      if (productsResult.success) {
        productsResult.products.forEach(p => {
          productsMap[p.id] = p;
        });
      }

      const getComputedStock = (stock) => {
        return stock.remainingQuantity || stock.realTimeStock || stock.beginningStock || stock.currentStock || 0;
      };

      let reportItems = [];
      let totalValue = 0;
      let totalQuantity = 0;

      for (const branch of branches) {
        if (selectedBranch !== 'all' && branch.id !== selectedBranch) continue;

        const stocksResult = await inventoryService.getBranchStocks(branch.id);
        if (stocksResult.success && stocksResult.stocks) {
          stocksResult.stocks.forEach(stock => {
            const currentStock = getComputedStock(stock);
            const product = productsMap[stock.productId];
            const unitCost = stock.unitCost || product?.unitCost || 0;
            const value = currentStock * unitCost;

            reportItems.push({
              branchName: branch.name,
              productName: stock.productName,
              category: stock.category || product?.category || '-',
              quantity: currentStock,
              unitCost,
              totalValue: value,
              minStock: stock.minStock || 0,
              status: currentStock === 0 ? 'Out of Stock' : currentStock <= (stock.minStock || 5) ? 'Low Stock' : 'In Stock'
            });

            totalValue += value;
            totalQuantity += currentStock;
          });
        }
      }

      setReportData({
        type: 'Stock Valuation',
        generatedAt: new Date(),
        dateRange,
        items: reportItems,
        summary: {
          totalItems: reportItems.length,
          totalQuantity,
          totalValue,
          averageUnitCost: reportItems.length > 0 ? reportItems.reduce((sum, i) => sum + i.unitCost, 0) / reportItems.length : 0
        }
      });
    } catch (err) {
      console.error('Error generating report:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateLowStockReport = async () => {
    setLoading(true);
    try {
      const productsResult = await productService.getAllProducts();
      const productsMap = {};
      if (productsResult.success) {
        productsResult.products.forEach(p => {
          productsMap[p.id] = p;
        });
      }

      const getComputedStock = (stock) => {
        return stock.remainingQuantity || stock.realTimeStock || stock.beginningStock || stock.currentStock || 0;
      };

      let reportItems = [];

      for (const branch of branches) {
        if (selectedBranch !== 'all' && branch.id !== selectedBranch) continue;

        const stocksResult = await inventoryService.getBranchStocks(branch.id);
        if (stocksResult.success && stocksResult.stocks) {
          stocksResult.stocks.forEach(stock => {
            const currentStock = getComputedStock(stock);
            const minStock = stock.minStock || 5;

            if (currentStock <= minStock) {
              const product = productsMap[stock.productId];
              reportItems.push({
                branchName: branch.name,
                productName: stock.productName,
                category: stock.category || product?.category || '-',
                currentStock,
                minStock,
                reorderQuantity: Math.max(minStock * 2 - currentStock, 0),
                status: currentStock === 0 ? 'OUT OF STOCK' : 'LOW STOCK',
                unitCost: stock.unitCost || product?.unitCost || 0
              });
            }
          });
        }
      }

      reportItems.sort((a, b) => a.currentStock - b.currentStock);

      setReportData({
        type: 'Low Stock Alert',
        generatedAt: new Date(),
        dateRange,
        items: reportItems,
        summary: {
          totalLowStockItems: reportItems.length,
          outOfStockCount: reportItems.filter(i => i.status === 'OUT OF STOCK').length,
          lowStockCount: reportItems.filter(i => i.status === 'LOW STOCK').length
        }
      });
    } catch (err) {
      console.error('Error generating report:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateProductSalesReport = async () => {
    setLoading(true);
    try {
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999);

      let reportItems = [];
      let totalSales = 0;
      let totalQuantity = 0;

      const transactionsQuery = query(
        collection(db, 'transactions'),
        where('createdAt', '>=', startDate),
        where('createdAt', '<=', endDate),
        orderBy('createdAt', 'desc')
      );

      const transactionsSnapshot = await getDocs(transactionsQuery);
      const salesMap = {};

      transactionsSnapshot.forEach(doc => {
        const txn = doc.data();
        if (txn.salesType === 'product' || txn.salesType === 'mixed') {
          if (selectedBranch !== 'all' && txn.branchId !== selectedBranch) return;

          const branch = branches.find(b => b.id === txn.branchId);
          const productItems = (txn.items || []).filter(item => item.type === 'product');

          productItems.forEach(item => {
            const key = `${item.id}-${item.name}`;
            if (!salesMap[key]) {
              salesMap[key] = {
                productId: item.id,
                productName: item.name,
                branchName: branch?.name || 'Unknown',
                quantity: 0,
                revenue: 0,
                transactions: 0
              };
            }
            salesMap[key].quantity += item.quantity || 0;
            salesMap[key].revenue += (item.price || 0) * (item.quantity || 0);
            salesMap[key].transactions += 1;
            totalSales += (item.price || 0) * (item.quantity || 0);
            totalQuantity += item.quantity || 0;
          });
        }
      });

      reportItems = Object.values(salesMap).sort((a, b) => b.revenue - a.revenue);

      setReportData({
        type: 'Product Sales',
        generatedAt: new Date(),
        dateRange,
        items: reportItems,
        summary: {
          totalProducts: reportItems.length,
          totalQuantitySold: totalQuantity,
          totalRevenue: totalSales,
          averageTransactionValue: reportItems.length > 0 ? totalSales / reportItems.reduce((sum, i) => sum + i.transactions, 0) : 0
        }
      });
    } catch (err) {
      console.error('Error generating report:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateBranchComparisonReport = async () => {
    setLoading(true);
    try {
      const productsResult = await productService.getAllProducts();
      const productsMap = {};
      if (productsResult.success) {
        productsResult.products.forEach(p => {
          productsMap[p.id] = p;
        });
      }

      const getComputedStock = (stock) => {
        return stock.remainingQuantity || stock.realTimeStock || stock.beginningStock || stock.currentStock || 0;
      };

      let reportItems = [];

      for (const branch of branches) {
        const stocksResult = await inventoryService.getBranchStocks(branch.id);
        let branchValue = 0;
        let branchQuantity = 0;
        let lowStockCount = 0;
        let outOfStockCount = 0;

        if (stocksResult.success && stocksResult.stocks) {
          stocksResult.stocks.forEach(stock => {
            const currentStock = getComputedStock(stock);
            const minStock = stock.minStock || 5;
            const product = productsMap[stock.productId];
            const unitCost = stock.unitCost || product?.unitCost || 0;

            branchValue += currentStock * unitCost;
            branchQuantity += currentStock;

            if (currentStock === 0) outOfStockCount++;
            else if (currentStock <= minStock) lowStockCount++;
          });
        }

        reportItems.push({
          branchName: branch.name,
          totalItems: stocksResult.success ? stocksResult.stocks.length : 0,
          totalQuantity: branchQuantity,
          totalValue: branchValue,
          lowStockCount,
          outOfStockCount,
          averageValuePerItem: stocksResult.success && stocksResult.stocks.length > 0 ? branchValue / stocksResult.stocks.length : 0
        });
      }

      reportItems.sort((a, b) => b.totalValue - a.totalValue);

      setReportData({
        type: 'Branch Comparison',
        generatedAt: new Date(),
        dateRange,
        items: reportItems,
        summary: {
          totalBranches: reportItems.length,
          totalInventoryValue: reportItems.reduce((sum, i) => sum + i.totalValue, 0),
          totalQuantity: reportItems.reduce((sum, i) => sum + i.totalQuantity, 0),
          highestValueBranch: reportItems[0]?.branchName || '-'
        }
      });
    } catch (err) {
      console.error('Error generating report:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateExpiryReport = async () => {
    setLoading(true);
    try {
      const today = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const batchesQuery = query(
        collection(db, 'product_batches'),
        where('expiryDate', '<=', thirtyDaysFromNow),
        where('expiryDate', '>=', today),
        orderBy('expiryDate', 'asc')
      );

      const batchesSnapshot = await getDocs(batchesQuery);
      let reportItems = [];

      batchesSnapshot.forEach(doc => {
        const batch = doc.data();
        if (selectedBranch !== 'all' && batch.branchId !== selectedBranch) return;

        const branch = branches.find(b => b.id === batch.branchId);
        const daysUntilExpiry = Math.ceil((batch.expiryDate.toDate() - today) / (1000 * 60 * 60 * 24));

        reportItems.push({
          branchName: branch?.name || 'Unknown',
          productName: batch.productName,
          batchNumber: batch.batchNumber,
          quantity: batch.remainingQuantity || batch.quantity || 0,
          expiryDate: batch.expiryDate.toDate(),
          daysUntilExpiry,
          status: daysUntilExpiry <= 7 ? 'CRITICAL' : daysUntilExpiry <= 14 ? 'WARNING' : 'MONITOR',
          unitCost: batch.unitCost || 0
        });
      });

      reportItems.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

      setReportData({
        type: 'Expiry Tracker',
        generatedAt: new Date(),
        dateRange,
        items: reportItems,
        summary: {
          totalExpiringItems: reportItems.length,
          criticalCount: reportItems.filter(i => i.status === 'CRITICAL').length,
          warningCount: reportItems.filter(i => i.status === 'WARNING').length,
          monitorCount: reportItems.filter(i => i.status === 'MONITOR').length
        }
      });
    } catch (err) {
      console.error('Error generating report:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateStockAdjustmentReport = async () => {
    setLoading(true);
    try {
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999);

      const adjustmentsQuery = query(
        collection(db, 'stockAdjustments'),
        where('createdAt', '>=', startDate),
        where('createdAt', '<=', endDate),
        orderBy('createdAt', 'desc')
      );

      const adjustmentsSnapshot = await getDocs(adjustmentsQuery);
      let reportItems = [];
      let totalIncreases = 0;
      let totalDecreases = 0;

      adjustmentsSnapshot.forEach(doc => {
        const adj = doc.data();
        if (selectedBranch !== 'all' && adj.branchId !== selectedBranch) return;

        const branch = branches.find(b => b.id === adj.branchId);
        const adjustment = adj.adjustmentQuantity || 0;

        if (adjustment > 0) totalIncreases += adjustment;
        else totalDecreases += Math.abs(adjustment);

        reportItems.push({
          branchName: branch?.name || 'Unknown',
          productName: adj.productName || 'Unknown',
          adjustmentDate: adj.createdAt.toDate(),
          adjustment,
          reason: adj.reason || '-',
          adjustedBy: adj.adjustedByName || adj.adjustedBy || 'Unknown',
          usageType: adj.usageType || 'Manual',
          previousStock: adj.previousStock || 0,
          newStock: adj.newStock || 0
        });
      });

      setReportData({
        type: 'Stock Adjustments',
        generatedAt: new Date(),
        dateRange,
        items: reportItems,
        summary: {
          totalAdjustments: reportItems.length,
          totalIncreases,
          totalDecreases,
          netChange: totalIncreases - totalDecreases
        }
      });
    } catch (err) {
      console.error('Error generating report:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = (type) => {
    switch (type) {
      case 'stock-valuation':
        generateStockValuationReport();
        break;
      case 'low-stock':
        generateLowStockReport();
        break;
      case 'product-sales':
        generateProductSalesReport();
        break;
      case 'branch-comparison':
        generateBranchComparisonReport();
        break;
      case 'expiry':
        generateExpiryReport();
        break;
      case 'adjustments':
        generateStockAdjustmentReport();
        break;
      default:
        break;
    }
    setReportType(type);
  };

  if (reportData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{reportData.type} Report</h1>
            <p className="text-gray-600">Generated on {format(reportData.generatedAt, 'PPpp')}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setReportData(null)}>
              Back
            </Button>
            <Button onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        <div ref={printRef} className="space-y-6">
          <ReportContent reportData={reportData} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Overall Inventory Reports</h1>
          <p className="text-gray-600">Generate comprehensive inventory reports</p>
        </div>
      </div>

      <Card className="p-4 bg-blue-50 border border-blue-200">
        <div className="flex gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="border rounded px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="border rounded px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="border rounded px-3 py-2 text-sm"
            >
              <option value="all">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ReportCard
          icon={<Banknote className="w-6 h-6" />}
          title="Stock Valuation"
          description="Complete inventory value breakdown by branch and product"
          onClick={() => handleGenerateReport('stock-valuation')}
          loading={loading && reportType === 'stock-valuation'}
        />
        <ReportCard
          icon={<AlertTriangle className="w-6 h-6" />}
          title="Low Stock Alert"
          description="Products below minimum stock levels"
          onClick={() => handleGenerateReport('low-stock')}
          loading={loading && reportType === 'low-stock'}
        />
        <ReportCard
          icon={<ShoppingCart className="w-6 h-6" />}
          title="Product Sales"
          description="Sales volume and revenue by product"
          onClick={() => handleGenerateReport('product-sales')}
          loading={loading && reportType === 'product-sales'}
        />
        <ReportCard
          icon={<Building className="w-6 h-6" />}
          title="Branch Comparison"
          description="Inventory metrics across all branches"
          onClick={() => handleGenerateReport('branch-comparison')}
          loading={loading && reportType === 'branch-comparison'}
        />
        <ReportCard
          icon={<Calendar className="w-6 h-6" />}
          title="Expiry Tracker"
          description="Products expiring within 30 days"
          onClick={() => handleGenerateReport('expiry')}
          loading={loading && reportType === 'expiry'}
        />
        <ReportCard
          icon={<Activity className="w-6 h-6" />}
          title="Stock Adjustments"
          description="Manual stock adjustments and corrections"
          onClick={() => handleGenerateReport('adjustments')}
          loading={loading && reportType === 'adjustments'}
        />
      </div>
    </div>
  );
};

const ReportCard = ({ icon, title, description, onClick, loading }) => (
  <Card
    className="p-4 hover:shadow-lg transition-shadow cursor-pointer"
    onClick={onClick}
  >
    <div className="flex items-start gap-3">
      <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-600">{description}</p>
        {loading && <p className="text-xs text-blue-600 mt-2">Generating...</p>}
      </div>
    </div>
  </Card>
);

const ReportContent = ({ reportData }) => {
  const { type, items, summary, dateRange } = reportData;

  return (
    <Card className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-2">{type} Report</h2>
        <p className="text-sm text-gray-600">
          Period: {format(new Date(dateRange.start), 'MMM dd, yyyy')} to {format(new Date(dateRange.end), 'MMM dd, yyyy')}
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {Object.entries(summary).map(([key, value]) => (
          <div key={key} className="bg-gray-50 p-3 rounded-lg">
            <p className="text-xs text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
            <p className="text-lg font-bold text-gray-900">
              {typeof value === 'number' && value > 100 ? `₱${value.toLocaleString()}` : value}
            </p>
          </div>
        ))}
      </div>

      {/* Items Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {items.length > 0 && Object.keys(items[0]).map(key => (
                <th key={key} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {key.replace(/([A-Z])/g, ' $1')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map((item, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                {Object.values(item).map((value, i) => (
                  <td key={i} className="px-4 py-3 text-sm text-gray-900">
                    {value instanceof Date ? format(value, 'MMM dd, yyyy') : 
                     typeof value === 'number' ? value.toLocaleString() : 
                     value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default Reports;
