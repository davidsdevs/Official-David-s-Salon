/**
 * Receptionist Clients Management Page
 * Module: M06 - CRM
 * Advanced CRM-style interface with filtering, sorting, and pagination for big data
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Eye, History, ChevronUp, ChevronDown, Download, Phone, Mail, User, UserCheck, Star, Receipt, Calendar, FileText, Printer } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getClients, getClientsByBranchWithTransactions, searchClients, getClientProfile, updateClientProfile } from '../../services/clientService';
import { getLoyaltyPoints, getLoyaltyHistory, getAllBranchLoyaltyPoints } from '../../services/loyaltyService';
import { getServiceHistory } from '../../services/clientService';
import { getReferralCode } from '../../services/referralService';
import { collection, query, where, orderBy, getDocs, limit as firestoreLimit } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Modal from '../../components/ui/Modal';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../utils/helpers';
import { format } from 'date-fns';

const ReceptionistClients = () => {
  const { currentUser, userBranch } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Search
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  
  // Sorting
  const [sortBy, setSortBy] = useState('firstName');
  const [sortOrder, setSortOrder] = useState('asc');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [visibleStartIndex, setVisibleStartIndex] = useState(0);
  const [visibleEndIndex, setVisibleEndIndex] = useState(50);
  
  // Modals
  const [selectedClient, setSelectedClient] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  const [clientProfile, setClientProfile] = useState(null);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [allBranchPoints, setAllBranchPoints] = useState([]);
  const [serviceHistory, setServiceHistory] = useState([]);
  const [loyaltyHistory, setLoyaltyHistory] = useState([]);
  const [clientTransactions, setClientTransactions] = useState([]);
  const [referralCode, setReferralCode] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileTab, setProfileTab] = useState('overview'); // 'overview', 'transactions', 'loyalty'
  
  // Transaction filters
  const [transactionDateFrom, setTransactionDateFrom] = useState('');
  const [transactionDateTo, setTransactionDateTo] = useState('');
  
  // Client stats cache
  const [clientStatsCache, setClientStatsCache] = useState({});

  useEffect(() => {
    fetchClients();
  }, []);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchClients = async () => {
    try {
      setLoading(true);
      // Only show clients that have transactions in this branch
      const data = await getClientsByBranchWithTransactions(userBranch);
      setClients(data);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast.error('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  // Fetch client stats (loyalty points, visit count, etc.) - cached
  const fetchClientStats = useCallback(async (clientId) => {
    if (clientStatsCache[clientId]) {
      return clientStatsCache[clientId];
    }
    
    try {
      const [points, history] = await Promise.all([
        userBranch ? getLoyaltyPoints(clientId, userBranch).catch(() => 0) : Promise.resolve(0),
        getServiceHistory(clientId, 1, userBranch).catch(() => [])
      ]);
      
      const stats = {
        loyaltyPoints: points || 0,
        lastVisit: history && history.length > 0 ? history[0].date : null,
        visitCount: history?.length || 0
      };
      
      setClientStatsCache(prev => ({ ...prev, [clientId]: stats }));
      return stats;
    } catch (error) {
      console.error('Error fetching client stats:', error);
      return { loyaltyPoints: 0, lastVisit: null, visitCount: 0 };
    }
  }, [userBranch, clientStatsCache]);

  // Filter clients
  const filteredClients = useMemo(() => {
    let filtered = [...clients];
    
    // Search filter
    if (debouncedSearchTerm.trim()) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(client => {
        const fullName = `${client.firstName || ''} ${client.lastName || ''}`.toLowerCase();
        const email = (client.email || '').toLowerCase();
        const phone = (client.phoneNumber || '').toLowerCase();
        return fullName.includes(searchLower) || 
               email.includes(searchLower) || 
               phone.includes(searchLower);
      });
    }
    
    // Sort
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      if (sortBy === 'firstName' || sortBy === 'lastName') {
        aValue = (a[sortBy] || '').toLowerCase();
        bValue = (b[sortBy] || '').toLowerCase();
      } else if (sortBy === 'email') {
        aValue = (a.email || '').toLowerCase();
        bValue = (b.email || '').toLowerCase();
      } else if (sortBy === 'phoneNumber') {
        aValue = (a.phoneNumber || '').toLowerCase();
        bValue = (b.phoneNumber || '').toLowerCase();
      } else if (sortBy === 'createdAt') {
        aValue = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        bValue = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      } else {
        aValue = a[sortBy] || '';
        bValue = b[sortBy] || '';
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
    
    return filtered;
  }, [clients, debouncedSearchTerm, sortBy, sortOrder]);

  // Paginated clients
  const paginatedClients = useMemo(() => {
    return filteredClients.slice(visibleStartIndex, visibleEndIndex);
  }, [filteredClients, visibleStartIndex, visibleEndIndex]);

  // Fetch stats for visible clients
  useEffect(() => {
    const fetchStatsForVisibleClients = async () => {
      // Only fetch stats for clients that don't have cached stats yet
      const clientsNeedingStats = paginatedClients.filter(
        client => !clientStatsCache[client.id]
      );
      
      if (clientsNeedingStats.length === 0) return;
      
      // Fetch stats in parallel for all visible clients (limit to avoid too many requests)
      const batchSize = 10;
      for (let i = 0; i < clientsNeedingStats.length; i += batchSize) {
        const batch = clientsNeedingStats.slice(i, i + batchSize);
        await Promise.all(batch.map(client => fetchClientStats(client.id)));
      }
    };
    
    if (paginatedClients.length > 0 && !loading) {
      fetchStatsForVisibleClients();
    }
  }, [paginatedClients, loading, fetchClientStats, clientStatsCache]);

  // Calculate pagination info
  const totalPages = useMemo(() => {
    return Math.ceil(filteredClients.length / itemsPerPage);
  }, [filteredClients.length, itemsPerPage]);

  const currentPageNumber = useMemo(() => {
    return Math.floor(visibleStartIndex / itemsPerPage) + 1;
  }, [visibleStartIndex, itemsPerPage]);

  // Handle sorting
  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  // Navigate pages
  const goToPage = (page) => {
    const start = (page - 1) * itemsPerPage;
    setVisibleStartIndex(start);
    setVisibleEndIndex(Math.min(start + itemsPerPage, filteredClients.length));
    setCurrentPage(page);
  };

  // Load more
  const loadMore = () => {
    if (visibleEndIndex < filteredClients.length) {
      setVisibleEndIndex(prev => Math.min(prev + itemsPerPage, filteredClients.length));
    }
  };


  // Export to CSV
  const handleExport = () => {
    const headers = ['Name', 'Email', 'Phone', 'Created At'];
    const rows = filteredClients.map(client => [
      `${client.firstName || ''} ${client.lastName || ''}`,
      client.email || '',
      client.phoneNumber || '',
      client.createdAt ? new Date(client.createdAt).toLocaleDateString() : ''
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `clients_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Clients exported successfully');
  };

  // Fetch client transactions
  const fetchClientTransactions = async (clientId, dateFrom = null, dateTo = null) => {
    try {
      const transactionsRef = collection(db, 'transactions');
      let q = query(
        transactionsRef,
        where('clientId', '==', clientId),
        where('status', '==', 'paid'),
        orderBy('createdAt', 'desc'),
        firestoreLimit(100)
      );
      
      const snapshot = await getDocs(q);
      let transactions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        completedAt: doc.data().completedAt?.toDate()
      }));
      
      // Filter by date range if provided
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        transactions = transactions.filter(t => t.createdAt >= fromDate);
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        transactions = transactions.filter(t => t.createdAt <= toDate);
      }
      
      return transactions;
    } catch (error) {
      console.error('Error fetching client transactions:', error);
      return [];
    }
  };

  const handleViewProfile = async (client) => {
    try {
      setLoadingProfile(true);
      setSelectedClient(client);
      setShowProfileModal(true);
      setProfileTab('overview');
      
      const profile = await getClientProfile(client.id);
      setClientProfile(profile);
      
      // Fetch loyalty points for current branch
      if (userBranch) {
        const points = await getLoyaltyPoints(client.id, userBranch);
        setLoyaltyPoints(points);
      } else {
        setLoyaltyPoints(0);
      }
      
      // Fetch all branch loyalty points
      const allPoints = await getAllBranchLoyaltyPoints(client.id);
      setAllBranchPoints(allPoints);
      
      // Fetch service history
      const history = await getServiceHistory(client.id, 10, userBranch);
      setServiceHistory(history);
      
      // Fetch loyalty history
      const loyalty = await getLoyaltyHistory(client.id, userBranch, 20);
      setLoyaltyHistory(loyalty);
      
      // Fetch transactions
      const transactions = await fetchClientTransactions(client.id);
      setClientTransactions(transactions);
      
      // Fetch referral code
      if (userBranch) {
        const code = await getReferralCode(client.id, userBranch);
        setReferralCode(code);
      } else {
        setReferralCode(null);
      }
    } catch (error) {
      console.error('Error loading client profile:', error);
      toast.error('Failed to load client profile');
    } finally {
      setLoadingProfile(false);
    }
  };

  // Filter transactions by date
  const handleFilterTransactions = async () => {
    if (!selectedClient) return;
    setLoadingProfile(true);
    try {
      const transactions = await fetchClientTransactions(selectedClient.id, transactionDateFrom, transactionDateTo);
      setClientTransactions(transactions);
    } catch (error) {
      console.error('Error filtering transactions:', error);
    } finally {
      setLoadingProfile(false);
    }
  };

  // Export client transactions report
  const handleExportTransactions = () => {
    if (!clientTransactions.length) {
      toast.error('No transactions to export');
      return;
    }
    
    const headers = ['Date', 'Receipt #', 'Services/Products', 'Stylist', 'Payment Method', 'Subtotal', 'Discount', 'Total'];
    const rows = clientTransactions.map(t => [
      t.createdAt ? format(t.createdAt, 'yyyy-MM-dd HH:mm') : '',
      t.receiptNumber || t.id?.slice(-8) || '',
      (t.items || []).map(i => i.name || i.serviceName).join('; '),
      (t.items || []).map(i => i.stylistName).filter(Boolean).join('; ') || '-',
      t.paymentMethod || '-',
      `${formatCurrency(t.subtotal || 0)}`,
      `${formatCurrency(t.discountAmount || t.discount || 0)}`,
      `${formatCurrency(t.total || t.totalAmount || 0)}`
    ]);
    
    const csvContent = [
      `Client Transaction Report - ${selectedClient?.firstName} ${selectedClient?.lastName}`,
      `Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`,
      '',
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `transactions_${selectedClient?.firstName}_${selectedClient?.lastName}_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Transactions exported successfully');
  };

  // Print transactions report
  const handlePrintTransactions = () => {
    if (!clientTransactions.length) {
      toast.error('No transactions to print');
      return;
    }
    
    const printWindow = window.open('', '', 'height=800,width=1000');
    const totalSpent = clientTransactions.reduce((sum, t) => sum + (t.total || t.totalAmount || 0), 0);
    const totalDiscount = clientTransactions.reduce((sum, t) => sum + (t.discountAmount || t.discount || 0), 0);
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Transaction Report - ${selectedClient?.firstName} ${selectedClient?.lastName}</title>
          <style>
            @page { size: A4; margin: 1cm; }
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #2D1B4E; margin-bottom: 5px; text-align: center; }
            .subtitle { color: #666; margin-bottom: 20px; text-align: center; }
            .filters { background: #f5f5f5; padding: 10px; border-radius: 5px; margin-bottom: 20px; font-size: 11px; }
            .filters strong { color: #2D1B4E; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
            th { background-color: #2D1B4E; color: white; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .summary { margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px; }
            .summary-row { display: flex; justify-content: space-between; margin: 5px 0; }
            .total { font-weight: bold; font-size: 16px; color: #2D1B4E; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 2px solid #ddd; font-size: 10px; color: #666; }
            .footer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 15px; }
            .footer-right { text-align: right; }
            .footer-center { text-align: center; color: #999; }
          </style>
        </head>
        <body>
          <h1>Client Transaction Report</h1>
          <p class="subtitle">${selectedClient?.firstName} ${selectedClient?.lastName}</p>
          
          <div class="filters">
            <strong>REPORT DETAILS:</strong><br>
            Client: ${selectedClient?.firstName} ${selectedClient?.lastName}<br>
            Email: ${selectedClient?.email || 'N/A'} | Phone: ${selectedClient?.phoneNumber || 'N/A'}<br>
            Total Records: ${clientTransactions.length}
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Receipt #</th>
                <th>Services/Products</th>
                <th>Payment</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${clientTransactions.map(t => `
                <tr>
                  <td>${t.createdAt ? format(t.createdAt, 'MMM d, yyyy') : '-'}</td>
                  <td>${t.receiptNumber || t.id?.slice(-8) || '-'}</td>
                  <td>${(t.items || []).map(i => i.name || i.serviceName).join(', ') || '-'}</td>
                  <td>${t.paymentMethod || '-'}</td>
                  <td>${formatCurrency(t.total || t.totalAmount || 0)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="summary">
            <div class="summary-row">
              <span>Total Transactions:</span>
              <span>${clientTransactions.length}</span>
            </div>
            <div class="summary-row">
              <span>Total Discounts:</span>
              <span>${formatCurrency(totalDiscount)}</span>
            </div>
            <div class="summary-row total">
              <span>Total Spent:</span>
              <span>${formatCurrency(totalSpent)}</span>
            </div>
          </div>
          
          <div class="footer">
            <div class="footer-grid">
              <div>
                <strong>Generated By:</strong> ${currentUser?.displayName || currentUser?.email || 'Receptionist'}<br>
                <strong>Position:</strong> Receptionist
              </div>
              <div class="footer-right">
                <strong>Generated On:</strong> ${format(new Date(), 'MMMM dd, yyyy')}<br>
                <strong>Time:</strong> ${format(new Date(), 'hh:mm a')}
              </div>
            </div>
            <div class="footer-center">
              Page 1 of 1 | Client Transaction Report
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleViewHistory = async (client) => {
    try {
      setLoadingProfile(true);
      setSelectedClient(client);
      setShowHistoryModal(true);
      
      const history = await getServiceHistory(client.id, 50, userBranch);
      setServiceHistory(history);
      
      const loyalty = await getLoyaltyHistory(client.id, 50);
      setLoyaltyHistory(loyalty);
    } catch (error) {
      console.error('Error loading history:', error);
      toast.error('Failed to load history');
    } finally {
      setLoadingProfile(false);
    }
  };

  const SortIcon = ({ column }) => {
    if (sortBy !== column) return null;
    return sortOrder === 'asc' ? 
      <ChevronUp className="w-4 h-4 inline ml-1" /> : 
      <ChevronDown className="w-4 h-4 inline ml-1" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Client Relationship Management</h1>
          <p className="text-gray-600">
            Understanding client preferences and building lasting relationships
            <br />
            <span className="text-sm text-gray-500">
              {filteredClients.length} {filteredClients.length === 1 ? 'client' : 'clients'}
              {filteredClients.length !== clients.length && ` of ${clients.length} total`} with transactions in your branch
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExport}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </Card>

      {/* CRM Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Clients</p>
                <p className="text-2xl font-bold text-gray-900">{clients.length}</p>
                <p className="text-xs text-gray-500">With recent transactions</p>
              </div>
              <div className="p-2 bg-green-100 rounded-lg">
                <User className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg. Visits/Month</p>
                <p className="text-2xl font-bold text-gray-900">
                  {clients.length > 0
                    ? (clients.reduce((sum, client) => sum + (clientStatsCache[client.id]?.visitCount || 0), 0) / clients.length).toFixed(1)
                    : '0.0'
                  }
                </p>
                <p className="text-xs text-gray-500">Per active client</p>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg">
                <History className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Loyalty Members</p>
                <p className="text-2xl font-bold text-gray-900">
                  {clients.filter(client => (clientStatsCache[client.id]?.loyaltyPoints || 0) > 0).length}
                </p>
                <p className="text-xs text-gray-500">With points balance</p>
              </div>
              <div className="p-2 bg-purple-100 rounded-lg">
                <Star className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Retention Rate</p>
                <p className="text-2xl font-bold text-gray-900">
                  {(() => {
                    if (!clients.length) return '0%';

                    const now = new Date();
                    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
                    const sixtyDaysAgo = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000));

                    // Clients active in last 30 days (current period)
                    const currentPeriodClients = clients.filter(client => {
                      const lastVisit = clientStatsCache[client.id]?.lastVisit;
                      return lastVisit && new Date(lastVisit) >= thirtyDaysAgo;
                    });

                    // Clients active in previous 30 days (31-60 days ago)
                    const previousPeriodClients = clients.filter(client => {
                      const lastVisit = clientStatsCache[client.id]?.lastVisit;
                      const visitDate = new Date(lastVisit);
                      return visitDate >= sixtyDaysAgo && visitDate < thirtyDaysAgo;
                    });

                    // Clients who were active in previous period AND current period (retained)
                    const retainedClients = previousPeriodClients.filter(prevClient => {
                      return currentPeriodClients.some(currClient => currClient.id === prevClient.id);
                    });

                    // True retention rate: (retained / previous period active) × 100
                    const retentionRate = previousPeriodClients.length > 0
                      ? Math.round((retainedClients.length / previousPeriodClients.length) * 100)
                      : 0;

                    return `${retentionRate}%`;
                  })()}
                </p>
                <p className="text-xs text-gray-500">Monthly retention</p>
              </div>
              <div className="p-2 bg-orange-100 rounded-lg">
                <UserCheck className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Clients Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('firstName')}
                >
                  <div className="flex items-center">
                    Client Name
                    <SortIcon column="firstName" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('email')}
                >
                  <div className="flex items-center">
                    Contact Info
                    <SortIcon column="email" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center">
                    Relationship Insights
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center">
                    Loyalty & Activity
                  </div>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedClients.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                    <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No clients found</p>
                  </td>
                </tr>
              ) : (
                paginatedClients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-[#2D1B4E] flex items-center justify-center text-white text-xs font-medium">
                          {client.firstName?.[0]?.toUpperCase() || 'C'}
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {client.firstName} {client.lastName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        {client.email ? (
                          <>
                            <Mail className="w-4 h-4 mr-2 text-gray-400" />
                            {client.email}
                          </>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm">
                        {(() => {
                          const stats = clientStatsCache[client.id];
                          if (!stats) return <span className="text-gray-400">Loading...</span>;

                          const lastVisit = stats.lastVisit;
                          const daysSinceLastVisit = lastVisit
                            ? Math.floor((new Date() - new Date(lastVisit)) / (1000 * 60 * 60 * 24))
                            : null;

                          return (
                            <div className="space-y-1">
                              <div className="flex items-center text-gray-900">
                                <History className="w-3 h-3 mr-1 text-blue-500" />
                                Last: {lastVisit ? `${daysSinceLastVisit} days ago` : 'Never'}
                              </div>
                              <div className="text-xs text-gray-500">
                                {stats.visitCount} total visits
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm">
                        {(() => {
                          const stats = clientStatsCache[client.id];
                          if (!stats) return <span className="text-gray-400">Loading...</span>;

                          const points = stats.loyaltyPoints || 0;

                          return (
                            <div className="space-y-1">
                              <div className="flex items-center text-gray-900">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  points > 100 ? 'bg-green-100 text-green-800' :
                                  points > 50 ? 'bg-blue-100 text-blue-800' :
                                  points > 0 ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {points} pts
                                </span>
                              </div>
                              <div className="text-xs text-gray-500">
                                {points > 100 ? 'VIP Client' :
                                 points > 50 ? 'Regular Client' :
                                 points > 0 ? 'Occasional' : 'New Client'}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewProfile(client)}
                          className="text-xs"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewHistory(client)}
                          className="text-xs"
                        >
                          <History className="h-3 w-3 mr-1" />
                          History
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredClients.length > itemsPerPage && (
          <div className="px-4 py-3 bg-gray-50 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-600">
              Showing <span className="font-medium">{visibleStartIndex + 1}</span> to{' '}
              <span className="font-medium">{Math.min(visibleEndIndex, filteredClients.length)}</span> of{' '}
              <span className="font-medium">{filteredClients.length}</span> clients
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(Math.max(1, currentPageNumber - 1))}
                disabled={currentPageNumber === 1}
              >
                Previous
              </Button>
              
              <span className="text-sm text-gray-600 px-3 min-w-[100px] text-center">
                Page {currentPageNumber} of {totalPages}
              </span>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(Math.min(totalPages, currentPageNumber + 1))}
                disabled={currentPageNumber === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Load More Button */}
        {visibleEndIndex < filteredClients.length && (
          <div className="px-4 py-3 bg-gray-50 border-t text-center">
            <Button
              variant="outline"
              size="sm"
              onClick={loadMore}
            >
              Load More ({filteredClients.length - visibleEndIndex} remaining)
            </Button>
          </div>
        )}
      </Card>

      {/* Client Profile Modal with Tabs */}
      <Modal
        isOpen={showProfileModal}
        onClose={() => {
          setShowProfileModal(false);
          setSelectedClient(null);
          setClientProfile(null);
          setProfileTab('overview');
          setTransactionDateFrom('');
          setTransactionDateTo('');
        }}
        title={`${selectedClient?.firstName} ${selectedClient?.lastName}`}
        size="xl"
      >
        {loadingProfile && !clientProfile ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Tabs */}
            <div className="flex border-b">
              <button
                onClick={() => setProfileTab('overview')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  profileTab === 'overview'
                    ? 'border-[#2D1B4E] text-[#2D1B4E]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <User className="w-4 h-4 inline mr-1" />
                Overview
              </button>
              <button
                onClick={() => setProfileTab('transactions')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  profileTab === 'transactions'
                    ? 'border-[#2D1B4E] text-[#2D1B4E]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Receipt className="w-4 h-4 inline mr-1" />
                Transactions ({clientTransactions.length})
              </button>
              <button
                onClick={() => setProfileTab('loyalty')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  profileTab === 'loyalty'
                    ? 'border-[#2D1B4E] text-[#2D1B4E]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Star className="w-4 h-4 inline mr-1" />
                Loyalty ({loyaltyPoints} pts)
              </button>
            </div>

            {/* Overview Tab */}
            {profileTab === 'overview' && clientProfile && (
              <div className="space-y-4">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-purple-50 rounded-lg p-3 text-center">
                    <Star className="w-5 h-5 mx-auto text-purple-600 mb-1" />
                    <div className="text-2xl font-bold text-purple-700">{loyaltyPoints}</div>
                    <div className="text-xs text-purple-600">Loyalty Points</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <History className="w-5 h-5 mx-auto text-blue-600 mb-1" />
                    <div className="text-2xl font-bold text-blue-700">{clientProfile.visitCount || clientTransactions.length || 0}</div>
                    <div className="text-xs text-blue-600">Total Visits</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <Receipt className="w-5 h-5 mx-auto text-green-600 mb-1" />
                    <div className="text-xl font-bold text-green-700">{formatCurrency((clientProfile.totalSpent || clientTransactions.reduce((s, t) => s + (t.total || 0), 0)))}</div>
                    <div className="text-xs text-green-600">Total Spent</div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-3 text-center">
                    <Calendar className="w-5 h-5 mx-auto text-orange-600 mb-1" />
                    <div className="text-sm font-bold text-orange-700">
                      {clientTransactions[0]?.createdAt ? format(clientTransactions[0].createdAt, 'MMM d') : '-'}
                    </div>
                    <div className="text-xs text-orange-600">Last Visit</div>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Contact Information</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span>{selectedClient?.email || 'No email'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span>{selectedClient?.phoneNumber || 'No phone'}</span>
                    </div>
                  </div>
                  {referralCode && (
                    <div className="mt-2 pt-2 border-t">
                      <span className="text-xs text-gray-500">Referral Code: </span>
                      <span className="font-mono text-sm font-medium text-purple-600">{referralCode}</span>
                    </div>
                  )}
                </div>

                {/* Recent Services */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Services</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {serviceHistory.length === 0 ? (
                      <p className="text-sm text-gray-500">No service history</p>
                    ) : (
                      serviceHistory.slice(0, 5).map((entry) => (
                        <div key={entry.id} className="flex justify-between items-center p-2 bg-gray-50 rounded text-sm">
                          <div>
                            <div className="font-medium">{entry.serviceName}</div>
                            <div className="text-xs text-gray-500">
                              {entry.date ? format(entry.date, 'MMM d, yyyy') : '-'} • {entry.stylistName || '-'}
                            </div>
                          </div>
                          <div className="font-semibold">{formatCurrency(entry.price || 0)}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Transactions Tab */}
            {profileTab === 'transactions' && (
              <div className="space-y-4">
                {/* Filters */}
                <div className="flex flex-wrap items-end gap-2 bg-gray-50 p-3 rounded-lg">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">From</label>
                    <input
                      type="date"
                      value={transactionDateFrom}
                      onChange={(e) => setTransactionDateFrom(e.target.value)}
                      className="px-2 py-1 text-sm border rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">To</label>
                    <input
                      type="date"
                      value={transactionDateTo}
                      onChange={(e) => setTransactionDateTo(e.target.value)}
                      className="px-2 py-1 text-sm border rounded"
                    />
                  </div>
                  <Button size="sm" onClick={handleFilterTransactions}>
                    Filter
                  </Button>
                  <div className="flex-1" />
                  <Button size="sm" variant="outline" onClick={handleExportTransactions}>
                    <Download className="w-3 h-3 mr-1" />
                    Export
                  </Button>
                  <Button size="sm" variant="outline" onClick={handlePrintTransactions}>
                    <Printer className="w-3 h-3 mr-1" />
                    Print
                  </Button>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-blue-50 rounded p-2 text-center">
                    <div className="text-lg font-bold text-blue-700">{clientTransactions.length}</div>
                    <div className="text-xs text-blue-600">Transactions</div>
                  </div>
                  <div className="bg-green-50 rounded p-2 text-center">
                    <div className="text-lg font-bold text-green-700">
                      {formatCurrency(clientTransactions.reduce((s, t) => s + (t.total || t.totalAmount || 0), 0))}
                    </div>
                    <div className="text-xs text-green-600">Total Spent</div>
                  </div>
                  <div className="bg-orange-50 rounded p-2 text-center">
                    <div className="text-lg font-bold text-orange-700">
                      {formatCurrency(clientTransactions.reduce((s, t) => s + (t.discountAmount || t.discount || 0), 0))}
                    </div>
                    <div className="text-xs text-orange-600">Total Discounts</div>
                  </div>
                </div>

                {/* Transactions List */}
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {loadingProfile ? (
                    <div className="text-center py-4"><LoadingSpinner /></div>
                  ) : clientTransactions.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No transactions found</p>
                  ) : (
                    clientTransactions.map((t) => (
                      <div key={t.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="text-sm font-medium">
                              {t.createdAt ? format(t.createdAt, 'MMM d, yyyy h:mm a') : '-'}
                            </div>
                            <div className="text-xs text-gray-500">
                              Receipt: {t.receiptNumber || t.id?.slice(-8) || '-'} • {t.paymentMethod || '-'}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-green-600">{formatCurrency((t.total || t.totalAmount || 0))}</div>
                            {(t.discountAmount || t.discount) > 0 && (
                              <div className="text-xs text-orange-600">-{formatCurrency((t.discountAmount || t.discount))} discount</div>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-gray-600">
                          {(t.items || []).map((item, idx) => (
                            <span key={idx}>
                              {item.name || item.serviceName}
                              {item.stylistName && ` (${item.stylistName})`}
                              {idx < t.items.length - 1 && ', '}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Loyalty Tab */}
            {profileTab === 'loyalty' && (
              <div className="space-y-4">
                {/* Current Points */}
                <div className="bg-gradient-to-r from-purple-500 to-purple-700 rounded-lg p-4 text-white text-center">
                  <Star className="w-8 h-8 mx-auto mb-2 fill-yellow-300 text-yellow-300" />
                  <div className="text-3xl font-bold">{loyaltyPoints}</div>
                  <div className="text-purple-200">Available Points (This Branch)</div>
                  <div className="text-xs text-purple-300 mt-1">1 point = ₱1 discount</div>
                </div>

                {/* All Branch Points */}
                {allBranchPoints.length > 1 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Points by Branch</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {allBranchPoints.map((bp, idx) => (
                        <div key={idx} className={`p-2 rounded text-sm ${bp.branchId === userBranch ? 'bg-purple-100 border border-purple-300' : 'bg-gray-50'}`}>
                          <div className="font-medium">{bp.branchId === userBranch ? 'This Branch' : `Branch ${idx + 1}`}</div>
                          <div className="text-lg font-bold text-purple-600">{bp.loyaltyPoints} pts</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Loyalty History */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Points History</h4>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {loyaltyHistory.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">No loyalty history</p>
                    ) : (
                      loyaltyHistory.map((entry) => (
                        <div key={entry.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                          <div>
                            <div className="text-sm">{entry.description}</div>
                            <div className="text-xs text-gray-500">
                              {entry.createdAt ? format(entry.createdAt, 'MMM d, yyyy h:mm a') : '-'}
                            </div>
                          </div>
                          <div className={`text-sm font-bold ${entry.points > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {entry.points > 0 ? '+' : ''}{entry.points} pts
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* History Modal */}
      <Modal
        isOpen={showHistoryModal}
        onClose={() => {
          setShowHistoryModal(false);
          setSelectedClient(null);
        }}
        title={`History: ${selectedClient?.firstName} ${selectedClient?.lastName}`}
        size="lg"
      >
        {loadingProfile ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Service History</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {serviceHistory.length === 0 ? (
                  <p className="text-sm text-gray-500">No service history</p>
                ) : (
                  serviceHistory.map((entry) => (
                    <div key={entry.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <div>
                        <div className="text-sm font-medium">{entry.serviceName}</div>
                        <div className="text-xs text-gray-500">
                          {entry.date?.toLocaleDateString()} - {entry.branchName} - {entry.stylistName}
                        </div>
                      </div>
                      <div className="text-sm font-semibold">{formatCurrency(entry.price || 0)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Loyalty Points History</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {loyaltyHistory.length === 0 ? (
                  <p className="text-sm text-gray-500">No loyalty history</p>
                ) : (
                  loyaltyHistory.map((entry) => (
                    <div key={entry.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <div>
                        <div className="text-sm font-medium">{entry.description}</div>
                        <div className="text-xs text-gray-500">
                          {entry.createdAt?.toLocaleDateString()}
                        </div>
                      </div>
                      <div className={`text-sm font-semibold ${entry.points > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {entry.points > 0 ? '+' : ''}{entry.points} pts
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ReceptionistClients;
