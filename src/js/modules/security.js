/**
 * Security Module
 * Handles CSP, input sanitization, and security measures
 */

/**
 * Sanitize HTML string to prevent XSS
 * @param {string} str - Input string
 * @returns {string} - Sanitized string
 */
export function sanitizeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Validate that a data URL is a safe image
 * @param {string} dataUrl - Data URL to validate
 * @returns {boolean}
 */
export function isValidImageDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') return false;
  // Only allow PNG data URLs (from canvas)
  return /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(dataUrl);
}

/**
 * Rate limiter to prevent abuse
 */
export class RateLimiter {
  constructor(maxActions, windowMs) {
    this.maxActions = maxActions;
    this.windowMs = windowMs;
    this.actions = [];
  }

  /**
   * Check if action is allowed
   * @returns {boolean}
   */
  canProceed() {
    const now = Date.now();
    this.actions = this.actions.filter(t => now - t < this.windowMs);
    if (this.actions.length >= this.maxActions) {
      return false;
    }
    this.actions.push(now);
    return true;
  }
}

/**
 * Prevent prototype pollution in object operations
 * @param {string} key - Object key to check
 * @returns {boolean} - Whether the key is safe
 */
export function isSafeObjectKey(key) {
  const dangerous = ['__proto__', 'constructor', 'prototype'];
  return !dangerous.includes(key);
}

/**
 * Secure random ID generator
 * @param {number} length - ID length
 * @returns {string}
 */
export function generateSecureId(length = 16) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('').slice(0, length);
}

/**
 * Freeze object to prevent modification
 * @param {Object} obj - Object to freeze
 * @returns {Object}
 */
export function deepFreeze(obj) {
  Object.getOwnPropertyNames(obj).forEach(name => {
    const value = obj[name];
    if (typeof value === 'object' && value !== null) {
      deepFreeze(value);
    }
  });
  return Object.freeze(obj);
}
