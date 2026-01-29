/**
 * Two-Step Checkout Modal Component
 * Step 1: Service Review & Items
 * Step 2: Payment Processing (promotions, discounts, loyalty, payment method)
 */

import { useState, useEffect } from 'react';
import { X, ArrowLeft, ArrowRight, Receipt, CreditCard, Gift, Percent, Users, Calculator, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  calculateBillTotals, 
  calculateLoyaltyPointsEarned,
  calculateMaxRedeemableLoyaltyPoints 
} from '../../services/billingService';
import { getLoyaltyPoints } from '../../services/loyaltyService';
import { getTaxConfiguration } from '../../services/taxConfigurationService';
import { getLoyaltyCriteria } from '../../services/loyaltyCriteriaService';
import { validatePromotionCode, calculatePromotionDiscount } from '../../services/promotionService';
import LoadingSpinner from '../ui/LoadingSpinner';
import Modal from '../ui/Modal';
import toast from 'react-hot-toast';

const TwoStepCheckoutModal = ({ 
  isOpen, 
  onClose, 
  onSubmit,
  billData,
  loading = false
}) => {
  const { currentUser } = useAuth();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    items: [],
    discount: 0,
    discountType: 'fixed',
    loyaltyPointsUsed: 0,
    promotionCode: '',
    promotionDiscount: 0,
    paymentMethod: 'cash',
    paymentReference: '',
    amountReceived: '',
    notes: '',
    customerInfo: {
      isSeniorCitizen: false,
      isPwd: false
    }
  });
  
  const [calculations, setCalculations] = useState({
    subtotal: 0,
    discount: 0,
    serviceCharge: 0,
    tax: 0,
    total: 0,
    taxCalculation: null
  });
  
  const [loyaltyInfo, setLoyaltyInfo] = useState({
    availablePoints: 0,
    pointsToEarn: 0,
    maxRedeemablePoints: 0,
    maxRedeemableDiscount: 0
  });
  
  const [appliedPromotion, setAppliedPromotion] = useState(null);
  const [validatingPromotion, setValidatingPromotion] = useState(false);
  const [promotionError, setPromotionError] = useState('');
  
  const [taxConfig, setTaxConfig] = useState(null);
  const [loyaltyCriteria, setLoyaltyCriteria] = useState(null);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    if (isOpen && billData) {
      initializeForm();
      loadConfigurations();
    }
  }, [isOpen, billData]);

  useEffect(() => {
    if (formData.items.length > 0 && currentStep === 2) {
      calculateTotals();
    }
  }, [formData, taxConfig, loyaltyCriteria, currentStep]);

  const initializeForm = () => {
    setFormData({
      items: billData.items || [],
      discount: billData.discount || 0,
      discountType: billData.discountType || 'fixed',
      loyaltyPointsUsed: 0,
      promotionCode: '',
      promotionDiscount: billData.promotionDiscount || 0,
      paymentMethod: 'cash',
      paymentReference: '',
      amountReceived: '',
      notes: billData.notes || '',
      customerInfo: {
        isSeniorCitizen: false,
        isPwd: false
      }
    });
    setCurrentStep(1);
    setAppliedPromotion(null);
    setPromotionError('');
  };

  const loadConfigurations = async () => {
    try {
      const [taxConfigData, loyaltyCriteriaData] = await Promise.all([
        getTaxConfiguration(),
        getLoyaltyCriteria()
      ]);
      
      setTaxConfig(taxConfigData);
      setLoyaltyCriteria(loyaltyCriteriaData);

      // Load loyalty points if client is available
      if (billData.clientId && billData.branchId) {
        const availablePoints = await getLoyaltyPoints(billData.clientId, billData.branchId);
        setLoyaltyInfo(prev => ({ ...prev, availablePoints }));
      }
    } catch (error) {
      console.error('Error loading configurations:', error);
    }
  };

  const calculateTotals = async () => {
    try {
      setCalculating(true);
      
      const subtotal = formData.items.reduce((sum, item) => {
        return sum + (item.price * (item.quantity || 1));
      }, 0);

      // Calculate totals with tax configuration
      const totals = await calculateBillTotals(formData, formData.customerInfo);
      setCalculations(totals);

      // Calculate loyalty points
      if (loyaltyCriteria && billData.clientId) {
        const pointsToEarn = await calculateLoyaltyPointsEarned(totals.total);
        const { maxPoints, maxDiscount } = await calculateMaxRedeemableLoyaltyPoints(
          subtotal, 
          loyaltyInfo.availablePoints
        );
        
        setLoyaltyInfo(prev => ({
          ...prev,
          pointsToEarn,
          maxRedeemablePoints: maxPoints,
          maxRedeemableDiscount: maxDiscount
        }));
      }
    } catch (error) {
      console.error('Error calculating totals:', error);
      toast.error('Error calculating bill totals');
    } finally {
      setCalculating(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCustomerInfoChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      customerInfo: {
        ...prev.customerInfo,
        [field]: value
      }
    }));
  };

  const handleLoyaltyPointsChange = (points) => {
    const maxPoints = Math.min(points, loyaltyInfo.maxRedeemablePoints);
    handleInputChange('loyaltyPointsUsed', maxPoints);
  };

  const handlePromotionCodeValidation = async () => {
    if (!formData.promotionCode.trim()) {
      setAppliedPromotion(null);
      setPromotionError('');
      return;
    }

    try {
      setValidatingPromotion(true);
      setPromotionError('');
      
      const promotion = await validatePromotionCode(
        formData.promotionCode.trim().toUpperCase(),
        billData.branchId
      );
      
      if (promotion.isValid) {
        setAppliedPromotion(promotion.promotion);
        
        // Calculate promotion discount
        const services = formData.items.filter(item => item.type === 'service');
        const products = formData.items.filter(item => item.type === 'product');
        const subtotal = formData.items.reduce((sum, item) => sum + (item.price || 0), 0);
        const promoResult = calculatePromotionDiscount(promotion.promotion, subtotal, services, products);
        
        handleInputChange('promotionDiscount', promoResult.discountAmount);
        toast.success(`Promotion "${promotion.promotion.name}" applied!`);
      } else {
        setAppliedPromotion(null);
        setPromotionError(promotion.message);
        handleInputChange('promotionDiscount', 0);
      }
    } catch (error) {
      console.error('Error validating promotion:', error);
      setPromotionError('Failed to validate promotion code');
      setAppliedPromotion(null);
      handleInputChange('promotionDiscount', 0);
    } finally {
      setValidatingPromotion(false);
    }
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (formData.items.length === 0) {
        toast.error('No items to process');
        return;
      }
      setCurrentStep(2);
    }
  };

  const handlePreviousStep = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (currentStep === 1) {
      handleNextStep();
      return;
    }

    // Validate payment for cash
    if (formData.paymentMethod === 'cash') {
      const amountReceived = parseFloat(formData.amountReceived) || 0;
      if (!formData.amountReceived || amountReceived < calculations.total) {
        toast.error(`Insufficient amount received! Required: ₱${calculations.total.toFixed(2)}`);
        return;
      }
    }
    
    const submitData = {
      ...billData,
      ...formData,
      ...calculations,
      loyaltyPointsEarned: loyaltyInfo.pointsToEarn,
      appliedPromotion: appliedPromotion,
      promotionId: appliedPromotion?.id || null,
      promotionCode: appliedPromotion?.promotionCode || formData.promotionCode || null
    };
    
    onSubmit(submitData);
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          {/* Header with Step Indicator */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 relative flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="absolute top-4 right-4 p-1 text-white/80 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                {currentStep === 1 ? <Receipt className="w-6 h-6" /> : <CreditCard className="w-6 h-6" />}
                {currentStep === 1 ? 'Review Items' : 'Process Payment'}
              </h2>
              
              {/* Step Indicator */}
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  currentStep >= 1 ? 'bg-white text-blue-600' : 'bg-blue-500 text-white'
                }`}>
                  1
                </div>
                <div className="w-8 h-1 bg-blue-500"></div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  currentStep >= 2 ? 'bg-white text-blue-600' : 'bg-blue-500 text-white'
                }`}>
                  2
                </div>
              </div>
            </div>
            
            <p className="text-blue-100 text-sm">
              {currentStep === 1 
                ? 'Review the services and items before proceeding to payment'
                : 'Apply discounts, promotions, and select payment method'
              }
            </p>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {currentStep === 1 ? (
              /* Step 1: Items Review */
              <div className="space-y-6">
                {/* Customer Information */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    Customer Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-600">Name:</span>
                      <p className="font-semibold text-gray-900">{billData.clientName || 'Guest Customer'}</p>
                    </div>
                    {billData.clientPhone && (
                      <div>
                        <span className="text-sm text-gray-600">Phone:</span>
                        <p className="font-semibold text-gray-900">{billData.clientPhone}</p>
                      </div>
                    )}
                    {billData.clientEmail && (
                      <div>
                        <span className="text-sm text-gray-600">Email:</span>
                        <p className="font-semibold text-gray-900">{billData.clientEmail}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-sm text-gray-600">Appointment ID:</span>
                      <p className="font-semibold text-gray-900">{billData.appointmentId || 'Walk-in'}</p>
                    </div>
                  </div>
                </div>

                {/* Items Summary */}
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-gray-600" />
                    Services & Items
                  </h3>
                  <div className="space-y-3">
                    {formData.items.map((item, index) => (
                      <div key={index} className="flex justify-between items-center py-4 px-4 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="flex-1">
                          <span className="font-semibold text-gray-900 block">{item.name}</span>
                          <div className="flex items-center gap-4 mt-2">
                            <span className="text-sm text-gray-600">Qty: {item.quantity || 1}</span>
                            <span className="text-sm text-gray-600">Unit: ₱{item.price.toFixed(2)}</span>
                            {item.stylistName && (
                              <span className="text-sm text-blue-600">Stylist: {item.stylistName}</span>
                            )}
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                              item.type === 'service' 
                                ? 'bg-blue-100 text-blue-700' 
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {item.type === 'service' ? 'Service' : 'Product'}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-bold text-gray-900">
                            ₱{(item.price * (item.quantity || 1)).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                    
                    {formData.items.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                        <p>No items added yet</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Items Subtotal */}
                  {formData.items.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-gray-200">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-semibold text-gray-700">Subtotal:</span>
                        <span className="text-2xl font-bold text-gray-900">
                          ₱{formData.items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Additional notes for this transaction..."
                  />
                </div>
              </div>
            ) : (
              /* Step 2: Payment Processing - Enhanced Layout */
              <div className="space-y-6">
                {/* Top Section: 50/50 Split */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* LEFT SIDE - Payment Summary (50%) */}
                  <div className="space-y-6">
                    {/* Bill Summary */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl p-6 shadow-lg h-full">
                      <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <Calculator className="w-7 h-7 text-blue-600" />
                        Payment Summary
                        {calculating && <LoadingSpinner size="sm" />}
                      </h3>
                      
                      {/* Items List */}
                      <div className="space-y-3 mb-6">
                        <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Items</h4>
                        <div className="max-h-48 overflow-y-auto space-y-2">
                          {formData.items.map((item, index) => (
                            <div key={index} className="flex justify-between items-start py-2 px-3 bg-white rounded-lg border border-blue-100">
                              <div className="flex-1">
                                <span className="font-medium text-gray-900 text-sm block">{item.name}</span>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-gray-600">Qty: {item.quantity || 1}</span>
                                  <span className="text-xs text-gray-600">× ₱{item.price.toFixed(2)}</span>
                                  {item.stylistName && (
                                    <span className="text-xs text-blue-600">{item.stylistName}</span>
                                  )}
                                </div>
                              </div>
                              <span className="text-sm font-semibold text-gray-900">
                                ₱{(item.price * (item.quantity || 1)).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Total Amount - Large and Prominent */}
                      <div className="bg-white rounded-xl p-6 border-2 border-blue-400 shadow-lg mt-6">
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-2xl font-bold text-gray-900">TOTAL DUE:</span>
                          <span className="text-4xl font-black text-blue-600">₱{(calculations?.total || 0).toFixed(2)}</span>
                        </div>
                        
                        {/* Payment Method Display */}
                        <div className="pt-4 border-t-2 border-gray-200">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600 font-medium">Payment Method:</span>
                            <span className="text-lg font-bold text-gray-900 capitalize">
                              {formData.paymentMethod.replace('_', ' ')}
                            </span>
                          </div>
                          {formData.paymentReference && (
                            <div className="flex justify-between items-center mt-2">
                              <span className="text-sm text-gray-600">Reference:</span>
                              <span className="font-medium text-gray-900">{formData.paymentReference}</span>
                            </div>
                          )}
                          {formData.paymentMethod === 'cash' && formData.amountReceived && parseFloat(formData.amountReceived) >= (calculations?.total || 0) && (
                            <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-200">
                              <span className="text-sm text-gray-600">Change:</span>
                              <span className="text-lg font-bold text-green-600">
                                ₱{Math.max(0, parseFloat(formData.amountReceived) - (calculations?.total || 0)).toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT SIDE - Processing (Promotions, Discounts, Payment) (50%) */}
                  <div className="space-y-4">
                    {/* Payment Method */}
                    <div className="bg-white border-2 border-gray-300 rounded-xl p-5 shadow-sm">
                      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-gray-600" />
                        Payment Method
                      </h3>
                      <div className="space-y-3">
                        <select
                          value={formData.paymentMethod}
                          onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-base"
                        >
                          <option value="cash">Cash</option>
                          <option value="card">Card</option>
                          <option value="voucher">Voucher</option>
                          <option value="gift_card">Gift Card</option>
                        </select>
                        
                        {(formData.paymentMethod === 'card' || formData.paymentMethod === 'voucher' || formData.paymentMethod === 'gift_card') && (
                          <input
                            type="text"
                            value={formData.paymentReference}
                            onChange={(e) => handleInputChange('paymentReference', e.target.value)}
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Reference number"
                          />
                        )}
                        
                        {formData.paymentMethod === 'cash' && (
                          <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                              Amount Received *
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={formData.amountReceived}
                              onChange={(e) => handleInputChange('amountReceived', e.target.value)}
                              className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 text-lg font-semibold ${
                                formData.amountReceived && parseFloat(formData.amountReceived) < (calculations?.total || 0)
                                  ? 'border-red-500 bg-red-50'
                                  : 'border-gray-300'
                              }`}
                              placeholder="0.00"
                            />
                            {formData.amountReceived && parseFloat(formData.amountReceived) < (calculations?.total || 0) && (
                              <p className="mt-2 text-sm text-red-600 font-bold">
                                Insufficient! Short: ₱{((calculations?.total || 0) - parseFloat(formData.amountReceived)).toFixed(2)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Customer Discounts */}
                    <div className="bg-white border-2 border-gray-300 rounded-xl p-5 shadow-sm">
                      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Users className="w-5 h-5 text-gray-600" />
                        Customer Discounts
                      </h3>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border-2 border-blue-200">
                          <input
                            type="checkbox"
                            checked={formData.customerInfo.isSeniorCitizen}
                            onChange={(e) => handleCustomerInfoChange('isSeniorCitizen', e.target.checked)}
                            className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <span className="font-bold text-gray-900">Senior Citizen</span>
                            {taxConfig && (
                              <p className="text-sm text-blue-600 font-medium">
                                {taxConfig.seniorCitizenDiscount}% discount + VAT exempt
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border-2 border-purple-200">
                          <input
                            type="checkbox"
                            checked={formData.customerInfo.isPwd}
                            onChange={(e) => handleCustomerInfoChange('isPwd', e.target.checked)}
                            className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                          />
                          <div className="flex-1">
                            <span className="font-bold text-gray-900">PWD</span>
                            {taxConfig && (
                              <p className="text-sm text-purple-600 font-medium">
                                {taxConfig.pwdDiscount}% discount + VAT exempt
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {(formData.customerInfo.isSeniorCitizen || formData.customerInfo.isPwd) && (
                          <div className="bg-green-50 border-2 border-green-300 rounded-lg p-3">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-5 h-5 text-green-600" />
                              <span className="font-bold text-green-800 text-sm">
                                Special discount applied!
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Promotion Code */}
                    <div className="bg-white border-2 border-gray-300 rounded-xl p-5 shadow-sm">
                      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Gift className="w-5 h-5 text-gray-600" />
                        Promotion Code
                      </h3>
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={formData.promotionCode}
                            onChange={(e) => handleInputChange('promotionCode', e.target.value.toUpperCase())}
                            className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
                            placeholder="Enter code"
                          />
                          <button
                            type="button"
                            onClick={handlePromotionCodeValidation}
                            disabled={validatingPromotion || !formData.promotionCode.trim()}
                            className="px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-bold"
                          >
                            {validatingPromotion && <LoadingSpinner size="sm" />}
                            Apply
                          </button>
                        </div>
                        
                        {promotionError && (
                          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-3">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 text-red-600" />
                              <span className="text-sm text-red-800 font-medium">{promotionError}</span>
                            </div>
                          </div>
                        )}
                        
                        {appliedPromotion && (
                          <div className="bg-green-50 border-2 border-green-300 rounded-lg p-3">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600" />
                              <span className="text-sm text-green-800 font-bold">
                                {appliedPromotion.name}
                                {appliedPromotion.discountType === 'percentage' && (
                                  <span className="ml-1">({appliedPromotion.discountValue}%)</span>
                                )}
                                {' '}- ₱{formData.promotionDiscount.toFixed(2)} off
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Additional Discounts */}
                    {!appliedPromotion && (
                      <div className="bg-white border-2 border-gray-300 rounded-xl p-5 shadow-sm">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                          <Percent className="w-5 h-5 text-gray-600" />
                          Additional Discounts
                        </h3>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                              Discount Type
                            </label>
                            <select
                              value={formData.discountType}
                              onChange={(e) => handleInputChange('discountType', e.target.value)}
                              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
                            >
                              <option value="fixed">Fixed Amount (₱)</option>
                              <option value="percentage">Percentage (%)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                              Discount Value
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={formData.discount}
                              onChange={(e) => handleInputChange('discount', parseFloat(e.target.value) || 0)}
                              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
                              placeholder={formData.discountType === 'percentage' ? '10' : '100'}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Loyalty Points */}
                    {billData.clientId && loyaltyCriteria && loyaltyCriteria.isActive && (
                      <div className="bg-white border-2 border-gray-300 rounded-xl p-5 shadow-sm">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                          <Gift className="w-5 h-5 text-gray-600" />
                          Loyalty Points
                        </h3>
                        <div className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600 font-medium">Available:</span>
                            <span className="font-bold">{loyaltyInfo.availablePoints.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600 font-medium">To Earn:</span>
                            <span className="font-bold text-green-600">+{loyaltyInfo.pointsToEarn.toLocaleString()}</span>
                          </div>
                          
                          {loyaltyInfo.availablePoints >= loyaltyCriteria.minimumRedemptionPoints && (
                            <div>
                              <label className="block text-sm font-bold text-gray-700 mb-2">
                                Use Points (Max: {loyaltyInfo.maxRedeemablePoints.toLocaleString()})
                              </label>
                              <input
                                type="number"
                                min="0"
                                max={loyaltyInfo.maxRedeemablePoints}
                                value={formData.loyaltyPointsUsed}
                                onChange={(e) => handleLoyaltyPointsChange(parseInt(e.target.value) || 0)}
                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
                                placeholder="0"
                              />
                              <p className="text-xs text-gray-500 mt-1 font-medium">
                                Max discount: ₱{loyaltyInfo.maxRedeemableDiscount.toFixed(2)}
                              </p>
                            </div>
                          )}
                          
                          {loyaltyInfo.availablePoints < loyaltyCriteria.minimumRedemptionPoints && (
                            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-3">
                              <div className="flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-yellow-600" />
                                <span className="text-sm text-yellow-800 font-medium">
                                  Min {loyaltyCriteria.minimumRedemptionPoints} points required
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Section: Breakdown (Only show if items exist) */}
                <div className="bg-gradient-to-r from-gray-50 to-blue-50 border-2 border-blue-300 rounded-xl p-6 shadow-lg">
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Receipt className="w-6 h-6 text-blue-600" />
                    Bill Breakdown
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Subtotal - Always show */}
                    <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                      <span className="text-sm text-gray-600 font-medium block mb-1">Subtotal</span>
                      <span className="text-2xl font-bold text-gray-900">₱{(calculations?.subtotal || 0).toFixed(2)}</span>
                    </div>
                    
                    {/* Manual Discounts (Senior/PWD/Manual) - Only show if exists */}
                    {(calculations?.discount || 0) > 0 && (
                      <div className="bg-white rounded-lg p-4 border-2 border-red-200">
                        <span className="text-sm text-gray-600 font-medium block mb-1">
                          Discounts
                          {formData.customerInfo?.isSeniorCitizen && ' (Senior)'}
                          {formData.customerInfo?.isPwd && ' (PWD)'}
                        </span>
                        <span className="text-2xl font-bold text-red-600">-₱{(calculations?.discount || 0).toFixed(2)}</span>
                      </div>
                    )}
                    
                    {/* Promotions - Only show if exists */}
                    {(calculations?.promotionDiscount || 0) > 0 && appliedPromotion && (
                      <div className="bg-white rounded-lg p-4 border-2 border-orange-200">
                        <span className="text-sm text-gray-600 font-medium block mb-1">
                          Promotion
                          {appliedPromotion.discountType === 'percentage' && (
                            <span className="ml-1 text-orange-600">({appliedPromotion.discountValue}%)</span>
                          )}
                        </span>
                        <span className="text-2xl font-bold text-orange-600">-₱{(calculations?.promotionDiscount || 0).toFixed(2)}</span>
                        <span className="text-xs text-gray-500 block mt-1">{appliedPromotion.name}</span>
                      </div>
                    )}
                    
                    {/* Loyalty Points - Only show if exists */}
                    {(calculations?.loyaltyDiscount || 0) > 0 && formData.loyaltyPointsUsed > 0 && (
                      <div className="bg-white rounded-lg p-4 border-2 border-purple-200">
                        <span className="text-sm text-gray-600 font-medium block mb-1">
                          Loyalty ({formData.loyaltyPointsUsed.toLocaleString()} pts)
                        </span>
                        <span className="text-2xl font-bold text-purple-600">
                          -₱{(calculations?.loyaltyDiscount || 0).toFixed(2)}
                        </span>
                      </div>
                    )}
                    
                    {/* Tax - Only show if exists */}
                    {(calculations?.tax || 0) > 0 && (
                      <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                        <span className="text-sm text-gray-600 font-medium block mb-1">
                          VAT ({taxConfig?.vatRate}%)
                        </span>
                        <span className="text-2xl font-bold text-green-600">+₱{(calculations?.tax || 0).toFixed(2)}</span>
                      </div>
                    )}
                    
                    {/* Service Charge - Only show if exists */}
                    {(calculations?.serviceCharge || 0) > 0 && (
                      <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                        <span className="text-sm text-gray-600 font-medium block mb-1">
                          Service Charge ({taxConfig?.serviceCharge}%)
                        </span>
                        <span className="text-2xl font-bold text-green-600">+₱{(calculations?.serviceCharge || 0).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gradient-to-r from-gray-50 to-blue-50 px-6 py-6 flex items-center justify-between border-t-2 border-blue-200 flex-shrink-0">
            <div className="flex flex-col">
              <span className="text-sm text-gray-600 font-medium">
                {currentStep === 1 ? 'Items Subtotal' : 'Total Amount Due'}
              </span>
              <span className="text-2xl font-black text-blue-600">
                ₱{currentStep === 1 
                  ? formData.items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0).toFixed(2)
                  : (calculations?.total || 0).toFixed(2)
                }
              </span>
              {currentStep === 2 && (
                <span className="text-xs text-gray-500 capitalize">
                  Payment: {formData.paymentMethod.replace('_', ' ')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              {currentStep === 2 && (
                <button
                  type="button"
                  onClick={handlePreviousStep}
                  disabled={loading}
                  className="px-6 py-3 text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-6 py-3 text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || calculating || (currentStep === 1 && formData.items.length === 0) || 
                  (currentStep === 2 && formData.paymentMethod === 'cash' && 
                   (!formData.amountReceived || parseFloat(formData.amountReceived) < (calculations?.total || 0)))}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 font-bold text-lg shadow-lg"
              >
                {loading && <LoadingSpinner size="sm" />}
                {currentStep === 1 ? (
                  <>
                    Continue to Payment
                    <ArrowRight className="w-5 h-5" />
                  </>
                ) : (
                  loading ? 'Processing Payment...' : 'Process Payment'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default TwoStepCheckoutModal;