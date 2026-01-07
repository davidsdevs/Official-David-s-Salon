/**
 * Products Page - Client
 * Browse and view available salon products
 */

import { useState, useEffect, useMemo } from 'react';
import { Search, Package, Banknote, Filter, Eye, ShoppingBag, X, MapPin, Tag, Store } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getAllBranches } from '../../services/branchService';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { Card } from '../../components/ui/Card';
import { SearchInput } from '../../components/ui/SearchInput';
import { formatCurrency } from '../../utils/helpers';
import toast from 'react-hot-toast';

const ClientProducts = () => {
  const { currentUser } = useAuth();
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [stocks, setStocks] = useState({}); // { productId: { branchId: totalStock } }
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [branchSearch, setBranchSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showFullImageModal, setShowFullImageModal] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchBranches();
    fetchStocks();
  }, []);

  const fetchBranches = async () => {
    try {
      const data = await getAllBranches();
      setBranches(data.filter(b => b.isActive));
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const productsRef = collection(db, 'products');
      
      // Fetch all active products available to clients
      const snapshot = await getDocs(productsRef);
      const productsData = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        // Filter by status - only show active products (case-insensitive)
        const status = (data.status || '').toString();
        const isActive = status.toLowerCase() === 'active' || status === '';
        
        if (isActive) {
          productsData.push({
            id: doc.id,
            ...data
          });
        }
      });
      
      // Sort by name client-side
      productsData.sort((a, b) => {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
      
      setProducts(productsData);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const fetchStocks = async () => {
    try {
      const stocksRef = collection(db, 'stocks');
      const q = query(stocksRef, where('status', '==', 'active'));
      const snapshot = await getDocs(q);
      const stocksData = {};
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        const productId = data.productId;
        const branchId = data.branchId;
        const realTimeStock = data.realTimeStock || 0;
        
        // Only count stocks with positive quantities
        if (realTimeStock > 0) {
          if (!stocksData[productId]) {
            stocksData[productId] = {};
          }
          if (!stocksData[productId][branchId]) {
            stocksData[productId][branchId] = 0;
          }
          stocksData[productId][branchId] += realTimeStock;
        }
      });
      
      setStocks(stocksData);
    } catch (error) {
      console.error('Error fetching stocks:', error);
    }
  };

  const getProductStock = (productId, branchId = null) => {
    if (!stocks[productId]) return 0;
    if (branchId) {
      return stocks[productId][branchId] || 0;
    }
    // Sum all branches
    return Object.values(stocks[productId]).reduce((sum, qty) => sum + qty, 0);
  };

  const getBranchesWithStock = (productId) => {
    if (!stocks[productId]) return [];
    return Object.entries(stocks[productId])
      .filter(([branchId, stock]) => stock > 0)
      .map(([branchId, stock]) => {
        const branch = branches.find(b => b.id === branchId);
        return {
          branchId,
          branchName: branch?.name || branch?.branchName || 'Unknown Branch',
          stock
        };
      })
      .sort((a, b) => b.stock - a.stock); // Sort by stock descending
  };

  const filteredProducts = useMemo(() => {
    let filtered = [...products];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(product => product.category === categoryFilter);
    }

    // Apply branch filter
    if (branchFilter !== 'all') {
      filtered = filtered.filter(product => {
        // Check if product has stock in this branch
        const hasStock = getProductStock(product.id, branchFilter) > 0;
        // Also check if product has branches array
        if (product.branches && Array.isArray(product.branches) && product.branches.length > 0) {
          return product.branches.includes(branchFilter) || hasStock;
        }
        // If no branches specified but has stock, show it
        return hasStock;
      });
    }

    return filtered;
  }, [products, searchTerm, categoryFilter, branchFilter]);

  // Get unique categories from products
  const availableCategories = useMemo(() => {
    const categories = new Set(products.map(p => p.category).filter(Boolean));
    return Array.from(categories).sort();
  }, [products]);

  const handleViewDetails = (product) => {
    setSelectedProduct(product);
    setShowDetailsModal(true);
  };

  const getBranchName = (branchId) => {
    if (!branchId) return 'All Branches';
    const branch = branches.find(b => b.id === branchId);
    return branch?.name || branch?.branchName || 'Unknown Branch';
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Our Products</h1>
        <p className="text-gray-600">Browse our premium salon products</p>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <SearchInput
              placeholder="Search products by name, brand, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 border rounded-lg transition-colors flex items-center gap-2 ${
              categoryFilter !== 'all' || branchFilter !== 'all'
                ? 'bg-primary-50 border-primary-300 text-primary-700 hover:bg-primary-100'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {(categoryFilter !== 'all' || branchFilter !== 'all') && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-primary-600 text-white">
                Active
              </span>
            )}
          </button>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="all">All Categories</option>
                {availableCategories.map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Branch
              </label>
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={branchSearch}
                  onChange={(e) => setBranchSearch(e.target.value)}
                  placeholder="Search branches..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                />
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="all">All Branches</option>
                {branches
                  .filter(b => b && (branchSearch.trim() === '' || (b.name || b.branchName || '').toLowerCase().includes(branchSearch.toLowerCase())))
                  .map(branch => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name || branch.branchName}
                    </option>
                  ))}
              </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <ShoppingBag className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Products Found</h3>
          <p className="text-gray-600">
            {searchTerm || categoryFilter !== 'all' || branchFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'No products available at the moment'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {filteredProducts.map((product) => {
            const displayedPrice = product.otcPrice ?? product.price ?? product.salonUsePrice ?? null;
            const handleKeyDown = (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleViewDetails(product);
              }
            };

            return (
            <div 
              key={product.id} 
              className="bg-white rounded-xl shadow-md border-2 border-gray-200 overflow-hidden hover:shadow-xl hover:border-[#160B53] hover:scale-[1.02] transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#160B53]" 
              role="button" 
              tabIndex={0} 
              onKeyDown={handleKeyDown} 
              onClick={() => handleViewDetails(product)}
            >
              {/* Product Image */}
              <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-20 h-20 text-gray-400" />
                  </div>
                )}
                {product.category && (
                  <div className="absolute top-3 left-3">
                    <span className="px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-[#160B53] to-[#2D1B69] text-white rounded-lg shadow-md">
                      {product.category}
                    </span>
                  </div>
                )}
                {product.brand && (
                  <div className="absolute top-3 right-3">
                    <span className="px-3 py-1.5 text-xs font-semibold bg-white/90 backdrop-blur-sm text-gray-700 rounded-lg shadow-sm">
                      {product.brand}
                    </span>
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="p-5">
                <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-2">
                  {product.name}
                </h3>
                {product.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {product.description}
                  </p>
                )}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      {displayedPrice ? (
                        <p className="text-2xl font-bold text-[#160B53]">
                          {formatCurrency(displayedPrice)}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-500">Price on request</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                    <div className="flex items-center gap-2 text-sm">
                      <Store className="w-4 h-4 text-[#160B53]" />
                      {(() => {
                        const totalStock = getProductStock(product.id);
                        const branchStock = branchFilter !== 'all' ? getProductStock(product.id, branchFilter) : null;
                        const stock = branchStock !== null ? branchStock : totalStock;
                        
                        return (
                          <span className={`font-medium ${
                            stock > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {stock > 0 ? (
                              branchFilter === 'all' 
                                ? `${totalStock} units available`
                                : `${branchStock} units in stock`
                            ) : (
                              'Out of stock'
                            )}
                          </span>
                        );
                      })()}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleViewDetails(product); }}
                      className="px-4 py-2 text-sm font-semibold bg-gradient-to-r from-[#160B53] to-[#2D1B69] text-white rounded-lg hover:from-[#1a0f63] hover:to-[#35207a] transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
          })}
        </div>
      )}

      {/* Product Details Modal - Enhanced */}
      {showDetailsModal && selectedProduct && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4"
          onClick={() => {
            setShowDetailsModal(false);
            setSelectedProduct(null);
          }}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-[#160B53] to-[#2D1B69] px-4 sm:px-6 py-3 sm:py-4 text-white flex-shrink-0">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg sm:text-2xl font-bold">Product Details</h2>
                  <p className="text-blue-100 mt-1 text-sm sm:text-base">
                    View product information and availability
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedProduct(null);
                  }}
                  className="text-white hover:bg-white/20 p-2 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto" style={{ 
              maxHeight: 'calc(95vh - 200px)',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'thin'
            }}>
              <div className="p-4 sm:p-6 space-y-6">
                {/* Product Image */}
                <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-6 border-2 border-gray-200 relative">
                  {selectedProduct.imageUrl ? (
                    <>
                      <img
                        src={selectedProduct.imageUrl}
                        alt={selectedProduct.name}
                        className="w-full h-80 object-contain rounded-lg"
                      />
                      <button
                        onClick={() => setShowFullImageModal(true)}
                        className="absolute top-8 right-8 bg-white/90 hover:bg-white p-3 rounded-full shadow-lg transition-all hover:scale-110"
                        title="View full image"
                      >
                        <Eye className="w-5 h-5 text-[#160B53]" />
                      </button>
                    </>
                  ) : (
                    <div className="w-full h-80 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                      <Package className="w-32 h-32 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Product Name & Brand */}
                <div className="bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 rounded-xl p-6 shadow-md">
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-gray-200">
                    <div className="p-2 bg-[#160B53]/10 rounded-lg">
                      <Package className="w-6 h-6 text-[#160B53]" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 flex-1">
                      {selectedProduct.name}
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {selectedProduct.brand && (
                      <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                        <Tag className="w-5 h-5 text-[#160B53]" />
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Brand</p>
                          <p className="text-sm font-semibold text-gray-900">{selectedProduct.brand}</p>
                        </div>
                      </div>
                    )}
                    {selectedProduct.category && (
                      <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                        <div className="w-5 h-5 flex items-center justify-center">
                          <span className="w-1 h-5 bg-[#160B53] rounded-full"></span>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Category</p>
                          <span className="inline-block px-3 py-1 text-sm font-semibold bg-gradient-to-r from-[#160B53] to-[#2D1B69] text-white rounded-lg mt-1">
                            {selectedProduct.category}
                          </span>
                        </div>
                      </div>
                    )}
                    {(() => {
                      const displayed = selectedProduct.otcPrice ?? selectedProduct.price ?? null;
                      return displayed ? (
                        <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                          <Banknote className="w-5 h-5 text-[#160B53]" />
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Price</p>
                            <p className="text-xl font-bold text-[#160B53]">{formatCurrency(displayed)}</p>
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>

                {/* Description */}
                {selectedProduct.description && (
                  <div className="bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 rounded-xl p-6 shadow-md">
                    <h4 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <div className="w-1 h-6 bg-gradient-to-b from-[#160B53] to-[#2D1B69] rounded-full"></div>
                      Description
                    </h4>
                    <p className="text-gray-700 leading-relaxed">{selectedProduct.description}</p>
                  </div>
                )}

                {/* Real-Time Stock Availability Per Branch */}
                {(() => {
                  const branchesWithStock = getBranchesWithStock(selectedProduct.id);
                  const totalStock = getProductStock(selectedProduct.id);
                  
                  return (
                    <div className="bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 rounded-xl p-6 shadow-md">
                      <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-gray-200">
                        <div className="p-2 bg-[#160B53]/10 rounded-lg">
                          <MapPin className="w-6 h-6 text-[#160B53]" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-lg font-bold text-gray-900">Branch Availability</h4>
                          <p className="text-xs text-gray-500 mt-0.5">Real-time stock information</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Total Stock</p>
                          <p className="text-2xl font-bold text-[#160B53]">{totalStock}</p>
                        </div>
                      </div>
                      
                      {branchesWithStock.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {branchesWithStock.map(({ branchId, branchName, stock }) => (
                            <div key={branchId} className="flex justify-between items-center p-4 bg-white rounded-lg border-2 border-gray-200 hover:border-[#160B53]/30 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-50 rounded-lg">
                                  <Store className="w-5 h-5 text-green-600" />
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900">{branchName}</p>
                                  <p className="text-xs text-gray-500">Available now</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-xl font-bold text-green-600">{stock}</p>
                                <p className="text-xs text-gray-500">units</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Store className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500 font-medium">Currently out of stock</p>
                          <p className="text-xs text-gray-400 mt-1">This product is not available at any branch</p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Call to Action */}
                <div className="bg-gradient-to-r from-[#160B53] to-[#2D1B69] rounded-xl p-6 text-white text-center shadow-lg">

      {/* Full Image Modal */}
      {showFullImageModal && selectedProduct?.imageUrl && (
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
          onClick={() => setShowFullImageModal(false)}
        >
          <div className="relative max-w-7xl max-h-[95vh] w-full h-full flex items-center justify-center">
            <button
              onClick={() => setShowFullImageModal(false)}
              className="absolute top-4 right-4 bg-white/90 hover:bg-white p-3 rounded-full shadow-lg transition-all hover:scale-110 z-10"
              title="Close"
            >
              <X className="w-6 h-6 text-gray-900" />
            </button>
            <img
              src={selectedProduct.imageUrl}
              alt={selectedProduct.name}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
                  <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-90" />
                  <p className="text-lg font-semibold mb-1">Visit our salon to purchase this product</p>
                  <p className="text-sm opacity-90">Our staff will be happy to assist you</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientProducts;

