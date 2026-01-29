/**
 * Promotions Page - Client
 * View all active promotions
 */

import { useState, useEffect } from 'react';
import { Tag, Calendar, Percent, Clock, Gift, Sparkles } from 'lucide-react';
import { getActivePromotions } from '../../services/promotionService';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { format } from 'date-fns';
import { formatCurrency } from '../../utils/helpers';

const ClientPromotions = () => {
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPromotions();
  }, []);

  const loadPromotions = async () => {
    try {
      setLoading(true);
      const data = await getActivePromotions();
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
                  <h3 className="text-xl font-bold mb-1">{promo.name}</h3>
                  {promo.code && (
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-lg">
                      <span className="text-xs font-medium">Code:</span>
                      <span className="text-sm font-mono font-bold">{promo.code}</span>
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
                    onClick={() => window.location.href = '/client/appointments'}
                    className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm"
                  >
                    Book Now
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientPromotions;
