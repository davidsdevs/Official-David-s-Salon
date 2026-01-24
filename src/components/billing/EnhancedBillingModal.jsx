/**
 * Enhanced Billing Modal Component
 * Integrates tax configuration and loyalty criteria
 */

import { useState, useEffect } from 'react';
import { X, Calculator, Gift, Percent, Users, Receipt, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  calculateBillTotals, 
  calculateLoyaltyPointsEarned,
  calculateMaxRedeemableLoyaltyPoints 
} from '../../services/billingService';
import { getLoyaltyPoints } from '../../services/loyaltyService';
import { getTaxConfiguration } from '../../services/taxConfigurationService';
import { getLoyaltyCriteria } from '../../services/loyaltyCriteriaService';
import LoadingSpinner from '../ui/LoadingSpinner';
import Modal from '../ui/Modal';
import toast from 'react-hot-toast';

const EnhancedBillingModal = ({ 
  isOpen, 
  onClose, 
  onSubmit,
  billData,
  loading = false
}) => {
  const { currentUser } = useAuth();
  
  const [formData, setFormData] = useState({
    items: [],
    discount: 0,
    discountType: 'fixed',
    loyaltyPointsUsed: 0,
    promotionDiscount: 0,
    paymentMethod: 'cash',
    paymentReference: '',
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
    if (formData.items.length > 0) {
      calculateTotals();
    }
  }, [formData, taxConfig, loyaltyCriteria]);

  const initializeForm = () => {
    setFormData({
      items: billData.items || [],
      discount: billData.discount || 0,
      discountType: billData.discountType || 'fixed',
      loyaltyPointsUsed: 0,
      promotionDiscount: billData.promotionDiscount || 0,
      paymentMethod: 'cash',
      paymentReference: '',
      notes: billData.notes || '',
      customerInfo: {
        isSeniorCitizen: false,
        isPwd: false
      }
    });
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

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const submitData = {
      ...billData,
      ...formData,
      ...calculations,
      loyaltyPointsEarned: loyaltyInfo.pointsToEarn
    };
    
    onSubmit(submitData);
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          {/* Header */}
          <div className="bg-blue-600 px-6 py-4 relative flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="absolute top-4 right-4 p-1 text-white/80 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              <Receipt className="w-6 h-6" />
              Enhanced Billing
            </h2>
            <p className="text-blue-100 text-sm">
              Process payment with tax calculation and loyalty points
            </p>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Items and Discounts */}
              <div className="space-y-6">
                {/* Items Summary */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Items</h3>
                  <div className="space-y-2">
                    {formData.items.map((item, index) => (
                      <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-0">
                        <div>
                          <span className="font-medium">{item.name}</span>
                          <span className="text-sm text-gray-500 ml-2">x{item.quantity || 1}</span>
                        </div>
                        <span className="font-medium">₱{(item.price * (item.quantity || 1)).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Customer Information */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Customer Information
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.customerInfo.isSeniorCitizen}
                          onChange={(e) => handleCustomerInfoChange('isSeniorCitizen', e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium">Senior Citizen</span>
                        {taxConfig && (
                          <span className="text-xs text-gray-500">({taxConfig.seniorCitizenDiscount}% discount)</span>
                        )}
                      </label>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.customerInfo.isPwd}
                          onChange={(e) => handleCustomerInfoChange('isPwd', e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium">Person with Disability (PWD)</span>
                        {taxConfig && (
                          <span className="text-xs text-gray-500">({taxConfig.pwdDiscount}% discount)</span>
                        )}
                      </label>
                    </div>
                  </div>
                </div>

                {/* Additional Discounts */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Percent className="w-5 h-5" />
                    Additional Discounts
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Discount Type
                      </label>
                      <select
                        value={formData.discountType}
                        onChange={(e) => handleInputChange('discountType', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="fixed">Fixed Amount (₱)</option>
                        <option value="percentage">Percentage (%)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Discount Value
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.discount}
                        onChange={(e) => handleInputChange('discount', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder={formData.discountType === 'percentage' ? '10' : '100'}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Loyalty and Payment */}
              <div className="space-y-6">
                {/* Loyalty Points */}
                {billData.clientId && loyaltyCriteria && loyaltyCriteria.isActive && (
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Gift className="w-5 h-5" />
                      Loyalty Points
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Available Points:</span>
                        <span className="font-medium">{loyaltyInfo.availablePoints.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Points to Earn:</span>
                        <span className="font-medium text-green-600">+{loyaltyInfo.pointsToEarn.toLocaleString()}</span>
                      </div>
                      
                      {loyaltyInfo.availablePoints >= loyaltyCriteria.minimumRedemptionPoints && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Use Points (Max: {loyaltyInfo.maxRedeemablePoints.toLocaleString()})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={loyaltyInfo.maxRedeemablePoints}
                            value={formData.loyaltyPointsUsed}
                            onChange={(e) => handleLoyaltyPointsChange(parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="0"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Max discount: ₱{loyaltyInfo.maxRedeemableDiscount.toFixed(2)}
                          </p>
                        </div>
                      )}
                      
                      {loyaltyInfo.availablePoints < loyaltyCriteria.minimumRedemptionPoints && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-yellow-600" />
                            <span className="text-sm text-yellow-800">
                              Minimum {loyaltyCriteria.minimumRedemptionPoints} points required to redeem
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Payment Method */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Payment Method</h3>
                  <div className="space-y-3">
                    <select
                      value={formData.paymentMethod}
                      onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Reference number"
                      />
                    )}
                  </div>
                </div>

                {/* Bill Summary */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Calculator className="w-5 h-5" />
                    Bill Summary
                    {calculating && <LoadingSpinner size="sm" />}
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal:</span>
                      <span>₱{calculations.subtotal.toFixed(2)}</span>
                    </div>
                    {calculations.discount > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>Discounts:</span>
                        <span>-₱{calculations.discount.toFixed(2)}</span>
                      </div>
                    )}
                    {calculations.serviceCharge > 0 && (
                      <div className="flex justify-between">
                        <span>Service Charge ({taxConfig?.serviceCharge}%):</span>
                        <span>₱{calculations.serviceCharge.toFixed(2)}</span>
                      </div>
                    )}
                    {calculations.tax > 0 && (
                      <div className="flex justify-between">
                        <span>VAT ({taxConfig?.vatRate}%):</span>
                        <span>₱{calculations.tax.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="border-t border-gray-300 pt-2 flex justify-between font-bold text-lg">
                      <span>Total:</span>
                      <span>₱{calculations.total.toFixed(2)}</span>
                    </div>
                  </div>
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
                    placeholder="Additional notes..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200 flex-shrink-0">
            <div className="text-sm text-gray-600">
              Total Amount: <span className="font-bold text-lg text-gray-900">₱{calculations.total.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || calculating}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading && <LoadingSpinner size="sm" />}
                {loading ? 'Processing...' : 'Process Payment'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default EnhancedBillingModal;