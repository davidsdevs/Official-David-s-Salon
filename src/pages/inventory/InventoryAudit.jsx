// src/pages/06_InventoryController/InventoryAudit.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import InventoryLayout from '../../layouts/InventoryLayout';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SearchInput } from '../../components/ui/SearchInput';
import Modal from '../../components/ui/Modal';
import {
  ClipboardList,
  Search,
  Filter,
  Eye,
  Edit,
  Plus,
  Download,
  Upload,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  Calendar,
  Building,
  FileText,
  Bell,
  AlertCircle,
  TrendingDown,
  ShoppingCart,
  ArrowRight,
  Copy,
  Printer,
  Trash2,
  Clock3,
  CalendarDays,
  AlertCircle as AlertCircleIcon,
  Calculator,
  BarChart3,
  Users,
  CheckSquare,
  Square
} from 'lucide-react';
import { format } from 'date-fns';

const InventoryAudit = () => {
  const { userData } = useAuth();
  
  // Data states
  const [audits, setAudits] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // UI states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [sortBy, setSortBy] = useState('auditDate');
  const [sortOrder, setSortOrder] = useState('desc');
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCountingModalOpen, setIsCountingModalOpen] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState({
    status: 'all',
    branch: 'all',
    auditor: 'all',
    dateRange: { start: '', end: '' }
  });

  // Mock audit data
  const mockAudits = [
    {
      id: 'AUDIT-001',
      auditDate: new Date('2024-01-15'),
      branchId: 'branch1',
      branchName: 'Harbor Point Ayala',
      auditor: 'John Smith',
      status: 'Completed',
      totalItems: 45,
      countedItems: 45,
      discrepancies: 3,
      accuracy: 93.3,
      totalValue: 125000,
      discrepancyValue: 5000,
      notes: 'Minor discrepancies found in hair care products',
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-15'),
      items: [
        {
          productId: 'prod1',
          productName: 'Olaplex No.3 Hair Perfector',
          expectedQty: 15,
          actualQty: 14,
          discrepancy: -1,
          unitCost: 1400,
          discrepancyValue: -1400,
          status: 'Discrepancy'
        },
        {
          productId: 'prod2',
          productName: 'L\'Oréal Hair Color',
          expectedQty: 8,
          actualQty: 8,
          discrepancy: 0,
          unitCost: 800,
          discrepancyValue: 0,
          status: 'Match'
        }
      ]
    },
    {
      id: 'AUDIT-002',
      auditDate: new Date('2024-01-10'),
      branchId: 'branch2',
      branchName: 'SM Mall of Asia',
      auditor: 'Maria Santos',
      status: 'In Progress',
      totalItems: 32,
      countedItems: 28,
      discrepancies: 0,
      accuracy: 0,
      totalValue: 89000,
      discrepancyValue: 0,
      notes: 'Audit in progress, counting remaining items',
      createdAt: new Date('2024-01-10'),
      updatedAt: new Date('2024-01-12'),
      items: []
    },
    {
      id: 'AUDIT-003',
      auditDate: new Date('2024-01-05'),
      branchId: 'branch3',
      branchName: 'Greenbelt 5',
      auditor: 'Carlos Mendoza',
      status: 'Scheduled',
      totalItems: 28,
      countedItems: 0,
      discrepancies: 0,
      accuracy: 0,
      totalValue: 65000,
      discrepancyValue: 0,
      notes: 'Scheduled for next week',
      createdAt: new Date('2024-01-05'),
      updatedAt: new Date('2024-01-05'),
      items: []
    }
  ];

  // Mock products for counting
  const mockProducts = [
    { id: 'prod1', name: 'Olaplex No.3 Hair Perfector', category: 'Hair Care', expectedQty: 15 },
    { id: 'prod2', name: 'L\'Oréal Hair Color', category: 'Hair Color', expectedQty: 8 },
    { id: 'prod3', name: 'Kerastase Shampoo', category: 'Hair Care', expectedQty: 12 },
    { id: 'prod4', name: 'Wella Hair Color', category: 'Hair Color', expectedQty: 5 }
  ];

  // Load audits
  const loadAudits = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // For now, use mock data
      setAudits(mockAudits);
      setProducts(mockProducts);
      
    } catch (err) {
      console.error('Error loading audits:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load audits on mount
  useEffect(() => {
    loadAudits();
  }, []);

  // Get unique branches
  const branches = [...new Set(audits.map(a => a.branchName))].filter(Boolean);
  const auditors = [...new Set(audits.map(a => a.auditor))].filter(Boolean);

  // Filter and sort audits
  const filteredAudits = audits
    .filter(audit => {
      const matchesSearch = audit.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           audit.branchName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           audit.auditor.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = filters.status === 'all' || audit.status === filters.status;
      const matchesBranch = filters.branch === 'all' || audit.branchName === filters.branch;
      const matchesAuditor = filters.auditor === 'all' || audit.auditor === filters.auditor;
      
      const matchesDateRange = (!filters.dateRange.start || new Date(audit.auditDate) >= new Date(filters.dateRange.start)) &&
                              (!filters.dateRange.end || new Date(audit.auditDate) <= new Date(filters.dateRange.end));
      
      return matchesSearch && matchesStatus && matchesBranch && matchesAuditor && matchesDateRange;
    })
    .sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (sortBy === 'auditDate' || sortBy === 'createdAt' || sortBy === 'updatedAt') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  // Handle audit details
  const handleViewDetails = (audit) => {
    setSelectedAudit(audit);
    setIsDetailsModalOpen(true);
  };

  // Handle create audit
  const handleCreateAudit = () => {
    setIsCreateModalOpen(true);
  };

  // Handle start counting
  const handleStartCounting = (audit) => {
    setSelectedAudit(audit);
    setIsCountingModalOpen(true);
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    // Handle form submission logic here
    console.log('Form submitted');
    setIsCreateModalOpen(false);
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed': return 'text-green-600 bg-green-100';
      case 'In Progress': return 'text-blue-600 bg-blue-100';
      case 'Scheduled': return 'text-yellow-600 bg-yellow-100';
      case 'Cancelled': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'Completed': return <CheckCircle className="h-4 w-4" />;
      case 'In Progress': return <Clock className="h-4 w-4" />;
      case 'Scheduled': return <Calendar className="h-4 w-4" />;
      case 'Cancelled': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  // Calculate audit statistics
  const auditStats = {
    totalAudits: audits.length,
    completedAudits: audits.filter(a => a.status === 'Completed').length,
    inProgressAudits: audits.filter(a => a.status === 'In Progress').length,
    scheduledAudits: audits.filter(a => a.status === 'Scheduled').length,
    totalItems: audits.reduce((sum, a) => sum + a.totalItems, 0),
    totalDiscrepancies: audits.reduce((sum, a) => sum + a.discrepancies, 0),
    averageAccuracy: audits.filter(a => a.status === 'Completed').reduce((sum, a) => sum + a.accuracy, 0) / audits.filter(a => a.status === 'Completed').length || 0
  };

  if (loading) {
    return (
      <>>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading audit data...</span>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Audit Data</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={loadAudits} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inventory Audit</h1>
            <p className="text-gray-600">Conduct stock counts and reconcile inventory discrepancies</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Import
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button onClick={handleCreateAudit} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Audit
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <Card className="p-4">
            <div className="flex items-center">
              <ClipboardList className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Total Audits</p>
                <p className="text-xl font-bold text-gray-900">{auditStats.totalAudits}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-xl font-bold text-gray-900">{auditStats.completedAudits}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">In Progress</p>
                <p className="text-xl font-bold text-gray-900">{auditStats.inProgressAudits}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-yellow-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Scheduled</p>
                <p className="text-xl font-bold text-gray-900">{auditStats.scheduledAudits}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center">
              <Package className="h-8 w-8 text-purple-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Total Items</p>
                <p className="text-xl font-bold text-gray-900">{auditStats.totalItems}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-orange-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Avg Accuracy</p>
                <p className="text-xl font-bold text-gray-900">{auditStats.averageAccuracy.toFixed(1)}%</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <SearchInput
                placeholder="Search by audit ID, branch, or auditor..."
                value={searchTerm}
                onChange={setSearchTerm}
                className="w-full"
              />
            </div>
            <div className="flex gap-3">
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="Completed">Completed</option>
                <option value="In Progress">In Progress</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Cancelled">Cancelled</option>
              </select>
              <select
                value={filters.branch}
                onChange={(e) => setFilters(prev => ({ ...prev, branch: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Branches</option>
                {branches.map(branch => (
                  <option key={branch} value={branch}>{branch}</option>
                ))}
              </select>
              <Button
                variant="outline"
                onClick={() => setIsFilterModalOpen(true)}
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                More Filters
              </Button>
              <Button
                variant="outline"
                onClick={() => setFilters({
                  status: 'all',
                  branch: 'all',
                  auditor: 'all',
                  dateRange: { start: '', end: '' }
                })}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>
        </Card>

        {/* Audits Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Audit ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Branch
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Auditor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Audit Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Accuracy
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAudits.map((audit) => (
                  <tr key={audit.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{audit.id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{audit.branchName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{audit.auditor}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{format(new Date(audit.auditDate), 'MMM dd, yyyy')}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(audit.status)}`}>
                        {getStatusIcon(audit.status)}
                        {audit.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{audit.countedItems}/{audit.totalItems}</div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${(audit.countedItems / audit.totalItems) * 100}%` }}
                        ></div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {audit.status === 'Completed' ? `${audit.accuracy}%` : '-'}
                      </div>
                      {audit.discrepancies > 0 && (
                        <div className="text-xs text-red-600">{audit.discrepancies} discrepancies</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(audit)}
                          className="flex items-center gap-1"
                        >
                          <Eye className="h-3 w-3" />
                          View
                        </Button>
                        {audit.status === 'Scheduled' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStartCounting(audit)}
                            className="flex items-center gap-1"
                          >
                            <CheckSquare className="h-3 w-3" />
                            Start
                          </Button>
                        )}
                        {audit.status === 'In Progress' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStartCounting(audit)}
                            className="flex items-center gap-1"
                          >
                            <Clock className="h-3 w-3" />
                            Continue
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Empty State */}
        {filteredAudits.length === 0 && (
          <Card className="p-12 text-center">
            <ClipboardList className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Audits Found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || Object.values(filters).some(f => f !== 'all' && f !== '')
                ? 'Try adjusting your search or filters'
                : 'Get started by creating your first inventory audit'
              }
            </p>
            <Button onClick={handleCreateAudit} className="flex items-center gap-2 mx-auto">
              <Plus className="h-4 w-4" />
              New Audit
            </Button>
          </Card>
        )}

        {/* Audit Details Modal */}
        {isDetailsModalOpen && selectedAudit && (
          <Modal
            isOpen={isDetailsModalOpen}
            onClose={() => {
              setIsDetailsModalOpen(false);
              setSelectedAudit(null);
            }}
            title="Audit Details"
            size="lg"
          >
            <div className="space-y-6">
              {/* Audit Header */}
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedAudit.id}</h2>
                  <p className="text-gray-600">{selectedAudit.branchName}</p>
                </div>
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedAudit.status)}`}>
                  {getStatusIcon(selectedAudit.status)}
                  {selectedAudit.status}
                </span>
              </div>

              {/* Audit Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Audit Date</label>
                    <p className="text-gray-900">{format(new Date(selectedAudit.auditDate), 'MMM dd, yyyy')}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Auditor</label>
                    <p className="text-gray-900">{selectedAudit.auditor}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Total Items</label>
                    <p className="text-gray-900">{selectedAudit.totalItems}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Counted Items</label>
                    <p className="text-gray-900">{selectedAudit.countedItems}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Discrepancies</label>
                    <p className="text-gray-900">{selectedAudit.discrepancies}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Accuracy</label>
                    <p className="text-gray-900">{selectedAudit.accuracy}%</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Total Value</label>
                    <p className="text-gray-900">₱{selectedAudit.totalValue.toLocaleString()}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Discrepancy Value</label>
                    <p className="text-gray-900">₱{selectedAudit.discrepancyValue.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div>
                <label className="text-sm font-medium text-gray-500">Progress</label>
                <div className="w-full bg-gray-200 rounded-full h-3 mt-2">
                  <div 
                    className="bg-blue-600 h-3 rounded-full" 
                    style={{ width: `${(selectedAudit.countedItems / selectedAudit.totalItems) * 100}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0</span>
                  <span>{selectedAudit.countedItems}/{selectedAudit.totalItems}</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Audit Items */}
              {selectedAudit.items && selectedAudit.items.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-4">Audit Items</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Expected</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actual</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Difference</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedAudit.items.map((item, index) => (
                          <tr key={index}>
                            <td className="px-4 py-2 text-sm text-gray-900">{item.productName}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{item.expectedQty}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{item.actualQty}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{item.discrepancy}</td>
                            <td className="px-4 py-2 text-sm">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                item.status === 'Match' ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'
                              }`}>
                                {item.status === 'Match' ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                {item.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-sm font-medium text-gray-500">Notes</label>
                <p className="text-gray-900 bg-gray-50 p-3 rounded-lg mt-1">{selectedAudit.notes}</p>
              </div>
            </div>
          </Modal>
        )}

        {/* Create Audit Modal */}
        {isCreateModalOpen && (
          <Modal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            title="Create New Audit"
            size="md"
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Branch *</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required>
                  <option value="">Select Branch</option>
                  {branches.map(branch => (
                    <option key={branch} value={branch}>{branch}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Audit Date *</label>
                <Input
                  type="date"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Auditor *</label>
                <Input
                  type="text"
                  placeholder="Enter auditor name"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows="3"
                  placeholder="Additional notes..."
                ></textarea>
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Create Audit
                </Button>
              </div>
            </form>
          </Modal>
        )}

        {/* Counting Modal */}
        {isCountingModalOpen && selectedAudit && (
          <Modal
            isOpen={isCountingModalOpen}
            onClose={() => {
              setIsCountingModalOpen(false);
              setSelectedAudit(null);
            }}
            title="Stock Counting"
            size="xl"
          >
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Count Items for {selectedAudit.id}</h3>
                <div className="text-sm text-gray-500">
                  {selectedAudit.countedItems}/{selectedAudit.totalItems} items counted
                </div>
              </div>

              <div className="space-y-4">
                {products.map((product) => (
                  <div key={product.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{product.name}</div>
                      <div className="text-sm text-gray-500">{product.category}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-gray-500">Expected: {product.expectedQty}</div>
                      <Input
                        type="number"
                        placeholder="Actual"
                        className="w-20"
                      />
                      <Button variant="outline" size="sm">
                        <CheckSquare className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsCountingModalOpen(false)}>
                  Cancel
                </Button>
                <Button>
                  Save Count
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Advanced Filters Modal */}
        {isFilterModalOpen && (
          <Modal
            isOpen={isFilterModalOpen}
            onClose={() => setIsFilterModalOpen(false)}
            title="Advanced Filters"
            size="md"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Auditor</label>
                <select
                  value={filters.auditor}
                  onChange={(e) => setFilters(prev => ({ ...prev, auditor: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Auditors</option>
                  {auditors.map(auditor => (
                    <option key={auditor} value={auditor}>{auditor}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="date"
                    placeholder="Start Date"
                    value={filters.dateRange.start}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      dateRange: { ...prev.dateRange, start: e.target.value }
                    }))}
                  />
                  <Input
                    type="date"
                    placeholder="End Date"
                    value={filters.dateRange.end}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      dateRange: { ...prev.dateRange, end: e.target.value }
                    }))}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setFilters({
                  status: 'all',
                  branch: 'all',
                  auditor: 'all',
                  dateRange: { start: '', end: '' }
                })}>
                  Reset
                </Button>
                <Button onClick={() => setIsFilterModalOpen(false)}>
                  Apply Filters
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </>
  );
};

export default InventoryAudit;
