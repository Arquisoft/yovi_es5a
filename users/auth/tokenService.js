const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const sessionStore = require('./sessionStore');

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 3 * 24 * 60 * 60;

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'dev-access-secret-change-me';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'dev-refresh-secret-change-me';

function getAccessTokenTtl() {
  return ACCESS_TOKEN_TTL_SECONDS;
}

function getRefreshTokenTtl() {
  return REFRESH_TOKEN_TTL_SECONDS;
}

function issueAccessToken({ userId, username }) {
  return jwt.sign(
    {
      sub: String(userId),
      username,
      type: 'access',
    },
    ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL_SECONDS }
  );
}

function issueRefreshToken({ userId, username }) {
  const jti = crypto.randomUUID();
  const token = jwt.sign(
    {
      sub: String(userId),
      username,
      type: 'refresh',
      jti,
    },
    REFRESH_TOKEN_SECRET,
    { expiresIn: REFRESH_TOKEN_TTL_SECONDS }
  );

  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString();
  sessionStore.saveSession({
    jti,
    userId: String(userId),
    username,
    expiresAt,
    revokedAt: null,
    replacedBy: null,
  });

  return { token, jti, expiresAt };
}

function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_TOKEN_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_TOKEN_SECRET);
}

function issueTokenPair({ userId, username }) {
  const accessToken = issueAccessToken({ userId, username });
  const refreshTokenData = issueRefreshToken({ userId, username });

  return {
    accessToken,
    refreshToken: refreshTokenData.token,
    accessTokenExpiresIn: getAccessTokenTtl(),
    refreshTokenExpiresIn: getRefreshTokenTtl(),
  };
}

function rotateRefreshToken(refreshToken) {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (error) {
    const err = new Error('Refresh token inválido o expirado');
    err.statusCode = 401;
    throw err;
  }

  if (decoded.type !== 'refresh' || !decoded.jti) {
    const err = new Error('Refresh token inválido');
    err.statusCode = 401;
    throw err;
  }

  const currentSession = sessionStore.getSessionByJti(decoded.jti);
  if (!currentSession) {
    const err = new Error('Sesión de refresh token no encontrada');
    err.statusCode = 401;
    throw err;
  }

  if (currentSession.revokedAt) {
    const err = new Error('Refresh token reutilizado o revocado');
    err.statusCode = 401;
    throw err;
  }

  const replacement = issueRefreshToken({
    userId: currentSession.userId,
    username: currentSession.username,
  });

  sessionStore.revokeSession(currentSession.jti, replacement.jti);

  return {
    accessToken: issueAccessToken({
      userId: currentSession.userId,
      username: currentSession.username,
    }),
    refreshToken: replacement.token,
    accessTokenExpiresIn: getAccessTokenTtl(),
    refreshTokenExpiresIn: getRefreshTokenTtl(),
  };
}

function revokeRefreshToken(refreshToken) {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    return false;
  }

  if (!decoded?.jti) {
    return false;
  }

  const revoked = sessionStore.revokeSession(decoded.jti);
  return Boolean(revoked);
}

module.exports = {
  getAccessTokenTtl,
  getRefreshTokenTtl,
  verifyAccessToken,
  verifyRefreshToken,
  issueTokenPair,
  rotateRefreshToken,
  revokeRefreshToken,
};
