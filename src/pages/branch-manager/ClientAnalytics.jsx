/**
 * Branch Manager Client Analytics Page
 * Module: M06 - CRM
 * Provides comprehensive client analytics including preferences, patterns, and insights
 */

import { useState, useEffect } from 'react';
import { 
  TrendingUp, Users, Star, Banknote, Award, Clock, Calendar, 
  ShoppingBag, Scissors, CreditCard, Heart, AlertCircle, 
  TrendingDown, Package, UserCheck, UserX
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getClients, getServiceHistory } from '../../services/clientService';
import { getBranchFeedbackStats } from '../../services/feedbackService';
import { Card } from '../../components/ui/Card';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { format } from 'date-fns';

const ClientAnalytics = () => {
  const { userBranch, userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [segmentation, setSegmentation] = useState({
    bronze: 0,
    silver: 0,
    gold: 0,
    platinum: 0
  });
  const [feedbackStats, setFeedbackStats] = useState(null);
  const [topClients, setTopClients] = useState([]);
  const [avgMetrics, setAvgMetrics] = useState({
    avgSpend: 0,
    avgVisits: 0,
    totalRevenue: 0
  });
  
  // New analytics data
  const [clientPreferences, setClientPreferences] = useState({
    topServices: [],
    topProducts: [],
    topStylists: [],
    paymentMethods: {},
    visitTimes: {},
    visitDays: {}
  });
  const [visitPatterns, setVisitPatterns] = useState({
    peakHours: [],
    peakDays: [],
    avgVisitFrequency: 0
  });
  const [clientBehavior, setClientBehavior] = useState({
    newClients: 0,
    returningClients: 0,
    atRiskClients: 0,
    activeClients: 0
  });
  const [spendingPatterns, setSpendingPatterns] = useState({
    serviceRevenue: 0,
    productRevenue: 0,
    avgTransactionValue: 0
  });

  useEffect(() => {
    if (userBranch) {
      fetchAnalytics();
    }
  }, [userBranch]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      // Fetch all transactions for this branch
      const transactionsRef = collection(db, 'transactions');
      const transactionsQuery = query(
        transactionsRef,
        where('branchId', '==', userBranch),
        where('status', '==', 'paid')
      );
      const transactionsSnapshot = await getDocs(transactionsQuery);
      
      const transactions = [];
      transactionsSnapshot.forEach((doc) => {
        const data = doc.data();
        transactions.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt)
        });
      });

      // Fetch all clients
      const allClients = await getClients();
      
      // Process client data
      const branchClients = [];
      const clientSegments = [];
      const segCounts = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
      let totalSpent = 0;
      let totalVisits = 0;
      
      // Track preferences
      const serviceCounts = {};
      const productCounts = {};
      const stylistCounts = {};
      const paymentMethodCounts = {};
      const visitHourCounts = {};
      const visitDayCounts = {};
      const clientTransactions = {};
      const clientFirstVisit = {};
      const clientLastVisit = {};
      
      // Process transactions
      transactions.forEach(transaction => {
        const clientId = transaction.clientId;
        if (!clientId) return;
        
        // Track client transactions
        if (!clientTransactions[clientId]) {
          clientTransactions[clientId] = [];
        }
        clientTransactions[clientId].push(transaction);
        
        // Track first and last visit
        const visitDate = transaction.createdAt;
        if (!clientFirstVisit[clientId] || visitDate < clientFirstVisit[clientId]) {
          clientFirstVisit[clientId] = visitDate;
        }
        if (!clientLastVisit[clientId] || visitDate > clientLastVisit[clientId]) {
          clientLastVisit[clientId] = visitDate;
        }
        
        // Track services
        if (transaction.items) {
          transaction.items.forEach(item => {
            if (item.type === 'service') {
              const serviceName = item.name || item.serviceName || 'Unknown Service';
              serviceCounts[serviceName] = (serviceCounts[serviceName] || 0) + 1;
              
              // Track stylist
              const stylistId = item.stylistId || transaction.stylistId;
              if (stylistId) {
                const stylistName = item.stylistName || transaction.stylistName || 'Unknown Stylist';
                stylistCounts[stylistName] = (stylistCounts[stylistName] || 0) + 1;
              }
            } else if (item.type === 'product') {
              const productName = item.name || item.productName || 'Unknown Product';
              productCounts[productName] = (productCounts[productName] || 0) + 1;
            }
          });
        }
        
        // Track payment methods
        const paymentMethod = transaction.paymentMethod || 'cash';
        paymentMethodCounts[paymentMethod] = (paymentMethodCounts[paymentMethod] || 0) + 1;
        
        // Track visit times
        const hour = visitDate.getHours();
        visitHourCounts[hour] = (visitHourCounts[hour] || 0) + 1;
        
        // Track visit days
        const day = visitDate.getDay(); // 0 = Sunday, 6 = Saturday
        visitDayCounts[day] = (visitDayCounts[day] || 0) + 1;
      });
      
      // Process clients
      for (const client of allClients) {
        const clientTxns = clientTransactions[client.id] || [];
        
        if (clientTxns.length > 0) {
          branchClients.push(client);
          
          const branchSpent = clientTxns.reduce((sum, t) => sum + (t.total || 0), 0);
          const branchVisits = clientTxns.length;
          
          // Determine tier
          let tier = 'Bronze';
          if (branchVisits >= 20 || branchSpent >= 50000) {
            tier = 'Platinum';
          } else if (branchVisits >= 10 || branchSpent >= 25000) {
            tier = 'Gold';
          } else if (branchVisits >= 5 || branchSpent >= 10000) {
            tier = 'Silver';
          }
          
          const seg = {
            tier,
            visitFrequency: branchVisits,
            avgSpend: branchVisits > 0 ? branchSpent / branchVisits : 0,
            totalSpent: branchSpent,
            lastVisit: clientLastVisit[client.id],
            firstVisit: clientFirstVisit[client.id]
          };
          
          clientSegments.push({ client, segmentation: seg });
          segCounts[tier.toLowerCase()]++;
          totalSpent += branchSpent;
          totalVisits += branchVisits;
        }
      }
      
      setClients(branchClients);
      setSegmentation(segCounts);
      
      // Get top clients
      const sortedClients = clientSegments
        .sort((a, b) => (b.segmentation.totalSpent || 0) - (a.segmentation.totalSpent || 0))
        .slice(0, 10);
      setTopClients(sortedClients);
      
      // Calculate averages
      const clientCount = branchClients.length || 1;
      setAvgMetrics({
        avgSpend: totalSpent / clientCount,
        avgVisits: totalVisits / clientCount,
        totalRevenue: totalSpent
      });
      
      // Set preferences
      const topServices = Object.entries(serviceCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }));
      
      const topProducts = Object.entries(productCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }));
      
      const topStylists = Object.entries(stylistCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }));
      
      setClientPreferences({
        topServices,
        topProducts,
        topStylists,
        paymentMethods: paymentMethodCounts,
        visitTimes: visitHourCounts,
        visitDays: visitDayCounts
      });
      
      // Set visit patterns
      const peakHours = Object.entries(visitHourCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([hour, count]) => ({ hour: parseInt(hour), count }));
      
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const peakDays = Object.entries(visitDayCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([day, count]) => ({ day: dayNames[parseInt(day)], count }));
      
      setVisitPatterns({
        peakHours,
        peakDays,
        avgVisitFrequency: totalVisits / clientCount
      });
      
      // Set client behavior
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      
      let newClients = 0;
      let returningClients = 0;
      let atRiskClients = 0;
      let activeClients = 0;
      
      clientSegments.forEach(({ segmentation: seg }) => {
        const daysSinceLastVisit = seg.lastVisit 
          ? Math.floor((now - seg.lastVisit) / (1000 * 60 * 60 * 24))
          : 999;
        
        if (seg.firstVisit && seg.firstVisit > thirtyDaysAgo) {
          newClients++;
        } else if (seg.visitFrequency > 1) {
          returningClients++;
        }
        
        if (daysSinceLastVisit > 90) {
          atRiskClients++;
        } else if (daysSinceLastVisit <= 30) {
          activeClients++;
        }
      });
      
      setClientBehavior({
        newClients,
        returningClients,
        atRiskClients,
        activeClients
      });
      
      // Set spending patterns
      let serviceRevenue = 0;
      let productRevenue = 0;
      
      transactions.forEach(txn => {
        if (txn.items) {
          txn.items.forEach(item => {
            const itemTotal = (item.price || 0) * (item.quantity || 1);
            if (item.type === 'service') {
              serviceRevenue += itemTotal;
            } else if (item.type === 'product') {
              productRevenue += itemTotal;
            }
          });
        }
      });
      
      setSpendingPatterns({
        serviceRevenue,
        productRevenue,
        avgTransactionValue: transactions.length > 0 ? totalSpent / transactions.length : 0
      });
      
      // Fetch feedback stats
      const stats = await getBranchFeedbackStats(userBranch);
      setFeedbackStats(stats);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Client Analytics</h1>
        <p className="text-gray-600">Comprehensive client insights, preferences, and behavior patterns</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Clients</p>
                <p className="text-2xl font-bold text-gray-900">{clients.length}</p>
              </div>
              <Users className="h-8 w-8 text-[#2D1B4E] opacity-50" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  ₱{avgMetrics.totalRevenue.toFixed(2)}
                </p>
              </div>
              <Banknote className="h-8 w-8 text-green-600 opacity-50" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg. Spend</p>
                <p className="text-2xl font-bold text-gray-900">
                  ₱{avgMetrics.avgSpend.toFixed(2)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-600 opacity-50" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg. Visits</p>
                <p className="text-2xl font-bold text-gray-900">
                  {avgMetrics.avgVisits.toFixed(1)}
                </p>
              </div>
              <Award className="h-8 w-8 text-yellow-600 opacity-50" />
            </div>
          </div>
        </Card>
      </div>

      {/* Client Behavior Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Clients</p>
                <p className="text-2xl font-bold text-green-600">{clientBehavior.activeClients}</p>
                <p className="text-xs text-gray-500 mt-1">Visited in last 30 days</p>
              </div>
              <UserCheck className="h-8 w-8 text-green-600 opacity-50" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">New Clients</p>
                <p className="text-2xl font-bold text-blue-600">{clientBehavior.newClients}</p>
                <p className="text-xs text-gray-500 mt-1">Last 30 days</p>
              </div>
              <Users className="h-8 w-8 text-blue-600 opacity-50" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Returning Clients</p>
                <p className="text-2xl font-bold text-purple-600">{clientBehavior.returningClients}</p>
                <p className="text-xs text-gray-500 mt-1">Multiple visits</p>
              </div>
              <Heart className="h-8 w-8 text-purple-600 opacity-50" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">At Risk Clients</p>
                <p className="text-2xl font-bold text-red-600">{clientBehavior.atRiskClients}</p>
                <p className="text-xs text-gray-500 mt-1">No visit in 90+ days</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-600 opacity-50" />
            </div>
          </div>
        </Card>
      </div>

      {/* Client Preferences - Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Services */}
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Scissors className="h-5 w-5 text-[#160B53]" />
              <h2 className="text-lg font-semibold text-gray-900">Most Popular Services</h2>
            </div>
            <div className="space-y-3">
              {clientPreferences.topServices.length === 0 ? (
                <p className="text-sm text-gray-500">No service data available</p>
              ) : (
                clientPreferences.topServices.map((service, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-[#160B53] flex items-center justify-center text-white text-xs font-medium">
                        {index + 1}
                      </div>
                      <span className="text-sm font-medium text-gray-900">{service.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-[#160B53]">{service.count} times</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>

        {/* Top Products */}
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Package className="h-5 w-5 text-[#160B53]" />
              <h2 className="text-lg font-semibold text-gray-900">Most Popular Products</h2>
            </div>
            <div className="space-y-3">
              {clientPreferences.topProducts.length === 0 ? (
                <p className="text-sm text-gray-500">No product data available</p>
              ) : (
                clientPreferences.topProducts.map((product, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-[#160B53] flex items-center justify-center text-white text-xs font-medium">
                        {index + 1}
                      </div>
                      <span className="text-sm font-medium text-gray-900">{product.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-[#160B53]">{product.count} times</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Preferred Stylists & Payment Methods */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Stylists */}
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-[#160B53]" />
              <h2 className="text-lg font-semibold text-gray-900">Preferred Stylists</h2>
            </div>
            <div className="space-y-3">
              {clientPreferences.topStylists.length === 0 ? (
                <p className="text-sm text-gray-500">No stylist data available</p>
              ) : (
                clientPreferences.topStylists.map((stylist, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-[#160B53] flex items-center justify-center text-white text-xs font-medium">
                        {index + 1}
                      </div>
                      <span className="text-sm font-medium text-gray-900">{stylist.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-[#160B53]">{stylist.count} clients</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>

        {/* Payment Methods */}
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="h-5 w-5 text-[#160B53]" />
              <h2 className="text-lg font-semibold text-gray-900">Payment Method Preferences</h2>
            </div>
            <div className="space-y-3">
              {Object.keys(clientPreferences.paymentMethods).length === 0 ? (
                <p className="text-sm text-gray-500">No payment data available</p>
              ) : (
                Object.entries(clientPreferences.paymentMethods)
                  .sort((a, b) => b[1] - a[1])
                  .map(([method, count]) => (
                    <div key={method} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-900 capitalize">{method}</span>
                      <span className="text-sm font-semibold text-[#160B53]">{count} transactions</span>
                    </div>
                  ))
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Visit Patterns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Peak Hours */}
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-[#160B53]" />
              <h2 className="text-lg font-semibold text-gray-900">Peak Visit Hours</h2>
            </div>
            <div className="space-y-3">
              {visitPatterns.peakHours.length === 0 ? (
                <p className="text-sm text-gray-500">No visit time data available</p>
              ) : (
                visitPatterns.peakHours.map(({ hour, count }, index) => {
                  const hourLabel = hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`;
                  const maxCount = Math.max(...visitPatterns.peakHours.map(h => h.count));
                  const percentage = (count / maxCount) * 100;
                  
                  return (
                    <div key={index} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-gray-900">{hourLabel}</span>
                        <span className="text-gray-600">{count} visits</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-[#160B53] h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </Card>

        {/* Peak Days */}
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-5 w-5 text-[#160B53]" />
              <h2 className="text-lg font-semibold text-gray-900">Peak Visit Days</h2>
            </div>
            <div className="space-y-3">
              {visitPatterns.peakDays.length === 0 ? (
                <p className="text-sm text-gray-500">No visit day data available</p>
              ) : (
                visitPatterns.peakDays.map(({ day, count }, index) => {
                  const maxCount = Math.max(...visitPatterns.peakDays.map(d => d.count));
                  const percentage = (count / maxCount) * 100;
                  
                  return (
                    <div key={index} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-gray-900">{day}</span>
                        <span className="text-gray-600">{count} visits</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-[#160B53] h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Spending Patterns */}
      <Card>
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-[#160B53]" />
            <h2 className="text-lg font-semibold text-gray-900">Spending Patterns</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <Scissors className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-1">Service Revenue</p>
              <p className="text-2xl font-bold text-blue-600">
                ₱{spendingPatterns.serviceRevenue.toFixed(2)}
              </p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <ShoppingBag className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-1">Product Revenue</p>
              <p className="text-2xl font-bold text-green-600">
                ₱{spendingPatterns.productRevenue.toFixed(2)}
              </p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <Banknote className="h-8 w-8 text-purple-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-1">Avg. Transaction</p>
              <p className="text-2xl font-bold text-purple-600">
                ₱{spendingPatterns.avgTransactionValue.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Client Segmentation */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Client Segmentation</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-amber-50 rounded-lg">
              <div className="text-3xl font-bold text-amber-700">{segmentation.bronze}</div>
              <div className="text-sm text-amber-600 mt-1">Bronze</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-3xl font-bold text-gray-700">{segmentation.silver}</div>
              <div className="text-sm text-gray-600 mt-1">Silver</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-3xl font-bold text-yellow-700">{segmentation.gold}</div>
              <div className="text-sm text-yellow-600 mt-1">Gold</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-3xl font-bold text-purple-700">{segmentation.platinum}</div>
              <div className="text-sm text-purple-600 mt-1">Platinum</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Feedback Statistics */}
      {feedbackStats && feedbackStats.totalFeedback > 0 && (
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Star className="h-5 w-5 text-yellow-500" />
              <h2 className="text-lg font-semibold text-gray-900">Client Satisfaction</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">Overall Rating</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl font-bold text-gray-900">
                    {feedbackStats.averageOverallRating}
                  </span>
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600">Stylist Rating</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl font-bold text-gray-900">
                    {feedbackStats.averageStylistRating}
                  </span>
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600">Service Rating</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl font-bold text-gray-900">
                    {feedbackStats.averageServiceRating}
                  </span>
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600">Recommendation Rate</p>
                <div className="mt-1">
                  <span className="text-2xl font-bold text-gray-900">
                    {feedbackStats.recommendationRate}%
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4 text-sm text-gray-500">
              Based on {feedbackStats.totalFeedback} feedback submissions
            </div>
          </div>
        </Card>
      )}

      {/* Top Clients */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Clients by Spending</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Client
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Tier
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Visits
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Total Spent
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Last Visit
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {topClients.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-4 py-4 text-center text-gray-500">
                      No client data available
                    </td>
                  </tr>
                ) : (
                  topClients.map(({ client, segmentation: seg }, index) => (
                    <tr key={client.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-[#2D1B4E] flex items-center justify-center text-white text-xs font-medium">
                            {index + 1}
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">
                              {client.firstName} {client.lastName}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded ${
                          seg.tier === 'Platinum' ? 'bg-purple-100 text-purple-700' :
                          seg.tier === 'Gold' ? 'bg-yellow-100 text-yellow-700' :
                          seg.tier === 'Silver' ? 'bg-gray-100 text-gray-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {seg.tier}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {seg.visitFrequency}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        ₱{seg.totalSpent?.toFixed(2) || '0.00'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {seg.lastVisit ? format(seg.lastVisit, 'MMM dd, yyyy') : 'N/A'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ClientAnalytics;
