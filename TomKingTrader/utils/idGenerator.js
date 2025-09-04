/**
 * Secure ID Generator
 * Generates unique IDs without using Math.random() for production safety
 */

const crypto = require('crypto');

/**
 * Generate a secure unique ID using crypto
 * @param {string} prefix - Optional prefix for the ID
 * @returns {string} Unique ID string
 */
function generateSecureId(prefix = '') {
    // Use crypto for secure random generation
    const randomBytes = crypto.randomBytes(6);
    const randomStr = randomBytes.toString('base64')
        .replace(/[+/]/g, '')  // Remove chars that might cause issues
        .substring(0, 9);       // Take first 9 chars
    
    const timestamp = Date.now();
    return prefix ? `${prefix}-${timestamp}-${randomStr}` : `${timestamp}-${randomStr}`;
}

/**
 * Generate a simple counter-based ID
 * @param {string} prefix - Optional prefix for the ID
 * @returns {string} Sequential ID string
 */
let idCounter = 0;
function generateSequentialId(prefix = '') {
    const timestamp = Date.now();
    const count = (++idCounter).toString().padStart(6, '0');
    return prefix ? `${prefix}-${timestamp}-${count}` : `${timestamp}-${count}`;
}

/**
 * Generate ID for orders
 * @returns {string} Order ID
 */
function generateOrderId() {
    return generateSecureId('ORD');
}

/**
 * Generate ID for trades
 * @returns {string} Trade ID
 */
function generateTradeId() {
    return generateSecureId('TRD');
}

/**
 * Generate ID for positions
 * @returns {string} Position ID
 */
function generatePositionId() {
    return generateSecureId('POS');
}

/**
 * Generate ID for journal entries
 * @returns {string} Journal ID
 */
function generateJournalId() {
    return generateSecureId('JNL');
}

module.exports = {
    generateSecureId,
    generateSequentialId,
    generateOrderId,
    generateTradeId,
    generatePositionId,
    generateJournalId
};