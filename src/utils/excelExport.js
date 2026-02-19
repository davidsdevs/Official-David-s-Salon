// src/utils/excelExport.js
import ExcelJS from 'exceljs';
import { format } from 'date-fns';

/**
 * Create a new styled workbook
 */
export const createStyledWorkbook = () => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "David's Salon Management System";
  workbook.created = new Date();
  return workbook;
};

/**
 * Add report header (DAVID'S SALON + Report Title)
 */
export const addReportHeader = (worksheet, reportTitle, columnCount) => {
  // Row 1: DAVID'S SALON
  worksheet.mergeCells(1, 1, 1, columnCount);
  const headerCell = worksheet.getCell(1, 1);
  headerCell.value = "DAVID'S SALON";
  headerCell.font = { name: 'Calibri', size: 20, bold: true };
  headerCell.alignment = { horizontal: 'center', vertical: 'middle' };
  headerCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE3F2FD' }
  };
  headerCell.border = {
    top: { style: 'thin', color: { argb: 'FF333333' } },
    left: { style: 'thin', color: { argb: 'FF333333' } },
    bottom: { style: 'thin', color: { argb: 'FF333333' } },
    right: { style: 'thin', color: { argb: 'FF333333' } }
  };
  worksheet.getRow(1).height = 30;

  // Row 2: Report Title
  worksheet.mergeCells(2, 1, 2, columnCount);
  const titleCell = worksheet.getCell(2, 1);
  titleCell.value = reportTitle;
  titleCell.font = { name: 'Calibri', size: 16, bold: true };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE3F2FD' }
  };
  titleCell.border = {
    top: { style: 'thin', color: { argb: 'FF333333' } },
    left: { style: 'thin', color: { argb: 'FF333333' } },
    bottom: { style: 'thin', color: { argb: 'FF333333' } },
    right: { style: 'thin', color: { argb: 'FF333333' } }
  };
  worksheet.getRow(2).height = 25;

  return 3; // Next available row
};

/**
 * Add filters section
 */
export const addFiltersSection = (worksheet, filtersText, columnCount, startRow) => {
  worksheet.mergeCells(startRow, 1, startRow, columnCount);
  const filterCell = worksheet.getCell(startRow, 1);
  filterCell.value = `FILTERS APPLIED: ${filtersText}`;
  filterCell.font = { name: 'Calibri', size: 10, bold: true };
  filterCell.alignment = { horizontal: 'center', vertical: 'middle' };
  filterCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF5F5F5' }
  };
  filterCell.border = {
    top: { style: 'thin', color: { argb: 'FF333333' } },
    left: { style: 'thin', color: { argb: 'FF333333' } },
    bottom: { style: 'thin', color: { argb: 'FF333333' } },
    right: { style: 'thin', color: { argb: 'FF333333' } }
  };
  worksheet.getRow(startRow).height = 20;

  return startRow + 2; // Next available row (with spacing)
};

/**
 * Add summary statistics
 */
export const addSummaryStats = (worksheet, stats, startRow) => {
  const statsPerRow = 4;
  const colsPerStat = 3;
  
  stats.forEach((stat, index) => {
    const col = (index % statsPerRow) * colsPerStat + 1;
    
    // Merge cells for stat box
    worksheet.mergeCells(startRow, col, startRow, col + colsPerStat - 1);
    const statCell = worksheet.getCell(startRow, col);
    statCell.value = `${stat.label}\n${stat.value}`;
    statCell.font = { name: 'Calibri', size: 10, bold: true };
    statCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    statCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFF9C4' }
    };
    statCell.border = {
      top: { style: 'thin', color: { argb: 'FF333333' } },
      left: { style: 'thin', color: { argb: 'FF333333' } },
      bottom: { style: 'thin', color: { argb: 'FF333333' } },
      right: { style: 'thin', color: { argb: 'FF333333' } }
    };
  });
  
  worksheet.getRow(startRow).height = 35;
  return startRow + 2; // Next available row (with spacing)
};

/**
 * Add data table with headers
 */
