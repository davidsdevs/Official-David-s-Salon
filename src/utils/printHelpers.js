/**
 * Print Helpers Utility
 * Standardized print formatting for all reports
 * - Letter size paper (8.5" x 11")
 * - Poppins font
 * - Ink-saving (no fills/backgrounds)
 * - Includes applied filters
 */

/**
 * Generate standardized print styles
 * @returns {string} CSS styles for printing
 */
export const getPrintStyles = () => `
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
  
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  @page {
    size: letter; /* 8.5in x 11in */
    margin: 0.5in;
  }
  
  body {
    font-family: 'Poppins', sans-serif;
    font-size: 10pt;
    line-height: 1.4;
    color: #000;
    background: #fff;
  }
  
  /* Header */
  .report-header {
    text-align: center;
    margin-bottom: 20px;
    padding-bottom: 10px;
    border-bottom: 2px solid #000;
  }
  
  .report-title {
    font-size: 18pt;
    font-weight: 700;
    margin-bottom: 5px;
  }
  
  .report-subtitle {
    font-size: 12pt;
    font-weight: 500;
    margin-bottom: 3px;
  }
  
  .report-date {
    font-size: 9pt;
    font-weight: 400;
    color: #333;
  }
  
  /* Filters Section */
  .filters-section {
    margin: 15px 0;
    padding: 10px;
    border: 1px solid #000;
    background: #fff;
  }
  
  .filters-title {
    font-size: 11pt;
    font-weight: 600;
    margin-bottom: 8px;
  }
  
  .filter-item {
    font-size: 9pt;
    margin: 3px 0;
    display: flex;
    gap: 5px;
  }
  
  .filter-label {
    font-weight: 600;
  }
  
  .filter-value {
    font-weight: 400;
  }
  
  /* Summary Section */
  .summary-section {
    margin: 15px 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 10px;
  }
  
  .summary-card {
    border: 1px solid #000;
    padding: 8px;
    text-align: center;
  }
  
  .summary-label {
    font-size: 9pt;
    font-weight: 500;
    margin-bottom: 3px;
  }
  
  .summary-value {
    font-size: 14pt;
    font-weight: 700;
  }
  
  /* Table Styles */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 15px 0;
    font-size: 9pt;
  }
  
  thead {
    border-top: 2px solid #000;
    border-bottom: 2px solid #000;
  }
  
  th {
    padding: 8px 5px;
    text-align: left;
    font-weight: 600;
    background: #fff;
  }
  
  td {
    padding: 6px 5px;
    border-bottom: 1px solid #ddd;
  }
  
  tbody tr:last-child td {
    border-bottom: 2px solid #000;
  }
  
  /* Alignment helpers */
  .text-left { text-align: left; }
  .text-center { text-align: center; }
  .text-right { text-align: right; }
  
  /* Number formatting */
  .currency {
    text-align: right;
    font-weight: 500;
  }
  
  .number {
    text-align: right;
  }
  
  /* Footer */
  .report-footer {
    margin-top: 20px;
    padding-top: 10px;
    border-top: 1px solid #000;
    font-size: 8pt;
    text-align: center;
    color: #333;
  }
  
  /* Page break helpers */
  .page-break {
    page-break-after: always;
  }
  
  .avoid-break {
    page-break-inside: avoid;
  }
  
  /* Hide elements in print */
  .no-print {
    display: none !important;
  }
  
  /* Totals row */
  .totals-row {
    font-weight: 700;
    border-top: 2px solid #000 !important;
    border-bottom: 2px solid #000 !important;
  }
  
  /* Status indicators (text-only, no colors) */
  .status-active::before { content: "✓ "; }
  .status-inactive::before { content: "✗ "; }
  .status-pending::before { content: "⧗ "; }
  .status-completed::before { content: "✓ "; }
  .status-cancelled::before { content: "✗ "; }
`;

/**
 * Format filters for display in report
 * @param {Object} filters - Filter object
 * @returns {Array} Array of filter items
 */
