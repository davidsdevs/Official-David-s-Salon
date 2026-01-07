/**
 * Receptionist Clients Management Page
 * Module: M06 - CRM
 * Advanced CRM-style interface with filtering, sorting, and pagination for big data
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Eye, History, ChevronUp, ChevronDown, Download, Phone, Mail, User, UserCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getClients, getClientsByBranchWithTransactions, searchClients, getClientProfile, updateClientProfile } from '../../services/clientService';
import { getLoyaltyPoints, getLoyaltyHistory } from '../../services/loyaltyService';
import { getServiceHistory } from '../../services/clientService';
import { getReferralCode } from '../../services/referralService';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Modal from '../../components/ui/Modal';
import toast from 'react-hot-toast';

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
  const [clientProfile, setClientProfile] = useState(null);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [serviceHistory, setServiceHistory] = useState([]);
  const [loyaltyHistory, setLoyaltyHistory] = useState([]);
  const [referralCode, setReferralCode] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  
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

  const handleViewProfile = async (client) => {
    try {
      setLoadingProfile(true);
      setSelectedClient(client);
      setShowProfileModal(true);
      
      const profile = await getClientProfile(client.id);
      setClientProfile(profile);
      
      if (userBranch) {
        const points = await getLoyaltyPoints(client.id, userBranch);
        setLoyaltyPoints(points);
      } else {
        setLoyaltyPoints(0);
      }
      
      const history = await getServiceHistory(client.id, 10, userBranch);
      setServiceHistory(history);
      
      const loyalty = await getLoyaltyHistory(client.id, userBranch, 10);
      setLoyaltyHistory(loyalty);
      
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
                <Phone className="w-5 h-5 text-purple-600" />
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

      {/* Client Profile Modal */}
      <Modal
        isOpen={showProfileModal}
        onClose={() => {
          setShowProfileModal(false);
          setSelectedClient(null);
          setClientProfile(null);
        }}
        title={`Client Profile: ${selectedClient?.firstName} ${selectedClient?.lastName}`}
        size="lg"
      >
        {loadingProfile ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : clientProfile ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Loyalty Points
                </label>
                <div className="text-2xl font-bold text-[#2D1B4E]">{loyaltyPoints}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Visits
                </label>
                <div className="text-2xl font-bold text-gray-900">{clientProfile.visitCount || 0}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Spent
                </label>
                <div className="text-lg font-semibold text-gray-900">
                  ₱{clientProfile.totalSpent?.toFixed(2) || '0.00'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Referral Code {userBranch && <span className="text-xs text-gray-500">(for this branch)</span>}
                </label>
                <div className="text-sm font-mono text-gray-900">
                  {referralCode ? (
                    referralCode
                  ) : (
                    <span className="text-gray-400 italic">
                      {userBranch 
                        ? 'No referral code yet (client must visit this branch first)' 
                        : 'Branch not specified'}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {clientProfile.allergies && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Allergies/Notes
                </label>
                <p className="text-sm text-gray-600">{clientProfile.allergies}</p>
              </div>
            )}
            
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Recent Service History</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {serviceHistory.length === 0 ? (
                  <p className="text-sm text-gray-500">No service history</p>
                ) : (
                  serviceHistory.map((entry) => (
                    <div key={entry.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <div>
                        <div className="text-sm font-medium">{entry.serviceName}</div>
                        <div className="text-xs text-gray-500">
                          {entry.date?.toLocaleDateString()} - {entry.stylistName}
                        </div>
                      </div>
                      <div className="text-sm font-semibold">₱{entry.price?.toFixed(2)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            Profile not found
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
                      <div className="text-sm font-semibold">₱{entry.price?.toFixed(2)}</div>
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
