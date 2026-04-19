import i18n from "../i18n";

const backendErrorKeyByCode = {
  MISSING_USERNAME: "auth.error.missingUsername",
  MISSING_EMAIL: "auth.error.missingEmail",
  MISSING_PASSWORD: "auth.error.missingPassword",
  EMAIL_ALREADY_REGISTERED: "auth.error.emailAlreadyRegistered",
  MISSING_LOGIN_DATA: "auth.error.missingLoginData",
  USER_NOT_FOUND: "auth.error.userNotFound",
  INVALID_CREDENTIALS: "auth.error.invalidCredentials",
  MISSING_REGISTRATION_DATA: "auth.error.missingRegistrationData",
  PASSWORDS_MISMATCH: "auth.error.passwordMismatch",
  REFRESH_TOKEN_REQUIRED: "auth.error.refreshTokenRequired",
  REFRESH_TOKEN_INVALID_OR_EXPIRED: "auth.error.refreshTokenInvalidOrExpired",
  REFRESH_TOKEN_INVALID: "auth.error.refreshTokenInvalid",
  REFRESH_SESSION_NOT_FOUND: "auth.error.refreshTokenSessionNotFound",
  REFRESH_TOKEN_REVOKED: "auth.error.refreshTokenRevoked",
  ACCESS_TOKEN_REQUIRED: "auth.error.accessTokenRequired",
  ACCESS_TOKEN_INVALID: "auth.error.accessTokenInvalid",
  INVALID_FINISHED_MATCH_PAYLOAD: "users.error.invalidFinishedMatchPayload",
};

export function getBackendErrorMessage(data, fallbackKey) {
  const messageKey = data?.code && backendErrorKeyByCode[data.code];
  if (messageKey) {
    return i18n.t(messageKey);
  }
  return data?.message || data?.error || i18n.t(fallbackKey);
}
