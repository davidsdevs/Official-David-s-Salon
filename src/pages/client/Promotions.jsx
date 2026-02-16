/**
 * Promotions Page - Client
 * View all active promotions
 */

import { useState, useEffect, useRef } from 'react';
import { Tag, Calendar, Percent, Clock, Gift, Sparkles, X, Download, Copy, Check } from 'lucide-react';
import { getActivePromotions } from '../../services/promotionService';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { format } from 'date-fns';
import { formatCurrency } from '../../utils/helpers';
import html2canvas from 'html2canvas';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';

const ClientPromotions = () => {
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPromo, setSelectedPromo] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const promoCardRef = useRef(null);

  useEffect(() => {
    loadPromotions();
  }, []);

  const loadPromotions = async () => {
    try {
      setLoading(true);
      const data = await getActivePromotions();
      console.log('📢 Loaded promotions:', data);
      console.log('📢 First promotion:', data[0]);
      setPromotions(data || []);
    } catch (error) {
      console.error('Error loading promotions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDiscountDisplay = (promo) => {
    if (promo.discountType === 'percentage') {
      return `${promo.discountValue}% OFF`;
    } else {
      return `${formatCurrency(promo.discountValue)} OFF`;
    }
  };

  const getApplicableItems = (promo) => {
    const items = [];
    if (promo.applicableServices?.length > 0) {
      items.push(`${promo.applicableServices.length} service(s)`);
    }
    if (promo.applicableProducts?.length > 0) {
      items.push(`${promo.applicableProducts.length} product(s)`);
    }
    if (items.length === 0) {
      return 'All items';
    }
    return items.join(' & ');
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('Promotion code copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveAsPNG = async () => {
    if (!promoCardRef.current) return;

    try {
      // Wait a bit to ensure all fonts and styles are loaded
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Convert SVG QR codes to canvas before capturing
      const svgElements = promoCardRef.current.querySelectorAll('svg');
      const svgData = [];
      
      // Store SVG data and replace with canvas
      for (const svg of svgElements) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const svgString = new XMLSerializer().serializeToString(svg);
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        const img = new Image();
        
        await new Promise((resolve) => {
          img.onload = () => {
            canvas.width = svg.clientWidth || 120;
            canvas.height = svg.clientHeight || 120;
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
            
            // Store original SVG and its parent
            svgData.push({
              svg: svg,
              parent: svg.parentNode,
              canvas: canvas,
              nextSibling: svg.nextSibling
            });
            
            // Replace SVG with canvas temporarily
            svg.parentNode.replaceChild(canvas, svg);
            resolve();
          };
          img.src = url;
        });
      }

      // Capture the card with canvas QR codes
      const canvas = await html2canvas(promoCardRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: true, // Enable logging to debug
        useCORS: true,
        allowTaint: true,
        letterRendering: true,
        imageTimeout: 0,
        removeContainer: false,
        windowWidth: promoCardRef.current.scrollWidth,
        windowHeight: promoCardRef.current.scrollHeight,
        onclone: (clonedDoc) => {
          // Force text color in cloned document
          const spans = clonedDoc.querySelectorAll('span');
          spans.forEach(span => {
            if (span.textContent && (span.textContent.includes('%') || span.textContent.includes('OFF'))) {
              span.style.color = '#dc2626';
              span.style.fontWeight = '900';
              span.style.fontSize = '36px';
              console.log('Forced color on span:', span.textContent);
            }
          });
        }
      });

      // Restore original SVG elements
      svgData.forEach(({ svg, parent, canvas, nextSibling }) => {
        if (nextSibling) {
          parent.insertBefore(svg, nextSibling);
        } else {
          parent.appendChild(svg);
        }
        canvas.remove();
      });

      // Save the image
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${selectedPromo.promotionCode || selectedPromo.title || 'promotion'}_${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('Promotion code saved as image!');
      });
    } catch (error) {
      console.error('Error saving promotion:', error);
      toast.error('Failed to save promotion code');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <Tag className="w-8 h-8" />
          <h1 className="text-3xl font-bold">Active Promotions</h1>
        </div>
        <p className="text-primary-100">
          Check out our latest deals and save on your next visit!
        </p>
      </div>

      {/* Promotions Grid */}
      {promotions.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <Gift className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Active Promotions</h3>
          <p className="text-gray-500">
            Check back later for exciting deals and offers!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {promotions.map((promo) => (
            <div
              key={promo.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* Promotion Header with Discount Badge */}
              <div className="bg-gradient-to-br from-primary-500 to-primary-600 p-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12"></div>
                
                <div className="relative">
                  <div className="flex items-start justify-between mb-3">
                    <Sparkles className="w-6 h-6" />
                    <span className="px-3 py-1 bg-white text-primary-600 text-sm font-bold rounded-full">
                      {getDiscountDisplay(promo)}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold mb-1">{promo.title || promo.name}</h3>
                  {promo.promotionCode && (
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-lg">
                      <span className="text-xs font-medium">Code:</span>
                      <span className="text-sm font-mono font-bold">{promo.promotionCode}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Promotion Details */}
              <div className="p-6 space-y-4">
                {promo.description && (
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {promo.description}
                  </p>
                )}

                {/* Applicable Items */}
                <div className="flex items-start gap-2 text-sm">
                  <Tag className="w-4 h-4 text-primary-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-gray-700">Applies to:</span>
                    <span className="text-gray-600 ml-1">{getApplicableItems(promo)}</span>
                  </div>
                </div>

                {/* Minimum Purchase */}
                {promo.minimumPurchase > 0 && (
                  <div className="flex items-start gap-2 text-sm">
                    <Percent className="w-4 h-4 text-primary-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium text-gray-700">Minimum purchase:</span>
                      <span className="text-gray-600 ml-1">{formatCurrency(promo.minimumPurchase)}</span>
                    </div>
                  </div>
                )}

                {/* Usage Limit */}
                {promo.usageLimit && (
                  <div className="flex items-start gap-2 text-sm">
                    <Clock className="w-4 h-4 text-primary-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium text-gray-700">Usage limit:</span>
                      <span className="text-gray-600 ml-1">
                        {promo.usageLimit === 1 ? 'One-time use' : `${promo.usageLimit} times per customer`}
                      </span>
                    </div>
                  </div>
                )}

                {/* Valid Period */}
                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Calendar className="w-4 h-4" />
                    <span>
                      Valid until {format(new Date(promo.endDate), 'MMM dd, yyyy')}
                    </span>
                  </div>
                </div>

                {/* Call to Action */}
                <div className="pt-2">
                  <button
                    onClick={() => {
                      setSelectedPromo(promo);
                      setShowDetailsModal(true);
                    }}
                    className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm"
                  >
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Promotion Details Modal */}
      {showDetailsModal && selectedPromo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Promotion Details</h2>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedPromo(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Promotion Card for Screenshot */}
            <div className="p-6">
              <div ref={promoCardRef} className="bg-white rounded-xl border-2 border-primary-200 overflow-hidden">
                {/* Promotion Header */}
                <div className="bg-gradient-to-br from-primary-500 to-primary-600 p-8 text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20"></div>
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full -ml-16 -mb-16"></div>
                  
                  <div className="relative text-center">
                    <Sparkles className="w-10 h-10 mx-auto mb-4" />
                    
                    {/* Discount Badge - Large and Prominent */}
                    <div className="mb-4">
                      <span style={{ fontSize: '48px', fontWeight: '900', color: '#ffffff', fontFamily: 'system-ui, -apple-system, sans-serif', textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>{getDiscountDisplay(selectedPromo)}</span>
                    </div>
                    
                    <h3 className="text-3xl font-bold mb-4">{selectedPromo.title || selectedPromo.name}</h3>
                    
                    {selectedPromo.promotionCode && (
                      <div className="mt-4 pt-4 border-t border-white/30">
                        <p className="text-sm text-white/80 mb-2">Promotion Code</p>
                        <div className="inline-flex items-center gap-3 px-6 py-3 bg-white/20 backdrop-blur-sm rounded-xl">
                          <span className="text-2xl font-mono font-bold tracking-wider">{selectedPromo.promotionCode}</span>
                        </div>
                        
                        {/* QR Code */}
                        <div className="mt-4 flex justify-center">
                          <div className="bg-white p-4 rounded-xl shadow-lg">
                            <QRCodeSVG 
                              value={selectedPromo.promotionCode}
                              size={120}
                              level="M"
                              includeMargin={false}
                              fgColor="#000000"
                              bgColor="#FFFFFF"
                            />
                            <p className="text-xs text-gray-800 font-semibold text-center mt-2">{selectedPromo.promotionCode}</p>
                          </div>
                        </div>
                        <p className="text-xs text-white/80 mt-2">Scan this code at checkout</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Promotion Details */}
                <div className="p-6 space-y-4 bg-gray-50">
                  {selectedPromo.description && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Description</h4>
                      <p className="text-gray-600 text-sm leading-relaxed">
                        {selectedPromo.description}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-2 text-sm">
                      <Tag className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium text-gray-700 block">Applies to</span>
                        <span className="text-gray-600">{getApplicableItems(selectedPromo)}</span>
                      </div>
                    </div>

                    {selectedPromo.minimumPurchase > 0 && (
                      <div className="flex items-start gap-2 text-sm">
                        <Percent className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-medium text-gray-700 block">Minimum purchase</span>
                          <span className="text-gray-600">{formatCurrency(selectedPromo.minimumPurchase)}</span>
                        </div>
                      </div>
                    )}

                    {selectedPromo.usageLimit && (
                      <div className="flex items-start gap-2 text-sm">
                        <Clock className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-medium text-gray-700 block">Usage limit</span>
                          <span className="text-gray-600">
                            {selectedPromo.usageLimit === 1 ? 'One-time use' : `${selectedPromo.usageLimit} times`}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-2 text-sm">
                      <Calendar className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium text-gray-700 block">Valid until</span>
                        <span className="text-gray-600">
                          {format(new Date(selectedPromo.endDate), 'MMM dd, yyyy')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500 text-center">
                      Show this code to the receptionist when booking or checking out
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex gap-3">
                {selectedPromo.promotionCode && (
                  <button
                    onClick={() => handleCopyCode(selectedPromo.promotionCode)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 transition-colors font-medium"
                  >
                    {copied ? (
                      <>
                        <Check className="w-5 h-5" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-5 h-5" />
                        Copy Code
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={handleSaveAsPNG}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                >
                  <Download className="w-5 h-5" />
                  Save as Image
                </button>
              </div>

              <p className="text-xs text-gray-500 text-center mt-4">
                Save this image to easily share the promotion code with the receptionist
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientPromotions;
