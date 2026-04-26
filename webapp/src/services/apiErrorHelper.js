import i18n from "../i18n";

// Esto centraliza la lógica de interpretación de errores provenientes del backend, permitiendo mapear códigos de error a mensajes traducidos y proporcionando un fallback adecuado. De esta forma, se mejora la experiencia del usuario al mostrar mensajes de error claros y localizados, incluso para errores no previstos o sin mensaje específico.
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
  INVALID_DIFFICULTY: "users.error.invalidDifficulty",
  INVALID_GAME_PLAYERS: "users.error.invalidGamePlayers",
  MISSING_GAME_PARAMETERS: "users.error.missingGameParameters",
  MISSING_FINISH_GAME_DATA: "users.error.invalidFinishedMatchPayload",
  INVALID_WINNER: "users.error.invalidWinner",
  TOKEN_MISMATCH_PLAYER_NAME: "users.error.tokenMismatchPlayerName",
  NO_BOT_FOR_DIFFICULTY: "users.error.noBotForDifficulty",
  UNSUPPORTED_GAME_MODE: "users.error.unsupportedGameMode",
  DATABASE_ERROR: "app.error.databaseError",
  INVALID_YEN_FORMAT: "game.error.invalidYenFormat",
  GAME_ALREADY_OVER: "game.error.gameAlreadyOver",
  BOT_NOT_FOUND: "game.error.botNotFound",
  NO_VALID_BOT_MOVES: "game.error.noValidBotMove",
  INVALID_BOT_MOVE: "game.error.invalidBotMove",
  UNSUPPORTED_API_VERSION: "game.error.unsupportedApiVersion",
  INVALID_POSITION_JSON: "game.error.invalidPositionJson",
  GAME_MOVE_ERROR: "game.error.serverMoveFailed",
};

export function getBackendErrorMessage(data, fallbackKey) {
  const messageKey = data?.code && backendErrorKeyByCode[data.code];
  if (messageKey) {
    return i18n.t(messageKey);
  }
  return data?.message || data?.error || i18n.t(fallbackKey);
}
