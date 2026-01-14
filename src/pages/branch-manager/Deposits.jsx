// src/pages/04_BranchManager/Deposits.jsx
import React, { useState, useEffect } from 'react';
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
  
  // Expenses/Justifications state
  const [expenses, setExpenses] = useState([]);
  
  // Filter modal state
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showDuplicateWarningModal, setShowDuplicateWarningModal] = useState(false);

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

  // Get daily sales total when deposit date changes and check for duplicates
  useEffect(() => {
    const fetchDailySales = async () => {
      if (!userData?.branchId || !depositDate) return;
      
      // Check for duplicate deposit immediately when date changes
      if (checkDuplicateDeposit(depositDate)) {
        setError(`A deposit already exists for ${format(new Date(depositDate), 'MMMM dd, yyyy')}. You cannot submit another deposit for this date.`);
        // Show modal immediately when duplicate date is selected
        setShowDuplicateWarningModal(true);
      } else {
        // Clear duplicate error and close modal if date is valid (but keep other errors)
        setError(prevError => {
          if (prevError && prevError.includes('already exists')) {
            return '';
          }
          return prevError;
        });
        // Close modal if it was open for duplicate
        if (showDuplicateWarningModal) {
          setShowDuplicateWarningModal(false);
        }
      }
      
      try {
        const salesTotal = await depositService.getDailySalesTotal(
          userData.branchId,
          new Date(depositDate)
        );
        setDailySalesTotal(salesTotal);
      } catch (err) {
        console.error('Error fetching daily sales:', err);
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
                message: `✓ Daily sales total (₱${dailySalesTotal.toLocaleString()}) found in receipt`,
                extractedAmount: result.amount,
                expectedAmount: dailySalesTotal
              });
            } else {
              setValidationResult({
                isValid: false,
                message: `⚠ Daily sales total (₱${dailySalesTotal.toLocaleString()}) not found in receipt`,
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
              message: `✓ Daily sales total (₱${dailySalesTotal.toLocaleString()}) found in receipt`,
              extractedAmount: result.amount,
              expectedAmount: dailySalesTotal
            });
          } else {
            setValidationResult({
              isValid: false,
              message: `⚠ Daily sales total (₱${dailySalesTotal.toLocaleString()}) not found in receipt`,
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
        anomalies.push(`Daily sales total (₱${salesTotal.toLocaleString()}) was not found in the receipt. The receipt may not match today's sales.`);
      }
    }

    // Check Manual Amount vs Daily Sales
    if (manualAmount && salesTotal > 0) {
      const manualDifference = Math.abs(manualAmount - salesTotal);
      if (manualDifference > 1) {
        hasAnomaly = true;
        if (manualDifference > 100) {
          anomalies.push(`Deposit amount (₱${manualAmount.toLocaleString()}) differs significantly from daily sales total (₱${salesTotal.toLocaleString()}) by ₱${manualDifference.toFixed(2)}`);
        } else {
          anomalies.push(`Deposit amount (₱${manualAmount.toLocaleString()}) differs from daily sales total (₱${salesTotal.toLocaleString()}) by ₱${manualDifference.toFixed(2)}`);
        }
      }
    }

    // Check if OCR failed to read receipt
    if (!ocrText && salesTotal > 0) {
      hasAnomaly = true;
      anomalies.push(`Could not read receipt text. Unable to verify if receipt contains daily sales total (₱${salesTotal.toLocaleString()}). Please ensure receipt image is clear.`);
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

  // Handle form submission
  // Check if deposit exists for the selected date
  const checkDuplicateDeposit = (date) => {
    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);
    
    return deposits.some(deposit => {
      const depositDate = new Date(deposit.depositDate);
      depositDate.setHours(0, 0, 0, 0);
      return depositDate.getTime() === selectedDate.getTime();
    });
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

    try {
      setIsSubmitting(true);
      setError(null);

      // Upload receipt image to Cloudinary
      const uploadResult = await cloudinaryService.uploadImage(receiptImage, 'deposits');
      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Failed to upload receipt image');
      }
      const receiptImageUrl = uploadResult.url;

      // Upload expense receipt images
      const expensesWithUrls = await Promise.all(expenses.map(async (expense) => {
        let receiptImageUrl = null;
        let receiptImagePath = null;
        
        if (expense.receiptImage) {
          const uploadResult = await cloudinaryService.uploadImage(expense.receiptImage, 'deposits/expenses');
          if (uploadResult.success) {
            receiptImageUrl = uploadResult.url;
            receiptImagePath = uploadResult.publicId || '';
          }
        }
        
        return {
          amount: parseFloat(expense.amount) || 0,
          description: expense.description || '',
          receiptImageUrl: receiptImageUrl,
          receiptImagePath: receiptImagePath,
          createdAt: new Date().toISOString()
        };
      }));

      // Calculate difference (accounting for expenses)
      const depositAmount = parseFloat(amount);
      const totalExpensesAmount = expensesWithUrls.reduce((sum, exp) => sum + exp.amount, 0);
      const adjustedSalesTotal = dailySalesTotal - totalExpensesAmount;
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
        totalExpenses: totalExpensesAmount,
        expenses: expensesWithUrls,
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

  // Handle form submission with duplicate check
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

    // Check for duplicate deposit - STOP submission if exists
    if (checkDuplicateDeposit(depositDate)) {
      const existingDeposit = deposits.find(deposit => {
        const depositDateObj = new Date(deposit.depositDate);
        depositDateObj.setHours(0, 0, 0, 0);
        const selectedDateObj = new Date(depositDate);
        selectedDateObj.setHours(0, 0, 0, 0);
        return depositDateObj.getTime() === selectedDateObj.getTime();
      });
      
      setShowDuplicateWarningModal(true);
      setError(`A deposit already exists for ${format(new Date(depositDate), 'MMMM dd, yyyy')}. You cannot submit another deposit for this date.`);
      return;
    }

    // No duplicate, proceed with submission
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
    setExpenses([]);
    setError(null);
  };

  // Add expense
  const addExpense = () => {
    setExpenses([...expenses, {
      id: Date.now().toString(),
      amount: '',
      description: '',
      receiptImage: null,
      receiptPreview: null,
      receiptImageUrl: null
    }]);
  };

  // Remove expense
  const removeExpense = (expenseId) => {
    setExpenses(expenses.filter(exp => exp.id !== expenseId));
  };

  // Update expense field
  const updateExpense = (expenseId, field, value) => {
    setExpenses(expenses.map(exp => 
      exp.id === expenseId ? { ...exp, [field]: value } : exp
    ));
  };

  // Handle expense image upload
  const handleExpenseImageUpload = (expenseId, e) => {
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
      updateExpense(expenseId, 'receiptPreview', reader.result);
      updateExpense(expenseId, 'receiptImage', file);
    };
    reader.readAsDataURL(file);
    setError(null);
  };

  // Calculate total expenses
  const totalExpenses = expenses.reduce((sum, exp) => {
    return sum + (parseFloat(exp.amount) || 0);
  }, 0);

  // Calculate expected deposit (Sales - Expenses)
  const expectedDepositAmount = Math.max(0, dailySalesTotal - totalExpenses);

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
      // Create print window
      const printWindow = window.open('', '_blank', 'width=1200,height=800');
      if (!printWindow) {
        toast.error('Please allow pop-ups to print the report');
        return;
      }

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
            <td>₱${(deposit.amount || 0).toLocaleString()}</td>
            <td>₱${(deposit.dailySalesTotal || 0).toLocaleString()}</td>
            <td>₱${(deposit.totalExpenses || 0).toLocaleString()}</td>
            <td>${deposit.difference >= 0 ? '+' : ''}₱${Math.abs(deposit.difference || 0).toFixed(2)}</td>
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
          <title>Deposits Report</title>
          <meta charset="utf-8">
          <style>
            @media print {
              @page {
                size: A4 landscape;
                margin: 1cm;
              }
            }
            * {
              font-family: Arial, sans-serif;
              box-sizing: border-box;
            }
            body {
              margin: 0;
              padding: 20px;
              font-size: 11px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            thead {
              background: #000;
              color: white;
            }
            th {
              padding: 8px;
              text-align: left;
              font-weight: 600;
              border: 1px solid #000;
            }
            td {
              padding: 6px;
              border: 1px solid #ccc;
            }
            tbody tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            @media print {
              .no-print {
                display: none;
                  }
            }
          </style>
        </head>
        <body>
          <h2 style="margin-bottom: 10px;">Bank Deposits Report</h2>
          <p style="margin-bottom: 10px; color: #666;">Generated: ${new Date().toLocaleString()}</p>
          
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Daily Sales</th>
                <th>Expenses</th>
                <th>Difference</th>
                <th>Bank Name</th>
                <th>Reference Number</th>
                <th>Validation</th>
                <th>Status</th>
                <th>Submitted By</th>
              </tr>
            </thead>
            <tbody>
              ${depositRows || '<tr><td colspan="10" style="text-align: center; padding: 20px;">No deposits found</td></tr>'}
            </tbody>
          </table>

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
          
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Amount</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">
                ₱{deposits.reduce((sum, d) => sum + (d.amount || 0), 0).toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600" />
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
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors relative ${
              hasActiveFilters
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
                        ₱{(deposit.amount || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        ₱{(deposit.dailySalesTotal || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {deposit.totalExpenses > 0 ? (
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-orange-700">
                              ₱{(deposit.totalExpenses || 0).toLocaleString()}
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
                        <span className={`font-medium ${
                          Math.abs(deposit.difference || 0) <= 1 
                            ? 'text-green-600' 
                            : Math.abs(deposit.difference || 0) > 100
                            ? 'text-red-600'
                            : 'text-yellow-600'
                        }`}>
                          {deposit.difference >= 0 ? '+' : ''}₱{Math.abs(deposit.difference || 0).toFixed(2)}
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

      {/* Submit Deposit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-[75vw] max-h-[95vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-[#160B53] to-[#12094A] text-white p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Submit Bank Deposit</h2>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="text-white hover:bg-white/20"
                >
                  <XCircle className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Daily Sales Total - Prominent Display */}
              <Card className={`p-6 ${dailySalesTotal > 0 ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white' : 'bg-gray-100 border-2 border-gray-300'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-medium mb-1 ${dailySalesTotal > 0 ? 'text-blue-100' : 'text-gray-600'}`}>
                      Total Transactions Today
                    </p>
                    <p className={`text-3xl font-bold ${dailySalesTotal > 0 ? 'text-white' : 'text-gray-700'}`}>
                      ₱{dailySalesTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className={`text-xs mt-1 ${dailySalesTotal > 0 ? 'text-blue-100' : 'text-gray-500'}`}>
                      For {format(new Date(depositDate), 'MMMM dd, yyyy')}
                    </p>
                    {dailySalesTotal === 0 && (
                      <p className="text-xs text-gray-500 mt-1 italic">No transactions found for this date</p>
                    )}
                  </div>
                  <Banknote className={`h-12 w-12 ${dailySalesTotal > 0 ? 'text-blue-200' : 'text-gray-400'}`} />
                </div>
              </Card>

              {/* Anomaly Status Display - Only show after receipt is uploaded */}
              {receiptImage && (() => {
                const currentAnomalyCheck = checkAnomalies(
                  ocrResult?.rawText || ocrResult?.extractedText || null,
                  amount ? parseFloat(amount) : null,
                  dailySalesTotal
                );
                  
                if (currentAnomalyCheck.hasAnomaly) {
                  return (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg shadow-md">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-red-800 mb-2">
                            ⚠️ Anomaly Detected
                          </h3>
                          <div className="bg-white p-3 rounded border border-red-200">
                            <p className="text-sm text-red-700 font-medium mb-2">
                              Issues found with this deposit:
                            </p>
                            <div className="space-y-2">
                              {currentAnomalyCheck.description?.split(' | ').map((issue, index) => (
                                <div key={index} className="flex items-start gap-2">
                                  <span className="text-red-600 mt-1">•</span>
                                  <p className="text-sm text-red-800">{issue}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                          <p className="text-xs text-red-600 font-medium mt-3">
                            This deposit will be flagged for review by the Operational Manager.
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                } else if (ocrResult && dailySalesTotal > 0 && amount) {
                  return (
                    <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-lg shadow-md">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-green-800 mb-1">
                            ✓ No Anomalies Detected
                          </h3>
                          <p className="text-sm text-green-700">
                            All validations passed. The deposit amount matches the daily sales total and the receipt has been verified.
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Validation Summary */}
              {(dailySalesTotal > 0 || ocrResult || amount) && (
                <Card className="p-6 bg-gradient-to-r from-blue-50 to-green-50 border-2 border-blue-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Deposit Validation</h3>
                  <div className="space-y-4">
                    {/* Daily Sales Total */}
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-200">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                        <span className="font-medium text-gray-700">Daily Sales Total (Transactions)</span>
                      </div>
                      <span className="text-xl font-bold text-blue-600">
                        ₱{dailySalesTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Receipt Validation Status */}
                    {ocrResult && dailySalesTotal > 0 && (
                      <div className={`flex items-center justify-between p-3 bg-white rounded-lg border ${
                        validationResult?.isValid ? 'border-green-200' : 'border-red-200'
                      }`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${
                            validationResult?.isValid ? 'bg-green-600' : 'bg-red-600'
                          }`}></div>
                          <span className="font-medium text-gray-700">Receipt Validation</span>
                          {ocrResult.confidence && (
                            <span className="text-xs text-gray-500">({ocrResult.confidence.toFixed(1)}% confidence)</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {validationResult?.isValid ? (
                            <span className="text-sm font-medium text-green-600 flex items-center gap-1">
                              <CheckCircle className="h-4 w-4" />
                              Found in Receipt
                            </span>
                          ) : (
                            <span className="text-sm font-medium text-red-600 flex items-center gap-1">
                              <AlertTriangle className="h-4 w-4" />
                              Not Found
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Total Expenses */}
                    {totalExpenses > 0 && (
                      <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-200">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-orange-600"></div>
                          <span className="font-medium text-gray-700">Total Expenses</span>
                        </div>
                        <span className="text-xl font-bold text-orange-600">
                          ₱{totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}

                    {/* Expected Deposit (Sales - Expenses) */}
                    {totalExpenses > 0 && (
                      <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-200">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                          <span className="font-medium text-gray-700">Expected Deposit (Sales - Expenses)</span>
                        </div>
                        <span className="text-xl font-bold text-blue-600">
                          ₱{expectedDepositAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}

                    {/* Manual Deposit Amount */}
                    {amount && (
                      <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-green-200">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-green-600"></div>
                          <span className="font-medium text-gray-700">Deposit Amount</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-bold text-green-600">
                            ₱{parseFloat(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          {dailySalesTotal > 0 && (
                            <span className={`text-sm font-medium ${
                              Math.abs(parseFloat(amount) - expectedDepositAmount) <= 1 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              ({parseFloat(amount) >= expectedDepositAmount ? '+' : ''}₱{Math.abs(parseFloat(amount) - expectedDepositAmount).toFixed(2)})
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Match Status Display */}
                    {amount && dailySalesTotal > 0 && (
                      <div className={`flex items-center justify-between p-4 rounded-lg border-2 ${
                        Math.abs(parseFloat(amount) - expectedDepositAmount) <= 1 
                          ? 'bg-green-50 border-green-500' 
                          : 'bg-red-50 border-red-500'
                      }`}>
                        <div className="flex items-center gap-3">
                          {Math.abs(parseFloat(amount) - expectedDepositAmount) <= 1 ? (
                            <CheckCircle className="h-6 w-6 text-green-600" />
                          ) : (
                            <AlertTriangle className="h-6 w-6 text-red-600" />
                          )}
                          <div>
                            <p className={`text-lg font-bold ${
                              Math.abs(parseFloat(amount) - expectedDepositAmount) <= 1 ? 'text-green-800' : 'text-red-800'
                            }`}>
                              {Math.abs(parseFloat(amount) - expectedDepositAmount) <= 1 
                                ? '✓ Amounts Match' 
                                : '✗ Amounts Do Not Match'}
                            </p>
                            {Math.abs(parseFloat(amount) - expectedDepositAmount) > 1 && (
                              <p className="text-sm text-red-700 mt-1">
                                Difference: ₱{Math.abs(parseFloat(amount) - expectedDepositAmount).toFixed(2)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-600 mb-1">Daily Sales</p>
                          <p className="text-sm font-semibold text-gray-800">
                            ₱{dailySalesTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          {totalExpenses > 0 && (
                            <>
                              <p className="text-xs text-gray-600 mt-1 mb-1">Less: Expenses</p>
                              <p className="text-sm font-semibold text-orange-700">
                                -₱{totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            </>
                          )}
                          <p className="text-xs text-gray-600 mt-1 mb-1">Expected Deposit</p>
                          <p className="text-sm font-semibold text-blue-700">
                            ₱{expectedDepositAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-gray-600 mt-1 mb-1">Actual Deposit</p>
                          <p className="text-sm font-semibold text-gray-800">
                            ₱{parseFloat(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Validation Summary */}
                    {amount && dailySalesTotal > 0 && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-sm font-semibold text-gray-700 mb-2">Validation Summary:</p>
                        <div className="space-y-1">
                          {ocrResult && dailySalesTotal > 0 && (
                            <p className="text-xs text-gray-600">
                              Receipt Check: <span className={`font-medium ${
                                validationResult?.isValid ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {validationResult?.isValid 
                                  ? `✓ Daily sales total (₱${dailySalesTotal.toLocaleString()}) found in receipt` 
                                  : `✗ Daily sales total (₱${dailySalesTotal.toLocaleString()}) not found in receipt`}
                              </span>
                            </p>
                          )}
                          {totalExpenses > 0 && (
                            <p className="text-xs text-gray-600">
                              Expenses deducted: <span className="font-medium text-orange-600">₱{totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </p>
                          )}
                          <p className="text-xs text-gray-600">
                            Deposit vs Expected: <span className={`font-medium ${
                              Math.abs(parseFloat(amount) - expectedDepositAmount) <= 1 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {Math.abs(parseFloat(amount) - expectedDepositAmount) <= 1 ? '✓ Match' : `✗ Difference: ₱${Math.abs(parseFloat(amount) - expectedDepositAmount).toFixed(2)}`}
                            </span>
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Deposit Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deposit Date <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  value={depositDate}
                  onChange={(e) => setDepositDate(e.target.value)}
                  required
                  max={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                />
                <p className="text-xs text-gray-500 mt-1">
                  You can deposit for today or up to 1 day in advance
                </p>
              </div>

              {/* Receipt Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Receipt Image <span className="text-red-500">*</span>
                </label>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <label className="flex-1 cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#160B53] transition-colors">
                        {receiptPreview ? (
                          <img src={receiptPreview} alt="Receipt preview" className="max-h-48 mx-auto rounded" />
                        ) : (
                          <div>
                            <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-600">Click to upload receipt image</p>
                            <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 5MB</p>
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                    
                  {/* Show scanning status */}
                  {isScanning && (
                    <div className="flex items-center justify-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      <span className="text-sm text-blue-700">Scanning receipt...</span>
                    </div>
                  )}

                  {/* OCR Validation Results */}
                  {ocrResult && dailySalesTotal > 0 && (
                    <Card className={`p-4 ${
                      validationResult?.isValid 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {validationResult?.isValid ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 text-red-600" />
                          )}
                          <p className={`text-sm font-medium ${
                            validationResult?.isValid ? 'text-green-800' : 'text-red-800'
                          }`}>
                            {validationResult?.isValid 
                              ? `Daily sales total (₱${dailySalesTotal.toLocaleString()}) found in receipt`
                              : `Daily sales total (₱${dailySalesTotal.toLocaleString()}) not found in receipt`}
                          </p>
                        </div>
                        <p className="text-xs text-gray-600">
                          Receipt scanned with {(ocrResult.confidence || 0).toFixed(1)}% confidence
                        </p>
                      </div>
                    </Card>
                  )}

                </div>
              </div>

              {/* Expenses/Justifications Section */}
              <Card className="p-6 bg-orange-50 border-2 border-orange-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Expenses & Justifications</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Add expenses (e.g., maintenance, repairs) to justify why the deposit amount differs from sales
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addExpense}
                    className="flex items-center gap-2 bg-white hover:bg-orange-100"
                  >
                    <Plus className="h-4 w-4" />
                    Add Expense
                  </Button>
                </div>

                {expenses.length > 0 && (
                  <div className="space-y-4 mb-4">
                    {expenses.map((expense, index) => (
                      <Card key={expense.id} className="p-4 bg-white border border-orange-200">
                        <div className="flex items-start justify-between mb-3">
                          <h4 className="font-semibold text-gray-900">Expense #{index + 1}</h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeExpense(expense.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Amount <span className="text-red-500">*</span>
                            </label>
                            <Input
                              type="number"
                              step="0.01"
                              value={expense.amount}
                              onChange={(e) => updateExpense(expense.id, 'amount', e.target.value)}
                              placeholder="0.00"
                              min="0"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Description <span className="text-red-500">*</span>
                            </label>
                            <Input
                              type="text"
                              value={expense.description}
                              onChange={(e) => updateExpense(expense.id, 'description', e.target.value)}
                              placeholder="e.g., Maintenance repair, Supplies, etc."
                              required
                            />
                          </div>
                        </div>
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Receipt Image (Optional)
                          </label>
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleExpenseImageUpload(expense.id, e)}
                              className="hidden"
                            />
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-orange-400 transition-colors">
                              {expense.receiptPreview ? (
                                <div>
                                  <img src={expense.receiptPreview} alt="Receipt preview" className="max-h-32 mx-auto rounded mb-2" />
                                  <p className="text-xs text-gray-600">Click to change image</p>
                                </div>
                              ) : (
                                <div>
                                  <Receipt className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                                  <p className="text-sm text-gray-600">Click to upload receipt</p>
                                  <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 5MB</p>
                                </div>
                              )}
                            </div>
                          </label>
                        </div>
                      </Card>
                    ))}
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Total Expenses:</span>
                        <span className="text-lg font-bold text-blue-700">₱{totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      {dailySalesTotal > 0 && (
                        <div className="mt-2 pt-2 border-t border-blue-300">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Daily Sales:</span>
                            <span className="text-sm font-semibold text-gray-900">₱{dailySalesTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-sm font-medium text-gray-700">Expected Deposit:</span>
                            <span className="text-base font-bold text-green-700">₱{expectedDepositAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {expenses.length === 0 && (
                  <div className="text-center py-8 border-2 border-dashed border-orange-300 rounded-lg bg-white">
                    <Receipt className="h-12 w-12 text-orange-400 mx-auto mb-3" />
                    <p className="text-sm text-gray-600 mb-2">No expenses added yet</p>
                    <p className="text-xs text-gray-500">Click "Add Expense" to justify deposit differences</p>
                  </div>
                )}
              </Card>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deposit Amount <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  min="0"
                />
                {dailySalesTotal > 0 && (
                  <div className="mt-2 space-y-1">
                    {totalExpenses > 0 && (
                      <p className="text-xs text-gray-600">
                        After expenses: ₱{expectedDepositAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    )}
                    {amount && (
                      <p className={`text-xs font-medium ${
                        Math.abs(parseFloat(amount) - expectedDepositAmount) <= 1 ? 'text-green-600' : 'text-orange-600'
                      }`}>
                        Difference: {parseFloat(amount) >= expectedDepositAmount ? '+' : ''}
                        ₱{Math.abs(parseFloat(amount) - expectedDepositAmount).toFixed(2)}
                        {Math.abs(parseFloat(amount) - expectedDepositAmount) <= 1 && ' ✓ Match'}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Bank Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bank Name
                  </label>
                  <Input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g., BDO, BPI"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Number
                  </label>
                  <Input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="Account number"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reference Number
                </label>
                <Input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="Deposit reference number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
                  placeholder="Additional notes..."
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || checkDuplicateDeposit(depositDate)}
                  className="bg-[#160B53] text-white hover:bg-[#12094A] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Deposit'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deposit Details Modal */}
      {showDetailsModal && selectedDeposit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-[#160B53] to-[#12094A] text-white p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Deposit Details</h2>
                <Button
                  variant="ghost"
                  onClick={() => setShowDetailsModal(false)}
                  className="text-white hover:bg-white/20"
                >
                  <XCircle className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Date</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {format(new Date(selectedDeposit.depositDate), 'MMM dd, yyyy')}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Amount</p>
                  <p className="text-lg font-semibold text-gray-900">
                    ₱{(selectedDeposit.amount || 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Daily Sales</p>
                  <p className="text-lg font-semibold text-gray-900">
                    ₱{(selectedDeposit.dailySalesTotal || 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Difference</p>
                  <p className={`text-lg font-semibold ${
                    Math.abs(selectedDeposit.difference || 0) <= 1 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {selectedDeposit.difference >= 0 ? '+' : ''}₱{Math.abs(selectedDeposit.difference || 0).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Status</p>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(selectedDeposit.status)}`}>
                    {selectedDeposit.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Validation</p>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getValidationColor(selectedDeposit.validationStatus)}`}>
                    {selectedDeposit.validationStatus}
                  </span>
                </div>
              </div>

              {selectedDeposit.receiptImageUrl && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Receipt</p>
                  <img 
                    src={selectedDeposit.receiptImageUrl} 
                    alt="Deposit receipt" 
                    className="max-w-full rounded-lg border border-gray-200"
                  />
                </div>
              )}

              {selectedDeposit.bankName && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Bank</p>
                  <p className="text-gray-900">{selectedDeposit.bankName}</p>
                </div>
              )}

              {selectedDeposit.referenceNumber && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Reference Number</p>
                  <p className="text-gray-900">{selectedDeposit.referenceNumber}</p>
                </div>
              )}

              {selectedDeposit.notes && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Notes</p>
                  <p className="text-gray-900">{selectedDeposit.notes}</p>
                </div>
              )}

              {selectedDeposit.reviewNotes && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Review Notes</p>
                  <p className="text-gray-900">{selectedDeposit.reviewNotes}</p>
                </div>
              )}

              {/* Expenses Section */}
              {selectedDeposit.expenses && selectedDeposit.expenses.length > 0 && (
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-orange-600" />
                    Expenses & Justifications
                  </h3>
                  <div className="space-y-3">
                    {selectedDeposit.expenses.map((expense, index) => (
                      <Card key={index} className="p-4 bg-orange-50 border border-orange-200">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-semibold text-gray-900">Expense #{index + 1}</span>
                              <span className="text-lg font-bold text-orange-700">
                                ₱{(expense.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                            {expense.description && (
                              <p className="text-sm text-gray-700 mb-2">{expense.description}</p>
                            )}
                            {expense.receiptImageUrl && (
                              <div className="mt-3">
                                <p className="text-xs font-medium text-gray-600 mb-2">Receipt:</p>
                                <img 
                                  src={expense.receiptImageUrl} 
                                  alt={`Expense receipt ${index + 1}`}
                                  className="max-w-full max-h-48 rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => window.open(expense.receiptImageUrl, '_blank')}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-700">Total Expenses:</span>
                        <span className="text-lg font-bold text-blue-700">
                          ₱{(selectedDeposit.totalExpenses || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Anomaly Information */}
              {selectedDeposit.hasAnomaly && (
                <div className="border-t border-gray-200 pt-4">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-red-900 mb-2">⚠️ Anomaly Detected</p>
                        <p className="text-sm text-red-800">{selectedDeposit.anomalyDescription || 'Anomaly detected in deposit validation'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Filter Deposits</h2>
              <button
                onClick={() => setShowFilterModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="all">All Status</option>
                      <option value="submitted">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Validation Status</label>
                    <select
                      value={validationFilter}
                      onChange={(e) => setValidationFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                    <select
                      value={dateFilterType}
                      onChange={(e) => handleDateFilterTypeChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-3"
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">To</label>
                          <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
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
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Clear Filters
              </button>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">
                  {filteredDeposits.length} of {deposits.length} deposits
                </span>
                <Button
                  onClick={() => setShowFilterModal(false)}
                  className="bg-[#160B53] text-white hover:bg-[#12094A]"
                >
                  Apply Filters
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Deposit Error Modal */}
      {showDuplicateWarningModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-red-100 rounded-full">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Cannot Submit Deposit</h3>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-sm text-gray-700 mb-2">
                  You already have a deposit for <strong className="text-red-600">{format(new Date(depositDate), 'MMMM dd, yyyy')}</strong>.
                </p>
                <p className="text-sm text-gray-600 mb-3">
                  You cannot submit another deposit for this date. Please select a different date.
                </p>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-xs text-red-800 font-medium">
                    ⚠️ Only one deposit per date is allowed.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end">
                <Button
                  onClick={() => {
                    setShowDuplicateWarningModal(false);
                    setError('');
                  }}
                  className="bg-[#160B53] text-white hover:bg-[#12094A]"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
    
  );
};

export default Deposits;