export const addDataTable = (worksheet, headers, data, startRow, columnFormats = {}) => {
  // Add header row
  headers.forEach((header, index) => {
    const cell = worksheet.getCell(startRow, index + 1);
    cell.value = header.label;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { 
      horizontal: header.align || 'left', 
      vertical: 'middle' 
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' }
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF333333' } },
      left: { style: 'thin', color: { argb: 'FF333333' } },
      bottom: { style: 'thin', color: { argb: 'FF333333' } },
      right: { style: 'thin', color: { argb: 'FF333333' } }
    };
  });
  worksheet.getRow(startRow).height = 20;

  // Add data rows
  data.forEach((row, rowIndex) => {
    const currentRow = startRow + rowIndex + 1;
    const isEvenRow = rowIndex % 2 === 0;
    
    headers.forEach((header, colIndex) => {
      const cell = worksheet.getCell(currentRow, colIndex + 1);
      cell.value = row[header.key];
      cell.font = { name: 'Calibri', size: 9 };
      cell.alignment = { 
        horizontal: header.align || 'left', 
        vertical: 'middle' 
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isEvenRow ? 'FFFFFFFF' : 'FFF9FAFB' }
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF333333' } },
        left: { style: 'thin', color: { argb: 'FF333333' } },
        bottom: { style: 'thin', color: { argb: 'FF333333' } },
        right: { style: 'thin', color: { argb: 'FF333333' } }
      };

      // Apply number format if specified
      if (columnFormats[header.key]) {
        cell.numFmt = columnFormats[header.key];
      }
    });
    worksheet.getRow(currentRow).height = 18;
  });

  return startRow + data.length + 1; // Next available row
};

/**
 * Add grand total row
 */
export const addGrandTotal = (worksheet, headers, totalData, startRow) => {
  headers.forEach((header, colIndex) => {
    const cell = worksheet.getCell(startRow, colIndex + 1);
    cell.value = totalData[header.key] !== undefined ? totalData[header.key] : '';
    cell.font = { name: 'Calibri', size: 9, bold: true };
    cell.alignment = { 
      horizontal: header.align || 'left', 
      vertical: 'middle' 
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF333333' } },
      bottom: { style: 'thin', color: { argb: 'FF333333' } },
      right: { style: 'thin', color: { argb: 'FF333333' } }
    };

    // Apply number format if it's a number column
    if (typeof totalData[header.key] === 'number') {
      if (header.key.toLowerCase().includes('amount') || header.key.toLowerCase().includes('cost') || header.key.toLowerCase().includes('price') || header.key.toLowerCase().includes('value')) {
        cell.numFmt = '₱#,##0.00';
      } else {
        cell.numFmt = '#,##0';
      }
    }
  });
  worksheet.getRow(startRow).height = 20;

  return startRow + 2; // Next available row (with spacing)
};

/**
 * Add footer information
 */
export const addFooter = (worksheet, userData, branchName, startRow, columnCount) => {
  const leftCol = 1;
  const rightCol = Math.floor(columnCount / 2) + 1;

  // Extract user name from various possible formats
  let userName = 'Inventory Controller';
  if (userData) {
    // Try different property names
    if (userData.name) {
      userName = userData.name;
    } else if (userData.firstName && userData.lastName) {
      userName = `${userData.firstName} ${userData.lastName}`.trim();
    } else if (userData.firstName) {
      userName = userData.firstName;
    } else if (userData.lastName) {
      userName = userData.lastName;
    } else if (userData.displayName) {
      userName = userData.displayName;
    } else if (userData.email) {
      userName = userData.email.split('@')[0]; // Use email username part
    }
  }

  // Left side - Generated By info
  const leftCell = worksheet.getCell(startRow, leftCol);
  leftCell.value = `Generated By: ${userName}\nPosition: Inventory Controller\nBranch: ${branchName}`;
  leftCell.font = { name: 'Calibri', size: 8 };
  leftCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };

  // Right side - Date/Time info
  const rightCell = worksheet.getCell(startRow, rightCol);
  rightCell.value = `Generated On: ${format(new Date(), 'MMMM dd, yyyy')}\nTime: ${format(new Date(), 'HH:mm:ss')}`;
  rightCell.font = { name: 'Calibri', size: 8 };
  rightCell.alignment = { horizontal: 'right', vertical: 'top', wrapText: true };

  worksheet.getRow(startRow).height = 30;

  return startRow + 1;
};

/**
 * Set column widths
 */
export const setColumnWidths = (worksheet, widths) => {
  widths.forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width;
  });
};

/**
 * Save and download workbook
 */
export const saveWorkbook = async (workbook, filename) => {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
};

/**
 * Legacy export function for backward compatibility
 * Simple Excel export without styling (used by other modules)
 */
export const exportToExcel = (data, filename, sheetName, headers) => {
  const XLSX = require('xlsx');
  
  // Create workbook
  const wb = XLSX.utils.book_new();
  
  // Prepare data with headers
  const wsData = [];
  
  // Add headers
  if (headers && headers.length > 0) {
    wsData.push(headers.map(h => h.label || h));
  }
  
  // Add data rows
  data.forEach(row => {
    if (headers && headers.length > 0) {
      const rowData = headers.map(h => {
        const key = h.key || h;
        return row[key] !== undefined ? row[key] : '';
      });
      wsData.push(rowData);
    } else {
      wsData.push(Object.values(row));
    }
  });
  
  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Sheet1');
  
  // Generate Excel file and download
  XLSX.writeFile(wb, `${filename}.xlsx`);
};
