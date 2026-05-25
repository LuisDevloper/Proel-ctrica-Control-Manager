/** Sesión en memoria del main process tras login. */
let authSession = null;

function getAuthSession() {
  return authSession;
}

function setAuthSession(session) {
  authSession = session;
}

function clearAuthSession() {
  authSession = null;
}

module.exports = {
  getAuthSession,
  setAuthSession,
  clearAuthSession,
};
