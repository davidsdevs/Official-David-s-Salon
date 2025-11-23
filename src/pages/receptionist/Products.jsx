/**
 * Products Page - Receptionist
 * View-only page to see available products at the branch
 */

import { useState, useEffect, useMemo } from 'react';
import { Search, Package, Banknote, Filter, Eye } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { Card } from '../../components/ui/Card';
import { SearchInput } from '../../components/ui/SearchInput';
import toast from 'react-hot-toast';

const ReceptionistProducts = () => {
  const { userBranch } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    if (userBranch) {
      fetchProducts();
    }
  }, [userBranch]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const productsRef = collection(db, 'products');
      
      // Get products that are available for this branch
      // Fetch all products and filter client-side to avoid index requirements
      const snapshot = await getDocs(productsRef);
      const productsData = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        // Filter by status and branch availability
        const isActive = data.status === 'active' || data.status === undefined;
        const isAvailableToBranch = !data.branches || 
          (Array.isArray(data.branches) && data.branches.includes(userBranch));
        
        if (isActive && isAvailableToBranch) {
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

    return filtered;
  }, [products, searchTerm, categoryFilter]);

  // Get unique categories from products
  const availableCategories = useMemo(() => {
    const categories = new Set(products.map(p => p.category).filter(Boolean));
    return Array.from(categories).sort();
  }, [products]);

  const handleViewDetails = (product) => {
    setSelectedProduct(product);
    setShowDetailsModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <p className="text-gray-600">View available products at this branch</p>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <SearchInput
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 border rounded-lg transition-colors flex items-center gap-2 ${
              categoryFilter !== 'all'
                ? 'bg-primary-50 border-primary-300 text-primary-700 hover:bg-primary-100'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {categoryFilter !== 'all' && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-primary-600 text-white">
                Active
              </span>
            )}
          </button>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="pt-4 border-t border-gray-200">
            <div className="space-y-3">
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
              <button
                onClick={() => {
                  setCategoryFilter('all');
                  setSearchTerm('');
                }}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                Reset Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Products List */}
      {filteredProducts.length === 0 ? (
        <Card className="p-8 text-center">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">
            {searchTerm || categoryFilter !== 'all'
              ? 'No products found matching your filters'
              : 'No products available at this branch'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="p-5 hover:shadow-md transition-shadow">
              <div className="space-y-3">
                {/* Product Image */}
                <div className="w-full h-40 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className="w-full h-full flex items-center justify-center" style={{ display: product.imageUrl ? 'none' : 'flex' }}>
                    <Package className="h-12 w-12 text-gray-400" />
                  </div>
                </div>

                {/* Product Info */}
                <div>
                  <h3 className="font-semibold text-lg text-gray-900 mb-1">
                    {product.name}
                  </h3>
                  {product.brand && (
                    <p className="text-sm text-gray-500 mb-1">
                      {product.brand}
                    </p>
                  )}
                  {product.description && (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                      {product.description}
                    </p>
                  )}
                </div>

                {/* Product Details */}
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  {product.category && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="px-2 py-1 bg-gray-100 rounded">
                        {product.category}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    {product.otcPrice && (
                      <div className="flex items-center gap-1 text-lg font-bold text-primary-600">
                        <Banknote className="w-4 h-4" />
                        <span>₱{product.otcPrice?.toLocaleString() || '0'}</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleViewDetails(product)}
                    className="w-full mt-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    View Details
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Summary */}
      <div className="text-sm text-gray-600 text-center">
        Showing {filteredProducts.length} of {products.length} products
      </div>

      {/* Product Details Modal */}
      {showDetailsModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">{selectedProduct.name}</h2>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {selectedProduct.imageUrl && (
                  <div className="w-full h-64 bg-gray-100 rounded-lg overflow-hidden">
                    <img
                      src={selectedProduct.imageUrl}
                      alt={selectedProduct.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {selectedProduct.brand && (
                    <div>
                      <p className="text-sm text-gray-500">Brand</p>
                      <p className="font-medium">{selectedProduct.brand}</p>
                    </div>
                  )}
                  
                  {selectedProduct.category && (
                    <div>
                      <p className="text-sm text-gray-500">Category</p>
                      <p className="font-medium">{selectedProduct.category}</p>
                    </div>
                  )}

                  {selectedProduct.otcPrice && (
                    <div>
                      <p className="text-sm text-gray-500">Price</p>
                      <p className="font-medium text-primary-600">
                        ₱{selectedProduct.otcPrice?.toLocaleString() || '0'}
                      </p>
                    </div>
                  )}

                  {selectedProduct.commissionPercentage && (
                    <div>
                      <p className="text-sm text-gray-500">Commission</p>
                      <p className="font-medium">{selectedProduct.commissionPercentage}%</p>
                    </div>
                  )}
                </div>

                {selectedProduct.description && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Description</p>
                    <p className="text-gray-700">{selectedProduct.description}</p>
                  </div>
                )}

                {selectedProduct.shelfLife && (
                  <div>
                    <p className="text-sm text-gray-500">Shelf Life</p>
                    <p className="font-medium">{selectedProduct.shelfLife}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceptionistProducts;

