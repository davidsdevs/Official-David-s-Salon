/**
 * Receipt Component - Matches Thermal Printer Detailed Format
 * Shows BIR-compliant detailed receipt format
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

  const formatDateDetailed = (date) => {
    if (!date) return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatTimeDetailed = (date) => {
    if (!date) return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  };

  const formatCurrency = (amount) => {
    return '₱' + Number(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

  // Calculate VAT breakdown
  const subtotal = bill.subtotal || 0;
  const totalDiscounts = (bill.discount || 0) + (bill.promotionDiscount || 0) + (bill.loyaltyPointsUsed || 0);
  const netSales = subtotal - totalDiscounts;
  const vatRate = 12;
  const vatableSales = netSales / 1.12;
  const vatAmount = netSales - vatableSales;

  return (
    <div ref={ref} className="bg-white p-6 max-w-md mx-auto" style={{ fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.4', width: '384px' }}>
      
      {/* HEADER */}
      <div className="text-center mb-2">
        <div className="text-xl font-bold">David's Salon</div>
        {(branch?.name || branch?.branchName) && (
          <div className="text-sm font-bold">{branch.name || branch.branchName}</div>
        )}
      </div>

      {/* Branch Address */}
      {branch?.address && (
        <div className="text-center text-xs mb-1">
          {wrapText(branch.address, 40).map((line, idx) => (
            <div key={idx}>{line}</div>
          ))}
        </div>
      )}

      {/* Email */}
      {branch?.email && (
        <div className="text-center text-xs">Email: {branch.email}</div>
      )}

      {/* TIN */}
      <div className="text-center text-xs">TIN: 123-456-777-898</div>
      <div className="text-center text-xs font-bold mb-2">VAT Registered</div>

      <div className="border-t border-dashed border-gray-400 my-2"></div>

      {/* TRANSACTION DETAILS */}
      <div className="mb-2">
        <div className="font-bold text-xs mb-1">TRANSACTION DETAILS</div>
        <div className="text-xs space-y-0.5">
          <div className="flex justify-between">
            <span>Receipt No:</span>
            <span>{bill.receiptNumber || bill.id}</span>
          </div>
          <div className="flex justify-between">
            <span>Invoice No:</span>
            <span>{bill.id}</span>
          </div>
          <div className="flex justify-between">
            <span>POS Terminal ID:</span>
            <span>{branch?.posTerminalId || 'POS-001'}</span>
          </div>
          <div className="flex justify-between">
            <span>Cashier Name / ID:</span>
            <span>{bill.createdByName || 'Staff'}</span>
          </div>
          <div className="flex justify-between">
            <span>Date:</span>
            <span>{formatDateDetailed(bill.createdAt)}</span>
          </div>
          <div className="flex justify-between">
            <span>Time:</span>
            <span>{formatTimeDetailed(bill.createdAt)}</span>
          </div>
        </div>
      </div>

      <div className="border-t border-dashed border-gray-400 my-2"></div>

      {/* CUSTOMER INFORMATION */}
      <div className="mb-2">
        <div className="font-bold text-xs mb-1">CUSTOMER INFORMATION</div>
        <div className="text-xs space-y-0.5">
          <div className="flex justify-between">
            <span>Name:</span>
            <span>{bill.clientName || 'Guest'}</span>
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
      </div>

      <div className="border-t border-dashed border-gray-400 my-2"></div>

      {/* ITEMIZED PURCHASE */}
      <div className="mb-2">
        <div className="font-bold text-xs mb-1">ITEMIZED PURCHASE</div>
        <div className="text-xs mb-1">
          <div>Qty Item Description</div>
          <div>    Unit Price      Total</div>
        </div>

        {/* Services */}
        {services.length > 0 && (
          <div className="mb-2">
            <div className="font-bold text-xs">SERVICES:</div>
            {services.map((item, index) => {
              const itemName = item.name || item.serviceName || 'Service';
              const qty = item.quantity || 1;
              const price = item.price || item.finalPrice || 0;
              const total = qty * price;
              const nameLines = wrapText(itemName, 30);

              return (
                <div key={index} className="mb-1">
                  {nameLines.map((line, idx) => (
                    <div key={idx}>{idx === 0 ? `${qty} ${line}` : `  ${line}`}</div>
                  ))}
                  <div className="flex justify-between">
                    <span>    {formatCurrency(price)}</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                  {item.stylistName && (
                    <div>    by {item.stylistName}</div>
                  )}
                  {item.clientType && (
                    <div>    ({item.clientType})</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Products */}
        {products.length > 0 && (
          <div className="mb-2">
            <div className="font-bold text-xs">PRODUCTS:</div>
            {products.map((item, index) => {
              const itemName = item.name || 'Product';
              const qty = item.quantity || 1;
              const price = item.price || 0;
              const total = qty * price;
              const nameLines = wrapText(itemName, 30);

              return (
                <div key={index} className="mb-1">
                  {nameLines.map((line, idx) => (
                    <div key={idx}>{idx === 0 ? `${qty} ${line}` : `  ${line}`}</div>
                  ))}
                  <div className="flex justify-between">
                    <span>    {formatCurrency(price)}</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-dashed border-gray-400 my-2"></div>

      {/* COST BREAKDOWN */}
      <div className="mb-2">
        <div className="font-bold text-xs mb-1">COST BREAKDOWN</div>
        <div className="text-xs space-y-0.5">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>{formatCurrency(bill.subtotal || 0)}</span>
          </div>

          {/* Discounts */}
          {((bill.discount || 0) > 0 || (bill.promotionDiscount || 0) > 0 || (bill.loyaltyPointsUsed || 0) > 0) && (
            <>
              <div className="font-bold mt-1">Less: Discounts:</div>
              
              {bill.discount > 0 && (
                <>
                  <div className="flex justify-between">
                    <span>
                      {bill.discountReason === 'Senior' 
                        ? `  Senior Citizen${bill.discountType === 'percent' && bill.discountValue ? ` (${bill.discountValue}%)` : ''}:` 
                        : bill.discountReason === 'PWD' 
                        ? `  PWD Discount${bill.discountType === 'percent' && bill.discountValue ? ` (${bill.discountValue}%)` : ''}:` 
                        : '  Manual Discount:'}
                    </span>
                    <span>-{formatCurrency(bill.discount)}</span>
                  </div>
                  {(bill.discountReason === 'Senior' || bill.discountReason === 'PWD') && bill.controlNumber && (
                    <div className="flex justify-between">
                      <span>  ID/Control No:</span>
                      <span>{bill.controlNumber}</span>
                    </div>
                  )}
                </>
              )}

              {bill.promotionDiscount > 0 && (
                <div className="flex justify-between">
                  <span>  Promotion Discount:</span>
                  <span>-{formatCurrency(bill.promotionDiscount)}</span>
                </div>
              )}

              {bill.loyaltyPointsUsed > 0 && (
                <div className="flex justify-between">
                  <span>  Loyalty ({bill.loyaltyPointsUsed} pts):</span>
                  <span>-{formatCurrency(bill.loyaltyPointsUsed)}</span>
                </div>
              )}

              <div className="flex justify-between font-bold">
                <span>Total Discounts:</span>
                <span>-{formatCurrency(totalDiscounts)}</span>
              </div>
            </>
          )}

          <div className="flex justify-between">
            <span>Net Sales:</span>
            <span>{formatCurrency(netSales)}</span>
          </div>
        </div>
      </div>

      <div className="border-t border-dashed border-gray-400 my-2"></div>

      {/* TAX BREAKDOWN */}
      <div className="mb-2">
        <div className="font-bold text-xs mb-1">TAX BREAKDOWN</div>
        <div className="text-xs space-y-0.5">
          <div className="flex justify-between">
            <span>VATable Sales:</span>
            <span>{formatCurrency(vatableSales)}</span>
          </div>
          <div className="flex justify-between">
            <span>VAT Amount (12%):</span>
            <span>{formatCurrency(vatAmount)}</span>
          </div>
        </div>
      </div>

      <div className="border-t border-dashed border-gray-400 my-2"></div>

      {/* TOTAL AMOUNT DUE */}
      <div className="mb-2">
        <div className="flex justify-between font-bold text-sm">
          <span>TOTAL AMOUNT DUE:</span>
          <span>{formatCurrency(bill.total || bill.grandTotal || 0)}</span>
        </div>
      </div>

      <div className="border-t border-dashed border-gray-400 my-2"></div>

      {/* PAYMENT DETAILS */}
      <div className="mb-2">
        <div className="font-bold text-xs mb-1">PAYMENT DETAILS</div>
        <div className="text-xs space-y-0.5">
          <div className="flex justify-between">
            <span>Payment Method:</span>
            <span>{(bill.paymentMethod || 'Cash')}</span>
          </div>

          {(bill.paymentMethod === 'cash' || bill.paymentMethod === 'Cash') && (
            <>
              <div className="flex justify-between font-bold">
                <span>Total Amount:</span>
                <span>{formatCurrency(bill.total || bill.grandTotal || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Cash Received:</span>
                <span>{formatCurrency(bill.amountReceived || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Change:</span>
                <span>{formatCurrency(bill.change || 0)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {bill.notes && (
        <>
          <div className="border-t border-dashed border-gray-400 my-2"></div>
          <div className="mb-2">
            <div className="font-bold text-xs mb-1">Notes:</div>
            <div className="text-xs">{bill.notes}</div>
          </div>
        </>
      )}

      <div className="border-t border-dashed border-gray-400 my-2"></div>

      <div className="text-center text-xs space-y-1">
        <div className="font-bold">Thank you for choosing David's Salon!</div>
        <div>This serves as your official receipt.</div>
        <div className="mt-2">VAT Reg TIN: 123-456-777-898</div>
        <div>Accreditation No: ACC-12312512874</div>
        <div>Permit No: PER-1247124</div>
        <div className="mt-2">Return / Exchange Policy:</div>
        <div>Products may be returned after 3 days</div>
        <div className="mt-2">Transaction ID: {bill.id}</div>
        <div>Receipt No: {bill.receiptNumber || bill.id}</div>
        <div className="mt-2 text-xs">Powered by David's Salon POS System</div>
      </div>
    </div>
  );
});

Receipt.displayName = 'Receipt';

export default Receipt;
