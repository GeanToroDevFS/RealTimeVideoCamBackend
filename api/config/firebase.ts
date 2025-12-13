/**
 * @file Firebase Admin initialization module for video server.
 * @description
 * Loads environment variables, parses the Firebase service account JSON, validates
 * required environment variables, initializes the Firebase Admin SDK and exports
 * Firestore client and Auth for use in video operations.
 *
 * Expected environment variables:
 *  - FIREBASE_PROJECT_ID: Firebase project id (string)
 *  - FIREBASE_SERVICE_ACCOUNT_KEY: JSON string of the Firebase service account
 *
 * Usage:
 *  import { db, auth } from './config/firebase';
 */

import * as admin from 'firebase-admin';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import path from 'path';

console.log('🔹 [FIREBASE] Loading configuration for the video server...');
dotenv.config();

/**
 * Parses a raw service account string that may be plain JSON or base64 encoded JSON.
 *
 * @param raw Raw string provided through an environment variable.
 * @returns Parsed service account when successful, otherwise undefined.
 */
const tryParseServiceAccount = (raw: string): admin.ServiceAccount | undefined => {
  try {
    return JSON.parse(raw);
  } catch (jsonError) {
    try {
      const decoded = Buffer.from(raw, 'base64').toString('utf8');
      return JSON.parse(decoded);
    } catch (base64Error) {
      console.error('❌ [FIREBASE] Failed to parse the provided credential.');
      return undefined;
    }
  }
};

/**
 * Loads and parses a service account JSON file. Supports both absolute and relative paths.
 *
 * @param filepath Path to the service account file.
 * @returns Parsed service account when successful, otherwise undefined.
 */
const loadServiceAccountFromPath = (filepath: string): admin.ServiceAccount | undefined => {
  try {
    const absolutePath = path.isAbsolute(filepath) ? filepath : path.resolve(process.cwd(), filepath);
    const fileContents = readFileSync(absolutePath, 'utf8');
    return tryParseServiceAccount(fileContents);
  } catch (error) {
    console.error('❌ [FIREBASE] Failed to read the provided service account file:', error);
    return undefined;
  }
};

const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

let serviceAccount: admin.ServiceAccount | undefined;

if (rawServiceAccount) {
  serviceAccount = tryParseServiceAccount(rawServiceAccount);
}

if (!serviceAccount && serviceAccountPath) {
  serviceAccount = loadServiceAccountFromPath(serviceAccountPath);
}

const hasProjectId = Boolean(process.env.FIREBASE_PROJECT_ID);
const hasServiceAccount = Boolean(serviceAccount);

console.log('🔍 [FIREBASE] Checking environment variables...');
console.log(' - FIREBASE_PROJECT_ID:', hasProjectId ? '✅ OK' : '❌ MISSING');
console.log(' - FIREBASE_SERVICE_ACCOUNT:', hasServiceAccount ? '✅ OK' : '❌ MISSING');

/** Firestore client used by the video services. Null when Firebase is disabled. */
let db: admin.firestore.Firestore | null = null;
/** Firebase Authentication client exposed for future integration. Null when disabled. */
let auth: admin.auth.Auth | null = null;
/** Indicates whether Firebase-related functionality is available in the current run. */
let isFirebaseEnabled = false;

if (hasProjectId && hasServiceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount!),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });

  db = admin.firestore();
  auth = admin.auth();
  isFirebaseEnabled = true;

  console.log('✅ [FIREBASE] Firebase client initialized successfully for the video server.');
} else {
  console.warn('⚠️ [FIREBASE] Firebase was not initialized. Firestore validations will be skipped.');
}

export { db, auth, isFirebaseEnabled };