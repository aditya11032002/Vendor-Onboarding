const fs = require('fs');
const path = require('path');

/**
 * SIMULATED MOCK OCR PROCESSOR
 * Simulates processing delay and uses file names to test different validation paths:
 * - 'match' (or default) -> extracts values matching what user entered (success)
 * - 'mismatch' -> extracts different values (triggers mismatch validation)
 * - 'blurry' / 'invalid' -> triggers OCR reading failure
 */
const mockOcrProcessor = async (fileName, userEnteredValue, documentType) => {
  // Simulate 1.5 seconds network/CPU latency
  await new Promise(resolve => setTimeout(resolve, 1500));

  const cleanName = (fileName || '').toLowerCase().trim();

  // 1. Simulate unreadable/blurry documents
  if (cleanName.includes('blurry') || cleanName.includes('invalid')) {
    return {
      success: false,
      error: `OCR Read Failure: Uploaded ${documentType} document is blurry, shadowed, or text is unreadable.`,
      extractedValue: null
    };
  }

  // 2. Simulate mismatch documents
  if (cleanName.includes('mismatch')) {
    const fakeValue = documentType === 'PAN' ? 'XYZPD9876C' : '27XYZPD9876C1ZD';
    return {
      success: true,
      error: null,
      extractedValue: fakeValue
    };
  }

  // 3. Success path: extract the exact value matching the form input
  return {
    success: true,
    error: null,
    extractedValue: userEnteredValue || (documentType === 'PAN' ? 'AAACT1234A' : '27AAACT1234A1Z9')
  };
};

/**
 * TESSERACT OCR PROCESSOR
 * Performs text extraction locally using the tesseract.js package.
 * Requires: npm install tesseract.js
 */
const tesseractOcrProcessor = async (imageBufferOrPath, userEnteredValue, documentType) => {
  try {
    const Tesseract = require('tesseract.js');
    console.log(`[Tesseract OCR] Scanning image for ${documentType}...`);

    // Perform text recognition
    const { data: { text } } = await Tesseract.recognize(
      imageBufferOrPath,
      'eng'
    );

    console.log(`[Tesseract OCR] Raw text detected for ${documentType}:`, text);

    if (!text || text.trim().length === 0) {
      return {
        success: false,
        error: 'OCR Read Failure: No text detected in the uploaded image.',
        extractedValue: null
      };
    }

    const cleanText = text.toUpperCase();

    // Parse values from text block using regex patterns
    if (documentType === 'PAN') {
      const panRegex = /[A-Z]{5}[0-9]{4}[A-Z]{1}/;
      const match = cleanText.match(panRegex);
      if (match) {
        return { success: true, error: null, extractedValue: match[0] };
      }
      return {
        success: false,
        error: 'OCR Read Failure: Could not locate a valid PAN format (ABCDE1234F) in document text.',
        extractedValue: null
      };
    } else if (documentType === 'GSTIN') {
      const gstinRegex = /[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}/;
      const match = cleanText.match(gstinRegex);
      if (match) {
        return { success: true, error: null, extractedValue: match[0] };
      }
      return {
        success: false,
        error: 'OCR Read Failure: Could not locate a valid 15-digit GSTIN format in certificate text.',
        extractedValue: null
      };
    }

    return {
      success: false,
      error: 'OCR Read Failure: Unsupported document type requested.',
      extractedValue: null
    };

  } catch (err) {
    console.error('[Tesseract OCR Error]:', err);
    return {
      success: false,
      error: `OCR System Error: ${err.message}`,
      extractedValue: null
    };
  }
};

// Switch activeProcessor: 'mock' (rules-based file name simulation) or 'tesseract' (real local OCR)
const ACTIVE_MODE = 'tesseract'; // 'mock' or 'tesseract'

module.exports = {
  processOcr: async (imageBufferOrFileName, userEnteredValue, documentType) => {
    if (ACTIVE_MODE === 'tesseract') {
      return await tesseractOcrProcessor(imageBufferOrFileName, userEnteredValue, documentType);
    } else {
      // In mock mode, we expect imageBufferOrFileName to be the filename string (like "pan_match.jpg")
      return await mockOcrProcessor(imageBufferOrFileName, userEnteredValue, documentType);
    }
  }
};
