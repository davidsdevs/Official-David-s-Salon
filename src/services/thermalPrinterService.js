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

      // Header - Branch Name
      await this.printLine(branchData?.name || branchData?.branchName || "David's Salon", { center: true, bold: true, doubleSize: true });
      await this.feedPaper(1);
      
      // Branch Address (if available)
      if (branchData?.address) {
        const addressLines = this.wrapText(branchData.address, width);
        for (const line of addressLines) {
          await this.printLine(line, { center: true });
        }
      }
      
      // Contact
      if (branchData?.phone) {
        await this.printLine(`Tel: ${branchData.phone}`, { center: true });
      }
      
      await this.printSeparator('=', width);
      
      // Receipt Info
      await this.printLine('OFFICIAL RECEIPT', { center: true, bold: true });
      await this.printSeparator('-', width);
      
      // Receipt details
      await this.printTwoColumns('Receipt #:', billData.receiptNumber || 'N/A', width);
      await this.printTwoColumns('Date:', this.formatDate(billData.createdAt), width);
      await this.printTwoColumns('Time:', this.formatTime(billData.createdAt), width);
      await this.printTwoColumns('Cashier:', billData.createdByName || 'Staff', width);
      
      await this.printSeparator('-', width);
      
      // Customer
      await this.printTwoColumns('Customer:', billData.clientName || 'Guest', width);
      
      await this.printSeparator('=', width);
      
      // Items Header
      await this.printLine('ITEMS', { bold: true });
      await this.printSeparator('-', width);
      
      // Print each item
      for (const item of (billData.items || [])) {
        const itemName = item.name || item.serviceName || 'Item';
        const qty = item.quantity || 1;
        const price = item.price || item.finalPrice || 0;
        const total = qty * price;
        
        // Item name (may wrap)
        const nameLines = this.wrapText(itemName, width - 2);
        for (let i = 0; i < nameLines.length; i++) {
          if (i === 0) {
            await this.printLine(nameLines[i]);
          } else {
            await this.printLine('  ' + nameLines[i]);
          }
        }
        
        // Quantity x Price = Total
        const itemDetail = `  ${qty} x ${this.formatCurrency(price)}`;
        await this.printTwoColumns(itemDetail, this.formatCurrency(total), width);
      }
      
      await this.printSeparator('=', width);
      
      // Totals
      await this.printTwoColumns('Subtotal:', this.formatCurrency(billData.subtotal || 0), width);
      
      if (billData.discount > 0) {
        await this.printTwoColumns('Discount:', `-${this.formatCurrency(billData.discount)}`, width);
      }
      
      if (billData.promotionDiscount > 0) {
        await this.printTwoColumns('Promo:', `-${this.formatCurrency(billData.promotionDiscount)}`, width);
      }
      
      if (billData.loyaltyDiscount > 0) {
        await this.printTwoColumns('Loyalty:', `-${this.formatCurrency(billData.loyaltyDiscount)}`, width);
      }
      
      await this.printSeparator('-', width);
      
      // Grand Total
      await this.printLine('');
      await this.printTwoColumns('TOTAL:', this.formatCurrency(billData.total || billData.grandTotal || 0), width);
      await this.printLine('', { bold: true, doubleSize: true });
      
      await this.printSeparator('-', width);
      
      // Payment Info
      await this.printTwoColumns('Payment:', (billData.paymentMethod || 'Cash').toUpperCase(), width);
      
      if (billData.paymentMethod === 'cash' || billData.paymentMethod === 'Cash') {
        await this.printTwoColumns('Received:', this.formatCurrency(billData.amountReceived || 0), width);
        await this.printTwoColumns('Change:', this.formatCurrency(billData.change || 0), width);
      }
      
      await this.printSeparator('=', width);
      
      // Footer
      await this.feedPaper(1);
      await this.printLine('Thank you for visiting!', { center: true });
      await this.printLine("David's Salon", { center: true, bold: true });
      await this.feedPaper(1);
      await this.printLine('Please come again!', { center: true });
      
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
    return `P${(amount || 0).toFixed(2)}`;
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
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      printerName: this.printerName,
      isSupported: this.isSupported()
    };
  }
}

// Export singleton instance
export const thermalPrinter = new ThermalPrinterService();
export default thermalPrinter;
