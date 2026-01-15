import { useEffect, useMemo, useRef, useState } from 'react';
import { Banknote, Download, Printer, Search, User } from 'lucide-react';
import { collection, getDocs, query, where, orderBy, Timestamp, doc, getDoc, updateDoc, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import PDFPreviewModal from '../../components/ui/PDFPreviewModal';
import toast from 'react-hot-toast';

const DEFAULT_COMMISSION_PERCENT = 5;

const CommissionManagement = () => {
  const [loading, setLoading] = useState(true);
  const [stylistsLoading, setStylistsLoading] = useState(true);
  const [transactionsLoading, setTransactionsLoading] = useState(true);

  const [stylists, setStylists] = useState([]);

  const [records, setRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const [showPDFPreview, setShowPDFPreview] = useState(false);
  const printRef = useRef(null);

  const [rowOverrideDrafts, setRowOverrideDrafts] = useState({});
  const [rowSaving, setRowSaving] = useState({});

  useEffect(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setDateRange({
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10)
    });
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        await Promise.all([fetchStylists(), fetchRecords()]);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [dateRange.start, dateRange.end]);

  const fetchStylists = async () => {
    try {
      setStylistsLoading(true);

      const usersRef = collection(db, 'users');
      const legacyQuery = query(usersRef, where('role', '==', 'stylist'));
      const rolesQuery = query(usersRef, where('roles', 'array-contains', 'stylist'));

      const [legacySnapshot, rolesSnapshot] = await Promise.all([getDocs(legacyQuery), getDocs(rolesQuery)]);

      const stylistsMap = new Map();
      legacySnapshot.forEach((d) => {
        const data = d.data();
        stylistsMap.set(d.id, {
          id: d.id,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          email: data.email || '',
          isActive: data.isActive !== false
        });
      });

      rolesSnapshot.forEach((d) => {
        if (!stylistsMap.has(d.id)) {
          const data = d.data();
          stylistsMap.set(d.id, {
            id: d.id,
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            email: data.email || '',
            isActive: data.isActive !== false
          });
        }
      });

      const stylistsList = Array.from(stylistsMap.values()).sort((a, b) => {
        const aName = `${a.firstName} ${a.lastName}`.trim().toLowerCase();
        const bName = `${b.firstName} ${b.lastName}`.trim().toLowerCase();
        return aName.localeCompare(bName);
      });

      setStylists(stylistsList);
    } catch (error) {
      console.error('Error fetching stylists:', error);
      toast.error('Failed to load stylists');
    } finally {
      setStylistsLoading(false);
    }
  };

  const fetchRecords = async () => {
    try {
      setTransactionsLoading(true);

      const transactionsRef = collection(db, 'transactions');
      const constraints = [orderBy('createdAt', 'desc'), limit(500)];

      const startDate = dateRange.start ? new Date(dateRange.start) : null;
      const endDate = dateRange.end ? new Date(dateRange.end) : null;

      if (startDate) {
        startDate.setHours(0, 0, 0, 0);
        constraints.unshift(where('createdAt', '>=', Timestamp.fromDate(startDate)));
      }
      if (endDate) {
        endDate.setHours(23, 59, 59, 999);
        constraints.unshift(where('createdAt', '<=', Timestamp.fromDate(endDate)));
      }

      let snapshot;
      try {
        snapshot = await getDocs(query(transactionsRef, ...constraints));
      } catch (queryError) {
        console.warn('Commission query error, falling back:', queryError);
        snapshot = await getDocs(query(transactionsRef, limit(500)));
      }

      const parsed = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (String(data?.status || '').toLowerCase() !== 'paid') return;
        const createdAt = data.createdAt;
        const createdAtDate = createdAt?.toDate ? createdAt.toDate() : createdAt instanceof Date ? createdAt : createdAt ? new Date(createdAt) : null;
        const items = Array.isArray(data.items) ? data.items : [];
        const servicesArray = Array.isArray(data.services) ? data.services : [];

        const pushRecord = ({
          key,
          itemIndex,
          serviceId,
          serviceName,
          stylistId,
          stylistName,
          quantity,
          unitPrice,
          adminCommissionPercentage
        }) => {
          if (createdAtDate instanceof Date) {
            if (startDate instanceof Date && createdAtDate < startDate) return;
            if (endDate instanceof Date && createdAtDate > endDate) return;
          }

          const qty = Number(quantity) || 1;
          const price = Number(unitPrice) || 0;
          const saleAmount = Number((price * qty).toFixed(2));
          const perSaleOverride = adminCommissionPercentage;
          const adminPercent = typeof perSaleOverride === 'number' ? perSaleOverride : DEFAULT_COMMISSION_PERCENT;
          const commissionEarned = Number((saleAmount * (adminPercent / 100)).toFixed(2));

          parsed.push({
            id: `${d.id}-${key}`,
            transactionId: d.id,
            transactionDate: createdAtDate,
            branchName: data.branchName || '',
            productId: serviceId || '',
            productName: serviceName || 'Service',
            quantity: qty,
            saleAmount,
            adminPercent,
            commissionEarned,
            commissionerId: stylistId || '',
            commissionerName: stylistName || 'Unassigned',
            itemIndex,
            hasOverride: typeof perSaleOverride === 'number'
          });
        };

        // Primary: service items stored inside items[]
        items.forEach((item, itemIndex) => {
          if (item?.type !== 'service') return;
          pushRecord({
            key: `item-${itemIndex}`,
            itemIndex,
            serviceId: item?.id || item?.serviceId || '',
            serviceName: item?.name || item?.serviceName || data?.serviceName || 'Service',
            stylistId: item?.stylistId || data?.stylistId || '',
            stylistName: item?.stylistName || data?.stylistName || '',
            quantity: item?.quantity ?? 1,
            unitPrice: item?.price ?? item?.basePrice ?? data?.servicePrice ?? 0,
            adminCommissionPercentage: item?.adminCommissionPercentage
          });
        });

        // Fallback: services stored in transaction.services[] (legacy / arrival-based)
        servicesArray.forEach((svc, svcIndex) => {
          pushRecord({
            key: `svc-${svcIndex}`,
            itemIndex: null,
            serviceId: svc?.serviceId || svc?.id || '',
            serviceName: svc?.serviceName || svc?.name || data?.serviceName || 'Service',
            stylistId: svc?.stylistId || data?.stylistId || '',
            stylistName: svc?.stylistName || data?.stylistName || '',
            quantity: svc?.quantity ?? 1,
            unitPrice: svc?.price ?? data?.servicePrice ?? 0,
            adminCommissionPercentage: svc?.adminCommissionPercentage
          });
        });

        // Fallback: single service fields on transaction
        if ((items.length === 0 || !items.some((i) => i?.type === 'service')) && servicesArray.length === 0 && (data?.serviceName || data?.servicePrice)) {
          pushRecord({
            key: 'svc-single',
            itemIndex: null,
            serviceId: data?.serviceId || '',
            serviceName: data?.serviceName || 'Service',
            stylistId: data?.stylistId || '',
            stylistName: data?.stylistName || '',
            quantity: 1,
            unitPrice: data?.servicePrice ?? 0,
            adminCommissionPercentage: data?.adminCommissionPercentage
          });
        }
      });

      setRecords(parsed);

      const overrides = {};
      parsed.forEach((r) => {
        overrides[r.id] = String(r.adminPercent ?? 0);
      });
      setRowOverrideDrafts(overrides);
    } catch (error) {
      console.error('Error fetching commission records:', error);
      toast.error('Failed to load commission records');
    } finally {
      setTransactionsLoading(false);
    }
  };

  const stylistNameById = useMemo(() => {
    const map = {};
    stylists.forEach((s) => {
      map[s.id] = `${s.firstName} ${s.lastName}`.trim() || s.email || 'Unknown';
    });
    return map;
  }, [stylists]);

  const filteredRecords = useMemo(() => {
    let filtered = [...records];

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      filtered = filtered.filter((r) => {
        const stylistName = (r.commissionerName || stylistNameById[r.commissionerId] || '').toLowerCase();
        const serviceName = (r.productName || '').toLowerCase();
        const branchName = (r.branchName || '').toLowerCase();
        return stylistName.includes(q) || serviceName.includes(q) || branchName.includes(q);
      });
    }

    return filtered;
  }, [records, searchTerm, stylistNameById]);

  const totals = useMemo(() => {
    const totalCommission = filteredRecords.reduce((sum, r) => sum + (Number(r.commissionEarned) || 0), 0);
    const totalServiceAmount = filteredRecords.reduce((sum, r) => sum + (Number(r.saleAmount) || 0), 0);
    return {
      totalCommission: Number(totalCommission.toFixed(2)),
      totalServiceAmount: Number(totalServiceAmount.toFixed(2)),
      recordCount: filteredRecords.length
    };
  }, [filteredRecords]);


  const handleSaveRowOverride = async (record) => {
    if (!record?.transactionId && record?.transactionId !== '') return;

    if (record?.itemIndex == null) {
      toast.error('Override is not available for this record');
      return;
    }

    const raw = rowOverrideDrafts[record.id];
    const value = Number(raw);
    if (Number.isNaN(value) || value < 0 || value > 100) {
      toast.error('Commission % must be between 0 and 100');
      return;
    }

    try {
      setRowSaving((prev) => ({ ...prev, [record.id]: true }));
      const txRef = doc(db, 'transactions', record.transactionId);
      const snap = await getDoc(txRef);
      if (!snap.exists()) {
        toast.error('Transaction not found');
        return;
      }
      const data = snap.data();
      const items = Array.isArray(data.items) ? [...data.items] : [];
      if (!items[record.itemIndex]) {
        toast.error('Transaction item not found');
        return;
      }

      items[record.itemIndex] = {
        ...items[record.itemIndex],
        adminCommissionPercentage: value
      };

      await updateDoc(txRef, {
        items,
        updatedAt: Timestamp.now()
      });

      setRecords((prev) =>
        prev.map((r) => {
          if (r.id !== record.id) return r;
          const saleAmount = Number(r.saleAmount) || 0;
          const commissionEarned = Number((saleAmount * (value / 100)).toFixed(2));
          return {
            ...r,
            adminPercent: value,
            commissionEarned,
            hasOverride: true
          };
        })
      );

      toast.success('Per-service override saved');
    } catch (error) {
      console.error('Error saving per-service override:', error);
      toast.error('Failed to save override');
    } finally {
      setRowSaving((prev) => ({ ...prev, [record.id]: false }));
    }
  };

  const handleExportCSV = () => {
    if (!filteredRecords.length) {
      toast.error('No commission data to export');
      return;
    }

    const headers = ['Service Date', 'Stylist', 'Service Type', 'Qty', 'Service Price', 'Commission %', 'Commission Earned', 'Branch', 'Transaction ID'];
    const rows = filteredRecords.map((r) => {
      const dateText = r.transactionDate instanceof Date ? r.transactionDate.toISOString() : '';
      const stylistName = r.commissionerName || stylistNameById[r.commissionerId] || 'Unknown';
      return [
        dateText,
        stylistName,
        r.productName,
        r.quantity,
        Number(r.saleAmount).toFixed(2),
        Number(r.adminPercent || 0).toFixed(2),
        Number(r.commissionEarned).toFixed(2),
        r.branchName || '',
        r.transactionId
      ];
    });

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `commissions_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Commissions exported');
  };

  const handlePrint = () => {
    if (!printRef.current) {
      toast.error('Print content not ready. Please try again.');
      return;
    }
    setShowPDFPreview(true);
  };

  if (loading || stylistsLoading || transactionsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Banknote className="h-6 w-6 text-primary-600" />
            Commission Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">Track commissions from services</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 border border-primary-300 text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
            title="Print PDF"
          >
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">Print</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            title="Export CSV"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Commission</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">₱{totals.totalCommission.toFixed(2)}</p>
            </div>
            <Banknote className="h-10 w-10 text-primary-200" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Service Amount</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">₱{totals.totalServiceAmount.toFixed(2)}</p>
            </div>
            <Banknote className="h-10 w-10 text-primary-200" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Records</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totals.recordCount}</p>
            </div>
            <User className="h-10 w-10 text-primary-200" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Stylist, service type, branch..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Commission Records</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stylist</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service Type</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Service Price</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Commission %</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Commission Earned</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-gray-500">No commission records found</td>
                </tr>
              ) : (
                filteredRecords.map((r) => {
                  const dateText = r.transactionDate instanceof Date ? r.transactionDate.toLocaleString() : 'N/A';
                  const stylistName = r.commissionerName || stylistNameById[r.commissionerId] || 'Unknown';
                  const isSaving = !!rowSaving[r.id];
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{dateText}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{stylistName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.productName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">{r.quantity}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">₱{Number(r.saleAmount).toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={rowOverrideDrafts[r.id] ?? String(r.adminPercent ?? 0)}
                            onChange={(e) => setRowOverrideDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                            className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-right focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                          <span className="text-sm text-gray-500">%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-primary-600">₱{Number(r.commissionEarned).toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleSaveRowOverride(r)}
                          disabled={isSaving}
                          className={`px-4 py-2 rounded-lg text-white transition-colors ${isSaving ? 'bg-gray-400' : 'bg-primary-600 hover:bg-primary-700'}`}
                        >
                          {isSaving ? 'Saving...' : r.hasOverride ? 'Update' : 'Override'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredRecords.length > 0 && (
              <tfoot className="bg-gray-50">
                <tr>
                  <td className="px-6 py-3 text-sm font-semibold text-gray-900" colSpan="4">Grand Total</td>
                  <td className="px-6 py-3 text-right text-sm font-semibold text-gray-900">₱{totals.totalServiceAmount.toFixed(2)}</td>
                  <td className="px-6 py-3"></td>
                  <td className="px-6 py-3 text-right text-sm font-semibold text-primary-700">₱{totals.totalCommission.toFixed(2)}</td>
                  <td className="px-6 py-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <div ref={printRef} style={{ position: 'fixed', left: '-200%', top: 0, width: '8.5in', zIndex: -1 }}>
        <div style={{ padding: '16px', fontSize: '12px' }}>
          <div style={{ textAlign: 'center', marginBottom: '12px' }}>
            <div style={{ fontWeight: 700, fontSize: '18px' }}>Commission Report</div>
            <div style={{ fontWeight: 600 }}>David's Salon Management System</div>
            <div>Generated: {new Date().toLocaleDateString()}</div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <div>Total Service Amount: ₱{totals.totalServiceAmount.toFixed(2)}</div>
            <div>Total Commission: ₱{totals.totalCommission.toFixed(2)}</div>
            <div>Records: {totals.recordCount}</div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #000', padding: '6px' }}>Service Date</th>
                <th style={{ border: '1px solid #000', padding: '6px' }}>Stylist</th>
                <th style={{ border: '1px solid #000', padding: '6px' }}>Service Type</th>
                <th style={{ border: '1px solid #000', padding: '6px' }}>Qty</th>
                <th style={{ border: '1px solid #000', padding: '6px' }}>Service Price</th>
                <th style={{ border: '1px solid #000', padding: '6px' }}>Commission %</th>
                <th style={{ border: '1px solid #000', padding: '6px' }}>Commission</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((r) => {
                const dateText = r.transactionDate instanceof Date ? r.transactionDate.toLocaleString() : '';
                const stylistName = r.commissionerName || stylistNameById[r.commissionerId] || 'Unknown';
                return (
                  <tr key={r.id}>
                    <td style={{ border: '1px solid #000', padding: '6px' }}>{dateText}</td>
                    <td style={{ border: '1px solid #000', padding: '6px' }}>{stylistName}</td>
                    <td style={{ border: '1px solid #000', padding: '6px' }}>{r.productName}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>{r.quantity}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>₱{Number(r.saleAmount).toFixed(2)}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>{Number(r.adminPercent || 0).toFixed(2)}%</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>₱{Number(r.commissionEarned).toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <PDFPreviewModal
        isOpen={showPDFPreview}
        onClose={() => setShowPDFPreview(false)}
        contentRef={printRef}
        title="Commission Report"
        fileName="commission_report"
      />
    </div>
  );
};

export default CommissionManagement;
