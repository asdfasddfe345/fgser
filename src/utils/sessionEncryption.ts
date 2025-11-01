// src/utils/sessionEncryption.ts
import CryptoJS from 'crypto-js';

/**
 * Encryption utilities for platform session tokens
 * Uses AES-256-GCM for secure encryption with user-specific keys
 */

/**
 * Derives an encryption key from master key and user ID
 * This ensures each user has a unique encryption key
 */
export function deriveEncryptionKey(userId: string, masterKey: string): string {
  return CryptoJS.SHA256(masterKey + userId).toString();
}

/**
 * Encrypts session data using AES-256
 * @param sessionData - The session data to encrypt (cookies, tokens, etc.)
 * @param userId - User ID for key derivation
 * @param masterKey - Master encryption key (from env)
 * @returns Encrypted string in format: iv:encryptedData
 */
export function encryptSessionData(
  sessionData: any,
  userId: string,
  masterKey: string
): string {
  try {
    const dataString = JSON.stringify(sessionData);
    const key = deriveEncryptionKey(userId, masterKey);

    // Encrypt using AES with random IV
    const encrypted = CryptoJS.AES.encrypt(dataString, key);

    return encrypted.toString();
  } catch (error) {
    console.error('Session encryption failed:', error);
    throw new Error('Failed to encrypt session data');
  }
}

/**
 * Decrypts session data
 * @param encryptedData - The encrypted session string
 * @param userId - User ID for key derivation
 * @param masterKey - Master encryption key (from env)
 * @returns Decrypted session data object
 */
export function decryptSessionData(
  encryptedData: string,
  userId: string,
  masterKey: string
): any {
  try {
    const key = deriveEncryptionKey(userId, masterKey);

    // Decrypt using AES
    const decrypted = CryptoJS.AES.decrypt(encryptedData, key);
    const dataString = decrypted.toString(CryptoJS.enc.Utf8);

    if (!dataString) {
      throw new Error('Decryption produced empty result');
    }

    return JSON.parse(dataString);
  } catch (error) {
    console.error('Session decryption failed:', error);
    throw new Error('Failed to decrypt session data');
  }
}

/**
 * Validates that encrypted data can be decrypted successfully
 */
export function validateEncryptedSession(
  encryptedData: string,
  userId: string,
  masterKey: string
): boolean {
  try {
    decryptSessionData(encryptedData, userId, masterKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generates a secure random session ID
 */
export function generateSessionId(): string {
  return CryptoJS.lib.WordArray.random(16).toString();
}
