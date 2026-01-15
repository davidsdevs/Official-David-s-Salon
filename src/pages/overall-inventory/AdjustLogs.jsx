// src/pages/overall-inventory/AdjustLogs.jsx
import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { getAllBranches } from '../../services/branchService';
import { db } from '../../config/firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import {
  ClipboardList,
  Eye,
  RefreshCw,
  Building,
  Printer,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Download
} from 'lucide-react';
import { format } from 'date-fns';

const AdjustLogs = () => {
  const [branches, setBranches] = useState([]);
  const [adjustLogs, setAdjustLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('7');
  const [branchFilter, setBranchFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const ITEMS_PER_PAGE = 15;

  // Load branches
  const loadBranches = async () => {
    try {
      const branchesData = await getAllBranches();
      setBranches(Array.isArray(branchesData) ? branchesData : []);
    } catch (err) {
      console.error('Error loading branches:', err);
      setBranches([]);
    }
  };

  // Load Adjust Logs from all branches
  const loadAdjustLogs = async () => {
    try {
      setLoading(true);
      
      let logsQuery = query(
        collection(db, 'stockAdjustments'),
        orderBy('createdAt', 'desc')
      );

      // Apply date filter
      if (dateFilter !== 'all') {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(dateFilter));
        logsQuery = query(
          collection(db, 'stockAdjustments'),
          where('createdAt', '>=', daysAgo),
          orderBy('createdAt', 'desc')
        );
      }

      const logsSnapshot = await getDocs(logsQuery);
      let logs = [];
      
      logsSnapshot.forEach((doc) => {
        const data = doc.data();
        logs.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt)
        });
      });

      // Apply branch filter client-side
      if (branchFilter !== 'all') {
        logs = logs.filter(log => log.branchId === branchFilter);
      }

      // Enrich with branch names
      const enrichedLogs = logs.map(log => {
        const branch = branches.find(b => b.id === log.branchId);
        return {
          ...log,
          branchName: branch?.name || 'Unknown Branch'
        };
      });

      setAdjustLogs(enrichedLogs);
      setCurrentPage(1);
    } catch (err) {
      console.error('Error loading adjust logs:', err);
      setAdjustLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    if (branches.length > 0) {
      loadAdjustLogs();
    }
  }, [branches, dateFilter, branchFilter]);

  // Pagination
  const totalPages = Math.ceil(adjustLogs.length / ITEMS_PER_PAGE);
  const paginatedLogs = adjustLogs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Summary stats
  const totalAdjustments = adjustLogs.length;
  const totalIncreases = adjustLogs.filter(log => (log.adjustmentQuantity || 0) > 0).length;
  const totalDecreases = adjustLogs.filter(log => (log.adjustmentQuantity || 0) < 0).length;

  // Print function
  const handlePrint = () => {
    const printWindow = window.open('', '', 'height=600,width=900');
    printWindow.document.write(`
      <html>
        <head>
          <title>Stock Adjustment Logs Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; font-size: 11px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f4f4f4; }
            h1 { font-size: 18px; margin-bottom: 10px; }
            .summary { margin-bottom: 20px; }
            .summary span { margin-right: 20px; }
            .increase { color: green; }
            .decrease { color: red; }
          </style>
        </head>
        <body>
          <h1>Stock Adjustment Logs Report</h1>
          <p>Generated: ${format(new Date(), 'PPpp')}</p>
          <div class="summary">
            <span><strong>Total Adjustments:</strong> ${totalAdjustments}</span>
            <span><strong>Increases:</strong> ${totalIncreases}</span>
            <span><strong>Decreases:</strong> ${totalDecreases}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Branch</th>
                <th>Product</th>
                <th>Type</th>
                <th>Previous</th>
                <th>Adjustment</th>
                <th>New Stock</th>
                <th>Reason</th>
                <th>Adjusted By</th>
              </tr>
            </thead>
            <tbody>
              ${adjustLogs.map(log => `
                <tr>
                  <td>${format(log.createdAt, 'MMM dd, yyyy HH:mm')}</td>
                  <td>${log.branchName}</td>
                  <td>${log.productName || 'N/A'}</td>
                  <td>${log.usageType || 'Manual'}</td>
                  <td>${log.previousStock || 0}</td>
                  <td class="${(log.adjustmentQuantity || 0) >= 0 ? 'increase' : 'decrease'}">
                    ${(log.adjustmentQuantity || 0) >= 0 ? '+' : ''}${log.adjustmentQuantity || 0}
                  </td>
                  <td>${log.newStock || 0}</td>
                  <td>${log.reason || '-'}</td>
                  <td>${log.adjustedByName || log.adjustedBy || 'Unknown'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Adjustment Logs</h1>
          <p className="text-gray-600">View all stock adjustments across branches</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadAdjustLogs} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ClipboardList className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Adjustments</p>
              <p className="text-xl font-bold">{totalAdjustments}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Stock Increases</p>
              <p className="text-xl font-bold text-green-600">{totalIncreases}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Stock Decreases</p>
              <p className="text-xl font-bold text-red-600">{totalDecreases}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">All Branches</option>
              {branches.map(branch => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Logs Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Adjustment</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">New Stock</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Adjusted By</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading adjustment logs...
                  </td>
                </tr>
              ) : paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                    No adjustment logs found
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {format(log.createdAt, 'MMM dd, yyyy')}
                      <br />
                      <span className="text-gray-500 text-xs">{format(log.createdAt, 'HH:mm')}</span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4 text-gray-400" />
                        {log.branchName}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {log.productName || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        log.usageType === 'otc' ? 'bg-blue-100 text-blue-700' :
                        log.usageType === 'salon-use' ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {log.usageType === 'otc' ? 'OTC' : 
                         log.usageType === 'salon-use' ? 'Salon Use' : 
                         'Manual'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      <span className={`${(log.adjustmentQuantity || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {(log.adjustmentQuantity || 0) >= 0 ? '+' : ''}{log.adjustmentQuantity || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">{log.newStock || 0}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {log.adjustedByName || log.adjustedBy || 'Unknown'}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedLog(log);
                          setIsDetailsModalOpen(true);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, adjustLogs.length)} of {adjustLogs.length}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="px-3 py-1 text-sm">Page {currentPage} of {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Log Details Modal */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title="Adjustment Details"
      >
        {selectedLog && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Date & Time</p>
                <p className="text-sm">{format(selectedLog.createdAt, 'PPpp')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Branch</p>
                <p className="text-sm">{selectedLog.branchName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Product</p>
                <p className="text-sm">{selectedLog.productName || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Batch Number</p>
                <p className="text-sm">{selectedLog.batchNumber || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Usage Type</p>
                <p className="text-sm capitalize">
                  {selectedLog.usageType === 'otc' ? 'Over The Counter (OTC)' : 
                   selectedLog.usageType === 'salon-use' ? 'Salon Use' : 
                   'Manual Adjustment'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Adjusted By</p>
                <p className="text-sm">{selectedLog.adjustedByName || selectedLog.adjustedBy || 'Unknown'}</p>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Stock Changes</p>
              <div className="grid grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg">
                <div className="text-center">
                  <p className="text-xs text-gray-500">Previous Stock</p>
                  <p className="text-lg font-bold">{selectedLog.previousStock || 0}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Adjustment</p>
                  <p className={`text-lg font-bold ${(selectedLog.adjustmentQuantity || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(selectedLog.adjustmentQuantity || 0) >= 0 ? '+' : ''}{selectedLog.adjustmentQuantity || 0}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">New Stock</p>
                  <p className="text-lg font-bold">{selectedLog.newStock || 0}</p>
                </div>
              </div>
            </div>

            {selectedLog.reason && (
              <div>
                <p className="text-sm text-gray-500">Reason</p>
                <p className="text-sm bg-gray-50 p-3 rounded-lg">{selectedLog.reason}</p>
              </div>
            )}

            {selectedLog.notes && (
              <div>
                <p className="text-sm text-gray-500">Notes</p>
                <p className="text-sm bg-gray-50 p-3 rounded-lg">{selectedLog.notes}</p>
              </div>
            )}

            <div className="flex justify-end pt-4">
              <Button variant="outline" onClick={() => setIsDetailsModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdjustLogs;
