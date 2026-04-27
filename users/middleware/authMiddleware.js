const tokenService = require('../auth/tokenService');

function getBearerToken(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') {
    return null;
  }

  const [scheme, token] = headerValue.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

function authenticateAccessToken(req, res, next) {
  const token = getBearerToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ message: 'Access token required', code: 'ACCESS_TOKEN_REQUIRED' });
  }

  try {
    const payload = tokenService.verifyAccessToken(token);
    req.auth = {
      userId: payload.sub,
      username: payload.username,
    };
    return next();
  } catch {
    return res.status(401).json({ message: 'Access token invalid or expired', code: 'ACCESS_TOKEN_INVALID' });
  }
}

module.exports = {
  authenticateAccessToken,
  getBearerToken,
};
