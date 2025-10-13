import fs from 'fs';
import path from 'path';
import os from 'os';
import fetch from 'node-fetch';
import { logDebug, logError, logInfo } from './logger.js';
import { initializeKeyManager, getKeyManager } from './key-manager.js';

// State management for API key and refresh
let currentApiKey = null;
let currentRefreshToken = null;
let lastRefreshTime = null;
let clientId = null;
let authSource = null; // 'env' or 'file' or 'factory_key' or 'factory_keys_file' or 'client'
let authFilePath = null;
let factoryApiKey = null; // From FACTORY_API_KEY environment variable (deprecated for multi-key)
let lastSelectedKey = null; // Track last selected key for result recording

const REFRESH_URL = 'https://api.workos.com/user_management/authenticate';
const REFRESH_INTERVAL_HOURS = 6; // Refresh every 6 hours
const TOKEN_VALID_HOURS = 8; // Token valid for 8 hours

/**
 * Generate a ULID (Universally Unique Lexicographically Sortable Identifier)
 * Format: 26 characters using Crockford's Base32
 * First 10 chars: timestamp (48 bits)
 * Last 16 chars: random (80 bits)
 */
function generateULID() {
  // Crockford's Base32 alphabet (no I, L, O, U to avoid confusion)
  const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  
  // Get timestamp in milliseconds
  const timestamp = Date.now();
  
  // Encode timestamp to 10 characters
  let time = '';
  let ts = timestamp;
  for (let i = 9; i >= 0; i--) {
    const mod = ts % 32;
    time = ENCODING[mod] + time;
    ts = Math.floor(ts / 32);
  }
  
  // Generate 16 random characters
  let randomPart = '';
  for (let i = 0; i < 16; i++) {
    const rand = Math.floor(Math.random() * 32);
    randomPart += ENCODING[rand];
  }
  
  return time + randomPart;
}

/**
 * Generate a client ID in format: client_01{ULID}
 */
function generateClientId() {
  const ulid = generateULID();
  return `client_01${ulid}`;
}

/**
 * Load auth configuration with priority system
 * Priority: FACTORY_API_KEY > factory_keys.txt > refresh token mechanism > client authorization
 */
function loadAuthConfig() {
  // 1. Check FACTORY_API_KEY environment variable (highest priority)
  const factoryKey = process.env.FACTORY_API_KEY;
  if (factoryKey && factoryKey.trim() !== '') {
    // 支持分号分隔多个key
    const keys = factoryKey.split(';')
      .map(k => k.trim())
      .filter(k => k !== '');
    
    if (keys.length > 0) {
      logInfo(`Using API key(s) from FACTORY_API_KEY environment variable: ${keys.length} key(s)`);
      authSource = 'factory_key';
      return { type: 'factory_key', value: keys };
    }
  }

  // 2. Check factory_keys.txt file in project directory
  const keysFilePath = path.join(process.cwd(), 'factory_keys.txt');
  try {
    if (fs.existsSync(keysFilePath)) {
      const keysContent = fs.readFileSync(keysFilePath, 'utf-8');
      const keys = keysContent.split('\n')
        .map(k => k.trim())
        .filter(k => k !== '' && !k.startsWith('#')); // 过滤空行和注释行
      
      if (keys.length > 0) {
        logInfo(`Using API key(s) from factory_keys.txt: ${keys.length} key(s)`);
        authSource = 'factory_keys_file';
        return { type: 'factory_key', value: keys };
      }
    }
  } catch (error) {
    logError('Error reading factory_keys.txt', error);
  }

  // 3. Check refresh token mechanism (DROID_REFRESH_KEY)
  const envRefreshKey = process.env.DROID_REFRESH_KEY;
  if (envRefreshKey && envRefreshKey.trim() !== '') {
    logInfo('Using refresh token from DROID_REFRESH_KEY environment variable');
    authSource = 'env';
    authFilePath = path.join(process.cwd(), 'auth.json');
    return { type: 'refresh', value: envRefreshKey.trim() };
  }

  // 4. Check ~/.factory/auth.json
  const homeDir = os.homedir();
  const factoryAuthPath = path.join(homeDir, '.factory', 'auth.json');
  
  try {
    if (fs.existsSync(factoryAuthPath)) {
      const authContent = fs.readFileSync(factoryAuthPath, 'utf-8');
      const authData = JSON.parse(authContent);
      
      if (authData.refresh_token && authData.refresh_token.trim() !== '') {
        logInfo('Using refresh token from ~/.factory/auth.json');
        authSource = 'file';
        authFilePath = factoryAuthPath;
        
        // Also load access_token if available
        if (authData.access_token) {
          currentApiKey = authData.access_token.trim();
        }
        
        return { type: 'refresh', value: authData.refresh_token.trim() };
      }
    }
  } catch (error) {
    logError('Error reading ~/.factory/auth.json', error);
  }

  // 5. No configured auth found - will use client authorization
  logInfo('No auth configuration found, will use client authorization headers');
  authSource = 'client';
  return { type: 'client', value: null };
}

/**
 * Refresh API key using refresh token
 */
