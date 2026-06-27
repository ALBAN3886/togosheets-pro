import { doc, getDoc, setDoc, serverTimestamp } from '../firebase/firestore.js';
import { COLLECTIONS, SETTINGS_DOCS } from '../config/collections.js';
import { tenantCollectionPath } from './_paths.js';

export async function saveSettings(db, tenantId, settingId, payload) {
  await setDoc(doc(db, tenantCollectionPath(tenantId, COLLECTIONS.SETTINGS), settingId), {
    ...payload,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export async function getSettings(db, tenantId, settingId = SETTINGS_DOCS.GENERAL) {
  const snap = await getDoc(doc(db, tenantCollectionPath(tenantId, COLLECTIONS.SETTINGS), settingId));
  return snap.exists() ? { id: snap.id, ...(snap.data() || {}) } : null;
}
