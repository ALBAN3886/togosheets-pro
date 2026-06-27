export function withMeta(payload = {}, extra = {}) {
  return {
    ...payload,
    ...extra,
  };
}

export function docToEntity(snapshot) {
  if (!snapshot?.exists()) return null;
  return { id: snapshot.id, ...(snapshot.data() || {}) };
}

export function docsToEntities(querySnapshot) {
  return (querySnapshot?.docs || []).map(doc => ({ id: doc.id, ...(doc.data() || {}) }));
}

export function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}