async function refreshApiKey() {
  if (!currentRefreshToken) {
    throw new Error('No refresh token available');
  }

  if (!clientId) {
    clientId = 'client_01HNM792M5G5G1A2THWPXKFMXB';
    logDebug(`Using fixed client ID: ${clientId}`);
  }

  logInfo('Refreshing API key...');

  try {
    // Create form data
    const formData = new URLSearchParams();
    formData.append('grant_type', 'refresh_token');
    formData.append('refresh_token', currentRefreshToken);
    formData.append('client_id', clientId);

    const response = await fetch(REFRESH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to refresh token: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    // Update tokens
    currentApiKey = data.access_token;
    currentRefreshToken = data.refresh_token;
    lastRefreshTime = Date.now();

    // Log user info
    if (data.user) {
      logInfo(`Authenticated as: ${data.user.email} (${data.user.first_name} ${data.user.last_name})`);
      logInfo(`User ID: ${data.user.id}`);
      logInfo(`Organization ID: ${data.organization_id}`);
    }

    // Save tokens to file
    saveTokens(data.access_token, data.refresh_token);

    logInfo(`New Refresh-Key: ${currentRefreshToken}`);
    logInfo('API key refreshed successfully');
    return data.access_token;

  } catch (error) {
    logError('Failed to refresh API key', error);
    throw error;
  }
}

/**
 * Save tokens to appropriate file
 */
function saveTokens(accessToken, refreshToken) {
  try {
    const authData = {
      access_token: accessToken,
      refresh_token: refreshToken,
      last_updated: new Date().toISOString()
    };

    // Ensure directory exists
    const dir = path.dirname(authFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // If saving to ~/.factory/auth.json, preserve other fields
    if (authSource === 'file' && fs.existsSync(authFilePath)) {
      try {
        const existingData = JSON.parse(fs.readFileSync(authFilePath, 'utf-8'));
        Object.assign(authData, existingData, {
          access_token: accessToken,
          refresh_token: refreshToken,
          last_updated: authData.last_updated
        });
      } catch (error) {
        logError('Error reading existing auth file, will overwrite', error);
      }
    }

    fs.writeFileSync(authFilePath, JSON.stringify(authData, null, 2), 'utf-8');
    logDebug(`Tokens saved to ${authFilePath}`);

  } catch (error) {
    logError('Failed to save tokens', error);
  }
}

/**
 * Check if API key needs refresh (older than 6 hours)
 */
function shouldRefresh() {
  if (!lastRefreshTime) {
    return true;
  }

  const hoursSinceRefresh = (Date.now() - lastRefreshTime) / (1000 * 60 * 60);
  return hoursSinceRefresh >= REFRESH_INTERVAL_HOURS;
}

/**
 * Initialize auth system - load auth config and setup initial API key if needed
 * @param {string} roundRobinAlgorithm - Key selection algorithm: 'weighted' or 'simple'
 * @param {boolean} removeOn402 - Whether to remove keys on 402 response
 */
export async function initializeAuth(roundRobinAlgorithm = 'weighted', removeOn402 = true) {
  try {
    const authConfig = loadAuthConfig();
    
    if (authConfig.type === 'factory_key') {
      // Using FACTORY_API_KEY or factory_keys.txt
      const keys = authConfig.value;
      if (Array.isArray(keys) && keys.length > 0) {
        // Initialize KeyManager with loaded keys
        initializeKeyManager(keys, roundRobinAlgorithm, removeOn402);
        logInfo(`Auth system initialized with ${keys.length} API key(s), algorithm: ${roundRobinAlgorithm}, removeOn402: ${removeOn402}`);
      } else {
        logError('Invalid keys configuration', new Error('Keys should be an array'));
      }
    } else if (authConfig.type === 'refresh') {
      // Using refresh token mechanism
      currentRefreshToken = authConfig.value;
      
      // Always refresh on startup to get fresh token
      await refreshApiKey();
      logInfo('Auth system initialized with refresh token mechanism');
    } else {
      // Using client authorization, no setup needed
      logInfo('Auth system initialized for client authorization mode');
    }
    
    logInfo('Auth system initialized successfully');
  } catch (error) {
    logError('Failed to initialize auth system', error);
    throw error;
  }
}

/**
 * Get API key based on configured authorization method
 * @param {string} clientAuthorization - Authorization header from client request (optional)
 */
export async function getApiKey(clientAuthorization = null) {
  // Priority 1: FACTORY_API_KEY or factory_keys.txt (using KeyManager)
  if (authSource === 'factory_key' || authSource === 'factory_keys_file') {
    const keyManager = getKeyManager();
    if (keyManager) {
      const selectedKey = keyManager.selectKey();
      lastSelectedKey = selectedKey; // Track for result recording
      return `Bearer ${selectedKey}`;
    }
    // Fallback for single key (backward compatibility)
    if (factoryApiKey) {
      lastSelectedKey = factoryApiKey;
      return `Bearer ${factoryApiKey}`;
    }
  }
  
  // Priority 2: Refresh token mechanism
  if (authSource === 'env' || authSource === 'file') {
    // Check if we need to refresh
    if (shouldRefresh()) {
      logInfo('API key needs refresh (6+ hours old)');
      await refreshApiKey();
    }

    if (!currentApiKey) {
      throw new Error('No API key available from refresh token mechanism.');
    }

    return `Bearer ${currentApiKey}`;
  }
  
  // Priority 3: Client authorization header
  if (clientAuthorization) {
    logDebug('Using client authorization header');
    return clientAuthorization;
  }
  
  // No authorization available
  throw new Error('No authorization available. Please configure FACTORY_API_KEY, refresh token, or provide client authorization.');
}

/**
 * Record request result for key statistics
 * @param {string} endpoint - The endpoint URL
 * @param {boolean} success - Whether the request was successful (2xx status)
 * @param {number} statusCode - HTTP status code
 */
export function recordRequestResult(endpoint, success, statusCode) {
  if ((authSource === 'factory_key' || authSource === 'factory_keys_file') && lastSelectedKey) {
    const keyManager = getKeyManager();
    if (keyManager) {
      keyManager.recordResult(lastSelectedKey, endpoint, success, statusCode);
    }
  }
}
