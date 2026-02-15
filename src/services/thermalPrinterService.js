/**
 * Thermal Printer Service
 * Handles Bluetooth connection and ESC/POS printing for XPrinter 58H and similar 58mm thermal printers
 */

// ESC/POS Commands
const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

const COMMANDS = {
  INIT: [ESC, 0x40], // Initialize printer
  ALIGN_LEFT: [ESC, 0x61, 0x00],
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  ALIGN_RIGHT: [ESC, 0x61, 0x02],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  DOUBLE_HEIGHT_ON: [GS, 0x21, 0x10],
  DOUBLE_WIDTH_ON: [GS, 0x21, 0x20],
  DOUBLE_SIZE_ON: [GS, 0x21, 0x30],
  NORMAL_SIZE: [GS, 0x21, 0x00],
  UNDERLINE_ON: [ESC, 0x2D, 0x01],
  UNDERLINE_OFF: [ESC, 0x2D, 0x00],
  CUT_PAPER: [GS, 0x56, 0x00], // Full cut
  CUT_PAPER_PARTIAL: [GS, 0x56, 0x01], // Partial cut
  FEED_LINES: (n) => [ESC, 0x64, n], // Feed n lines
  LINE_SPACING: (n) => [ESC, 0x33, n], // Set line spacing
};

class ThermalPrinterService {
  constructor() {
    this.device = null;
    this.server = null;
    this.characteristic = null;
    this.isConnected = false;
    this.printerName = null;

    // Standard Bluetooth Serial Port Profile UUID
    this.SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb';
    this.CHARACTERISTIC_UUID = '00002af1-0000-1000-8000-00805f9b34fb';

    // Alternative UUIDs for different printers
    this.ALT_SERVICE_UUIDS = [
      '000018f0-0000-1000-8000-00805f9b34fb',
      '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Common for Chinese printers
      'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
    ];
  }

  /**
   * Check if Web Bluetooth is supported
   */
  isSupported() {
    return 'bluetooth' in navigator;
  }

