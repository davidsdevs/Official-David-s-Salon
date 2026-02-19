/**
 * Receipt Component
 * Displays a BIR-compliant printable receipt for billing transactions
 * with comprehensive tax breakdown and store information
 */

import { forwardRef, useState, useEffect } from 'react';
import { Receipt as ReceiptIcon, MapPin, Phone, Mail } from 'lucide-react';
import { getSystemSettings } from '../../services/systemSettingsService';

const Receipt = forwardRef(({ bill, branch }, ref) => {
  const [systemSettings, setSystemSettings] = useState(null);

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await getSystemSettings();
      setSystemSettings(settings);
    };
    loadSettings();
  }, []);

  const formatDate = (date) => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (date) => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getPaymentMethodLabel = (method) => {
    const labels = {
      cash: 'Cash',
      card: 'Card',
      voucher: 'E-Wallet',
      gift_card: 'Gift Card'
    };
    return labels[method] || method;
  };

  const getClientTypeLabel = (type) => {
    const labels = {
      'X': 'New Client',
      'R': 'Regular',
      'TR': 'Transfer'
    };
    return labels[type] || type;
  };

  const formatCurrency = (amount) => {
    return Number(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Calculate VAT breakdown
  const calculateVATBreakdown = () => {
    const subtotal = bill.subtotal || 0;
    const totalDiscount = (bill.discount || 0) + (bill.promotionDiscount || 0) + (bill.loyaltyPointsUsed || 0);
    const netSales = subtotal - totalDiscount;
    const taxRate = bill.taxRate || 12;
    
    // Check if VAT is inclusive (default for Philippines)
    const isVatInclusive = bill.isVatInclusive !== false; // Default to true
    
    let vatableSales = 0;
    let vatAmount = 0;
    let vatExemptSales = 0;
    let zeroRatedSales = 0;
    
    if (isVatInclusive && taxRate > 0) {
      // VAT is included in the price
      vatAmount = netSales / (1 + taxRate / 100) * (taxRate / 100);
      vatableSales = netSales - vatAmount;
    } else if (!isVatInclusive && taxRate > 0) {
      // VAT is added on top
      vatableSales = netSales;
      vatAmount = netSales * (taxRate / 100);
    } else {
      // No VAT
      vatExemptSales = netSales;
    }
    
    // Check if customer is senior citizen or PWD (VAT exempt)
    if (bill.isSeniorCitizen || bill.isPwd || bill.discountType === 'senior' || bill.discountType === 'pwd') {
      vatExemptSales = netSales;
      vatableSales = 0;
      vatAmount = 0;
    }
    
    return {
      vatableSales: parseFloat(vatableSales.toFixed(2)),
      vatAmount: parseFloat(vatAmount.toFixed(2)),
      vatExemptSales: parseFloat(vatExemptSales.toFixed(2)),
      zeroRatedSales: parseFloat(zeroRatedSales.toFixed(2)),
      netSales: parseFloat(netSales.toFixed(2))
    };
  };

  const vatBreakdown = calculateVATBreakdown();

  // Separate services and products
  const services = bill.items?.filter(item => item.type === 'service') || [];
  const products = bill.items?.filter(item => item.type === 'product') || [];

  return (
    <div ref={ref} className="bg-white p-8 max-w-md mx-auto" style={{ fontFamily: 'monospace', fontSize: '12px' }}>
      {/* ================= STORE INFORMATION ================= */}
      <div className="text-center border-b-2 border-gray-800 pb-3 mb-3">
        
        <h1 className="text-xl font-bold my-2">{systemSettings?.companyName || "DAVID'S SALON"}</h1>
        
        {(branch || bill.branchName) && (
          <>
            <p className="text-sm font-semibold">{branch?.branchName || branch?.name || bill.branchName}</p>
            {branch?.address && (
              <p className="text-xs mt-1">{branch.address}</p>
            )}
            {branch?.phoneNumber && (
              <p className="text-xs">Contact: {branch.phoneNumber}</p>
            )}
            {branch?.email && (
              <p className="text-xs">Email: {branch.email}</p>
            )}
          </>
        )}
        
        <div className="mt-2 text-xs space-y-0.5">
          <p>TIN: {systemSettings?.tin || branch?.tin || '000-000-000-000'}</p>
          <p className="font-semibold">{systemSettings?.vatRegistered ? 'VAT Registered' : 'Non-VAT'}</p>
        </div>
      </div>

      {/* ================ TRANSACTION DETAILS ================ */}
      <div className="mb-3 text-xs border-b border-gray-400 pb-3">
        <div className="font-bold mb-2">TRANSACTION DETAILS</div>
        
        <div className="space-y-0.5">
          <div className="flex justify-between">
            <span>Receipt No:</span>
            <span className="font-bold">{bill.receiptNumber || bill.id}</span>
          </div>
          {bill.id && (
            <div className="flex justify-between">
              <span>Invoice No:</span>
              <span className="font-semibold">{bill.id}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>POS Terminal ID:</span>
            <span>{branch?.posTerminalId || 'POS-001'}</span>
          </div>
          <div className="flex justify-between">
            <span>Cashier Name / ID:</span>
            <span>{bill.createdByName || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span>Date:</span>
            <span>{formatDate(bill.createdAt)}</span>
          </div>
          <div className="flex justify-between">
            <span>Time:</span>
            <span>{formatTime(bill.createdAt)}</span>
          </div>
          {bill.appointmentId && (
            <div className="flex justify-between">
              <span>Order No:</span>
              <span>{bill.appointmentId}</span>
            </div>
          )}
        </div>
      </div>

      {/* Customer Info */}
      <div className="mb-3 text-xs border-b border-gray-400 pb-3">
        <div className="font-bold mb-1">CUSTOMER INFORMATION</div>
        <div className="space-y-0.5">
          <div className="flex justify-between">
            <span>Name:</span>
            <span className="font-semibold">{bill.clientName}</span>
          </div>
          {bill.clientPhone && (
            <div className="flex justify-between">
              <span>Phone:</span>
              <span>{bill.clientPhone}</span>
            </div>
          )}
          {bill.clientEmail && (
            <div className="flex justify-between">
              <span>Email:</span>
              <span className="text-xs">{bill.clientEmail}</span>
            </div>
          )}
          {(bill.isSeniorCitizen || bill.discountType === 'senior') && (
            <div className="flex justify-between text-green-700 font-bold">
              <span>Type:</span>
              <span>SENIOR CITIZEN</span>
            </div>
          )}
          {(bill.isPwd || bill.discountType === 'pwd') && (
            <div className="flex justify-between text-green-700 font-bold">
              <span>Type:</span>
              <span>PWD</span>
            </div>
          )}
        </div>
      </div>

      {/* ================= ITEMIZED PURCHASE ================= */}
      <div className="mb-3 border-b border-gray-400 pb-3">
        <div className="text-xs font-bold mb-2">ITEMIZED PURCHASE</div>
        
        <div className="text-xs">
          <div className="flex border-b border-gray-300 pb-1 mb-2 font-bold">
            <div className="w-8">Qty</div>
            <div className="flex-1">Item Description</div>
            <div className="w-20 text-right">Unit Price</div>
            <div className="w-20 text-right">Total</div>
          </div>
          
          {/* Services */}
          {services.length > 0 && (
            <>
              <div className="font-bold text-xs mb-1 text-gray-700">SERVICES:</div>
              {services.map((item, index) => (
                <div key={`service-${index}`} className="mb-2">
                  <div className="flex">
                    <div className="w-8">{item.quantity || 1}</div>
                    <div className="flex-1">
                      <div className="font-medium">{item.name}</div>
                      {item.stylistName && (
                        <div className="text-xs text-gray-600">by {item.stylistName}</div>
                      )}
                      {item.clientType && (
                        <div className="text-xs text-gray-600">({getClientTypeLabel(item.clientType)})</div>
                      )}
                    </div>
                    <div className="w-20 text-right">₱{formatCurrency(item.price || 0)}</div>
                    <div className="w-20 text-right font-semibold">₱{formatCurrency((item.price || 0) * (item.quantity || 1))}</div>
                  </div>
                </div>
              ))}
            </>
          )}
          
          {/* Products */}
          {products.length > 0 && (
            <>
              <div className="font-bold text-xs mb-1 mt-2 text-gray-700">PRODUCTS:</div>
              {products.map((item, index) => (
                <div key={`product-${index}`} className="mb-2">
                  <div className="flex">
                    <div className="w-8">{item.quantity || 1}</div>
                    <div className="flex-1">
                      <div className="font-medium">{item.name}</div>
                      {item.commissionerName && (
                        <div className="text-xs text-gray-600">by {item.commissionerName}</div>
                      )}
                    </div>
                    <div className="w-20 text-right">₱{formatCurrency(item.price || item.unitCost || 0)}</div>
                    <div className="w-20 text-right font-semibold">₱{formatCurrency((item.price || item.unitCost || 0) * (item.quantity || 1))}</div>
                  </div>
                </div>
              ))}
            </>
          )}
          
          {/* Service Product Charges */}
          {bill.serviceProductCharges && bill.serviceProductCharges.length > 0 && (
            <>
              <div className="font-bold text-xs mb-1 mt-2 text-gray-700">SERVICE PRODUCT USAGE:</div>
              {bill.serviceProductCharges.map((charge, index) => (
                <div key={`charge-${index}`} className="mb-1">
                  <div className="flex">
                    <div className="w-8">-</div>
                    <div className="flex-1">
                      <div>{charge.productName}</div>
                      <div className="text-xs text-gray-600">({charge.percentage}% - {charge.quantityUsed}{charge.unit})</div>
                    </div>
                    <div className="w-20 text-right">-</div>
                    <div className="w-20 text-right">₱{formatCurrency(charge.charge)}</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ==================== COST BREAKDOWN =================== */}
      <div className="mb-3 text-xs border-b border-gray-800 pb-3">
        <div className="font-bold mb-2">COST BREAKDOWN</div>
        
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>₱{formatCurrency(bill.subtotal)}</span>
          </div>

          {(bill.serviceProductChargeTotal || 0) > 0 && (
            <div className="flex justify-between">
              <span>Service Product Charges:</span>
              <span>₱{formatCurrency(bill.serviceProductChargeTotal)}</span>
            </div>
          )}

          {/* Discounts Section */}
          {((bill.discount || 0) > 0 || (bill.promotionDiscount || 0) > 0 || (bill.loyaltyPointsUsed || 0) > 0) && (
            <>
              <div className="border-t border-gray-300 pt-1 mt-1">
                <div className="font-bold">Less: Discounts:</div>
              </div>
              
              {(bill.isSeniorCitizen || bill.discountType === 'senior') && bill.discount > 0 && (
                <div className="flex justify-between text-green-700 ml-2">
                  <span>• Senior Citizen Discount:</span>
                  <span>-₱{formatCurrency(bill.discount)}</span>
                </div>
              )}
              
              {(bill.isPwd || bill.discountType === 'pwd') && bill.discount > 0 && (
                <div className="flex justify-between text-green-700 ml-2">
                  <span>• PWD Discount:</span>
                  <span>-₱{formatCurrency(bill.discount)}</span>
                </div>
              )}
              
              {bill.discount > 0 && !bill.isSeniorCitizen && !bill.isPwd && bill.discountType !== 'senior' && bill.discountType !== 'pwd' && (
                <div className="flex justify-between text-green-700 ml-2">
                  <span>• Manual Discount:</span>
                  <span>-₱{formatCurrency(bill.discount)}</span>
                </div>
              )}
              
              {bill.promotionDiscount > 0 && (
                <div className="flex justify-between text-green-700 ml-2">
                  <span>• Promo Discount{bill.promotionCode ? ` (${bill.promotionCode})` : ''}:</span>
                  <span>-₱{formatCurrency(bill.promotionDiscount)}</span>
                </div>
              )}
              
              {bill.loyaltyPointsUsed > 0 && (
                <div className="flex justify-between text-green-700 ml-2">
                  <span>• Loyalty Discount ({bill.loyaltyPointsUsed} pts):</span>
                  <span>-₱{formatCurrency(bill.loyaltyPointsUsed)}</span>
                </div>
              )}
              
              <div className="flex justify-between font-bold text-green-700 border-t border-gray-300 pt-1">
                <span>Total Discounts:</span>
                <span>-₱{formatCurrency((bill.discount || 0) + (bill.promotionDiscount || 0) + (bill.loyaltyPointsUsed || 0))}</span>
              </div>
            </>
          )}

          <div className="flex justify-between font-bold border-t border-gray-300 pt-1 mt-1">
            <span>Net Sales:</span>
            <span>₱{formatCurrency(vatBreakdown.netSales)}</span>
          </div>

          {/* VAT Breakdown */}
          <div className="border-t border-gray-400 pt-2 mt-2 space-y-1">
            <div className="font-bold text-center mb-1">TAX BREAKDOWN</div>
            
            {vatBreakdown.vatableSales > 0 && (
              <div className="flex justify-between">
                <span>VATable Sales:</span>
                <span>₱{formatCurrency(vatBreakdown.vatableSales)}</span>
              </div>
            )}
            
            {vatBreakdown.vatAmount > 0 && (
              <div className="flex justify-between font-semibold">
                <span>VAT Amount ({bill.taxRate || 12}%):</span>
                <span>₱{formatCurrency(vatBreakdown.vatAmount)}</span>
              </div>
            )}
            
            {vatBreakdown.vatExemptSales > 0 && (
              <div className="flex justify-between">
                <span>VAT-Exempt Sales:</span>
                <span>₱{formatCurrency(vatBreakdown.vatExemptSales)}</span>
              </div>
            )}
            
            {vatBreakdown.zeroRatedSales > 0 && (
              <div className="flex justify-between">
                <span>Zero-Rated Sales:</span>
                <span>₱{formatCurrency(vatBreakdown.zeroRatedSales)}</span>
              </div>
            )}
          </div>

          {bill.serviceCharge > 0 && (
            <div className="flex justify-between border-t border-gray-300 pt-1">
              <span>Service Charge ({bill.serviceChargeRate || 0}%):</span>
              <span>₱{formatCurrency(bill.serviceCharge)}</span>
            </div>
          )}

          <div className="border-t-2 border-gray-800 pt-2 mt-2">
            <div className="flex justify-between font-bold text-base">
              <span>TOTAL AMOUNT DUE:</span>
              <span>₱{formatCurrency(bill.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== PAYMENT DETAILS ================== */}
      <div className="mb-3 text-xs border-b border-gray-400 pb-3">
        <div className="font-bold mb-2">PAYMENT DETAILS</div>
        
        <div className="space-y-1">
          <div className="flex justify-between font-semibold">
            <span>Payment Method:</span>
            <span>{getPaymentMethodLabel(bill.paymentMethod)}</span>
          </div>

          {bill.paymentMethod === 'cash' && (
            <>
              <div className="flex justify-between ml-2">
                <span>• Cash:</span>
                <span>₱{formatCurrency(bill.amountReceived || bill.total)}</span>
              </div>
            </>
          )}

          {bill.paymentMethod === 'card' && (
            <div className="flex justify-between ml-2">
              <span>• Card:</span>
              <span>₱{formatCurrency(bill.total)}</span>
            </div>
          )}

          {bill.paymentMethod === 'voucher' && (
            <div className="flex justify-between ml-2">
              <span>• E-Wallet:</span>
              <span>₱{formatCurrency(bill.total)}</span>
            </div>
          )}

          {bill.paymentMethod === 'cash' && bill.amountReceived > 0 && (
            <>
              <div className="flex justify-between">
                <span>Amount Tendered:</span>
                <span>₱{formatCurrency(bill.amountReceived)}</span>
              </div>
              {bill.change > 0 && (
                <div className="flex justify-between font-bold text-green-700">
                  <span>Change:</span>
                  <span>₱{formatCurrency(bill.change)}</span>
                </div>
              )}
            </>
          )}

          {bill.paymentReference && (
            <div className="flex justify-between text-xs mt-1">
              <span>Reference No:</span>
              <span className="font-mono">{bill.paymentReference}</span>
            </div>
          )}
        </div>
      </div>

      {/* Status Badge */}
      {bill.status && bill.status !== 'paid' && (
        <div className="text-center mb-3 border border-red-500 p-2">
          <span className="text-sm font-bold text-red-700">
            *** {bill.status.toUpperCase()} ***
          </span>
          {bill.refundAmount && (
            <p className="text-xs text-red-600 mt-1">Refunded Amount: ₱{formatCurrency(bill.refundAmount)}</p>
          )}
          {bill.voidReason && (
            <p className="text-xs text-gray-600 mt-1">Reason: {bill.voidReason}</p>
          )}
        </div>
      )}

      {/* Notes */}
      {bill.notes && (
        <div className="mb-3 text-xs border-t border-gray-400 pt-2">
          <div className="font-semibold mb-1">Notes:</div>
          <p className="text-gray-700 italic">{bill.notes}</p>
        </div>
      )}

      {/* ======================= FOOTER ====================== */}
      <div className="text-xs border-t-2 border-gray-800 pt-3">
        
        <div className="text-center space-y-1">
          <p className="font-bold">{systemSettings?.receiptFooter || 'Thank you for your purchase!'}</p>
          <p>This serves as your official receipt.</p>
          
          <div className="mt-2 space-y-0.5">
            <p>VAT Reg TIN: {systemSettings?.tin || branch?.tin || '000-000-000-000'}</p>
            <p>Accreditation No: {systemSettings?.birAccreditationNo || branch?.accreditationNo || 'N/A'}</p>
            <p>Permit No: {systemSettings?.birPermitNo || branch?.permitNo || 'N/A'}</p>
            {(systemSettings?.birPermitDateIssued || branch?.permitDateIssued) && (
              <p>Date Issued: {formatDate(systemSettings?.birPermitDateIssued || branch.permitDateIssued)}</p>
            )}
          </div>
          
          <div className="mt-2 text-xs text-gray-600">
            <p>Return / Exchange Policy:</p>
            <p className="text-xs">{systemSettings?.returnPolicy || 'Products may be returned within 7 days'}</p>
            <p className="text-xs">{systemSettings?.returnPolicy ? '' : 'with original receipt and packaging.'}</p>
          </div>
        </div>
      </div>

      {/* Transaction ID Footer */}
      <div className="text-center mt-3 text-xs text-gray-500">
        <p>Transaction ID: {bill.id}</p>
        {bill.receiptNumber && (
          <p>Receipt No: {bill.receiptNumber}</p>
        )}
        <p className="mt-1 text-xs">Powered by {systemSettings?.companyName || "David's Salon"} POS System</p>
      </div>
    </div>
  );
});

Receipt.displayName = 'Receipt';

export default Receipt;
