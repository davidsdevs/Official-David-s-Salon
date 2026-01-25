/**
 * Receipt Component
 * Displays a printable receipt for billing transactions
 */

import { forwardRef } from 'react';
import { Receipt as ReceiptIcon, MapPin, Phone, Mail } from 'lucide-react';

const Receipt = forwardRef(({ bill, branch }, ref) => {
  const formatDate = (date) => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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

  // Separate services and products
  const services = bill.items?.filter(item => item.type === 'service') || [];
  const products = bill.items?.filter(item => item.type === 'product') || [];

  return (
    <div ref={ref} className="bg-white p-8 max-w-md mx-auto" style={{ fontFamily: 'monospace' }}>
      {/* Header */}
      <div className="text-center border-b-2 border-dashed border-gray-300 pb-4 mb-4">
        <h1 className="text-2xl font-bold mb-2">DAVID'S SALON</h1>
        {(branch || bill.branchName) && (
          <>
            <p className="text-sm font-semibold">{branch?.branchName || branch?.name || bill.branchName}</p>
            {branch?.address && (
              <div className="flex items-center justify-center gap-1 text-xs mt-1">
                <MapPin className="w-3 h-3" />
                <span>{branch.address}</span>
              </div>
            )}
            {branch?.phoneNumber && (
              <div className="flex items-center justify-center gap-1 text-xs">
                <Phone className="w-3 h-3" />
                <span>{branch.phoneNumber}</span>
              </div>
            )}
          </>
        )}
        <div className="flex items-center justify-center gap-2 mt-3">
          <ReceiptIcon className="w-5 h-5" />
          <span className="font-bold">OFFICIAL RECEIPT</span>
        </div>
      </div>

      {/* Receipt Details */}
      <div className="mb-4 text-sm space-y-1">
        <div className="flex justify-between border-b border-dashed border-gray-300 pb-1 mb-1">
          <span className="font-semibold">Receipt No:</span>
          <span className="font-bold text-lg">#{bill.receiptNumber || bill.id}</span>
        </div>
        {bill.id && (
          <div className="flex justify-between">
            <span>Transaction ID:</span>
            <span className="font-semibold">{bill.id}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Date:</span>
          <span>{formatDate(bill.createdAt)}</span>
        </div>
        <div className="flex justify-between">
          <span>Cashier:</span>
          <span>{bill.createdByName || 'N/A'}</span>
        </div>
      </div>

      {/* Customer Info */}
      <div className="border-t border-b border-dashed border-gray-300 py-3 mb-4 text-sm">
        <div className="flex justify-between">
          <span>Customer:</span>
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
            <span>{bill.clientEmail}</span>
          </div>
        )}
      </div>

      {/* Services Section */}
      {services.length > 0 && (
        <div className="mb-4">
          <div className="font-bold text-sm mb-2 border-b border-gray-300 pb-1">SERVICES</div>
          <div className="space-y-3 text-sm">
            {services.map((item, index) => (
              <div key={index} className="border-b border-dotted border-gray-200 pb-2">
                <div className="flex justify-between">
                  <div className="flex-1">
                    <span className="font-medium">{item.name}</span>
                    {item.quantity > 1 && (
                      <span className="text-xs text-gray-600 ml-1">x{item.quantity}</span>
                    )}
                  </div>
                  <span className="font-semibold">
                    ₱{formatCurrency((item.price || 0) * (item.quantity || 1))}
                  </span>
                </div>
                {item.stylistName && (
                  <div className="text-xs text-gray-600 ml-2">
                    Stylist: {item.stylistName}
                  </div>
                )}
                {item.clientType && (
                  <div className="text-xs text-gray-600 ml-2">
                    Client Type: {getClientTypeLabel(item.clientType)}
                  </div>
                )}
                {item.adjustment !== 0 && item.adjustment !== undefined && (
                  <div className="text-xs text-gray-600 ml-2">
                    Adjustment: {item.adjustment > 0 ? '+' : ''}₱{formatCurrency(item.adjustment)}
                    {item.adjustmentReason && ` (${item.adjustmentReason})`}
                  </div>
                )}
                {item.quantity > 1 && (
                  <div className="text-xs text-gray-500 ml-2">
                    Unit Price: ₱{formatCurrency(item.price || 0)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Products Section */}
      {products.length > 0 && (
        <div className="mb-4">
          <div className="font-bold text-sm mb-2 border-b border-gray-300 pb-1">PRODUCTS</div>
          <div className="space-y-2 text-sm">
            {products.map((item, index) => (
              <div key={index}>
                <div className="flex justify-between">
                  <div className="flex-1">
                    <span>{item.name}</span>
                    <span className="text-xs text-gray-600 ml-1">x{item.quantity || 1}</span>
                  </div>
                  <span className="font-semibold">
                    ₱{formatCurrency((item.price || item.unitCost || 0) * (item.quantity || 1))}
                  </span>
                </div>
                {item.quantity > 1 && (
                  <div className="text-xs text-gray-500 ml-2">
                    Unit Price: ₱{formatCurrency(item.price || item.unitCost || 0)}
                  </div>
                )}
                {item.commissionerName && (
                  <div className="text-xs text-gray-600 ml-2">
                    Commissioner: {item.commissionerName}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Service Product Charges (Salon Use) */}
      {bill.serviceProductCharges && bill.serviceProductCharges.length > 0 && (
        <div className="mb-4">
          <div className="font-bold text-sm mb-2 border-b border-gray-300 pb-1">SERVICE PRODUCT USAGE</div>
          <div className="space-y-1 text-xs">
            {bill.serviceProductCharges.map((charge, index) => (
              <div key={index} className="flex justify-between">
                <div className="flex-1">
                  <span>{charge.productName}</span>
                  <span className="text-gray-500 ml-1">
                    ({charge.percentage}% - {charge.quantityUsed}{charge.unit})
                  </span>
                </div>
                <span>₱{formatCurrency(charge.charge)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Totals */}
      <div className="border-t border-dashed border-gray-300 pt-3 mb-4 space-y-2 text-sm">
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

        {bill.discount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>
              Discount
              {(bill.discountType === 'percent' || bill.discountType === 'percentage') && bill.discountValue && ` (${bill.discountValue}%)`}
              {bill.promotionCode && ` - ${bill.promotionCode}`}:
            </span>
            <span>-₱{formatCurrency(bill.discount)}</span>
          </div>
        )}

        {bill.promotionDiscount > 0 && !bill.discount && (
          <div className="flex justify-between text-green-600">
            <span>Promo ({bill.promotionCode}):</span>
            <span>-₱{formatCurrency(bill.promotionDiscount)}</span>
          </div>
        )}

        {bill.loyaltyPointsUsed > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Loyalty Points ({bill.loyaltyPointsUsed} pts):</span>
            <span>-₱{formatCurrency(bill.loyaltyPointsUsed)}</span>
          </div>
        )}

        {bill.serviceCharge > 0 && (
          <div className="flex justify-between">
            <span>Service Charge ({bill.serviceChargeRate}%):</span>
            <span>₱{formatCurrency(bill.serviceCharge)}</span>
          </div>
        )}

        {bill.tax > 0 && (
          <div className="flex justify-between">
            <span>Tax ({bill.taxRate}%):</span>
            <span>₱{formatCurrency(bill.tax)}</span>
          </div>
        )}

        <div className="flex justify-between font-bold text-lg border-t border-gray-300 pt-2">
          <span>TOTAL:</span>
          <span>₱{formatCurrency(bill.total)}</span>
        </div>

        <div className="border-t border-gray-200 pt-2">
          <div className="flex justify-between">
            <span>Payment Method:</span>
            <span className="font-semibold">{getPaymentMethodLabel(bill.paymentMethod)}</span>
          </div>

          {bill.paymentMethod === 'cash' && bill.amountReceived > 0 && (
            <>
              <div className="flex justify-between">
                <span>Amount Received:</span>
                <span className="font-semibold">₱{formatCurrency(bill.amountReceived)}</span>
              </div>
              {bill.change > 0 && (
                <div className="flex justify-between text-green-600 font-bold">
                  <span>Change:</span>
                  <span>₱{formatCurrency(bill.change)}</span>
                </div>
              )}
            </>
          )}

          {bill.paymentReference && (
            <div className="flex justify-between text-xs mt-1">
              <span>Reference:</span>
              <span>{bill.paymentReference}</span>
            </div>
          )}
        </div>
      </div>

      {/* Status Badge */}
      {bill.status && bill.status !== 'paid' && (
        <div className="text-center mb-4">
          <span className={`inline-block px-3 py-1 text-sm font-bold rounded ${bill.status === 'refunded' ? 'bg-red-100 text-red-700' :
            bill.status === 'voided' ? 'bg-gray-100 text-gray-700' :
              'bg-yellow-100 text-yellow-700'
            }`}>
            {bill.status.toUpperCase()}
          </span>
          {bill.refundAmount && (
            <p className="text-sm text-red-600 mt-1">Refunded: ₱{formatCurrency(bill.refundAmount)}</p>
          )}
        </div>
      )}

      {/* Notes */}
      {bill.notes && (
        <div className="border-t border-dashed border-gray-300 pt-3 mb-4 text-sm">
          <div className="font-semibold mb-1">Notes:</div>
          <p className="text-gray-600 italic">{bill.notes}</p>
        </div>
      )}

      {/* Footer */}
      <div className="border-t-2 border-dashed border-gray-300 pt-4 text-center text-xs space-y-1">
        <p className="font-bold">THANK YOU FOR CHOOSING DAVID'S SALON!</p>
        <p>This serves as your official receipt.</p>
        <p className="text-gray-600">Please keep this for your records.</p>
      </div>

      {/* Transaction ID Footer */}
      <div className="text-center mt-4 text-xs text-gray-400">
        <p>Transaction ID: {bill.id}</p>
        {bill.receiptNumber && (
          <p className="mt-1">Receipt No: {bill.receiptNumber}</p>
        )}
      </div>
    </div>
  );
});

Receipt.displayName = 'Receipt';

export default Receipt;
