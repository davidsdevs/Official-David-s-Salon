/**
 * Receipt Component - Matches Thermal Printer Format
 * Mimics the 58mm thermal receipt layout
 */

import { forwardRef, useState, useEffect } from 'react';
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
    if (!date) return new Date().toLocaleDateString();
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const formatTime = (date) => {
    if (!date) return new Date().toLocaleTimeString();
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleTimeString('en-PH', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatCurrency = (amount) => {
    return 'P' + Number(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const wrapText = (text, maxWidth = 32) => {
    if (!text) return [''];
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + ' ' + word).trim().length <= maxWidth) {
        currentLine = (currentLine + ' ' + word).trim();
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word.length > maxWidth ? word.substring(0, maxWidth) : word;
      }
    }
    if (currentLine) lines.push(currentLine);

    return lines.length > 0 ? lines : [''];
  };

  const services = bill.items?.filter(item => item.type === 'service') || [];
  const products = bill.items?.filter(item => item.type === 'product') || [];

  return (
    <div ref={ref} className="bg-white p-6 max-w-md mx-auto" style={{ fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.5', width: '384px' }}>
      
      {/* HEADER - Salon Name */}
      <div className="text-center mb-2">
        <div className="text-2xl font-bold mb-1">DAVID'S SALON</div>
        {(branch?.name || branch?.branchName) && (
          <div className="text-base font-bold mb-2">{branch.name || branch.branchName}</div>
        )}
      </div>

      {/* Branch Address */}
      {branch?.address && (
        <div className="text-center text-xs mb-1">
          {wrapText(branch.address, 32).map((line, idx) => (
            <div key={idx}>{line}</div>
          ))}
        </div>
      )}

      {/* Contact */}
      {branch?.phone && (
        <div className="text-center text-xs mb-2">Tel: {branch.phone}</div>
      )}

      <div className="border-t-2 border-black my-2" style={{ borderTopWidth: '2px' }}></div>

      {/* Receipt Info */}
      <div className="text-center font-bold text-sm mb-2">OFFICIAL RECEIPT</div>
      <div className="border-t border-black mb-2"></div>

      {/* Receipt Details */}
      <div className="text-xs space-y-0.5 mb-2">
        <div className="flex justify-between">
          <span>Receipt #:</span>
          <span>{bill.receiptNumber || bill.id}</span>
        </div>
        <div className="flex justify-between">
          <span>Date:</span>
          <span>{formatDate(bill.createdAt)}</span>
        </div>
        <div className="flex justify-between">
          <span>Time:</span>
          <span>{formatTime(bill.createdAt)}</span>
        </div>
        <div className="flex justify-between">
          <span>Cashier:</span>
          <span>{bill.createdByName || 'Staff'}</span>
        </div>
      </div>

      <div className="border-t border-black mb-2"></div>

      {/* Customer */}
      <div className="flex justify-between text-xs mb-2">
        <span>Customer:</span>
        <span>{bill.clientName || 'Guest'}</span>
      </div>

      <div className="border-t-2 border-black my-2" style={{ borderTopWidth: '2px' }}></div>

      {/* Items Header */}
      <div className="font-bold text-xs mb-2">ITEMS</div>
      <div className="border-t border-black mb-2"></div>

      {/* Print each item */}
      <div className="text-xs space-y-2 mb-2">
        {(bill.items || []).map((item, index) => {
          const itemName = item.name || item.serviceName || 'Item';
          const qty = item.quantity || 1;
          const price = item.price || item.finalPrice || 0;
          const total = qty * price;

          const nameLines = wrapText(itemName, 30);

          return (
            <div key={index}>
              {/* Item name (may wrap) */}
              {nameLines.map((line, idx) => (
                <div key={idx}>{idx === 0 ? line : '  ' + line}</div>
              ))}
              {/* Quantity x Price = Total */}
              <div className="flex justify-between">
                <span>  {qty} x {formatCurrency(price)}</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t-2 border-black my-2" style={{ borderTopWidth: '2px' }}></div>

      {/* Totals */}
      <div className="text-xs space-y-0.5 mb-2">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{formatCurrency(bill.subtotal || 0)}</span>
        </div>

        {(bill.serviceProductChargeTotal || 0) > 0 && (
          <div className="flex justify-between">
            <span>Svc Prod Charges:</span>
            <span>{formatCurrency(bill.serviceProductChargeTotal)}</span>
          </div>
        )}

        {bill.discount > 0 && (
          <>
            <div className="flex justify-between">
              <span>
                {bill.discountReason === 'Senior' ? 'Senior Citizen (10%):' :
                 bill.discountReason === 'PWD' ? 'PWD Discount (10%):' :
                 'Discount:'}
              </span>
              <span>-{formatCurrency(bill.discount)}</span>
            </div>
            {(bill.discountReason === 'Senior' || bill.discountReason === 'PWD') && bill.controlNumber && (
              <div className="flex justify-between text-xs italic">
                <span>  ID/Control No:</span>
                <span>{bill.controlNumber}</span>
              </div>
            )}
          </>
        )}

        {bill.promotionDiscount > 0 && (
          <div className="flex justify-between">
            <span>Promo Code:</span>
            <span>-{formatCurrency(bill.promotionDiscount)}</span>
          </div>
        )}

        {bill.loyaltyPointsUsed > 0 && (
          <div className="flex justify-between">
            <span>Loyalty Pts:</span>
            <span>-{formatCurrency(bill.loyaltyPointsUsed)}</span>
          </div>
        )}

        {(bill.serviceCharge || 0) > 0 && (
          <div className="flex justify-between">
            <span>Service Charge:</span>
            <span>{formatCurrency(bill.serviceCharge)}</span>
          </div>
        )}

        {(bill.tax || 0) > 0 && (
          <div className="flex justify-between">
            <span>VAT / Tax:</span>
            <span>{formatCurrency(bill.tax)}</span>
          </div>
        )}
      </div>

      <div className="border-t border-black mb-2"></div>

      {/* Grand Total */}
      <div className="mb-2">
        <div className="flex justify-between font-bold text-sm">
          <span>TOTAL:</span>
          <span>{formatCurrency(bill.total || bill.grandTotal || 0)}</span>
        </div>
      </div>

      <div className="border-t border-black mb-2"></div>

      {/* Payment Info */}
      <div className="text-xs space-y-0.5 mb-2">
        <div className="flex justify-between">
          <span>Payment:</span>
          <span>{(bill.paymentMethod || 'Cash').toUpperCase()}</span>
        </div>

        {(bill.paymentMethod === 'cash' || bill.paymentMethod === 'Cash') && (
          <>
            <div className="flex justify-between">
              <span>Received:</span>
              <span>{formatCurrency(bill.amountReceived || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>Change:</span>
              <span>{formatCurrency(bill.change || 0)}</span>
            </div>
          </>
        )}
      </div>

      <div className="border-t-2 border-black my-2" style={{ borderTopWidth: '2px' }}></div>

      {/* Footer */}
      <div className="text-center text-xs space-y-1 mt-2">
        <div>Trans ID: {bill.id}</div>
        <div className="mt-2">Thank you for choosing</div>
        <div className="font-bold">DAVID'S SALON!</div>
        <div className="mt-2">This serves as your official receipt.</div>
        <div>Please keep this for your records.</div>
      </div>
    </div>
  );
});

Receipt.displayName = 'Receipt';

export default Receipt;
