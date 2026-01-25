# Inventory Controller - Stock Filtering Implementation Guide

## Overview
Add filtering options to hide expired batches and filter stocks by status (All, Good, Expired, Depleted).

## File: `src/pages/inventory/Stocks.jsx`

### Change 1: Add Stock Status Filter State (Lines ~88-92)

**Add new state after `selectedStatus`:**

```javascript
const [selectedStatus, setSelectedStatus] = useState('all');
const [stockStatusFilter, setStockStatusFilter] = useState('all'); // ADD THIS: 'all', 'good', 'expired', 'depleted'
const [sortBy, setSortBy] = useState('productName');
```

### Change 2: Update filteredStocks Logic (Lines ~735-865)

**Find the `filteredStocks` useMemo and update the filter logic:**

```javascript
const filteredStocks = useMemo(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return currentMonthStocks
    .filter(stockData => {
      const stock = stockData.stock || stockData;
      const product = stockData.product || products.find(p => p.id === stock.productId);
      
      // Search filter
      const matchesSearch = !debouncedSearchTerm ||
        (stock.productName || product?.name || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        (stock.batchNumber || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        (stock.upc || product?.upc || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase());
      
      // Status filter (existing)
      const matchesStatus = filters.status === 'all' || stock.status === filters.status;
      
      // Category filter (existing)
      const matchesCategory = filters.category === 'all' || 
        (stock.category || product?.category || '') === filters.category;
      
      // NEW: Stock Status Filter
      let matchesStockStatus = true;
      if (stockStatusFilter !== 'all') {
        const expirationDate = stock.expirationDate?.toDate ? stock.expirationDate.toDate() : stock.expirationDate;
        const isExpired = expirationDate && new Date(expirationDate) < today;
        const isDepleted = (stock.realTimeStock || 0) === 0 || stock.status === 'Out of Stock';
        const isGood = !isExpired && !isDepleted && (stock.realTimeStock || 0) > 0;
        
        switch (stockStatusFilter) {
          case 'good':
            matchesStockStatus = isGood;
            break;
          case 'expired':
            matchesStockStatus = isExpired;
            break;
          case 'depleted':
            matchesStockStatus = isDepleted;
            break;
          default:
            matchesStockStatus = true;
        }
      }
      
      // Other existing filters...
      const matchesUsageType = filters.usageType === 'all' || stock.usageType === filters.usageType;
      const matchesBatchNumber = !filters.batchNumber || 
        (stock.batchNumber || '').toLowerCase().includes(filters.batchNumber.toLowerCase());
      const matchesLowStock = !filters.lowStock || (stock.realTimeStock || 0) <= 10;
      
      const stockRange = filters.stockRange;
      const matchesStockRange = (!stockRange.min || (stock.realTimeStock || 0) >= parseInt(stockRange.min)) &&
                                (!stockRange.max || (stock.realTimeStock || 0) <= parseInt(stockRange.max));
      
      return matchesSearch && matchesStatus && matchesCategory && matchesStockStatus && 
             matchesUsageType && matchesBatchNumber && matchesLowStock && matchesStockRange;
    })
    .sort((a, b) => {
      // Existing sort logic...
    });
}, [currentMonthStocks, debouncedSearchTerm, filters, stockStatusFilter, sortBy, sortOrder, products]);
```

### Change 3: Add Filter Buttons in UI (Lines ~3000-3100, in the toolbar section)

**Add filter buttons after the search input:**

```jsx
{/* Stock Status Filter Buttons */}
<div className="flex items-center gap-2">
  <span className="text-sm font-medium text-gray-700">Status:</span>
  <div className="flex gap-1">
    <button
      onClick={() => setStockStatusFilter('all')}
      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
        stockStatusFilter === 'all'
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      All
    </button>
    <button
      onClick={() => setStockStatusFilter('good')}
      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
        stockStatusFilter === 'good'
          ? 'bg-green-600 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      <CheckCircle className="w-4 h-4 inline mr-1" />
      Good
    </button>
    <button
      onClick={() => setStockStatusFilter('expired')}
      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
        stockStatusFilter === 'expired'
          ? 'bg-red-600 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      <XCircle className="w-4 h-4 inline mr-1" />
      Expired
    </button>
    <button
      onClick={() => setStockStatusFilter('depleted')}
      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
        stockStatusFilter === 'depleted'
          ? 'bg-orange-600 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      <AlertTriangle className="w-4 h-4 inline mr-1" />
      Depleted
    </button>
  </div>
</div>
```

### Change 4: Add Visual Indicators in Stock Table

**Update the stock row rendering to show status badges:**

```jsx
{/* In the table row, add a status badge column */}
<td className="px-4 py-3">
  {(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expirationDate = stock.expirationDate?.toDate ? stock.expirationDate.toDate() : stock.expirationDate;
    const isExpired = expirationDate && new Date(expirationDate) < today;
    const isDepleted = (stock.realTimeStock || 0) === 0;
    
    if (isExpired) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <XCircle className="w-3 h-3 mr-1" />
          Expired
        </span>
      );
    } else if (isDepleted) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Depleted
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Good
        </span>
      );
    }
  })()}
</td>
```

### Change 5: Update Stats Cards (Lines ~1670-1680)

**Add counts for each status:**

```javascript
const goodStockCount = currentMonthStocks.filter(s => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expirationDate = s.expirationDate?.toDate ? s.expirationDate.toDate() : s.expirationDate;
  const isExpired = expirationDate && new Date(expirationDate) < today;
  const isDepleted = (s.realTimeStock || 0) === 0;
  return !isExpired && !isDepleted && (s.realTimeStock || 0) > 0;
}).length;

const expiredStockCount = currentMonthStocks.filter(s => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expirationDate = s.expirationDate?.toDate ? s.expirationDate.toDate() : s.expirationDate;
  return expirationDate && new Date(expirationDate) < today;
}).length;

const depletedStockCount = currentMonthStocks.filter(s => 
  (s.realTimeStock || 0) === 0 || s.status === 'Out of Stock'
).length;
```

**Add stat cards for these counts:**

```jsx
<Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm font-medium text-green-600">Good Stock</p>
      <p className="text-2xl font-bold text-green-900">{goodStockCount}</p>
    </div>
    <CheckCircle className="h-8 w-8 text-green-600" />
  </div>
</Card>

<Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm font-medium text-red-600">Expired</p>
      <p className="text-2xl font-bold text-red-900">{expiredStockCount}</p>
    </div>
    <XCircle className="h-8 w-8 text-red-600" />
  </div>
</Card>

<Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm font-medium text-orange-600">Depleted</p>
      <p className="text-2xl font-bold text-orange-900">{depletedStockCount}</p>
    </div>
    <AlertTriangle className="h-8 w-8 text-orange-600" />
  </div>
</Card>
```

## Testing Checklist

- [ ] "All" filter shows all stocks
- [ ] "Good" filter shows only active, non-expired, in-stock items
- [ ] "Expired" filter shows only expired batches
- [ ] "Depleted" filter shows only out-of-stock items
- [ ] Filter buttons highlight correctly when selected
- [ ] Stats cards show correct counts
- [ ] Status badges display correctly in table
- [ ] Filters work in combination with search and other filters
- [ ] Export includes filtered data only
- [ ] Print report respects active filters

## Notes

- **Good Stock**: Not expired AND has quantity > 0
- **Expired**: expirationDate < today
- **Depleted**: realTimeStock = 0 OR status = 'Out of Stock'
- Filters are cumulative with existing search and category filters
- The filter state is independent of the existing `selectedStatus` filter
