// tests/setup.js
// Setup file for Jest tests

// Import Jest globals
import { jest } from '@jest/globals';

// Import TextEncoder/TextDecoder for Node environment
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Import the webextension mock
import 'jest-webextension-mock';

// Import test utilities
import './utils/test-utils.js';

// Setup Chrome API mocks
global.chrome = {
  ...chrome,
  runtime: {
    ...chrome.runtime,
    getManifest: jest.fn(() => ({
      version: '2.0.0',
      name: 'DOM Style Injector Extension'
    }))
  },
  scripting: {
    executeScript: jest.fn(() => Promise.resolve([{ result: { success: true } }]))
  }
};

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Setup DOM environment
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();

  // Reset localStorage
  localStorage.clear();

  // Reset sessionStorage
  sessionStorage.clear();
});

// Cleanup after tests
afterEach(() => {
  // Clean up any timers
  jest.clearAllTimers();
});

// Global test utilities
global.mockFetch = (data, ok = true) => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok,
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
    })
  );
};

// Mock chrome.storage API with more realistic behavior
chrome.storage.local.get.mockImplementation((keys, callback) => {
  const result = {};
  if (callback) {
    callback(result);
  }
  return Promise.resolve(result);
});

chrome.storage.local.set.mockImplementation((items, callback) => {
  if (callback) {
    callback();
  }
  return Promise.resolve();
});

chrome.storage.sync.get.mockImplementation((keys, callback) => {
  const result = {};
  if (callback) {
    callback(result);
  }
  return Promise.resolve(result);
});

chrome.storage.sync.set.mockImplementation((items, callback) => {
  if (callback) {
    callback();
  }
  return Promise.resolve();
});