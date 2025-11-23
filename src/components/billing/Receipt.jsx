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
      voucher: 'Voucher',
      gift_card: 'Gift Card'
    };
    return labels[method] || method;
  };

  return (
    <div ref={ref} className="bg-white p-8 max-w-md mx-auto" style={{ fontFamily: 'monospace' }}>
      {/* Header */}
      <div className="text-center border-b-2 border-dashed border-gray-300 pb-4 mb-4">
        <h1 className="text-2xl font-bold mb-2">DAVID'S SALON</h1>
        {branch && (
          <>
            <p className="text-sm font-semibold">{branch.branchName || bill.branchName}</p>
            {branch.address && (
              <div className="flex items-center justify-center gap-1 text-xs mt-1">
                <MapPin className="w-3 h-3" />
                <span>{branch.address}</span>
              </div>
            )}
            {branch.phoneNumber && (
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
        <div className="flex justify-between">
          <span>Receipt No:</span>
          <span className="font-bold">#{bill.id?.slice(-8).toUpperCase()}</span>
        </div>
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
      </div>

      {/* Items */}
      <div className="mb-4">
        <div className="font-bold text-sm mb-2 border-b border-gray-300 pb-1">ITEMS</div>
        <div className="space-y-2 text-sm">
          {bill.items?.map((item, index) => (
            <div key={index}>
              <div className="flex justify-between">
                <div className="flex-1">
                  <span>{item.name}</span>
                  {(item.type === 'product' || item.quantity > 1) && (
                    <span className="text-xs text-gray-600 ml-1">
                      x{item.quantity || 1}
                    </span>
                  )}
                </div>
                <span className="font-semibold">
                  {item.type === 'product' && item.quantity > 1 ? (
                    <>
                      ₱{item.basePrice?.toFixed(2) || item.price?.toFixed(2)}
                      {item.basePrice && (
                        <span className="text-xs text-gray-500 ml-1">
                          = ₱{item.price?.toFixed(2)}
                        </span>
                      )}
                    </>
                  ) : (
                    `₱${item.price?.toFixed(2)}`
                  )}
                </span>
              </div>
              {item.stylistName && item.type !== 'product' && (
                <div className="text-xs text-gray-600 ml-2">
                  Stylist: {item.stylistName}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="border-t border-dashed border-gray-300 pt-3 mb-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>₱{bill.subtotal?.toFixed(2) || '0.00'}</span>
        </div>
        
        {bill.discount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>
              Discount
              {bill.discountCode && ` (${bill.discountCode})`}:
            </span>
            <span>-₱{bill.discount?.toFixed(2)}</span>
          </div>
        )}

        {bill.loyaltyPointsUsed > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Loyalty Points:</span>
            <span>-₱{bill.loyaltyPointsUsed?.toFixed(2)}</span>
          </div>
        )}

        {bill.serviceCharge > 0 && (
          <div className="flex justify-between">
            <span>Service Charge ({bill.serviceChargeRate}%):</span>
            <span>₱{bill.serviceCharge?.toFixed(2)}</span>
          </div>
        )}

        {bill.tax > 0 && (
          <div className="flex justify-between">
            <span>Tax ({bill.taxRate}%):</span>
            <span>₱{bill.tax?.toFixed(2)}</span>
          </div>
        )}

        <div className="flex justify-between font-bold text-lg border-t border-gray-300 pt-2">
          <span>TOTAL:</span>
          <span>₱{bill.total?.toFixed(2) || '0.00'}</span>
        </div>

        <div className="flex justify-between">
          <span>Payment Method:</span>
          <span className="font-semibold">{getPaymentMethodLabel(bill.paymentMethod)}</span>
        </div>

        {bill.paymentReference && (
          <div className="flex justify-between text-xs">
            <span>Ref:</span>
            <span>{bill.paymentReference}</span>
          </div>
        )}
      </div>

      {/* Status Badge */}
      {bill.status && bill.status !== 'paid' && (
        <div className="text-center mb-4">
          <span className={`inline-block px-3 py-1 text-sm font-bold rounded ${
            bill.status === 'refunded' ? 'bg-red-100 text-red-700' :
            bill.status === 'voided' ? 'bg-gray-100 text-gray-700' :
            'bg-yellow-100 text-yellow-700'
          }`}>
            {bill.status.toUpperCase()}
          </span>
          {bill.refundAmount && (
            <p className="text-sm text-red-600 mt-1">Refunded: ₱{bill.refundAmount.toFixed(2)}</p>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="border-t-2 border-dashed border-gray-300 pt-4 text-center text-xs space-y-1">
        <p className="font-bold">THANK YOU FOR CHOOSING DAVID'S SALON!</p>
        <p>This serves as your official receipt.</p>
        <p className="text-gray-600">Please keep this for your records.</p>
        {bill.notes && (
          <p className="text-gray-500 italic mt-2">{bill.notes}</p>
        )}
      </div>

      {/* QR Code Placeholder (Optional - for future implementation) */}
      <div className="text-center mt-4 text-xs text-gray-400">
        <p>Receipt ID: {bill.id}</p>
      </div>
    </div>
  );
});

Receipt.displayName = 'Receipt';

export default Receipt;