export const formatFiltersForPrint = (filters) => {
  const filterItems = [];
  
  if (filters.dateRange) {
    filterItems.push({
      label: 'Date Range',
      value: `${filters.dateRange.start || 'All'} to ${filters.dateRange.end || 'All'}`
    });
  }
  
  if (filters.startDate && filters.endDate) {
    filterItems.push({
      label: 'Date Range',
      value: `${filters.startDate} to ${filters.endDate}`
    });
  }
  
  if (filters.branch) {
    filterItems.push({
      label: 'Branch',
      value: filters.branch === 'all' ? 'All Branches' : filters.branchName || filters.branch
    });
  }
  
  if (filters.status) {
    filterItems.push({
      label: 'Status',
      value: filters.status === 'all' ? 'All Statuses' : filters.status
    });
  }
  
  if (filters.category) {
    filterItems.push({
      label: 'Category',
      value: filters.category === 'all' ? 'All Categories' : filters.category
    });
  }
  
  if (filters.type) {
    filterItems.push({
      label: 'Type',
      value: filters.type === 'all' ? 'All Types' : filters.type
    });
  }
  
  if (filters.staff) {
    filterItems.push({
      label: 'Staff',
      value: filters.staff === 'all' ? 'All Staff' : filters.staffName || filters.staff
    });
  }
  
  if (filters.client) {
    filterItems.push({
      label: 'Client',
      value: filters.client === 'all' ? 'All Clients' : filters.clientName || filters.client
    });
  }
  
  if (filters.service) {
    filterItems.push({
      label: 'Service',
      value: filters.service === 'all' ? 'All Services' : filters.serviceName || filters.service
    });
  }
  
  if (filters.product) {
    filterItems.push({
      label: 'Product',
      value: filters.product === 'all' ? 'All Products' : filters.productName || filters.product
    });
  }
  
  if (filters.paymentMethod) {
    filterItems.push({
      label: 'Payment Method',
      value: filters.paymentMethod === 'all' ? 'All Methods' : filters.paymentMethod
    });
  }
  
  if (filters.tier) {
    filterItems.push({
      label: 'Loyalty Tier',
      value: filters.tier === 'all' ? 'All Tiers' : filters.tier
    });
  }
  
  if (filters.search) {
    filterItems.push({
      label: 'Search',
      value: filters.search
    });
  }
  
  return filterItems;
};

/**
 * Generate print HTML with standardized format
 * @param {Object} options - Print options
 * @returns {string} Complete HTML for printing
 */
export const generatePrintHTML = ({
  title,
  subtitle = 'David\'s Salon Management System',
  filters = {},
  summaryData = [],
  tableHeaders = [],
  tableRows = [],
  footerText = 'This report is generated for internal use only.',
  additionalContent = ''
}) => {
  const filterItems = formatFiltersForPrint(filters);
  const currentDate = new Date().toLocaleString('en-US', { 
    dateStyle: 'medium', 
    timeStyle: 'short' 
  });
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>${getPrintStyles()}</style>
    </head>
    <body>
      <!-- Header -->
      <div class="report-header">
        <div class="report-title">${title}</div>
        <div class="report-subtitle">${subtitle}</div>
        <div class="report-date">Generated: ${currentDate}</div>
      </div>
      
      <!-- Filters Section -->
      ${filterItems.length > 0 ? `
        <div class="filters-section">
          <div class="filters-title">Applied Filters:</div>
          ${filterItems.map(item => `
            <div class="filter-item">
              <span class="filter-label">${item.label}:</span>
              <span class="filter-value">${item.value}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
      
      <!-- Summary Section -->
      ${summaryData.length > 0 ? `
        <div class="summary-section">
          ${summaryData.map(item => `
            <div class="summary-card">
              <div class="summary-label">${item.label}</div>
              <div class="summary-value">${item.value}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
      
      <!-- Additional Content -->
      ${additionalContent}
      
      <!-- Table -->
      ${tableHeaders.length > 0 ? `
        <table>
          <thead>
            <tr>
              ${tableHeaders.map(header => `
                <th class="${header.align || 'text-left'}">${header.label}</th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            ${tableRows.map(row => `
              <tr>
                ${row.map((cell, index) => `
                  <td class="${tableHeaders[index]?.align || 'text-left'} ${cell.className || ''}">${cell.value || cell}</td>
                `).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}
      
      <!-- Footer -->
      <div class="report-footer">
        <p>${footerText}</p>
        <p>© ${new Date().getFullYear()} David's Salon. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
};

/**
 * Trigger browser print dialog
 * @param {string} htmlContent - HTML content to print
 */
export const printReport = (htmlContent) => {
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    
    // Wait for content to load before printing
    printWindow.onload = () => {
      printWindow.print();
    };
  } else {
    alert('Please allow popups to print reports');
  }
};

/**
 * Format currency for display
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency
 */
export const formatCurrency = (amount) => {
  return `₱${Number(amount || 0).toLocaleString('en-PH', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })}`;
};

/**
 * Format number for display
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
export const formatNumber = (num) => {
  return Number(num || 0).toLocaleString('en-PH');
};

/**
 * Format date for display
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date
 */
export const formatDate = (date) => {
  if (!date) return 'N/A';
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
};

/**
 * Format date and time for display
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date and time
 */
export const formatDateTime = (date) => {
  if (!date) return 'N/A';
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};
