export function normalizeSession(authUser) {
  return {
    uid: authUser?.uid || null,
    email: authUser?.email || '',
    displayName: authUser?.displayName || '',
  };
}

export function requireAuthUser(authUser) {
  if (!authUser?.uid) {
    throw new Error('Session utilisateur requise');
  }
  return authUser;
}
