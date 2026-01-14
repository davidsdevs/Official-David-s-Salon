/**
 * BIR Receipt Batch Modal
 * Allows Branch Managers to add and manage BIR-issued receipt batches
 */

import { useState, useEffect } from 'react';
import { X, Plus, Receipt, AlertCircle, CheckCircle, Trash2, RefreshCw, Package, SkipForward, Ban, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  createBIRReceiptBatch,
  getBIRReceiptBatches,
  getActiveBIRReceiptBatch,
  deactivateBIRReceiptBatch,
  reactivateBIRReceiptBatch,
  voidReceiptNumbers,
  skipToReceiptNumber
} from '../../services/birReceiptService';
import toast from 'react-hot-toast';

const BIRReceiptBatchModal = ({ isOpen, onClose, branchId }) => {
  const { userData } = useAuth();
  const [batches, setBatches] = useState([]);
  const [activeBatch, setActiveBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showVoidForm, setShowVoidForm] = useState(false);
  const [expandedBatch, setExpandedBatch] = useState(null);
  
  // Form state
  const [prefix, setPrefix] = useState('DS');
  const [startNumber, setStartNumber] = useState('');
  const [endNumber, setEndNumber] = useState('');
  const [dateReceived, setDateReceived] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  
  // Void form state
  const [voidMode, setVoidMode] = useState('skip'); // 'skip' or 'select'
  const [skipToNumber, setSkipToNumber] = useState('');
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [voidReason, setVoidReason] = useState('');
  const [voidingBatchId, setVoidingBatchId] = useState(null);

  useEffect(() => {
    if (isOpen && branchId) {
      fetchBatches();
    }
  }, [isOpen, branchId]);

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const [allBatches, active] = await Promise.all([
        getBIRReceiptBatches(branchId),
        getActiveBIRReceiptBatch(branchId)
      ]);
      setBatches(allBatches);
      setActiveBatch(active);
    } catch (error) {
      console.error('Error fetching batches:', error);
      toast.error('Failed to load receipt batches');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!prefix.trim()) {
      toast.error('Please enter a receipt prefix');
      return;
    }
    
    const start = parseInt(startNumber);
    const end = parseInt(endNumber);
    
    if (isNaN(start) || start < 1) {
      toast.error('Start number must be at least 1');
      return;
    }
    
    if (isNaN(end) || end <= start) {
      toast.error('End number must be greater than start number');
      return;
    }
    
    try {
      setSubmitting(true);
      
      await createBIRReceiptBatch({
        branchId,
        prefix: prefix.trim(),
        startNumber: start,
        endNumber: end,
        dateReceived: dateReceived,
        notes: notes.trim()
      }, userData);
      
      toast.success('BIR receipt batch added successfully');
      
      // Reset form
      setPrefix('DS');
      setStartNumber('');
      setEndNumber('');
      setDateReceived(new Date().toISOString().split('T')[0]);
      setNotes('');
      setShowAddForm(false);
      
      // Refresh batches
      await fetchBatches();
    } catch (error) {
      console.error('Error creating batch:', error);
      toast.error(error.message || 'Failed to create receipt batch');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (batchId) => {
    if (!window.confirm('Are you sure you want to deactivate this batch? It will no longer be used for new transactions.')) {
      return;
    }
    
    try {
      await deactivateBIRReceiptBatch(batchId, userData);
      toast.success('Batch deactivated');
      await fetchBatches();
    } catch (error) {
      console.error('Error deactivating batch:', error);
      toast.error('Failed to deactivate batch');
    }
  };

  const handleReactivate = async (batchId) => {
    try {
      await reactivateBIRReceiptBatch(batchId, userData);
      toast.success('Batch reactivated');
      await fetchBatches();
    } catch (error) {
      console.error('Error reactivating batch:', error);
      toast.error(error.message || 'Failed to reactivate batch');
    }
  };

  const openVoidForm = (batch) => {
    setVoidingBatchId(batch.id);
    setShowVoidForm(true);
    setVoidMode('skip');
    setSkipToNumber('');
    setSelectedNumbers([]);
    setVoidReason('');
  };

  const handleVoidSubmit = async () => {
    if (!voidReason.trim()) {
      toast.error('Please provide a reason for voiding');
      return;
    }

    try {
      setSubmitting(true);
      
      if (voidMode === 'skip') {
        if (!skipToNumber || parseInt(skipToNumber) <= 0) {
          toast.error('Please enter a valid receipt number to skip to');
          return;
        }
        
        const result = await skipToReceiptNumber(voidingBatchId, parseInt(skipToNumber), voidReason, userData);
        toast.success(`Skipped to receipt #${skipToNumber}. ${result.voidedCount || 0} receipts voided.`);
      } else {
        if (selectedNumbers.length === 0) {
          toast.error('Please select at least one receipt number to void');
          return;
        }
        
        const result = await voidReceiptNumbers(voidingBatchId, selectedNumbers, voidReason, userData);
        toast.success(`${result.voidedCount} receipt(s) voided successfully`);
      }
      
      setShowVoidForm(false);
      setVoidingBatchId(null);
      await fetchBatches();
    } catch (error) {
      console.error('Error voiding receipts:', error);
      toast.error(error.message || 'Failed to void receipts');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleNumberSelection = (num) => {
    setSelectedNumbers(prev => 
      prev.includes(num) 
        ? prev.filter(n => n !== num)
        : [...prev, num]
    );
  };

  const selectAllAvailable = (batch) => {
    const available = [];
    for (let i = batch.currentNumber + 1; i <= batch.endNumber; i++) {
      if (!batch.voidedNumbers?.includes(i)) {
        available.push(i);
      }
    }
    setSelectedNumbers(available);
  };

  const getAvailableNumbers = (batch) => {
    const available = [];
    const maxToShow = 50; // Limit display for performance
    let count = 0;
    
    for (let i = batch.currentNumber + 1; i <= batch.endNumber && count < maxToShow; i++) {
      if (!batch.voidedNumbers?.includes(i)) {
        available.push(i);
        count++;
      }
    }
    return available;
  };

  const getStatusBadge = (batch) => {
    if (batch.status === 'exhausted') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
          <AlertCircle className="w-3 h-3" />
          Exhausted
        </span>
      );
    }
    if (batch.status === 'inactive') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
          Inactive
        </span>
      );
    }
    if (batch.remainingReceipts <= 10) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
          <AlertCircle className="w-3 h-3" />
          Low ({batch.remainingReceipts} left)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
        <CheckCircle className="w-3 h-3" />
        Active
      </span>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} />
        
        <div className="relative inline-block w-full max-w-2xl px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Receipt className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">BIR Receipt Batches</h3>
                <p className="text-sm text-gray-500">Manage BIR-issued receipt number batches</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Active Batch Summary */}
          {activeBatch && (
            <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-700">Current Active Batch</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {activeBatch.prefix}-{String(activeBatch.currentNumber + 1).padStart(String(activeBatch.endNumber).length, '0')}
                  </p>
                  <p className="text-sm text-purple-600">Next receipt number</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-purple-900">{activeBatch.remainingReceipts}</p>
                  <p className="text-sm text-purple-600">receipts remaining</p>
                </div>
              </div>
              <div className="mt-3 bg-purple-200 rounded-full h-2">
                <div 
                  className="bg-purple-600 h-2 rounded-full transition-all"
                  style={{ width: `${(activeBatch.usedReceipts / activeBatch.totalReceipts) * 100}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-purple-600 text-right">
                {activeBatch.usedReceipts} of {activeBatch.totalReceipts} used
              </p>
            </div>
          )}

          {!activeBatch && !loading && (
            <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="flex items-center gap-2 text-yellow-700">
                <AlertCircle className="w-5 h-5" />
                <p className="font-medium">No active receipt batch</p>
              </div>
              <p className="mt-1 text-sm text-yellow-600">
                Add a new batch to enable automatic receipt numbering for transactions.
              </p>
            </div>
          )}

          {/* BIR Summary Card - Total across all batches */}
          {!loading && batches.length > 0 && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-3">BIR Receipt Summary (All Batches)</h4>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-3 bg-white rounded-lg border">
                  <p className="text-2xl font-bold text-gray-900">
                    {batches.reduce((sum, b) => sum + b.totalReceipts, 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">Total Receipts</p>
                </div>
                <div className="text-center p-3 bg-white rounded-lg border">
                  <p className="text-2xl font-bold text-green-600">
                    {batches.reduce((sum, b) => sum + b.usedReceipts, 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">Used</p>
                </div>
                <div className="text-center p-3 bg-white rounded-lg border">
                  <p className="text-2xl font-bold text-blue-600">
                    {batches.filter(b => b.status === 'active').reduce((sum, b) => sum + b.remainingReceipts, 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">Available</p>
                </div>
                <div className="text-center p-3 bg-white rounded-lg border">
                  <p className="text-2xl font-bold text-purple-600">
                    {batches.length}
                  </p>
                  <p className="text-xs text-gray-500">Total Batches</p>
                </div>
              </div>
            </div>
          )}

          {/* Add New Batch Form */}
          {showAddForm ? (
            <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg border">
              <h4 className="font-medium text-gray-900 mb-4">Add New Receipt Batch</h4>
              
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prefix *
                  </label>
                  <input
                    type="text"
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                    placeholder="DS"
                    maxLength={5}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">e.g., DS, BIR</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Number *
                  </label>
                  <input
                    type="number"
                    value={startNumber}
                    onChange={(e) => setStartNumber(e.target.value)}
                    placeholder="1"
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Number *
                  </label>
                  <input
                    type="number"
                    value={endNumber}
                    onChange={(e) => setEndNumber(e.target.value)}
                    placeholder="500"
                    min="2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    required
                  />
                </div>
              </div>
              
              {startNumber && endNumber && parseInt(endNumber) > parseInt(startNumber) && (
                <div className="mb-4 p-3 bg-purple-50 rounded-lg">
                  <p className="text-sm text-purple-700">
                    <strong>Preview:</strong> {prefix}-{String(parseInt(startNumber)).padStart(String(endNumber).length, '0')} to {prefix}-{endNumber}
                  </p>
                  <p className="text-sm text-purple-600">
                    Total: {parseInt(endNumber) - parseInt(startNumber) + 1} receipts
                  </p>
                </div>
              )}
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date Received *
                </label>
                <input
                  type="date"
                  value={dateReceived}
                  onChange={(e) => setDateReceived(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">Date when batch was received from HQ</p>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Received from HQ on Jan 15, 2026"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Add Batch
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="mb-6 w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add New Receipt Batch
            </button>
          )}

          {/* Void Receipt Numbers Form */}
          {showVoidForm && voidingBatchId && (
            <div className="mb-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-orange-900 flex items-center gap-2">
                  <Ban className="w-5 h-5" />
                  Void Receipt Numbers
                </h4>
                <button
                  onClick={() => { setShowVoidForm(false); setVoidingBatchId(null); }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Mode Selection */}
              <div className="flex gap-4 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="voidMode"
                    value="skip"
                    checked={voidMode === 'skip'}
                    onChange={() => setVoidMode('skip')}
                    className="text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">Skip to number</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="voidMode"
                    value="select"
                    checked={voidMode === 'select'}
                    onChange={() => setVoidMode('select')}
                    className="text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">Select specific numbers</span>
                </label>
              </div>
              
              {voidMode === 'skip' ? (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Skip to Receipt Number
                  </label>
                  <input
                    type="number"
                    value={skipToNumber}
                    onChange={(e) => setSkipToNumber(e.target.value)}
                    placeholder="Enter the number to skip to"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    All numbers before this will be voided (e.g., if batch destroyed in fire)
                  </p>
                </div>
              ) : (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Select Numbers to Void
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const batch = batches.find(b => b.id === voidingBatchId);
                        if (batch) selectAllAvailable(batch);
                      }}
                      className="text-xs text-orange-600 hover:text-orange-700"
                    >
                      Select All Available
                    </button>
                  </div>
                  <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-white">
                    <div className="flex flex-wrap gap-1">
                      {(() => {
                        const batch = batches.find(b => b.id === voidingBatchId);
                        if (!batch) return null;
                        const available = getAvailableNumbers(batch);
                        return available.map(num => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => toggleNumberSelection(num)}
                            className={`px-2 py-1 text-xs rounded ${
                              selectedNumbers.includes(num)
                                ? 'bg-orange-500 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {String(num).padStart(4, '0')}
                          </button>
                        ));
                      })()}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {selectedNumbers.length} number(s) selected
                  </p>
                </div>
              )}
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for Voiding *
                </label>
                <input
                  type="text"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="e.g., Receipts destroyed in fire, damaged, lost"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  required
                />
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setShowVoidForm(false); setVoidingBatchId(null); }}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleVoidSubmit}
                  disabled={submitting}
                  className="px-4 py-2 text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Ban className="w-4 h-4" />
                      Void Receipts
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Batches List */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">All Batches</h4>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
              </div>
            ) : batches.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No receipt batches yet</p>
                <p className="text-sm">Add your first batch to get started</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {batches.map((batch) => (
                  <div
                    key={batch.id}
                    className={`rounded-lg border ${
                      batch.status === 'active' ? 'border-green-200 bg-green-50' :
                      batch.status === 'exhausted' ? 'border-red-200 bg-red-50' :
                      'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-900">
                              {batch.prefix}-{String(batch.startNumber).padStart(String(batch.endNumber).length, '0')} to {batch.prefix}-{batch.endNumber}
                            </span>
                            {getStatusBadge(batch)}
                            {batch.voidedNumbers?.length > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700">
                                <Ban className="w-3 h-3" />
                                {batch.voidedNumbers.length} voided
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            Used: {batch.usedReceipts} / {batch.totalReceipts} • 
                            Current: {batch.prefix}-{String(batch.currentNumber).padStart(String(batch.endNumber).length, '0')}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Received: {batch.dateReceived ? new Date(batch.dateReceived.seconds ? batch.dateReceived.seconds * 1000 : batch.dateReceived).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                            {batch.notes && ` • ${batch.notes}`}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {batch.status === 'active' && batch.remainingReceipts > 0 && (
                            <button
                              onClick={() => openVoidForm(batch)}
                              className="p-2 text-orange-500 hover:text-orange-700 hover:bg-orange-100 rounded-lg"
                              title="Void receipt numbers"
                            >
                              <SkipForward className="w-4 h-4" />
                            </button>
                          )}
                          {batch.status === 'active' && (
                            <button
                              onClick={() => handleDeactivate(batch.id)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                              title="Deactivate batch"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          {batch.status === 'inactive' && batch.remainingReceipts > 0 && (
                            <button
                              onClick={() => handleReactivate(batch.id)}
                              className="px-3 py-1 text-sm text-green-600 hover:bg-green-100 rounded-lg"
                            >
                              Reactivate
                            </button>
                          )}
                          <button
                            onClick={() => setExpandedBatch(expandedBatch === batch.id ? null : batch.id)}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                            title="Show details"
                          >
                            {expandedBatch === batch.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    {/* Expanded Details */}
                    {expandedBatch === batch.id && (
                      <div className="px-4 pb-4 border-t border-gray-200 mt-2 pt-3">
                        {batch.voidedNumbers?.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs font-medium text-gray-700 mb-1">Voided Numbers:</p>
                            <div className="flex flex-wrap gap-1">
                              {batch.voidedNumbers.slice(0, 20).map(num => (
                                <span key={num} className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded">
                                  {String(num).padStart(4, '0')}
                                </span>
                              ))}
                              {batch.voidedNumbers.length > 20 && (
                                <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                                  +{batch.voidedNumbers.length - 20} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {batch.voidLogs?.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-gray-700 mb-1">Void History:</p>
                            <div className="space-y-1 max-h-24 overflow-y-auto">
                              {batch.voidLogs.map((log, idx) => (
                                <div key={idx} className="text-xs text-gray-600 bg-white p-2 rounded border">
                                  <span className="font-medium">{log.numbers?.length || 0} receipts</span> voided by {log.voidedByName}
                                  <br />
                                  <span className="text-gray-500">Reason: {log.reason}</span>
                                  <br />
                                  <span className="text-gray-400">{new Date(log.voidedAt).toLocaleString()}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {!batch.voidedNumbers?.length && !batch.voidLogs?.length && (
                          <p className="text-xs text-gray-500">No voided receipts in this batch</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BIRReceiptBatchModal;