  /**
   * Connect to Bluetooth thermal printer
   */
  async connect() {
    if (!this.isSupported()) {
      throw new Error('Web Bluetooth is not supported in this browser. Please use Chrome or Edge.');
    }

    try {
      // Request Bluetooth device
      this.device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'XP' }, // XPrinter
          { namePrefix: 'Printer' },
          { namePrefix: 'POS' },
          { namePrefix: 'BT' },
        ],
        optionalServices: this.ALT_SERVICE_UUIDS,
      });

      this.printerName = this.device.name;
      console.log('🖨️ Selected printer:', this.printerName);

      // Connect to GATT server
      this.server = await this.device.gatt.connect();
      console.log('🔗 Connected to GATT server');

      // Try to find the print service
      let service = null;
      for (const uuid of this.ALT_SERVICE_UUIDS) {
        try {
          service = await this.server.getPrimaryService(uuid);
          console.log('✅ Found service:', uuid);
          break;
        } catch (e) {
          console.log('Service not found:', uuid);
        }
      }

      if (!service) {
        throw new Error('Could not find print service on this device');
      }

      // Get all characteristics and find writable one
      const characteristics = await service.getCharacteristics();
      for (const char of characteristics) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          this.characteristic = char;
          console.log('✅ Found writable characteristic:', char.uuid);
          break;
        }
      }

      if (!this.characteristic) {
        throw new Error('Could not find writable characteristic');
      }

      this.isConnected = true;

      // Listen for disconnection
      this.device.addEventListener('gattserverdisconnected', () => {
        console.log('🔌 Printer disconnected');
        this.isConnected = false;
        this.characteristic = null;
        this.server = null;
      });

      return { success: true, printerName: this.printerName };
    } catch (error) {
      console.error('❌ Bluetooth connection error:', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Disconnect from printer
   */
  disconnect() {
    if (this.device && this.device.gatt.connected) {
      this.device.gatt.disconnect();
    }
    this.isConnected = false;
    this.characteristic = null;
    this.server = null;
    this.device = null;
  }

  /**
   * Send raw bytes to printer
   */
  async sendBytes(bytes) {
    if (!this.isConnected || !this.characteristic) {
      throw new Error('Printer not connected');
    }

    const data = new Uint8Array(bytes);

    // Send in chunks (BLE has packet size limits)
    const chunkSize = 100;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      if (this.characteristic.properties.writeWithoutResponse) {
        await this.characteristic.writeValueWithoutResponse(chunk);
      } else {
        await this.characteristic.writeValue(chunk);
      }
      // Small delay between chunks
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  /**
   * Convert text to bytes with encoding
   */
  textToBytes(text) {
    const encoder = new TextEncoder();
    return Array.from(encoder.encode(text));
  }

  /**
   * Print a line of text
   */
  async printLine(text, options = {}) {
    const bytes = [];

    if (options.bold) bytes.push(...COMMANDS.BOLD_ON);
    if (options.center) bytes.push(...COMMANDS.ALIGN_CENTER);
    if (options.right) bytes.push(...COMMANDS.ALIGN_RIGHT);
    if (options.doubleHeight) bytes.push(...COMMANDS.DOUBLE_HEIGHT_ON);
    if (options.doubleWidth) bytes.push(...COMMANDS.DOUBLE_WIDTH_ON);
    if (options.doubleSize) bytes.push(...COMMANDS.DOUBLE_SIZE_ON);

    bytes.push(...this.textToBytes(text));
    bytes.push(LF);

    // Reset formatting
    if (options.bold) bytes.push(...COMMANDS.BOLD_OFF);
    if (options.center || options.right) bytes.push(...COMMANDS.ALIGN_LEFT);
    if (options.doubleHeight || options.doubleWidth || options.doubleSize) {
      bytes.push(...COMMANDS.NORMAL_SIZE);
    }

    await this.sendBytes(bytes);
  }

  /**
   * Print separator line
   */
  async printSeparator(char = '-', width = 32) {
    await this.printLine(char.repeat(width));
  }

  /**
   * Print two columns (left and right aligned)
   */
  async printTwoColumns(left, right, width = 32) {
    const spaces = width - left.length - right.length;
    const line = left + ' '.repeat(Math.max(1, spaces)) + right;
    await this.printLine(line);
  }

  /**
   * Feed paper
   */
  async feedPaper(lines = 3) {
    await this.sendBytes(COMMANDS.FEED_LINES(lines));
  }

  /**
   * Cut paper (if supported)
   */
  async cutPaper() {
    await this.feedPaper(3);
    await this.sendBytes(COMMANDS.CUT_PAPER_PARTIAL);
  }

  /**
   * Print a complete receipt
   */
  async printReceipt(billData, branchData) {
    if (!this.isConnected) {
      throw new Error('Printer not connected. Please connect first.');
    }

    try {
      // Initialize printer
      await this.sendBytes(COMMANDS.INIT);
      await new Promise(resolve => setTimeout(resolve, 100));

      const width = 32; // 58mm paper is typically 32 characters

      // Header - Salon Name
      await this.printLine("David's Salon", { center: true, bold: true });
      
      // Branch Name
      if (branchData?.name || branchData?.branchName) {
        await this.printLine(branchData.name || branchData.branchName, { center: true, bold: true });
      }

      // Branch Address
      if (branchData?.address) {
        const addressLines = this.wrapText(branchData.address, width);
        for (const line of addressLines) {
          await this.printLine(line, { center: true });
        }
      }

      // Email
      if (branchData?.email) {
        await this.printLine(`Email: ${branchData.email}`, { center: true });
      }

      // TIN
      await this.printLine('TIN: 123-456-777-898', { center: true });
      await this.printLine('VAT Registered', { center: true, bold: true });

      await this.printSeparator('-', width);

      // TRANSACTION DETAILS
      await this.printLine('TRANSACTION DETAILS', { bold: true });
      await this.printTwoColumns('Receipt No:', billData.receiptNumber || billData.id, width);
      await this.printTwoColumns('Invoice No:', billData.id || '', width);
      await this.printTwoColumns('POS Terminal ID:', branchData?.posTerminalId || 'POS-001', width);
      await this.printTwoColumns('Cashier Name / ID:', billData.createdByName || 'Staff', width);
      await this.printTwoColumns('Date:', this.formatDateDetailed(billData.createdAt), width);
      await this.printTwoColumns('Time:', this.formatTimeDetailed(billData.createdAt), width);

      await this.printSeparator('-', width);

      // CUSTOMER INFORMATION
      await this.printLine('CUSTOMER INFORMATION', { bold: true });
      await this.printTwoColumns('Name:', billData.clientName || 'Guest', width);
      if (billData.clientPhone) {
        await this.printTwoColumns('Phone:', billData.clientPhone, width);
      }
      if (billData.clientEmail) {
        await this.printTwoColumns('Email:', billData.clientEmail, width);
      }

      await this.printSeparator('-', width);

      // ITEMIZED PURCHASE
      await this.printLine('ITEMIZED PURCHASE', { bold: true });
      
      // Header row
      await this.printLine('Qty Item Description');
      await this.printLine('    Unit Price      Total');

      // Separate services and products
      const services = (billData.items || []).filter(item => item.type === 'service');
      const products = (billData.items || []).filter(item => item.type === 'product');

      // Print services
      if (services.length > 0) {
        await this.printLine('SERVICES:', { bold: true });
        for (const item of services) {
          const itemName = item.name || item.serviceName || 'Service';
          const qty = item.quantity || 1;
          const price = item.price || item.finalPrice || 0;
          const total = qty * price;

          // Item name (may wrap)
          const nameLines = this.wrapText(itemName, width - 2);
          for (let i = 0; i < nameLines.length; i++) {
            await this.printLine(`${qty} ${nameLines[i]}`);
          }

          // Price line
          const priceLine = `    ${this.formatCurrency(price)}`;
          await this.printTwoColumns(priceLine, this.formatCurrency(total), width);

          // Stylist info
          if (item.stylistName) {
            await this.printLine(`    by ${item.stylistName}`);
          }
          if (item.clientType) {
            await this.printLine(`    (${item.clientType})`);
          }
        }
      }

      // Print products
      if (products.length > 0) {
        await this.printLine('PRODUCTS:', { bold: true });
        for (const item of products) {
          const itemName = item.name || 'Product';
          const qty = item.quantity || 1;
          const price = item.price || 0;
          const total = qty * price;

          // Item name (may wrap)
          const nameLines = this.wrapText(itemName, width - 2);
          for (let i = 0; i < nameLines.length; i++) {
            await this.printLine(`${qty} ${nameLines[i]}`);
          }

          // Price line
          const priceLine = `    ${this.formatCurrency(price)}`;
          await this.printTwoColumns(priceLine, this.formatCurrency(total), width);
        }
      }

      await this.printSeparator('-', width);

      // COST BREAKDOWN
      await this.printLine('COST BREAKDOWN', { bold: true });
      await this.printTwoColumns('Subtotal:', this.formatCurrency(billData.subtotal || 0), width);

      // Discounts
      const hasDiscounts = (billData.discount || 0) > 0 || (billData.promotionDiscount || 0) > 0 || (billData.loyaltyPointsUsed || 0) > 0;
      
      if (hasDiscounts) {
        await this.printLine('Less: Discounts:', { bold: true });
        
        if (billData.discount > 0) {
          // Show discount type if available
          let discountLabel = '  Manual Discount:';
          if (billData.discountReason === 'Senior') {
            discountLabel = '  Senior Citizen (10%):';
          } else if (billData.discountReason === 'PWD') {
            discountLabel = '  PWD Discount (10%):';
          }
          await this.printTwoColumns(discountLabel, `-${this.formatCurrency(billData.discount)}`, width);
          
          // Show control number for Senior/PWD
          if ((billData.discountReason === 'Senior' || billData.discountReason === 'PWD') && billData.controlNumber) {
            await this.printTwoColumns('  ID/Control No:', billData.controlNumber, width);
          }
        }
        if (billData.promotionDiscount > 0) {
          await this.printTwoColumns('  Promotion Discount:', `-${this.formatCurrency(billData.promotionDiscount)}`, width);
        }
        if (billData.loyaltyPointsUsed > 0) {
          await this.printTwoColumns(`  Loyalty (${billData.loyaltyPointsUsed} pts):`, `-${this.formatCurrency(billData.loyaltyPointsUsed)}`, width);
        }
        
        const totalDiscounts = (billData.discount || 0) + (billData.promotionDiscount || 0) + (billData.loyaltyPointsUsed || 0);
        await this.printTwoColumns('Total Discounts:', `-${this.formatCurrency(totalDiscounts)}`, width);
      }

      // Net Sales
      const netSales = (billData.subtotal || 0) - ((billData.discount || 0) + (billData.promotionDiscount || 0) + (billData.loyaltyPointsUsed || 0));
      await this.printTwoColumns('Net Sales:', this.formatCurrency(netSales), width);

      await this.printSeparator('-', width);

      // TAX BREAKDOWN
      await this.printLine('TAX BREAKDOWN', { bold: true });
      
      // Calculate VAT (assuming VAT inclusive)
      const vatRate = 0.12;
      const vatAmount = netSales / (1 + vatRate) * vatRate;
      const vatableSales = netSales - vatAmount;
      
      await this.printTwoColumns('VATable Sales:', this.formatCurrency(vatableSales), width);
      await this.printTwoColumns('VAT Amount (12%):', this.formatCurrency(vatAmount), width);

      await this.printSeparator('-', width);

      // TOTAL AMOUNT DUE
      await this.printLine('TOTAL AMOUNT DUE:', { bold: true });
      await this.printTwoColumns('', this.formatCurrency(billData.total || billData.grandTotal || 0), width);

      await this.printSeparator('-', width);

      // PAYMENT DETAILS
      await this.printLine('PAYMENT DETAILS', { bold: true });
      await this.printTwoColumns('Payment Method:', (billData.paymentMethod || 'Cash').toUpperCase(), width);

      if (billData.paymentMethod === 'cash' || billData.paymentMethod === 'Cash') {
        await this.printTwoColumns('  Cash:', this.formatCurrency(billData.amountReceived || billData.total), width);
        await this.printTwoColumns('Amount Tendered:', this.formatCurrency(billData.amountReceived || 0), width);
        await this.printTwoColumns('Change:', this.formatCurrency(billData.change || 0), width);
      } else if (billData.paymentMethod === 'card' || billData.paymentMethod === 'Card') {
        await this.printTwoColumns('  Card:', this.formatCurrency(billData.total), width);
      } else if (billData.paymentMethod === 'voucher') {
        await this.printTwoColumns('  E-Wallet:', this.formatCurrency(billData.total), width);
      }

      // Notes
      if (billData.notes) {
        await this.printSeparator('-', width);
        await this.printLine('Notes:', { bold: true });
        const notesLines = this.wrapText(billData.notes, width);
        for (const line of notesLines) {
          await this.printLine(line);
        }
      }

      await this.printSeparator('-', width);

      // FOOTER
      await this.printLine('FOOTER', { bold: true });
      await this.printLine('Thank you for choosing', { center: true });
      await this.printLine("David's Salon!", { center: true, bold: true });
      await this.printLine('This serves as your', { center: true });
      await this.printLine('official receipt.', { center: true });
      
      await this.feedPaper(1);
      await this.printLine('VAT Reg TIN: 123-456-777-898', { center: true });
      await this.printLine('Accreditation No:', { center: true });
      await this.printLine('ACC-12312512874', { center: true });
      await this.printLine('Permit No: PER-1247124', { center: true });
      
      await this.feedPaper(1);
      await this.printLine('Return / Exchange Policy:', { center: true });
      await this.printLine('Products may be returned', { center: true });
      await this.printLine('after 3 days', { center: true });
      
      await this.feedPaper(1);
      await this.printLine(`Transaction ID: ${billData.id || ''}`, { center: true });
      if (billData.receiptNumber) {
        await this.printLine(`Receipt No: ${billData.receiptNumber}`, { center: true });
      }
      await this.printLine('Powered by David\'s Salon', { center: true });
      await this.printLine('POS System', { center: true });

      // Feed and cut
      await this.feedPaper(4);
      await this.cutPaper();

      return { success: true };
    } catch (error) {
      console.error('❌ Print error:', error);
      throw error;
    }
  }

  /**
   * Wrap text to fit width
   */
  wrapText(text, maxWidth) {
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
  }

  /**
   * Format currency
   */
  formatCurrency(amount) {
    return 'P' + Number(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /**
   * Format date
   */
  formatDate(date) {
    if (!date) return new Date().toLocaleDateString();
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  /**
   * Format date (detailed for receipt)
   */
  formatDateDetailed(date) {
    if (!date) return new Date().toLocaleDateString();
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Format time
   */
  formatTime(date) {
    if (!date) return new Date().toLocaleTimeString();
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleTimeString('en-PH', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  /**
   * Format time (detailed with seconds for receipt)
   */
  formatTimeDetailed(date) {
    if (!date) return new Date().toLocaleTimeString();
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      printerName: this.printerName,
      isSupported: this.isSupported()
    };
  }

  /**
   * Print QR Code using ESC/POS commands - Native printer QR generation
   * This is MORE RELIABLE than raster images on thermal printers
   * @param {string} data - The data to encode in the QR code
   * @param {number} size - QR code module size (1-16, default 10)
   */
  async printQRCode(data, size = 10) {
    if (!this.isConnected || !this.characteristic) {
      throw new Error('Printer not connected');
    }

    console.log('📱 Printing QR with ESC/POS native, data:', data);
    console.log('📱 Data length:', data.length, 'Module size:', size);

    // Build all commands first, then send
    const allBytes = [];

    // QR Code: Select model (Model 2 - most compatible)
    allBytes.push(GS, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);

    // QR Code: Set module size (1-16)
    const moduleSize = Math.min(16, Math.max(1, size));
    allBytes.push(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, moduleSize);

    // QR Code: Set error correction level - M (Medium) is best for thermal
    // L=48, M=49, Q=50, H=51
    allBytes.push(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31); // M level (49 = 0x31)

    // QR Code: Store data
    const dataBytes = this.textToBytes(data);
    const dataLen = dataBytes.length + 3;
    const pL = dataLen % 256;
    const pH = Math.floor(dataLen / 256);
    allBytes.push(GS, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30);
    allBytes.push(...dataBytes);

    // QR Code: Print the stored QR code
    allBytes.push(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30);

    // Send all at once
    await this.sendBytes(allBytes);

    console.log('✅ ESC/POS QR command sent:', allBytes.length, 'bytes');
  }

  /**
   * Print image using GS v 0 raster command (widely supported)
   * @param {ImageData} imageData - Canvas image data
   * @param {number} width - Image width
   * @param {number} height - Image height
   */
  async printRasterImage(imageData, width, height) {
    const bytesPerLine = Math.ceil(width / 8);

    console.log(`🖼️ Raster image: ${width}x${height}px, ${bytesPerLine} bytes/line`);

    // BUILD COMPLETE IMAGE DATA FIRST
    const imageBytes = [];

    // Add header: GS v 0 m xL xH yL yH
    imageBytes.push(GS, 0x76, 0x30, 0x00);
    imageBytes.push(bytesPerLine % 256, Math.floor(bytesPerLine / 256)); // xL, xH
    imageBytes.push(height % 256, Math.floor(height / 256)); // yL, yH

    // Convert pixels to bytes (1 bit per pixel, MSB first)
    for (let y = 0; y < height; y++) {
      for (let byteX = 0; byteX < bytesPerLine; byteX++) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const x = byteX * 8 + bit;
          if (x < width) {
            const idx = (y * width + x) * 4;
            const r = imageData.data[idx];
            const g = imageData.data[idx + 1];
            const b = imageData.data[idx + 2];
            const gray = (r * 0.299 + g * 0.587 + b * 0.114);
            if (gray < 128) {
              byte |= (0x80 >> bit); // Black pixel
            }
          }
        }
        imageBytes.push(byte);
      }
    }

    console.log(`📦 Built complete image: ${imageBytes.length} bytes (header + data)`);

    // SEND ALL AT ONCE - continuous stream, no interruptions
    // Use moderate chunk size for smooth transmission
    const chunkSize = 128;
    const totalChunks = Math.ceil(imageBytes.length / chunkSize);

    console.log(`📤 Sending in ${totalChunks} chunks...`);

    for (let i = 0; i < imageBytes.length; i += chunkSize) {
      const chunk = imageBytes.slice(i, i + chunkSize);
      const data = new Uint8Array(chunk);

      // Retry logic for GATT errors
      let retries = 3;
      while (retries > 0) {
        try {
          if (this.characteristic.properties.writeWithoutResponse) {
            await this.characteristic.writeValueWithoutResponse(data);
          } else {
            await this.characteristic.writeValue(data);
          }
          break;
        } catch (writeError) {
          retries--;
          if (retries === 0) throw writeError;
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      // Small delay - just enough to not overwhelm BLE
      await new Promise(resolve => setTimeout(resolve, 30));
    }

    console.log(`✅ Raster image sent successfully`);
  }

  /**
   * Print image using ESC * bit image command (alternative method) - SLOW for reliability
   * @param {ImageData} imageData - Canvas image data
   * @param {number} width - Image width
   * @param {number} height - Image height
   */
  async printBitImage(imageData, width, height) {
    const bytesPerLine = Math.ceil(width / 8);

    console.log(`🖼️ Bit image: ${width}x${height}px, ${bytesPerLine} bytes/line`);

    // ESC * m nL nH d1...dk - Select bit-image mode
    // m = 0: 8-dot single density, 1: 8-dot double density, 32: 24-dot single, 33: 24-dot double

    const totalRows = Math.ceil(height / 8);

    // Process 8 rows at a time (8-dot mode)
    for (let y = 0; y < height; y += 8) {
      const lineBytes = [ESC, 0x2A, 0x00, width % 256, Math.floor(width / 256)]; // ESC * 0 nL nH

      for (let x = 0; x < width; x++) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const row = y + bit;
          if (row < height) {
            const idx = (row * width + x) * 4;
            const r = imageData.data[idx];
            const g = imageData.data[idx + 1];
            const b = imageData.data[idx + 2];
            const gray = (r * 0.299 + g * 0.587 + b * 0.114);
            if (gray < 128) {
              byte |= (0x80 >> bit); // Black pixel
            }
          }
        }
        lineBytes.push(byte);
      }

      lineBytes.push(LF); // Line feed after each row

      await this.sendBytes(lineBytes);
      // SLOW - 80ms delay per row to let printer process
      await new Promise(resolve => setTimeout(resolve, 80));

      // Log progress
      const rowNum = Math.floor(y / 8) + 1;
      if (rowNum % Math.ceil(totalRows / 5) === 0) {
        console.log(`📤 Bit image progress: ${Math.round((rowNum / totalRows) * 100)}%`);
      }
    }

    // Wait for printer to finish
    await new Promise(resolve => setTimeout(resolve, 200));

    console.log(`✅ Bit image sent`);
  }

  /**
   * Print QR Code as raster image - Medium size for reliable printing
   * 250px is a good balance - scannable but not too big for BLE
   * @param {string} data - The data to encode in the QR code
   * @param {number} size - QR code size in pixels (default 250)
   */
  async printQRCodeAsImage(data, size = 250) {
    if (!this.isConnected || !this.characteristic) {
      throw new Error('Printer not connected');
    }

    console.log('📱 Printing QR as image, data:', data);
    console.log('📱 Data length:', data.length);

    try {
      // Dynamically import qrcode library
      const QRCode = (await import('qrcode')).default;

      // 250px - good balance between scannable and reliable transmission
      const qrSize = size;

      const canvas = document.createElement('canvas');
      await QRCode.toCanvas(canvas, data, {
        width: qrSize,
        margin: 2, // Small margin
        errorCorrectionLevel: 'M', // Medium error correction - good balance
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;
      const imageData = ctx.getImageData(0, 0, width, height);

      console.log(`📷 QR code generated: ${width}x${height}px`);

      // Use raster method - image is pre-built then sent continuously
      await this.printRasterImage(imageData, width, height);
      console.log('✅ QR code printed successfully');

    } catch (error) {
      console.error('Error printing QR code as image:', error);
      throw error;
    }
  }

  /**
   * Print a QR code sticker for product/batch
   * @param {Object} qrData - QR code data object with qrCodeString property
   */
  async printQRSticker(qrData) {
    if (!this.isConnected) {
      throw new Error('Printer not connected. Please connect first.');
    }

    // Get the QR code string data - use compact format for smaller QR
    let qrString = qrData.qrCodeString || qrData.data;

    // If no pre-built string, create a compact one
    if (!qrString) {
      // Use compact JSON to reduce QR code density
      qrString = JSON.stringify({
        p: qrData.productId,
        b: qrData.batchNumber,
        pr: qrData.price,
        br: qrData.branchId
      });
    }

    console.log('🏷️ ========== PRINTING QR STICKER ==========');
    console.log('🏷️ QR String:', qrString);
    console.log('🏷️ QR String Length:', qrString.length);
    console.log('🏷️ Batch:', qrData.batchNumber);
    console.log('🏷️ Price:', qrData.price);

    try {
      // Initialize printer with longer delay
      await this.sendBytes(COMMANDS.INIT);
      await new Promise(resolve => setTimeout(resolve, 200));

      // Header - David's Salon
      await this.printLine("DAVID'S SALON", { center: true, bold: true });
      await new Promise(resolve => setTimeout(resolve, 50));
      await this.feedPaper(1);

      // Center align for QR code
      await this.sendBytes(COMMANDS.ALIGN_CENTER);
      await new Promise(resolve => setTimeout(resolve, 50));

      // Print QR Code - 250px for reliable printing
      let qrPrinted = false;

      // USE ESC/POS NATIVE QR COMMAND FIRST - more reliable on thermal printers
      try {
        console.log('🔲 Printing QR with ESC/POS native command (size 10)...');
        await this.printQRCode(qrString, 10); // Size 10 = good balance
        await new Promise(resolve => setTimeout(resolve, 200)); // Wait for printer
        await this.feedPaper(1);
        qrPrinted = true;
        console.log('✅ ESC/POS QR code printed');
      } catch (qrError) {
        console.log('⚠️ ESC/POS method failed:', qrError.message);

        // Fallback to raster image
        try {
          console.log('🔲 Fallback: Raster QR code (200px)...');
          await this.printQRCodeAsImage(qrString, 200);
          await this.feedPaper(1);
          qrPrinted = true;
          console.log('✅ Raster QR code printed');
        } catch (imgError) {
          console.error('❌ Raster QR failed:', imgError.message);
        }
      }

      if (!qrPrinted) {
        console.error('❌ All QR methods failed!');
        await this.printLine('[QR CODE FAILED]', { center: true });
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      // Batch Number
      if (qrData.batchNumber && qrData.batchNumber !== 'N/A') {
        await this.printLine(`Batch: ${qrData.batchNumber}`, { center: true });
      }

      // Product Name (if available)
      if (qrData.productName) {
        const nameLines = this.wrapText(qrData.productName, 28);
        for (const line of nameLines) {
          await this.printLine(line, { center: true });
        }
      }

      // Price (prominent)
      await this.feedPaper(1);
      await this.printLine(`P${(qrData.price || 0).toFixed(2)}`, { center: true, bold: true, doubleSize: true });

      // Reset alignment
      await this.sendBytes(COMMANDS.ALIGN_LEFT);

      // Feed and cut
      await this.feedPaper(3);
      await this.cutPaper();

      console.log('🏷️ ========== STICKER COMPLETE ==========');
      return { success: true };
    } catch (error) {
      console.error('❌ QR Sticker print error:', error);
      throw error;
    }
  }

  /**
   * Print multiple QR code stickers
   * @param {Array} qrDataArray - Array of QR code data objects
   */
  async printMultipleQRStickers(qrDataArray) {
    if (!this.isConnected) {
      throw new Error('Printer not connected. Please connect first.');
    }

    const results = [];
    for (let i = 0; i < qrDataArray.length; i++) {
      try {
        await this.printQRSticker(qrDataArray[i]);
        results.push({ index: i, success: true });
        // Small delay between prints
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        results.push({ index: i, success: false, error: error.message });
      }
    }
    return results;
  }
}

// Export singleton instance
export const thermalPrinter = new ThermalPrinterService();
export default thermalPrinter;
