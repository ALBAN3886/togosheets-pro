import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const FALLBACK_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyB5hpkRlFZ9HFRRbpQlvpHwMNDja37Nr2s',
  authDomain: 'gestion-salaire-9d3e9.firebaseapp.com',
  databaseURL: 'https://gestion-salaire-9d3e9-default-rtdb.firebaseio.com',
  projectId: 'gestion-salaire-9d3e9',
  storageBucket: 'gestion-salaire-9d3e9.firebasestorage.app',
  messagingSenderId: '1090226725870',
  appId: '1:1090226725870:web:d16c25eb46397b3f2de4ff',
  measurementId: 'G-MJCB7XVY6D'
};

export function resolveFirebaseConfig() {
  return window.__AET_FIREBASE_CONFIG__ || FALLBACK_FIREBASE_CONFIG;
}

export function getCommerceFirebaseApp() {
  return getApps().length ? getApp() : initializeApp(resolveFirebaseConfig());
}

export function getCommerceAuth() {
  return getAuth(getCommerceFirebaseApp());
}

export { onAuthStateChanged, signInWithEmailAndPassword, signOut };
