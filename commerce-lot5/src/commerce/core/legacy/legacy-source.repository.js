import { doc, getDoc } from '../firebase/firestore.js';

export async function getLegacyCommerceData(db, ownerUid) {
  const snap = await getDoc(doc(db, 'commerce_data', ownerUid));
  return snap.exists() ? snap.data() || {} : null;
}
