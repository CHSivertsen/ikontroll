import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!serviceAccountJson) {
  throw new Error(
    'FIREBASE_SERVICE_ACCOUNT_KEY is not set. Add it to your env to enable admin APIs.',
  );
}

const adminConfig = {
  credential: cert(JSON.parse(serviceAccountJson)),
};

const adminApp = getApps().length ? getApp() : initializeApp(adminConfig);

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);

