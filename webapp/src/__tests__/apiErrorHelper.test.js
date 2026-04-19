import { describe, it, expect } from "vitest";
import { getBackendErrorMessage } from "../services/apiErrorHelper";
import i18n from "../i18n";

describe("apiErrorHelper", () => {
  it("translates known backend error codes", () => {
    expect(getBackendErrorMessage({ code: "ACCESS_TOKEN_REQUIRED" }, "leaderboard.error.loadFailed"))
      .toBe(i18n.t("auth.error.accessTokenRequired"));
    expect(getBackendErrorMessage({ code: "INVALID_FINISHED_MATCH_PAYLOAD" }, "users.error.scoreCalculationFailed"))
      .toBe(i18n.t("users.error.invalidFinishedMatchPayload"));
  });

  it("falls back to raw message when the code is unknown", () => {
    expect(getBackendErrorMessage({ code: "UNKNOWN_CODE", message: "Raw message" }, "leaderboard.error.loadFailed"))
      .toBe("Raw message");
  });

  it("falls back to translation key when no message is available", () => {
    expect(getBackendErrorMessage({}, "leaderboard.error.loadFailed"))
      .toBe(i18n.t("leaderboard.error.loadFailed"));
  });
});
