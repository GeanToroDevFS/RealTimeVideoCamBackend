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

console.log('🔹 [FIREBASE] Cargando configuración para servidor de video...');
dotenv.config();

/**
 * Parse the Firebase service account JSON from the environment.
 *
 * @returns {admin.ServiceAccount} Parsed service account object.
 * @throws {SyntaxError} If the JSON in FIREBASE_SERVICE_ACCOUNT_KEY is invalid.
 */
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);

console.log('🔍 [FIREBASE] Verificando variables...');
console.log(' - FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID ? '✅ OK' : '❌ NO DEFINIDA');
console.log(' - FIREBASE_SERVICE_ACCOUNT_KEY:', serviceAccount ? '✅ OK' : '❌ NO DEFINIDA');

/**
 * Ensure required environment variables are present before initializing Firebase.
 * If any required variable is missing, an Error is thrown to prevent the app from continuing.
 *
 * @throws {Error} If FIREBASE_PROJECT_ID or FIREBASE_SERVICE_ACCOUNT_KEY is missing.
 */
if (!process.env.FIREBASE_PROJECT_ID || !serviceAccount) {
  throw new Error('❌ Faltan variables de entorno para conectar con Firebase.');
}

/**
 * Initialize the Firebase Admin SDK with the provided service account and project ID.
 * The initialization attaches credentials and project configuration to the global admin instance.
 */
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.FIREBASE_PROJECT_ID,
});

/**
 * Firestore client instance to perform database operations for video.
 * @type {admin.firestore.Firestore}
 */
const db = admin.firestore();

/**
 * Firebase Authentication client instance to manage users and tokens (for future use).
 * @type {admin.auth.Auth}
 */
const auth = admin.auth();

console.log('✅ [FIREBASE] Cliente inicializado correctamente para servidor de video.');

// Export the db and auth instances
export { db, auth };