/**
 * PDF Signer Module
 * Embeds signatures into PDF documents using pdf-lib
 */

import { PDFDocument } from 'pdf-lib';

export class PdfSigner {
  constructor() {
    this.originalPdfBytes = null;
    this.signatures = []; // {page, x, y, width, height, imageDataUrl}
  }

  /**
   * Load original PDF bytes
   * @param {ArrayBuffer} data - PDF file data
   */
  loadPdf(data) {
    this.originalPdfBytes = new Uint8Array(data);
    this.signatures = [];
  }

  /**
   * Add a signature placement
   * @param {Object} sig - Signature data
   * @param {number} sig.page - Page number (1-indexed)
   * @param {number} sig.x - X position (percentage of page width)
   * @param {number} sig.y - Y position (percentage of page height)
   * @param {number} sig.width - Width (percentage of page width)
   * @param {number} sig.height - Height (percentage of page height)
   * @param {string} sig.imageDataUrl - PNG data URL of signature
   */
  addSignature(sig) {
    this.signatures.push({ ...sig });
  }

  /**
   * Remove a signature by index
   * @param {number} index - Signature index
   */
  removeSignature(index) {
    if (index >= 0 && index < this.signatures.length) {
      this.signatures.splice(index, 1);
    }
  }

  /**
   * Update signature position/size
   * @param {number} index - Signature index
   * @param {Object} updates - Updated properties
   */
  updateSignature(index, updates) {
    if (index >= 0 && index < this.signatures.length) {
      Object.assign(this.signatures[index], updates);
    }
  }

  /**
   * Generate signed PDF
   * @returns {Promise<Uint8Array>} - Signed PDF bytes
   */
  async generateSignedPdf() {
    if (!this.originalPdfBytes) {
      throw new Error('Tidak ada PDF yang dimuat');
    }

    if (this.signatures.length === 0) {
      throw new Error('Tidak ada tanda tangan yang ditambahkan');
    }

    try {
      const pdfDoc = await PDFDocument.load(this.originalPdfBytes, {
        ignoreEncryption: true
      });

      const pages = pdfDoc.getPages();

      for (const sig of this.signatures) {
        const pageIndex = sig.page - 1;
        if (pageIndex < 0 || pageIndex >= pages.length) continue;

        const page = pages[pageIndex];
        const { width: pageWidth, height: pageHeight } = page.getSize();

        // Convert data URL to bytes
        const imageBytes = this._dataUrlToBytes(sig.imageDataUrl);
        const pngImage = await pdfDoc.embedPng(imageBytes);

        // Calculate actual position (convert from percentage)
        const sigWidth = (sig.width / 100) * pageWidth;
        const sigHeight = (sig.height / 100) * pageHeight;
        const sigX = (sig.x / 100) * pageWidth;
        // PDF coordinate system starts from bottom-left
        const sigY = pageHeight - ((sig.y / 100) * pageHeight) - sigHeight;

        page.drawImage(pngImage, {
          x: sigX,
          y: sigY,
          width: sigWidth,
          height: sigHeight
        });
      }

      return await pdfDoc.save();
    } catch (error) {
      throw new Error('Gagal membuat PDF: ' + error.message);
    }
  }

  /**
   * Convert data URL to Uint8Array
   * @param {string} dataUrl - Data URL
   * @returns {Uint8Array}
   */
  _dataUrlToBytes(dataUrl) {
    const base64 = dataUrl.split(',')[1];
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Get signature count
   * @returns {number}
   */
  getSignatureCount() {
    return this.signatures.length;
  }

  /**
   * Clear all signatures
   */
  clearSignatures() {
    this.signatures = [];
  }

  /**
   * Cleanup
   */
  destroy() {
    this.originalPdfBytes = null;
    this.signatures = [];
  }
}
