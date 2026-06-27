export function docToEntity(snapshot) {
  if (!snapshot?.exists()) return null;
  return { id: snapshot.id, ...(snapshot.data() || {}) };
}

export function docsToEntities(snapshot) {
  return (snapshot?.docs || []).map(doc => ({ id: doc.id, ...(doc.data() || {}) }));
}

export function toBool(value) {
  return !!value;
}
