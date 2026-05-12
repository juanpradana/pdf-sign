/**
 * File Handler Utility
 * Secure file validation and processing
 */

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_MIME_TYPES = ['application/pdf'];
const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46]; // %PDF

/**
 * Validate a file is a legitimate PDF
 * @param {File} file - File to validate
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
export async function validatePdfFile(file) {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File terlalu besar. Maksimal 20MB.' };
  }

  if (file.size === 0) {
    return { valid: false, error: 'File kosong.' };
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type) && !file.name.toLowerCase().endsWith('.pdf')) {
    return { valid: false, error: 'Hanya file PDF yang diperbolehkan.' };
  }

  // Check magic bytes (file signature)
  try {
    const header = await readFileHeader(file, 4);
    const isValidPdf = PDF_MAGIC_BYTES.every((byte, i) => header[i] === byte);
    if (!isValidPdf) {
      return { valid: false, error: 'File bukan PDF yang valid.' };
    }
  } catch {
    return { valid: false, error: 'Gagal membaca file.' };
  }

  return { valid: true };
}

/**
 * Read the first N bytes of a file
 * @param {File} file - File to read
 * @param {number} bytes - Number of bytes to read
 * @returns {Promise<Uint8Array>}
 */
function readFileHeader(file, bytes) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result));
    reader.onerror = () => reject(new Error('Read error'));
    reader.readAsArrayBuffer(file.slice(0, bytes));
  });
}

/**
 * Read file as ArrayBuffer
 * @param {File} file - File to read
 * @returns {Promise<ArrayBuffer>}
 */
export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Format file size to human readable
 * @param {number} bytes - File size in bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Sanitize filename for display (prevent XSS)
 * @param {string} name - Original filename
 * @returns {string}
 */
export function sanitizeFilename(name) {
  return name.replace(/[<>"'&]/g, '').slice(0, 100);
}

/**
 * Trigger file download
 * @param {Uint8Array} data - File data
 * @param {string} filename - Download filename
 */
export function downloadFile(data, filename) {
  const blob = new Blob([data], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = sanitizeFilename(filename);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after a short delay to ensure download starts
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
