// src/pages/04_BranchManager/Deposits.jsx
import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';

import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

import { depositService } from '../../services/depositService';
import { extractAmountFromReceipt, validateExtractedAmount } from '../../utils/ocrService';
import { cloudinaryService } from '../../services/cloudinaryService';
import {
  Upload,
  Camera,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Banknote,
  Calendar,
  Building,
  FileText,
  Loader2,
  Eye,
  RefreshCw,
  Image as ImageIcon,
  TrendingUp,
  TrendingDown,
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Plus,
  Trash2,
  Receipt,
  Download,
  Printer
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const Deposits = () => {
  const { userData } = useAuth();

  const [deposits, setDeposits] = useState([]);
  const [filteredDeposits, setFilteredDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter and sort states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [validationFilter, setValidationFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dateFilterType, setDateFilterType] = useState('all'); // 'all', 'today', 'thisWeek', 'thisMonth', 'custom'
  const [sortBy, setSortBy] = useState('date'); // 'date', 'amount', 'difference'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc', 'desc'

  // Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [depositDate, setDepositDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [receiptImage, setReceiptImage] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');

  // OCR states
  const [isScanning, setIsScanning] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [dailySalesTotal, setDailySalesTotal] = useState(0);
  const [validationResult, setValidationResult] = useState(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDeposit, setSelectedDeposit] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Deposit Adjustments state
  const [adjustments, setAdjustments] = useState([]);

  // Filter modal state
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showDuplicateWarningModal, setShowDuplicateWarningModal] = useState(false);

  // Today's deposit tracking
  const [todaysSales, setTodaysSales] = useState(0);
  const [todaysDeposits, setTodaysDeposits] = useState(0);

  // Load deposits
  const loadDeposits = async () => {
    if (!userData?.branchId) return;

    try {
      setLoading(true);
      setError(null);
      const depositsList = await depositService.getBranchDeposits(userData.branchId);
      setDeposits(depositsList);
    } catch (err) {
      console.error('Error loading deposits:', err);
      // If it's an index error, suggest refresh
      if (err.message?.includes('index') || err.message?.includes('refresh')) {
        setError(`${err.message} If the problem persists, try clearing your browser cache.`);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeposits();
  }, [userData?.branchId]);

  // Calculate today's sales and deposits
  useEffect(() => {
    const fetchTodaysSummary = async () => {
      if (!userData?.branchId) return;

      try {
        const today = new Date().toISOString().split('T')[0];
        
        console.log('=== TODAY DEPOSIT STATUS DEBUG ===');
        console.log('Today string:', today);
        
        // Get today's sales
        const salesTotal = await depositService.getDailySalesTotal(
          userData.branchId,
          today
        );
        console.log('Sales total for today:', salesTotal);
        setTodaysSales(salesTotal);

        // Calculate today's deposits - use depositDate field
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        
        // Also check yesterday's date since timezone might affect it
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        yesterdayDate.setHours(0, 0, 0, 0);
        
        console.log('Today date (normalized):', todayDate);
        console.log('Yesterday date (normalized):', yesterdayDate);
        console.log('All deposits:', deposits);
        
        const depositsForToday = deposits
          .filter(deposit => {
            const depositDate = new Date(deposit.depositDate);
            depositDate.setHours(0, 0, 0, 0);
            
            console.log('Checking deposit:', {
              id: deposit.id,
              depositDate: deposit.depositDate,
              depositDateNormalized: depositDate,
              amount: deposit.amount,
              matchesToday: depositDate.getTime() === todayDate.getTime(),
              matchesYesterday: depositDate.getTime() === yesterdayDate.getTime()
            });
            
            // Match either today or yesterday (to handle timezone issues)
            return depositDate.getTime() === todayDate.getTime() || 
                   depositDate.getTime() === yesterdayDate.getTime();
          })
          .reduce((sum, deposit) => sum + (deposit.amount || 0), 0);
        
        console.log('Total deposits for today:', depositsForToday);
        console.log('=== END DEBUG ===');
        
        setTodaysDeposits(depositsForToday);
      } catch (err) {
        console.error('Error fetching today\'s summary:', err);
      }
    };

    fetchTodaysSummary();
  }, [userData?.branchId, deposits]);

  // Filter and sort deposits
  useEffect(() => {
    let filtered = [...deposits];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(deposit =>
        deposit.referenceNumber?.toLowerCase().includes(term) ||
        deposit.bankName?.toLowerCase().includes(term) ||
        deposit.notes?.toLowerCase().includes(term) ||
        deposit.submittedByName?.toLowerCase().includes(term)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(deposit => deposit.status === statusFilter);
    }

    // Validation filter
    if (validationFilter !== 'all') {
      filtered = filtered.filter(deposit => deposit.validationStatus === validationFilter);
    }

    // Date range filter
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(deposit => {
        const depositDate = new Date(deposit.depositDate);
        return depositDate >= fromDate;
      });
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(deposit => {
        const depositDate = new Date(deposit.depositDate);
        return depositDate <= toDate;
      });
    }

    // Sorting
    filtered.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case 'date':
          aValue = new Date(a.depositDate).getTime();
          bValue = new Date(b.depositDate).getTime();
          break;
        case 'amount':
          aValue = a.amount || 0;
          bValue = b.amount || 0;
          break;
        case 'difference':
          aValue = Math.abs(a.difference || 0);
          bValue = Math.abs(b.difference || 0);
          break;
        default:
          return 0;
      }

      if (sortOrder === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });

    setFilteredDeposits(filtered);
  }, [deposits, searchTerm, statusFilter, validationFilter, dateFrom, dateTo, sortBy, sortOrder]);

  // Get daily sales total and existing deposits when deposit date changes
  useEffect(() => {
    const fetchDailySales = async () => {
      if (!userData?.branchId || !depositDate) return;

      try {
        const salesTotal = await depositService.getDailySalesTotal(
          userData.branchId,
          depositDate // Pass the string "YYYY-MM-DD" directly
        );
        console.log(`[Deposits] Fetched sales for ${depositDate}: ₱${salesTotal}`);
        setDailySalesTotal(salesTotal);
      } catch (err) {
        console.error('Error fetching daily sales:', err);
        // Only show toast on error, not on success or zero sales
      }
    };

    fetchDailySales();
  }, [depositDate, userData?.branchId, deposits.length]);

  // Handle image upload
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      setError('Image size should be less than 5MB');
      return;
    }

    setReceiptImage(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setReceiptPreview(reader.result);
    };
    reader.readAsDataURL(file);

    setError(null);

    // Automatically run OCR when image is uploaded to validate receipt
    // Use setTimeout to ensure state is updated first
    setTimeout(async () => {
      try {
        setIsScanning(true);
        setError(null);
        setOcrResult(null);
        setValidationResult(null);

        // Extract text from receipt using OCR
        const result = await extractAmountFromReceipt(file);

        if (result.success) {
          setOcrResult(result);

          // Check if daily sales total appears in the receipt text
          if (dailySalesTotal > 0 && result.rawText) {
            const salesAmountStr = dailySalesTotal.toString();
            const salesAmountFormatted = dailySalesTotal.toLocaleString('en-US');
            const salesAmountWithPeso = `₱${salesAmountFormatted}`;
            const salesAmountNoComma = salesAmountStr;

            // Check if any variation of the amount appears in the receipt text
            const receiptText = result.rawText.toLowerCase();
            const found =
              receiptText.includes(salesAmountStr.toLowerCase()) ||
              receiptText.includes(salesAmountFormatted.toLowerCase()) ||
              receiptText.includes(salesAmountWithPeso.toLowerCase()) ||
              receiptText.includes(salesAmountNoComma.toLowerCase());

            if (found) {
              setValidationResult({
                isValid: true,
                message: `✓ Daily sales total (${formatCurrency(dailySalesTotal)}) found in receipt`,
                extractedAmount: result.amount,
                expectedAmount: dailySalesTotal
              });
            } else {
              setValidationResult({
                isValid: false,
                message: `⚠ Daily sales total (${formatCurrency(dailySalesTotal)}) not found in receipt`,
                extractedAmount: result.amount,
                expectedAmount: dailySalesTotal
              });
            }
          }
        } else {
          setError('Could not read receipt. Please verify the image is clear.');
          setOcrResult(result);
        }
      } catch (err) {
        console.error('OCR Error:', err);
        setError('Failed to scan receipt. Please verify the image is clear.');
      } finally {
        setIsScanning(false);
      }
    }, 100);
  };

  // Scan receipt with OCR (manual trigger)
  const handleScanReceipt = async () => {
    if (!receiptImage) {
      setError('Please upload a receipt image first');
      return;
    }

    try {
      setIsScanning(true);
      setError(null);
      setOcrResult(null);
      setValidationResult(null);

      // Extract text from receipt using OCR
      const result = await extractAmountFromReceipt(receiptImage);

      if (result.success) {
        setOcrResult(result);

        // Check if daily sales total appears in the receipt text
        if (dailySalesTotal > 0 && result.rawText) {
          const salesAmountStr = dailySalesTotal.toString();
          const salesAmountFormatted = dailySalesTotal.toLocaleString('en-US');
          const salesAmountWithPeso = `₱${salesAmountFormatted}`;
          const salesAmountNoComma = salesAmountStr;

          // Check if any variation of the amount appears in the receipt text
          const receiptText = result.rawText.toLowerCase();
          const found =
            receiptText.includes(salesAmountStr.toLowerCase()) ||
            receiptText.includes(salesAmountFormatted.toLowerCase()) ||
            receiptText.includes(salesAmountWithPeso.toLowerCase()) ||
            receiptText.includes(salesAmountNoComma.toLowerCase());

          if (found) {
            setValidationResult({
              isValid: true,
              message: `✓ Daily sales total (${formatCurrency(dailySalesTotal)}) found in receipt`,
              extractedAmount: result.amount,
              expectedAmount: dailySalesTotal
            });
          } else {
            setValidationResult({
              isValid: false,
              message: `⚠ Daily sales total (${formatCurrency(dailySalesTotal)}) not found in receipt`,
              extractedAmount: result.amount,
              expectedAmount: dailySalesTotal
            });
          }
        }
      } else {
        setError('Could not read receipt. Please verify the image is clear.');
        setOcrResult(result);
      }
    } catch (err) {
      console.error('OCR Error:', err);
      setError('Failed to scan receipt. Please verify the image is clear.');
    } finally {
      setIsScanning(false);
    }
  };

  // Check for anomalies and generate description
  const checkAnomalies = (ocrText, manualAmount, salesTotal) => {
    const anomalies = [];
    let hasAnomaly = false;

    // Check if daily sales total appears in receipt text
    if (ocrText && salesTotal > 0) {
      const salesAmountStr = salesTotal.toString();
      const salesAmountFormatted = salesTotal.toLocaleString('en-US');
      const salesAmountWithPeso = `₱${salesAmountFormatted}`;
      const salesAmountNoComma = salesAmountStr;

      const receiptText = ocrText.toLowerCase();
      const found =
        receiptText.includes(salesAmountStr.toLowerCase()) ||
        receiptText.includes(salesAmountFormatted.toLowerCase()) ||
        receiptText.includes(salesAmountWithPeso.toLowerCase()) ||
        receiptText.includes(salesAmountNoComma.toLowerCase());

      if (!found) {
        hasAnomaly = true;
        anomalies.push(`Daily sales total (${formatCurrency(salesTotal)}) was not found in the receipt. The receipt may not match today's sales.`);
      }
    }

    // Check Manual Amount vs Daily Sales
    if (manualAmount && salesTotal > 0) {
      const manualDifference = Math.abs(manualAmount - salesTotal);
      if (manualDifference > 1) {
        hasAnomaly = true;
        if (manualDifference > 100) {
          anomalies.push(`Deposit amount (${formatCurrency(manualAmount)}) differs significantly from daily sales total (${formatCurrency(salesTotal)}) by ${formatCurrency(manualDifference)}`);
        } else {
          anomalies.push(`Deposit amount (${formatCurrency(manualAmount)}) differs from daily sales total (${formatCurrency(salesTotal)}) by ${formatCurrency(manualDifference)}`);
        }
      }
    }

    // Check if OCR failed to read receipt
    if (!ocrText && salesTotal > 0) {
      hasAnomaly = true;
      anomalies.push(`Could not read receipt text. Unable to verify if receipt contains daily sales total (${formatCurrency(salesTotal)}). Please ensure receipt image is clear.`);
    }

    // Check if no sales data available
    if (salesTotal === 0 && manualAmount) {
      hasAnomaly = true;
      anomalies.push(`No daily sales transactions found for the selected date. Cannot validate deposit amount.`);
    }

    return {
      hasAnomaly,
      description: anomalies.length > 0 ? anomalies.join(' | ') : null
    };
  };

  // Calculate total deposits already made for a specific date
  const getTotalDepositsForDate = (date) => {
    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);

    return deposits
      .filter(deposit => {
        const depositDate = new Date(deposit.depositDate);
        depositDate.setHours(0, 0, 0, 0);
        return depositDate.getTime() === selectedDate.getTime();
      })
      .reduce((sum, deposit) => sum + (deposit.amount || 0), 0);
  };

  // Actual deposit submission function
  const submitDeposit = async () => {
    if (!userData?.branchId) {
      setError('Branch ID not found');
      return;
    }

    if (!depositDate) {
      setError('Please select deposit date');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid deposit amount');
      return;
    }

    if (!receiptImage) {
      setError('Please upload receipt image');
      return;
    }

    // Validate adjustments
    for (const adj of adjustments) {
      if (!adj.amount || parseFloat(adj.amount) <= 0) {
        setError('All adjustments must have a valid amount');
        return;
      }
      if (!adj.description) {
        setError('All adjustments must have a description');
        return;
      }
      if (!adj.receiptImage && !adj.receiptImageUrl) { // Allow existing URL if editing (future proofing)
        setError('All adjustments must have a receipt image');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // Upload receipt image to Cloudinary
      const uploadResult = await cloudinaryService.uploadImage(receiptImage, 'deposits');
      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Failed to upload receipt image');
      }
      const receiptImageUrl = uploadResult.url;

      // Upload adjustment receipt images
      const adjustmentsWithUrls = await Promise.all(adjustments.map(async (adj) => {
        let receiptImageUrl = adj.receiptImageUrl || null;
        let receiptImagePath = adj.receiptImagePath || null;

        if (adj.receiptImage) {
          const uploadResult = await cloudinaryService.uploadImage(adj.receiptImage, 'deposits/adjustments');
          if (uploadResult.success) {
            receiptImageUrl = uploadResult.url;
            receiptImagePath = uploadResult.publicId || '';
          } else {
            throw new Error(`Failed to upload receipt for adjustment: ${adj.description}`);
          }
        }

        return {
          type: adj.type || 'deduction',
          amount: parseFloat(adj.amount) || 0,
          description: adj.description || '',
          receiptImageUrl: receiptImageUrl,
          receiptImagePath: receiptImagePath,
          createdAt: new Date().toISOString()
        };
      }));

      // Calculate totals
      const totalAdditionsVal = adjustmentsWithUrls.filter(a => a.type === 'addition').reduce((sum, a) => sum + a.amount, 0);
      const totalDeductionsVal = adjustmentsWithUrls.filter(a => a.type === 'deduction').reduce((sum, a) => sum + a.amount, 0);

      const depositAmount = parseFloat(amount);
      const adjustedSalesTotal = dailySalesTotal + totalAdditionsVal - totalDeductionsVal;
      const difference = depositAmount - adjustedSalesTotal;

      // Check for anomalies
      const anomalyCheck = checkAnomalies(
        ocrResult?.rawText || ocrResult?.extractedText || null,
        depositAmount,
        adjustedSalesTotal
      );

      // Determine validation status
      let validationStatus = 'pending';
      if (Math.abs(difference) <= 1) {
        validationStatus = 'match';
      } else if (Math.abs(difference) > 100) {
        validationStatus = 'mismatch';
      } else {
        validationStatus = 'manual_review';
      }

      // Create deposit
      const depositData = {
        branchId: userData.branchId,
        depositDate: depositDate,
        amount: depositAmount,
        receiptImageUrl: receiptImageUrl,
        receiptImagePath: uploadResult.publicId || '',
        ocrExtractedAmount: ocrResult?.amount || null,
        ocrConfidence: ocrResult?.confidence || null,
        dailySalesTotal: dailySalesTotal,
        expenses: adjustmentsWithUrls, // Backwards combatibility field name
        totalExpenses: totalDeductionsVal, // Backwards compatibility
        totalAdditions: totalAdditionsVal, // New field
        difference: difference,
        validationStatus: validationStatus,
        hasAnomaly: anomalyCheck.hasAnomaly,
        anomalyDescription: anomalyCheck.description || null,
        submittedBy: userData.uid || userData.id,
        submittedByName: (userData.firstName && userData.lastName
          ? `${userData.firstName} ${userData.lastName}`.trim()
          : (userData.email || 'Unknown')),
        bankName: bankName,
        accountNumber: accountNumber,
        referenceNumber: referenceNumber,
        notes: notes
      };

      await depositService.createDeposit(depositData);

      // Reset form
      resetForm();
      setIsModalOpen(false);
      setShowDuplicateWarningModal(false);
      await loadDeposits();

      toast.success('Deposit submitted successfully!');
    } catch (err) {
      console.error('Error submitting deposit:', err);
      setError(err.message || 'Failed to submit deposit');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!userData?.branchId) {
      setError('Branch ID not found');
      return;
    }

    if (!depositDate) {
      setError('Please select deposit date');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid deposit amount');
      return;
    }

    if (!receiptImage) {
      setError('Please upload receipt image');
      return;
    }

    // Proceed with submission (multiple deposits per day are now allowed)
    await submitDeposit();
  };

  // Reset form
  const resetForm = () => {
    setDepositDate(new Date().toISOString().split('T')[0]);
    setAmount('');
    setReceiptImage(null);
    setReceiptPreview(null);
    setBankName('');
    setAccountNumber('');
    setReferenceNumber('');
    setNotes('');
    setOcrResult(null);
    setValidationResult(null);
    setValidationResult(null);
    setAdjustments([]);
    setError(null);
  };

  // Add adjustment
  const addAdjustment = () => {
    setAdjustments([...adjustments, {
      id: Date.now().toString(),
      type: 'deduction', // Default to existing behavior (expense)
      amount: '',
      description: '',
      receiptImage: null,
      receiptPreview: null,
      receiptImageUrl: null
    }]);
  };

  // Remove adjustment
  const removeAdjustment = (id) => {
    setAdjustments(adjustments.filter(adj => adj.id !== id));
  };

  // Update adjustment field
  const updateAdjustment = (id, field, value) => {
    setAdjustments(adjustments.map(adj =>
      adj.id === id ? { ...adj, [field]: value } : adj
    ));
  };

  // Handle adjustment image upload
  const handleAdjustmentImageUpload = (id, e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image size should be less than 5MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      updateAdjustment(id, 'receiptPreview', reader.result);
      updateAdjustment(id, 'receiptImage', file);
    };
    reader.readAsDataURL(file);
    setError(null);
  };

  // Calculate totals
  const totalDeductions = adjustments
    .filter(adj => adj.type === 'deduction')
    .reduce((sum, adj) => sum + (parseFloat(adj.amount) || 0), 0);

  const totalAdditions = adjustments
    .filter(adj => adj.type === 'addition' || !adj.type) // Handle legacy/undefined as addition? No, deduction is safer, but new items have default.
    .reduce((sum, adj) => sum + (parseFloat(adj.amount) || 0), 0);

  // Calculate total deposits already made for the selected date
  const totalDepositsForDate = getTotalDepositsForDate(depositDate);

  // Calculate remaining amount to deposit (Sales + Additions - Deductions - Already Deposited)
  const expectedDepositAmount = Math.max(0, dailySalesTotal + totalAdditions - totalDeductions - totalDepositsForDate);

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'text-green-600 bg-green-100 border-green-200';
      case 'rejected': return 'text-red-600 bg-red-100 border-red-200';
      case 'submitted': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  // Get validation status color
  const getValidationColor = (status) => {
    switch (status) {
      case 'match': return 'text-green-600 bg-green-50';
      case 'mismatch': return 'text-red-600 bg-red-50';
      case 'manual_review': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  // Helper function to get date range based on preset type
  const getDateRange = (type) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (type) {
      case 'today':
        return {
          startDate: today.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0]
        };

      case 'thisWeek':
        const thisWeekStart = new Date(today);
        thisWeekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
        return {
          startDate: thisWeekStart.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0]
        };

      case 'thisMonth':
        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        return {
          startDate: thisMonthStart.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0]
        };

      default:
        return { startDate: '', endDate: '' };
    }
  };

  // Handle date filter type change
  const handleDateFilterTypeChange = (type) => {
    setDateFilterType(type);
    if (type === 'all') {
      setDateFrom('');
      setDateTo('');
    } else if (type !== 'custom') {
      const range = getDateRange(type);
      setDateFrom(range.startDate);
      setDateTo(range.endDate);
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setStatusFilter('all');
    setValidationFilter('all');
    setDateFrom('');
    setDateTo('');
    setDateFilterType('all');
  };

  // Check if filters are active
  const hasActiveFilters = statusFilter !== 'all' || validationFilter !== 'all' || dateFilterType !== 'all' || dateFrom || dateTo;

  // Export handler
  const handleExportData = async () => {
    try {
      if (!filteredDeposits || filteredDeposits.length === 0) {
        toast.error('No deposit data to export');
        return;
      }

      // Create CSV content
      const headers = [
        'Date',
        'Amount',
        'Daily Sales',
        'Expenses',
        'Difference',
        'Bank Name',
        'Account Number',
        'Reference Number',
        'Validation Status',
        'Status',
        'Submitted By',
        'Notes'
      ];

      const csvRows = [headers.join(',')];

      filteredDeposits.forEach(deposit => {
        const dateStr = format(new Date(deposit.depositDate), 'MMM dd, yyyy');

        const row = [
          `"${dateStr}"`,
          `"${deposit.amount || 0}"`,
          `"${deposit.dailySalesTotal || 0}"`,
          `"${deposit.totalExpenses || 0}"`,
          `"${deposit.difference || 0}"`,
          `"${deposit.bankName || 'N/A'}"`,
          `"${deposit.accountNumber || 'N/A'}"`,
          `"${deposit.referenceNumber || 'N/A'}"`,
          `"${deposit.validationStatus || 'pending'}"`,
          `"${deposit.status || 'submitted'}"`,
          `"${deposit.submittedByName || 'N/A'}"`,
          `"${(deposit.notes || '').replace(/"/g, '""')}"`
        ];

        csvRows.push(row.join(','));
      });

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');

      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `deposits_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Deposits exported successfully');
      }
    } catch (error) {
      console.error('Error exporting deposits:', error);
      toast.error('Failed to export deposits');
    }
  };

  // Print handler - prints only the data table
  const handlePrintReport = () => {
    try {
      // Build filters display
      const activeFilters = [];
      if (searchTerm) activeFilters.push(`Search: "${searchTerm}"`);
      if (statusFilter !== 'all') activeFilters.push(`Status: ${statusFilter}`);
      if (validationFilter !== 'all') activeFilters.push(`Validation: ${validationFilter}`);
      const filtersText = activeFilters.length > 0 ? activeFilters.join(' | ') : 'All Deposits';

      // Generate deposit rows
      const depositRows = filteredDeposits.map(deposit => {
        const dateStr = format(new Date(deposit.depositDate), 'MMM dd, yyyy');
        const status = deposit.status === 'approved' ? 'Approved' :
          deposit.status === 'rejected' ? 'Rejected' : 'Pending';
        const validationStatus = deposit.validationStatus === 'match' ? 'Match' :
          deposit.validationStatus === 'mismatch' ? 'Mismatch' :
            deposit.validationStatus === 'manual_review' ? 'Review Needed' : 'Pending';

        return `
          <tr>
            <td>${dateStr}</td>
            <td class="text-right">${formatCurrency((deposit.amount || 0))}</td>
            <td class="text-right">${formatCurrency((deposit.dailySalesTotal || 0))}</td>
            <td class="text-right">${formatCurrency((deposit.totalExpenses || 0))}</td>
            <td class="text-right">${deposit.difference >= 0 ? '+' : ''}${formatCurrency((deposit.difference || 0))}</td>
            <td>${deposit.bankName || 'N/A'}</td>
            <td>${deposit.referenceNumber || 'N/A'}</td>
            <td>${validationStatus}</td>
            <td>${status}</td>
            <td>${deposit.submittedByName || 'N/A'}</td>
          </tr>
        `;
      }).join('');

      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Bank Deposits Report - ${new Date().toLocaleDateString()}</title>
          <meta charset="utf-8">
          <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
          <style>
            @page {
              size: A4 landscape;
              margin: 0.4in;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Poppins', Arial, sans-serif;
              padding: 10px;
              color: #000;
              font-size: 9px;
            }
            .header {
              text-align: center;
              margin-bottom: 12px;
              padding-bottom: 8px;
              border-bottom: 2px solid #333;
            }
            .header h1 {
              font-size: 20px;
              font-weight: 700;
              margin: 0 0 4px 0;
            }
            .header h2 {
              font-size: 16px;
              font-weight: 600;
              margin: 0;
            }
            .filters {
              background: #f8f9fa;
              padding: 10px;
              border: 2px solid #333;
              margin: 10px 0;
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
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
              font-size: 9px;
              border: 1px solid #333;
            }
            th, td {
              border: 1px solid #333;
              padding: 6px 4px;
              text-align: left;
              vertical-align: top;
            }
            th {
              background-color: #fff;
              font-weight: 700;
              text-transform: uppercase;
              border-bottom: 2px solid #000;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .text-right { text-align: right; }
            .footer {
              margin-top: 12px;
              padding-top: 10px;
              border-top: 2px solid #333;
              font-size: 8px;
            }
            .footer-info {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
              margin-bottom: 10px;
            }
            .footer-left {
              text-align: left;
            }
            .footer-right {
              text-align: right;
            }
            .footer-center {
              text-align: center;
              margin-top: 8px;
              padding-top: 8px;
              border-top: 1px solid #ccc;
              color: #666;
            }
            .footer-center p {
              margin: 3px 0;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>DAVID'S SALON</h1>
            <h2>Bank Deposits Report</h2>
          </div>
          
          <div class="filters">
            <div class="filters-title">FILTERS APPLIED</div>
            <div class="filters-content">${filtersText}</div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th class="text-right">Amount</th>
                <th class="text-right">Daily Sales</th>
                <th class="text-right">Expenses</th>
                <th class="text-right">Difference</th>
                <th>Bank Name</th>
                <th>Reference #</th>
                <th>Validation</th>
                <th>Status</th>
                <th>Submitted By</th>
              </tr>
            </thead>
            <tbody>
              ${depositRows || '<tr><td colspan="10" style="text-align: center; padding: 20px;">No deposits found</td></tr>'}
            </tbody>
          </table>
          
          <div class="footer">
            <div class="footer-info">
              <div class="footer-left">
                <strong>Generated By:</strong> ${userData?.firstName && userData?.lastName ? `${userData.firstName} ${userData.lastName}` : 'Branch Manager'}<br>
                <strong>Position:</strong> Branch Manager
              </div>
              <div class="footer-right">
                <strong>Generated On:</strong> ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}<br>
                <strong>Time:</strong> ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <div class="footer-center">
              <p style="font-weight: 600; font-size: 9px;">Page 1 of 1</p>
              <p>Bank Deposits Report - ${filteredDeposits.length} Deposits</p>
            </div>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.onafterprint = function() {
                  window.close();
                };
              }, 250);
            };
          </script>
        </body>
        </html>
      `;

      // Create print window
      const printWindow = window.open('', '_blank', 'width=1200,height=800');
      if (!printWindow) {
        toast.error('Please allow pop-ups to print the report');
        return;
      }

      printWindow.document.write(printContent);
      printWindow.document.close();
      toast.success('Opening print preview...');
    } catch (error) {
      console.error('Error generating print report:', error);
      toast.error('Failed to generate print report');
    }
  };


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bank Deposits</h1>
          <p className="text-gray-600">Submit daily deposit receipts for validation</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            onClick={() => setIsModalOpen(true)}
            className="bg-[#160B53] text-white hover:bg-[#12094A] flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            Submit Deposit
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Today's Deposit Summary - Highlighted Card */}
        <div className="lg:col-span-2 bg-gradient-to-br from-[#160B53] to-[#2A1B70] rounded-lg shadow-lg border-2 border-[#160B53] p-6 text-white">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-5 h-5 text-blue-300" />
                <p className="text-sm font-bold text-blue-200 uppercase tracking-wide">Today's Deposit Status</p>
              </div>
              <p className="text-xs text-blue-100 mb-3">{format(new Date(), 'EEEE, MMMM dd, yyyy')}</p>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-100">Total Sales:</span>
                  <span className="text-base font-bold">{formatCurrency(todaysSales)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-100">Deposited:</span>
                  <span className="text-base font-bold text-green-300">{formatCurrency(todaysDeposits)}</span>
                </div>
                <div className="h-px bg-white/20 my-2"></div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-yellow-200">Remaining:</span>
                  <span className={`text-xl font-extrabold ${todaysSales - todaysDeposits > 0 ? 'text-yellow-300' : 'text-green-300'}`}>
                    {formatCurrency(Math.max(0, todaysSales - todaysDeposits))}
                  </span>
                </div>
              </div>
              
              <div className="mt-4">
                {todaysSales - todaysDeposits > 0 ? (
                  <div className="bg-yellow-500/20 border border-yellow-400/30 rounded-lg p-2.5 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-300 flex-shrink-0" />
                    <p className="text-xs text-yellow-100 font-medium">
                      You need to deposit {formatCurrency(todaysSales - todaysDeposits)} today
                    </p>
                  </div>
                ) : todaysSales > 0 ? (
                  <div className="bg-green-500/20 border border-green-400/30 rounded-lg p-2.5 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-300 flex-shrink-0" />
                    <p className="text-xs text-green-100 font-medium">
                      All sales for today have been deposited
                    </p>
                  </div>
                ) : (
                  <div className="bg-blue-500/20 border border-blue-400/30 rounded-lg p-2.5 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-blue-300 flex-shrink-0" />
                    <p className="text-xs text-blue-100 font-medium">
                      No sales transactions recorded today
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="p-3 bg-white/10 rounded-lg backdrop-blur-sm ml-4">
              <Banknote className="w-8 h-8 text-yellow-300" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Deposits</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{deposits.length}</p>
              <p className="text-xs text-gray-500 mt-1">of {filteredDeposits.length} filtered</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Banknote className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {deposits.filter(d => d.status === 'approved').length}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600 mt-1">
                {deposits.filter(d => d.status === 'submitted').length}
              </p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search deposits..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Filter Button */}
          <button
            onClick={() => setShowFilterModal(true)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors relative ${hasActiveFilters
              ? 'bg-primary-50 border-primary-300 text-primary-700 hover:bg-primary-100'
              : 'border-gray-300 hover:bg-gray-50'
              }`}
            title={`Filter - ${filteredDeposits.length} deposits`}
          >
            <Filter className="w-5 h-5" />
            <span className="bg-primary-600 text-white text-xs min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center">
              {filteredDeposits.length}
            </span>
          </button>

          {/* Export Button */}
          <button
            onClick={handleExportData}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title="Export Deposits Data"
          >
            <Download className="w-5 h-5 text-gray-600" />
          </button>

          {/* Print Button */}
          <button
            onClick={handlePrintReport}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title="Print Report"
          >
            <Printer className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Deposits Table */}
      {loading ? (
        <Card className="p-12">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#160B53]" />
            <span className="ml-2 text-gray-600">Loading deposits...</span>
          </div>
        </Card>
      ) : error ? (
        <Card className="p-6 bg-red-50 border-red-200">
          <p className="text-red-800">{error}</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Daily Sales</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expenses</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Difference</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Validation</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Anomaly</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDeposits.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                          <Banknote className="h-8 w-8 text-gray-400" />
                        </div>
                        <div>
                          <p className="text-lg font-semibold text-gray-900">
                            {deposits.length === 0 ? 'No data yet hello?? hehehe 😊' : 'No deposits match your filters'}
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            {deposits.length === 0
                              ? 'Start by submitting your first deposit!'
                              : 'Try adjusting your search or filter criteria'}
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredDeposits.map((deposit) => (
                    <tr key={deposit.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {format(new Date(deposit.depositDate), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-semibold">
                        {formatCurrency((deposit.amount || 0))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {formatCurrency((deposit.dailySalesTotal || 0))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {deposit.totalExpenses > 0 ? (
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-orange-700">
                              {formatCurrency((deposit.totalExpenses || 0))}
                            </span>
                            <span className="text-xs text-gray-500">
                              {deposit.expenses?.length || 0} item(s)
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">₱0.00</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`font-medium ${Math.abs(deposit.difference || 0) <= 1
                          ? 'text-green-600'
                          : Math.abs(deposit.difference || 0) > 100
                            ? 'text-red-600'
                            : 'text-yellow-600'
                          }`}>
                          {deposit.difference >= 0 ? '+' : ''}{formatCurrency(Math.abs(deposit.difference || 0))}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getValidationColor(deposit.validationStatus)}`}>
                          {deposit.validationStatus === 'match' ? 'Match' :
                            deposit.validationStatus === 'mismatch' ? 'Mismatch' :
                              deposit.validationStatus === 'manual_review' ? 'Review Needed' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {deposit.hasAnomaly ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Anomaly
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Normal
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(deposit.status)}`}>
                          {deposit.status === 'approved' ? 'Approved' :
                            deposit.status === 'rejected' ? 'Rejected' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedDeposit(deposit);
                            setShowDetailsModal(true);
                          }}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Enhanced Submit Deposit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-all duration-300">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

            {/* Sticky Header */}
            <div className="bg-gradient-to-r from-[#160B53] to-[#2A1B70] text-white px-6 py-4 flex-shrink-0 relative overflow-hidden shadow-md z-20">
              <div className="absolute inset-0 bg-white/5 opacity-20 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/20 to-transparent"></div>
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md shadow-inner border border-white/20">
                    <Banknote className="h-6 w-6 text-green-300" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-white drop-shadow-sm">Submit Bank Deposit</h2>
                    <p className="text-blue-100 text-xs font-medium opacity-90">Verify daily sales and upload proof</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-all duration-200 hover:rotate-90"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Form Container - Flex Column to allow scrolling body */}
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">

              {/* Scrollable Content Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50">

                {/* 1. Top Section: Sales Summary & Date */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Daily Sales Card */}
                  <div className="lg:col-span-2">
                    <div className={`relative overflow-hidden rounded-2xl p-6 transition-all duration-300 shadow-sm border ${dailySalesTotal > 0
                      ? 'bg-gradient-to-br from-blue-600 to-blue-800 text-white border-blue-600'
                      : 'bg-white border-gray-200'
                      }`}>
                      <div className="relative z-10 flex justify-between items-start">
                        <div>
                          <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${dailySalesTotal > 0 ? 'text-blue-200' : 'text-gray-500'}`}>
                            Total Sales For Date
                          </p>
                          <p className={`text-3xl font-extrabold tracking-tight ${dailySalesTotal > 0 ? 'text-white' : 'text-gray-900'}`}>
                            {formatCurrency(dailySalesTotal)}
                          </p>
                          {totalDepositsForDate > 0 && (
                            <div className="mt-2 space-y-1">
                              <p className={`text-sm ${dailySalesTotal > 0 ? 'text-blue-100' : 'text-gray-600'}`}>
                                Already Deposited: {formatCurrency(totalDepositsForDate)}
                              </p>
                              <p className={`text-lg font-bold ${dailySalesTotal > 0 ? 'text-green-300' : 'text-green-600'}`}>
                                Remaining: {formatCurrency(Math.max(0, dailySalesTotal - totalDepositsForDate))}
                              </p>
                            </div>
                          )}
                          <div className={`flex items-center gap-2 mt-2 text-sm ${dailySalesTotal > 0 ? 'text-blue-100' : 'text-gray-500'}`}>
                            <Calendar className="h-4 w-4" />
                            <span>For {format(new Date(depositDate), 'EEEE, MMMM dd, yyyy')}</span>
                          </div>
                          {dailySalesTotal === 0 && (
                            <p className="text-xs text-red-500 mt-2 font-medium bg-red-50 inline-block px-2 py-1 rounded">No transactions found</p>
                          )}
                        </div>
                        <div className={`p-3 rounded-xl ${dailySalesTotal > 0 ? 'bg-white/10 backdrop-blur-sm' : 'bg-gray-100'}`}>
                          <TrendingUp className={`h-6 w-6 ${dailySalesTotal > 0 ? 'text-green-300' : 'text-gray-400'}`} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Date Selection */}
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-center">
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Deposit Date
                    </label>
                    <Input
                      type="date"
                      value={depositDate}
                      onChange={(e) => setDepositDate(e.target.value)}
                      required
                      max={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                      className="w-full text-base p-2 border-gray-300 rounded-lg focus:ring-[#160B53]"
                    />
                    <p className="text-xs text-center text-gray-500 mt-2 bg-gray-50 p-1.5 rounded text-gray-600">
                      Select date to load sales
                    </p>
                  </div>
                </div>

                {/* 2. Main Logic: Anomalies & Upload */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column: Upload & Validation */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-gray-500" />
                        Deposit Receipt
                        <span className="text-red-500">*</span>
                      </h3>
                      {isScanning && <span className="text-xs text-blue-600 animate-pulse font-medium">Scanning...</span>}
                    </div>

                    <label className="group block relative cursor-pointer w-full">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <div className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all duration-300 overflow-hidden ${receiptPreview
                        ? 'border-blue-500 bg-blue-50/30'
                        : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50/50'
                        }`}>
                        {receiptPreview ? (
                          <div className="relative group-hover:scale-[1.01] transition-transform">
                            <img src={receiptPreview} alt="Receipt preview" className="max-h-56 mx-auto rounded-lg shadow-sm object-contain bg-white" />
                            <div className="absolute inset-0 bg-black/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <div className="bg-white text-gray-900 px-3 py-1.5 rounded-md font-medium shadow-lg text-sm">
                                Change Image
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="py-6">
                            <div className="bg-blue-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                              <Upload className="h-6 w-6 text-blue-600" />
                            </div>
                            <p className="text-sm font-medium text-gray-700">Click to upload deposit slip</p>
                            <p className="text-xs text-gray-400 mt-1">First, upload the receipt image</p>
                          </div>
                        )}
                      </div>
                    </label>

                    {/* Anomaly Check Logic (Inlined) */}
                    {receiptImage && (() => {
                      const currentAnomalyCheck = checkAnomalies(
                        ocrResult?.rawText || ocrResult?.extractedText || null,
                        amount ? parseFloat(amount) : null,
                        dailySalesTotal
                      );

                      if (currentAnomalyCheck.hasAnomaly) {
                        return (
                          <div className="bg-red-50 border border-red-200 p-4 rounded-xl animate-in slide-in-from-top-2">
                            <div className="flex items-start gap-3">
                              <div className="p-2 bg-white rounded-full shadow-sm">
                                <AlertTriangle className="h-5 w-5 text-red-600" />
                              </div>
                              <div className="flex-1">
                                <h3 className="text-sm font-bold text-red-900 mb-1">
                                  Anomaly Detected
                                </h3>
                                <div className="text-xs text-red-700 space-y-1">
                                  {currentAnomalyCheck.description?.split(' | ').map((issue, index) => (
                                    <p key={index} className="flex items-start gap-1">
                                      <span className="font-bold">•</span> {issue}
                                    </p>
                                  ))}
                                </div>
                                <p className="text-[10px] text-red-600 font-semibold mt-2 bg-red-100 p-1.5 rounded inline-block">
                                  Flagged for Manager Review
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      } else if (ocrResult && dailySalesTotal > 0 && amount) {
                        return (
                          <div className="bg-green-50 border border-green-200 p-3 rounded-xl flex items-start gap-3">
                            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                            <div>
                              <h3 className="text-sm font-bold text-green-900">Verified</h3>
                              <p className="text-xs text-green-700">Receipt matches sales data.</p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  {/* Right Column: Amount & Form Validations */}
                  <div className="space-y-6">
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-5">
                      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                        <h3 className="text-base font-bold text-gray-900">Deposit Details</h3>
                        <div className="text-xs text-gray-500 text-right">
                          <p>Remaining to Deposit: <span className="font-semibold text-gray-900">{formatCurrency(expectedDepositAmount)}</span></p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">
                          Amount Deposited <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">₱</span>
                          <Input
                            type="number"
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            required
                            min="0"
                            className="w-full pl-10 py-3 text-xl font-bold border-gray-300 rounded-xl focus:ring-[#160B53] focus:border-[#160B53]"
                          />
                        </div>

                        {/* Difference Alert */}
                        {dailySalesTotal > 0 && amount && (
                          <div className={`mt-2 text-xs flex items-center gap-1.5 font-medium ${Math.abs(parseFloat(amount) - expectedDepositAmount) <= 1
                            ? 'text-green-600'
                            : 'text-orange-600'
                            }`}>
                            {Math.abs(parseFloat(amount) - expectedDepositAmount) <= 1
                              ? <><CheckCircle className="h-3 w-3" /> Amounts match</>
                              : <><AlertTriangle className="h-3 w-3" /> Difference: {formatCurrency(Math.abs(parseFloat(amount) - expectedDepositAmount))}</>}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Bank Name</label>
                          <Input
                            value={bankName}
                            onChange={(e) => setBankName(e.target.value)}
                            placeholder="e.g. BDO"
                            className="bg-gray-50/50 border-gray-200"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Reference No.</label>
                          <Input
                            value={referenceNumber}
                            onChange={(e) => setReferenceNumber(e.target.value)}
                            placeholder="Ref #"
                            className="bg-gray-50/50 border-gray-200"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Deposit Adjustments Section */}
                <div className="bg-orange-50/30 rounded-2xl border border-orange-100 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-orange-500" />
                        Deposit Adjustments
                      </h3>
                      <p className="text-xs text-gray-500">Record expenses (deductions) or added cash (income)</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={addAdjustment}
                      className="bg-white text-xs border-orange-200 hover:bg-orange-50 text-orange-700"
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add Adjustment
                    </Button>
                  </div>

                  {adjustments.length > 0 ? (
                    <div className="space-y-3">
                      {adjustments.map((adjustment, index) => (
                        <div key={adjustment.id} className="bg-white p-4 rounded-xl border border-orange-100 shadow-sm relative group">
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button type="button" onClick={() => removeAdjustment(adjustment.id)} className="text-red-400 hover:text-red-600 p-1">
                              <XCircle className="h-4 w-4" />
                            </button>
                          </div>
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Adjustment #{index + 1}</h4>
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-medium text-gray-500 mb-1">Type</label>
                                <select
                                  value={adjustment.type}
                                  onChange={(e) => updateAdjustment(adjustment.id, 'type', e.target.value)}
                                  className="w-full text-sm border-gray-200 rounded-lg focus:ring-orange-500 focus:border-orange-500 py-2"
                                >
                                  <option value="deduction">Expense (Deduction)</option>
                                  <option value="addition">Income (Addition)</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] font-medium text-gray-500 mb-1">Amount</label>
                                <div className="relative">
                                  <Input
                                    type="number"
                                    value={adjustment.amount}
                                    onChange={(e) => updateAdjustment(adjustment.id, 'amount', e.target.value)}
                                    placeholder="0.00"
                                    className="h-[38px] text-sm"
                                  />
                                  <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold ${adjustment.type === 'addition' ? 'text-green-500' : 'text-red-500'}`}>
                                    {adjustment.type === 'addition' ? '+' : '-'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-medium text-gray-500 mb-1">Description</label>
                              <Input
                                value={adjustment.description}
                                onChange={(e) => updateAdjustment(adjustment.id, 'description', e.target.value)}
                                placeholder="What is this adjustment for?"
                                className="h-[38px] text-sm"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-medium text-gray-500 mb-1">Receipt Image <span className="text-red-500">*</span></label>
                              <label className="flex items-center gap-3 cursor-pointer p-2 border border-dashed border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleAdjustmentImageUpload(adjustment.id, e)}
                                  className="hidden"
                                />
                                {adjustment.receiptPreview ? (
                                  <>
                                    <img src={adjustment.receiptPreview} alt="Receipt" className="h-10 w-10 object-cover rounded-md" />
                                    <span className="text-xs text-blue-600 font-medium">Click to change</span>
                                  </>
                                ) : (
                                  <>
                                    <div className="bg-gray-100 p-2 rounded-md">
                                      <Upload className="h-4 w-4 text-gray-500" />
                                    </div>
                                    <span className="text-xs text-gray-500">Upload Receipt Proof (Required)</span>
                                  </>
                                )}
                              </label>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-end gap-4 text-sm font-bold mt-2">
                        {totalAdditions > 0 && <span className="text-green-700">Total Additions: +{formatCurrency(totalAdditions)}</span>}
                        {totalDeductions > 0 && <span className="text-red-700">Total Deductions: -{formatCurrency(totalDeductions)}</span>}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-xs text-gray-400 border-2 border-dashed border-orange-200/50 rounded-xl">
                      No adjustments recorded
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full border-gray-300 rounded-lg focus:ring-[#160B53] focus:border-[#160B53] shadow-sm text-sm p-3"
                    placeholder="Remarks..."
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> {error}
                  </div>
                )}

              </div>

              {/* Sticky Footer */}
              <div className="bg-white border-t border-gray-200 p-5 flex items-center justify-between flex-shrink-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="hidden sm:block text-xs text-gray-500">
                  Verify account details before submitting.
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setIsModalOpen(false);
                      resetForm();
                    }}
                    className="flex-1 sm:flex-none text-gray-600 hover:bg-gray-100"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 sm:flex-none bg-[#160B53] text-white hover:bg-[#2A1B70] px-6 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all font-medium"
                  >
                    {isSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing</> : 'Confirm Deposit'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deposit Details Modal */}
      {showDetailsModal && selectedDeposit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#160B53] to-[#12094A] text-white p-6 flex-shrink-0 relative overflow-hidden">
              <div className="absolute inset-0 bg-white/5 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/20 to-transparent"></div>
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md shadow-inner border border-white/20">
                    <FileText className="h-6 w-6 text-blue-200" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">Deposit Details</h2>
                    <p className="text-blue-100 text-xs font-medium opacity-90">Transaction records and proof</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => setShowDetailsModal(false)}
                  className="bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-all duration-200 hover:rotate-90"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Side: Info */}
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Calendar className="h-4 w-4" /> Core Information
                    </h3>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase mb-1">Date</p>
                        <p className="text-lg font-bold text-gray-900">
                          {format(new Date(selectedDeposit.depositDate), 'MMMM dd, yyyy')}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase mb-1">Amount</p>
                        <p className="text-lg font-bold text-[#160B53]">
                          {formatCurrency((selectedDeposit.amount || 0))}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase mb-1">Daily Sales</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {formatCurrency((selectedDeposit.dailySalesTotal || 0))}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase mb-1">Difference</p>
                        <p className={`text-lg font-bold ${Math.abs(selectedDeposit.difference || 0) <= 1 ? 'text-green-600' : 'text-red-600'}`}>
                          {selectedDeposit.difference >= 0 ? '+' : ''}{formatCurrency(Math.abs(selectedDeposit.difference || 0))}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Building className="h-4 w-4" /> Bank & Status
                    </h3>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase mb-1">Status</p>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusColor(selectedDeposit.status)}`}>
                          {selectedDeposit.status.toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase mb-1">Validation</p>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${getValidationColor(selectedDeposit.validationStatus)}`}>
                          {selectedDeposit.validationStatus.toUpperCase()}
                        </span>
                      </div>
                      {selectedDeposit.bankName && (
                        <div className="col-span-2 border-t border-gray-50 pt-4 mt-2">
                          <p className="text-xs font-bold text-gray-500 uppercase mb-1">Bank Name</p>
                          <p className="text-gray-900 font-medium">{selectedDeposit.bankName}</p>
                        </div>
                      )}
                      {selectedDeposit.referenceNumber && (
                        <div className="col-span-2">
                          <p className="text-xs font-bold text-gray-500 uppercase mb-1">Reference Number</p>
                          <p className="text-gray-900 font-mono text-sm">{selectedDeposit.referenceNumber}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedDeposit.notes && (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <FileText className="h-4 w-4" /> Additional Notes
                      </h3>
                      <p className="text-sm text-gray-700 bg-gray-50 p-4 rounded-xl border border-gray-100 italic leading-relaxed">
                        "{selectedDeposit.notes}"
                      </p>
                    </div>
                  )}
                </div>

                {/* Right Side: Proof */}
                <div className="space-y-6">
                  {selectedDeposit.receiptImageUrl && (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 h-full">
                      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Receipt className="h-4 w-4" /> Deposit Proof Receipt
                      </h3>
                      <div className="relative group cursor-zoom-in" onClick={() => window.open(selectedDeposit.receiptImageUrl, '_blank')}>
                        <img
                          src={selectedDeposit.receiptImageUrl}
                          alt="Deposit receipt"
                          className="w-full rounded-xl border border-gray-100 shadow-sm transition-transform duration-300 group-hover:scale-[1.01]"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-xl flex items-center justify-center">
                          <div className="bg-white/90 text-gray-900 px-4 py-2 rounded-full font-bold shadow-2xl scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-300 flex items-center gap-2">
                            <Eye className="h-4 w-4" /> View Full Image
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedDeposit.hasAnomaly && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-2xl shadow-sm">
                      <div className="flex items-start gap-4">
                        <div className="p-2 bg-white rounded-full shadow-sm">
                          <AlertTriangle className="h-5 w-5 text-red-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-red-900 mb-1">Anomaly Information</p>
                          <p className="text-xs text-red-800 leading-relaxed font-medium">
                            {selectedDeposit.anomalyDescription || 'This deposit was flagged for manual review due to data inconsistencies.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Adjustments Section - Full Width Bottom */}
              {selectedDeposit.expenses && selectedDeposit.expenses.length > 0 && (
                <div className="bg-orange-50/30 rounded-2xl border border-orange-100 p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                        <RefreshCw className="h-5 w-5 text-orange-500" />
                        Deposit Adjustments
                      </h3>
                      <p className="text-xs text-gray-500">Recorded deductions and additions for this date</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {selectedDeposit.expenses.map((expense, index) => (
                      <div key={index} className="bg-white p-5 rounded-2xl border border-orange-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                        <div className={`absolute top-0 left-0 w-1.5 h-full ${expense.type === 'addition' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <div className="flex items-center justify-between mb-4 border-b border-gray-50 pb-3">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Adjustment #{index + 1}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter ${expense.type === 'addition' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {expense.type === 'addition' ? 'Addition' : 'Deduction'}
                          </span>
                        </div>
                        <div className="flex items-start gap-4 mb-4">
                          <div className={`p-3 rounded-xl ${expense.type === 'addition' ? 'bg-green-50' : 'bg-red-50'}`}>
                            <span className={`text-lg font-black ${expense.type === 'addition' ? 'text-green-600' : 'text-red-600'}`}>
                              {expense.type === 'addition' ? '+' : '-'}{formatCurrency((expense.amount || 0))}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 font-semibold flex-1 leading-snug">{expense.description}</p>
                        </div>
                        {expense.receiptImageUrl && (
                          <div className="relative group/img cursor-zoom-in" onClick={() => window.open(expense.receiptImageUrl, '_blank')}>
                            <img
                              src={expense.receiptImageUrl}
                              alt={`Adjustment ${index + 1}`}
                              className="w-full h-40 object-cover rounded-xl border border-gray-100 transition-opacity group-hover/img:opacity-90"
                            />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
                              <div className="bg-black/60 text-white p-2 rounded-full backdrop-blur-sm">
                                <Eye className="h-5 w-5" />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Footer */}
            <div className="bg-white border-t border-gray-200 p-6 flex items-center justify-between flex-shrink-0 shadow-md">
              <div className="text-xs text-gray-400 italic">
                View-only mode. Approval can only be changed by administrators.
              </div>
              <Button
                onClick={() => setShowDetailsModal(false)}
                className="bg-[#160B53] text-white hover:bg-[#2A1B70] px-10 py-2.5 rounded-xl shadow-lg transition-all font-bold"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Filter Deposits</h2>
              <button
                onClick={() => setShowFilterModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 font-bold">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-transparent"
                    >
                      <option value="all">All Status</option>
                      <option value="submitted">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 font-bold">Validation Status</label>
                    <select
                      value={validationFilter}
                      onChange={(e) => setValidationFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-transparent"
                    >
                      <option value="all">All Validation</option>
                      <option value="match">Match</option>
                      <option value="mismatch">Mismatch</option>
                      <option value="manual_review">Review Needed</option>
                    </select>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 font-bold">Date Range</label>
                    <select
                      value={dateFilterType}
                      onChange={(e) => handleDateFilterTypeChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-transparent mb-3"
                    >
                      <option value="all">All Dates</option>
                      <option value="today">Today</option>
                      <option value="thisWeek">This Week</option>
                      <option value="thisMonth">This Month</option>
                      <option value="custom">Custom Range</option>
                    </select>

                    {dateFilterType === 'custom' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">From</label>
                          <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-transparent text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">To</label>
                          <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-transparent text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-6 border-t border-gray-200">
              <button
                onClick={clearFilters}
                className="text-sm text-red-600 hover:text-red-700 font-bold"
              >
                Clear All
              </button>
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => setShowFilterModal(false)}
                  className="bg-[#160B53] text-white hover:bg-[#2A1B70] px-8"
                >
                  Apply Filters
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Multiple Deposits Info - Show when there are existing deposits for the date */}
      {isModalOpen && totalDepositsForDate > 0 && (
        <div className="fixed bottom-4 right-4 z-[60] max-w-sm animate-in slide-in-from-bottom-5 duration-300">
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl shadow-lg p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-full">
                <AlertTriangle className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-blue-900 mb-1">Multiple Deposits Detected</h4>
                <p className="text-xs text-blue-800">
                  You've already deposited {formatCurrency(totalDepositsForDate)} for this date. 
                  The remaining balance is {formatCurrency(Math.max(0, dailySalesTotal - totalDepositsForDate))}.
                </p>
              </div>
              <button 
                onClick={() => {/* This is just an info toast, no action needed */}}
                className="text-blue-400 hover:text-blue-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Deposit Error Modal - Removed, multiple deposits now allowed */}
      {showDuplicateWarningModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-10 h-10 text-blue-600" />
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-2">Multiple Deposits Allowed</h3>
              <p className="text-gray-600 mb-6">
                You can now make multiple deposits for the same date. <br />
                The system will track the remaining balance automatically.
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                <p className="text-xs text-blue-800 font-semibold flex items-center justify-center gap-2">
                  <CheckCircle className="h-4 w-4" /> Remaining balance will be calculated automatically.
                </p>
              </div>

              <Button
                onClick={() => {
                  setShowDuplicateWarningModal(false);
                  setError('');
                }}
                className="w-full bg-[#160B53] text-white hover:bg-[#2A1B70] py-3 rounded-xl font-bold"
              >
                Got It
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Deposits;

