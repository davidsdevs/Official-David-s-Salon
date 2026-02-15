/**
 * Branches Management Page - Operational Manager
 * For Operational Manager to manage all branches
 */

import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, MapPin, Phone, Mail, User, Power, Edit, Eye, TrendingUp, Filter, Download, Printer, RefreshCw } from 'lucide-react';
import { getAllBranches, toggleBranchStatus, getBranchStats } from '../../services/branchService';
import { useAuth } from '../../context/AuthContext';
import { getFullName } from '../../utils/helpers';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import BranchFormModal from '../../components/branch/BranchFormModal';
import BranchDetailsModal from '../../components/branch/BranchDetailsModal';
import toast from 'react-hot-toast';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';

const OperationalManagerBranches = () => {
  const { currentUser } = useAuth();
  const [branches, setBranches] = useState([]);
  const [filteredBranches, setFilteredBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive'
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [branchStats, setBranchStats] = useState({});
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [viewBranch, setViewBranch] = useState(null);

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [branches, searchTerm, statusFilter]);

  const fetchBranches = async () => {
    try {
      setLoading(true);
      console.log('[Branches] Fetching all branches...');
      const data = await getAllBranches();
      console.log('[Branches] Fetched branches:', data.length, data);
      setBranches(data);
      
      // Fetch stats for each branch including revenue
      const stats = {};
      for (const branch of data) {
        const branchStat = await getBranchStats(branch.id);
        const yearlyRevenue = await fetchBranchYearlyRevenue(branch.id);
        stats[branch.id] = {
          ...branchStat,
          yearlyRevenue
        };
      }
      setBranchStats(stats);
    } catch (error) {
      console.error('Error fetching branches:', error);
      toast.error('Failed to load branches');
    } finally {
      setLoading(false);
    }
  };

  const fetchBranchYearlyRevenue = async (branchId) => {
    try {
      const currentYear = new Date().getFullYear();
      const yearStart = new Date(currentYear, 0, 1);
      const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59);

      const transactionsRef = collection(db, 'transactions');
      const q = query(
        transactionsRef,
        where('branchId', '==', branchId),
        where('createdAt', '>=', Timestamp.fromDate(yearStart)),
        where('createdAt', '<=', Timestamp.fromDate(yearEnd))
      );

      const snapshot = await getDocs(q);
      let totalRevenue = 0;
      let countedTransactions = 0;

      snapshot.forEach(doc => {
        const transaction = doc.data();
        // Count transactions that are completed or paid (exclude voided, refunded, cancelled)
        const status = (transaction.status || '').toLowerCase();
        if (status === 'completed' || status === 'paid' || status === 'in_service') {
          const amount = transaction.total || transaction.totalAmount || 0;
          totalRevenue += amount;
          countedTransactions++;
        }
      });

      console.log(`📊 Branch ${branchId} yearly revenue: ₱${totalRevenue} (${countedTransactions}/${snapshot.size} transactions counted)`);
      return totalRevenue;
    } catch (error) {
      console.error('Error fetching yearly revenue for branch', branchId, ':', error);
      return 0;
    }
  };

  const applyFilters = () => {
    let filtered = [...branches];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(branch =>
        (branch.name || branch.branchName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        branch.address.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(branch => {
        if (statusFilter === 'active') return branch.isActive === true;
        if (statusFilter === 'inactive') return branch.isActive === false;
        return true;
      });
    }

    setFilteredBranches(filtered);
  };

  const handleAddBranch = () => {
    setSelectedBranch(null);
    setShowFormModal(true);
  };

  const handleEditBranch = (branch) => {
    setSelectedBranch(branch);
    setShowFormModal(true);
  };

  const handleViewBranch = (branch) => {
    setViewBranch(branch);
    setShowDetailsModal(true);
  };

  const handleToggleStatus = async (branchId, currentIsActive) => {
    try {
      setToggling(branchId);
      const newStatus = !currentIsActive; // Toggle boolean
      await toggleBranchStatus(branchId, newStatus, currentUser);
      await fetchBranches();
    } catch (error) {
      // Error handled in service
    } finally {
      setToggling(null);
    }
  };

  const handleFormSave = () => {
    fetchBranches();
  };

  const handlePrint = () => {
    if (filteredBranches.length === 0) {
      toast.error('No branches to print');
      return;
    }

    // Build filters display
    const activeFilters = [];
    if (searchTerm) activeFilters.push(`Search: "${searchTerm}"`);
    if (statusFilter !== 'all') activeFilters.push(`Status: ${statusFilter === 'active' ? 'Active' : 'Inactive'}`);
    const filtersText = activeFilters.length > 0 ? activeFilters.join(' | ') : 'All Branches';

    const printWindow = window.open('', '', 'height=600,width=800');
    
    let htmlContent = `
      <html>
        <head>
          <title>Branch Management Report</title>
          <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>
            @media print {
              @page {
                size: A4 portrait;
                margin: 0.4in 0.4in 0.75in 0.4in;
              }
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
              font-family: 'Poppins', Arial, sans-serif;
            }
            body {
              font-family: 'Poppins', Arial, sans-serif;
              padding: 0;
              color: #000;
              font-size: 9px;
            }
            .header {
              text-align: center;
              margin-bottom: 15px;
              padding-bottom: 10px;
              border-bottom: 2px solid #333;
            }
            .header h1 {
              font-size: 14px;
              font-weight: 600;
              margin: 0 0 5px 0;
            }
            .header h2 {
              font-size: 18px;
              font-weight: 700;
              margin: 0;
            }
            .filters {
              background: #fff;
              padding: 10px;
              border: 2px solid #333;
              margin: 10px 0 15px 0;
              text-align: center;
            }
            .filters-title {
              font-size: 10px;
              font-weight: 700;
              margin-bottom: 5px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .filters-content {
              font-size: 9px;
              font-weight: 600;
            }
            .summary-stats {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
              margin: 15px 0;
            }
            .stat-box {
              text-align: center;
              padding: 10px;
              background: #fff;
              border: 1px solid #333;
            }
            .stat-value {
              font-size: 16px;
              font-weight: 700;
              color: #000;
              margin-bottom: 3px;
            }
            .stat-label {
              font-size: 9px;
              color: #000;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              font-weight: 600;
            }
            .branch-card {
              border: 1px solid #333;
              margin-bottom: 10px;
              background: #fff;
              page-break-inside: avoid;
            }
            .branch-header {
              background: #fff;
              padding: 8px 12px;
              border-bottom: 1px solid #333;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .branch-name {
              font-size: 11px;
              font-weight: 700;
            }
            .status-badge {
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 8px;
              font-weight: 600;
              text-transform: uppercase;
              border: 1px solid #333;
              background: #fff;
              color: #000;
            }
            .branch-body {
              padding: 10px 12px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 8px;
              margin-bottom: 8px;
            }
            .info-row {
              padding: 4px 0;
              border-bottom: 1px dotted #ddd;
              font-size: 9px;
            }
            .info-label {
              font-weight: 600;
              display: inline-block;
              width: 80px;
            }
            .info-value {
              color: #333;
            }
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 8px;
              margin-top: 8px;
              padding-top: 8px;
              border-top: 1px solid #ddd;
            }
            .stat-item {
              text-align: center;
              padding: 6px;
              border: 1px solid #ddd;
            }
            .stat-item-value {
              font-size: 11px;
              font-weight: 700;
              color: #000;
            }
            .stat-item-label {
              font-size: 7px;
              color: #666;
              text-transform: uppercase;
            }
            .footer {
              position: fixed;
              bottom: 0;
              left: 0;
              right: 0;
              padding: 10px 0.4in;
              border-top: 2px solid #333;
              font-size: 8px;
              background: #fff;
            }
            .footer-content {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }
            .footer-left, .footer-right {
              flex: 1;
            }
            .footer-left {
              text-align: left;
            }
            .footer-right {
              text-align: right;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>DAVID'S SALON</h1>
            <h2>Branch Management Report</h2>
          </div>
          
          <div class="filters">
            <div class="filters-title">FILTERS APPLIED</div>
            <div class="filters-content">${filtersText}</div>
          </div>

          <div class="summary-stats">
            <div class="stat-box">
              <div class="stat-value">${totalBranches}</div>
              <div class="stat-label">Total Branches</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${activeBranches}</div>
              <div class="stat-label">Active</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${totalStaff}</div>
              <div class="stat-label">Total Staff</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">₱${totalYearlyRevenue.toLocaleString()}</div>
              <div class="stat-label">Yearly Revenue</div>
            </div>
          </div>
    `;

    filteredBranches.forEach(branch => {
      const stats = branchStats[branch.id] || {};
      htmlContent += `
        <div class="branch-card">
          <div class="branch-header">
            <div class="branch-name">${branch.name || branch.branchName}</div>
            <span class="status-badge">${branch.isActive === true ? 'Active' : 'Inactive'}</span>
          </div>
          
          <div class="branch-body">
            <div class="info-grid">
              <div class="info-row">
                <span class="info-label">Address:</span>
                <span class="info-value">${branch.address || 'N/A'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Contact:</span>
                <span class="info-value">${branch.contact || 'N/A'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Email:</span>
                <span class="info-value">${branch.email || 'N/A'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Manager:</span>
                <span class="info-value">${branch.managerName || 'N/A'}</span>
              </div>
            </div>
            
            <div class="stats-grid">
              <div class="stat-item">
                <div class="stat-item-value">${stats.staffCount || 0}</div>
                <div class="stat-item-label">Staff</div>
              </div>
              <div class="stat-item">
                <div class="stat-item-value">${stats.appointmentsCount || 0}</div>
                <div class="stat-item-label">Appointments</div>
              </div>
              <div class="stat-item">
                <div class="stat-item-value">₱${(stats.yearlyRevenue || 0).toLocaleString()}</div>
                <div class="stat-item-label">Yearly Revenue</div>
              </div>
            </div>
          </div>
        </div>
      `;
    });

    htmlContent += `
          <div class="footer">
            <div class="footer-content">
              <div class="footer-left">
                <strong>Generated By:</strong> Operational Manager<br>
                <strong>Position:</strong> Operational Manager<br>
                <strong>Branch:</strong> All Branches
              </div>
              <div class="footer-right">
                <strong>Generated On:</strong> ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}<br>
                <strong>Time:</strong> ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Calculate overall stats
  const totalBranches = branches.length;
  const activeBranches = branches.filter(b => b.isActive === true).length;
  const inactiveBranches = branches.filter(b => b.isActive === false).length;
  const totalStaff = Object.values(branchStats).reduce((sum, stat) => sum + (stat?.staffCount || 0), 0);
  const totalYearlyRevenue = Object.values(branchStats).reduce((sum, stat) => sum + (stat?.yearlyRevenue || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Branch Management</h1>
          <p className="text-gray-600">Manage and monitor all salon branches</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Branches</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalBranches}</p>
            </div>
            <div className="p-3 bg-primary-100 rounded-lg">
              <MapPin className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Branches</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{activeBranches}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Staff</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{totalStaff}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <User className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Yearly Revenue</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">₱{totalYearlyRevenue.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Row */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
        <div className="flex items-center gap-3">
          {/* Search Bar */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search branches..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            />
          </div>

          {/* Filter Button */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm bg-white"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          {/* Icon-only buttons */}
          <button
            onClick={handleAddBranch}
            className="p-2.5 text-primary-600 hover:text-primary-900 hover:bg-primary-100 rounded transition-colors"
            title="Add Branch"
          >
            <Plus className="w-5 h-5" />
          </button>
          
          <button
            onClick={handlePrint}
            className="p-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
            title="Print Report"
          >
            <Printer className="w-5 h-5" />
          </button>
          
          <button
            onClick={fetchBranches}
            disabled={loading}
            className="p-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
            title="Refresh Branches"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Branches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBranches.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white rounded-lg shadow border border-gray-200">
            <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">No branches found</p>
          </div>
        ) : (
          filteredBranches.map((branch) => (
            <div key={branch.id} className="bg-white rounded-lg shadow border border-gray-200 p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {branch.name || branch.branchName}
                  </h3>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    branch.isActive === true 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {branch.isActive === true ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2 mb-4">
                <div className="flex items-start gap-2 text-sm text-gray-600">
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span className="line-clamp-2">{branch.address}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone className="w-4 h-4" />
                  <span>{branch.contact}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="w-4 h-4" />
                  <span className="truncate">{branch.email}</span>
                </div>
              </div>

              {/* Stats */}
              {branchStats[branch.id] && (
                <div className="grid grid-cols-3 gap-2 mb-4 pt-4 border-t border-gray-200">
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Staff</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {branchStats[branch.id].staffCount || 0}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Appointments</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {branchStats[branch.id].appointmentsCount || 0}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Yearly Revenue</p>
                    <p className="text-lg font-semibold text-purple-600">
                      ₱{(branchStats[branch.id].yearlyRevenue || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}

              {/* Manager */}
              {branch.managerName && (
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-4 p-3 bg-gray-50 rounded-lg">
                  <User className="w-4 h-4" />
                  <div>
                    <p className="text-xs text-gray-500">Branch Manager</p>
                    <p className="font-medium text-gray-900">{branch.managerName}</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleViewBranch(branch)}
                    disabled={toggling === branch.id}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm border border-primary-300 text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Eye className="w-4 h-4" />
                    View
                  </button>
                  <button
                    onClick={() => handleEditBranch(branch)}
                    disabled={toggling === branch.id}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggleStatus(branch.id, branch.isActive)}
                    disabled={toggling === branch.id}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      branch.isActive === true
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {toggling === branch.id ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <Power className="w-4 h-4" />
                    )}
                    {toggling === branch.id ? 'Processing...' : (branch.isActive === true ? 'Deactivate' : 'Activate')}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Branch Form Modal */}
      {showFormModal && (
        <BranchFormModal
          branch={selectedBranch}
          onClose={() => setShowFormModal(false)}
          onSave={handleFormSave}
        />
      )}

      {/* Branch Details Modal */}
      {showDetailsModal && viewBranch && (
        <BranchDetailsModal
          branch={viewBranch}
          stats={branchStats[viewBranch.id]}
          onClose={() => setShowDetailsModal(false)}
        />
      )}
    </div>
  );
};

export default OperationalManagerBranches;
