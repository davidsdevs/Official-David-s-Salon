// src/utils/ocrService.js
// Dynamic import for tesseract.js to reduce initial bundle size
let TesseractCache = null;

/**
 * Load Tesseract.js dynamically
 */
const loadTesseract = async () => {
  if (TesseractCache) {
    return TesseractCache;
  }
  
  try {
    const tesseractModule = await import('tesseract.js');
    TesseractCache = tesseractModule.default || tesseractModule;
    return TesseractCache;
  } catch (error) {
    console.error('Failed to load tesseract.js:', error);
    throw error;
  }
};

/**
 * Extract amount from receipt image using OCR
 * @param {File|string} image - Image file or image URL
 * @returns {Promise<Object>} - Extracted amount and confidence
 */
export const extractAmountFromReceipt = async (image) => {
  try {
    console.log('Starting OCR extraction...');
    
    // Load Tesseract.js
    const Tesseract = await loadTesseract();
    
    if (!Tesseract || !Tesseract.createWorker) {
      throw new Error('Tesseract.js module not properly loaded');
    }
    
    // Initialize Tesseract worker
    const worker = await Tesseract.createWorker('eng');
    
    // Perform OCR
    const { data: { text, confidence } } = await worker.recognize(image);
    
    // Terminate worker
    await worker.terminate();
    
    console.log('OCR Text extracted:', text);
    console.log('OCR Confidence:', confidence);
    
    // Extract amount from text
    const amount = extractAmountFromText(text);
    
    return {
      success: true,
      extractedText: text,
      amount: amount,
      confidence: confidence,
      rawText: text
    };
  } catch (error) {
    console.error('OCR Error:', error);
    return {
      success: false,
      error: error.message,
      amount: null,
      confidence: 0
    };
  }
};

/**
 * Extract amount from OCR text using regex patterns
 * @param {string} text - OCR extracted text
 * @returns {number|null} - Extracted amount or null
 */
const extractAmountFromText = (text) => {
  if (!text) return null;
  
  // Common patterns for amounts in receipts
  const patterns = [
    // Pattern 1: "Total: ₱1,234.56" or "Total: 1234.56"
    /total[:\s]*[₱]?[\s]*([\d,]+\.?\d*)/i,
    // Pattern 2: "Amount: ₱1,234.56"
    /amount[:\s]*[₱]?[\s]*([\d,]+\.?\d*)/i,
    // Pattern 3: "Grand Total: ₱1,234.56"
    /grand\s*total[:\s]*[₱]?[\s]*([\d,]+\.?\d*)/i,
    // Pattern 4: "Balance: ₱1,234.56"
    /balance[:\s]*[₱]?[\s]*([\d,]+\.?\d*)/i,
    // Pattern 5: Just look for large numbers with currency symbol
    /[₱]?\s*([\d]{1,3}(?:[,]\d{3})*(?:\.\d{2})?)/g,
    // Pattern 6: Numbers with decimal points (likely amounts)
    /([\d]{1,3}(?:[,]\d{3})*\.\d{2})/g
  ];
  
  let amounts = [];
  
  // Try each pattern
  patterns.forEach((pattern, index) => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        // Extract the number part
        const numberMatch = match.match(/[\d,]+\.?\d*/);
        if (numberMatch) {
          const amount = parseFloat(numberMatch[0].replace(/,/g, ''));
          if (amount > 0 && amount < 10000000) { // Reasonable range
            amounts.push({
              amount: amount,
              pattern: index,
              match: match
            });
          }
        }
      });
    }
  });
  
  // If multiple amounts found, prefer the largest (likely the total)
  if (amounts.length > 0) {
    // Sort by amount descending
    amounts.sort((a, b) => b.amount - a.amount);
    // Return the largest amount that seems reasonable
    return amounts[0].amount;
  }
  
  // Fallback: look for any number that looks like an amount
  const fallbackPattern = /([\d]{3,}(?:[,]\d{3})*(?:\.\d{2})?)/g;
  const fallbackMatches = text.match(fallbackPattern);
  if (fallbackMatches && fallbackMatches.length > 0) {
    const fallbackAmounts = fallbackMatches
      .map(m => parseFloat(m.replace(/,/g, '')))
      .filter(a => a > 100 && a < 10000000); // Reasonable range
    
    if (fallbackAmounts.length > 0) {
      return Math.max(...fallbackAmounts);
    }
  }
  
  return null;
};

/**
 * Validate extracted amount
 * @param {number} extractedAmount - Amount extracted from OCR
 * @param {number} expectedAmount - Expected amount (daily sales total)
 * @param {number} tolerance - Allowed difference in pesos (default: 1)
 * @returns {Object} - Validation result
 */
export const validateExtractedAmount = (extractedAmount, expectedAmount, tolerance = 1) => {
  if (!extractedAmount) {
    return {
      isValid: false,
      message: 'Could not extract amount from receipt',
      difference: null
    };
  }
  
  const difference = Math.abs(extractedAmount - expectedAmount);
  const isValid = difference <= tolerance;
  
  return {
    isValid: isValid,
    difference: extractedAmount - expectedAmount,
    message: isValid
      ? `Amount matches! (Difference: ₱${difference.toFixed(2)})`
      : `Amount mismatch: Difference of ₱${difference.toFixed(2)}`,
    extractedAmount: extractedAmount,
    expectedAmount: expectedAmount
  };
};

