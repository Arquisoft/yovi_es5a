const sessionsByJti = new Map();

function saveSession(session) {
  sessionsByJti.set(session.jti, session);
  return session;
}

function getSessionByJti(jti) {
  return sessionsByJti.get(jti) || null;
}

function revokeSession(jti, replacedBy = null) {
  const session = sessionsByJti.get(jti);
  if (!session) {
    return null;
  }

  const revokedSession = {
    ...session,
    revokedAt: new Date().toISOString(),
    replacedBy,
  };
  sessionsByJti.set(jti, revokedSession);
  return revokedSession;
}

function clearSessions() {
  sessionsByJti.clear();
}

module.exports = {
  saveSession,
  getSessionByJti,
  revokeSession,
  clearSessions,
};
