import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { login, register } from "../services/authApi";
import { useSessionStore } from "../store/sessionStore";

import "./AuthPage.css";

function isEmail(value) {
  const str = String(value || "").trim();

  if (str.length > 320) return false;

  return /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,63}$/.test(str);
}

export default function AuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setSession = useSessionStore((state) => state.setSession);

  const [activeTab, setActiveTab] = React.useState("login");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [successMessage, setSuccessMessage] = React.useState("");

  const [loginIdentifier, setLoginIdentifier] = React.useState("");
  const [loginPassword, setLoginPassword] = React.useState("");

  const [registerEmail, setRegisterEmail] = React.useState("");
  const [registerUsername, setRegisterUsername] = React.useState("");
  const [registerPassword, setRegisterPassword] = React.useState("");
  const [registerPasswordRepeat, setRegisterPasswordRepeat] = React.useState("");

  function clearMessages() {
    setError("");
    setSuccessMessage("");
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    clearMessages();

    if (!loginIdentifier.trim()) {
      setError(t("auth.error.missingUsername"));
      return;
    }

    if (!loginPassword.trim()) {
      setError(t("auth.error.missingPassword"));
      return;
    }

    setLoading(true);
    try {
      const response = await login({
        identifier: loginIdentifier.trim(),
        password: loginPassword,
      });

      setSession({
        user: response.user,
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        accessTokenExpiresIn: response.accessTokenExpiresIn,
        refreshTokenExpiresIn: response.refreshTokenExpiresIn,
      });

      navigate("/");
    } catch (err) {
      setError(err.message || t("auth.error.loginFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterSubmit(event) {
    event.preventDefault();
    clearMessages();

    if (!isEmail(registerEmail)) {
      setError(t("auth.error.invalidEmail"));
      return;
    }

    if (!registerUsername.trim()) {
      setError(t("auth.error.missingRegisterUsername"));
      return;
    }

    if (registerPassword.length < 6) {
      setError(t("auth.error.passwordTooShort"));
      return;
    }

    if (registerPassword !== registerPasswordRepeat) {
      setError(t("auth.error.passwordMismatch"));
      return;
    }

    setLoading(true);
    try {
      await register({
        email: registerEmail.trim(),
        username: registerUsername.trim(),
        password: registerPassword,
        confirmPassword: registerPasswordRepeat,
      });

      setActiveTab("login");
      setSuccessMessage(t("auth.success.registrationSent"));
    } catch (err) {
      setError(err.message || t("auth.error.registrationFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="authPage">
      <article className="authCard">
       
        <header className="authHeader">
          <h1 className="authTitle">{t("auth.title")}</h1>
          <p className="authSubtitle">{t("auth.subtitle")}</p>
        </header>

        <div className="authTabs" role="tablist" aria-label={t("auth.ariaLabel")}> 
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "login"}
            className={activeTab === "login" ? "isActive" : ""}
            onClick={() => {
              setActiveTab("login");
              clearMessages();
            }}
          >
            {t("auth.tab.login")}
          </button>

          <button
            data-testid="tab-register"
            type="button"
            role="tab"
            aria-selected={activeTab === "register"}
            className={activeTab === "register" ? "isActive" : ""}
            onClick={() => {
              setActiveTab("register");
              clearMessages();
            }}
          >
            {t("auth.tab.register")}
          </button>
        </div>

        {activeTab === "login" ? (
          <form className="authForm" onSubmit={handleLoginSubmit} noValidate>
            <label htmlFor="identifier">{t("auth.login.identifier")}</label>
            <input
              id="identifier"
              value={loginIdentifier}
              onChange={(event) => setLoginIdentifier(event.target.value)}
              placeholder={t("auth.login.identifierPlaceholder")}
              autoComplete="username"
            />

            <label htmlFor="loginPassword">{t("auth.login.password")}</label>
            <input
              id="loginPassword"
              type="password"
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
              autoComplete="current-password"
            />

            <button type="submit" className="authSubmit" disabled={loading}>
              {loading ? t("auth.login.loading") : t("auth.login.submit")}
            </button>
          </form>
        ) : (
          <form className="authForm" onSubmit={handleRegisterSubmit} noValidate>
            <label htmlFor="registerEmail">{t("auth.register.email")}</label>
            <input
              id="registerEmail"
              type="email"
              value={registerEmail}
              onChange={(event) => setRegisterEmail(event.target.value)}
              autoComplete="email"
            />

            <label htmlFor="registerUsername">{t("auth.register.username")}</label>
            <input
              id="registerUsername"
              value={registerUsername}
              onChange={(event) => setRegisterUsername(event.target.value)}
              autoComplete="username"
            />

            <label htmlFor="registerPassword">{t("auth.register.password")}</label>
            <input
              id="registerPassword"
              type="password"
              value={registerPassword}
              onChange={(event) => setRegisterPassword(event.target.value)}
              autoComplete="new-password"
            />

            <label htmlFor="registerPasswordRepeat">{t("auth.register.passwordRepeat")}</label>
            <input
              id="registerPasswordRepeat"
              type="password"
              value={registerPasswordRepeat}
              onChange={(event) => setRegisterPasswordRepeat(event.target.value)}
              autoComplete="new-password"
            />

            <button type="submit" className="registerSubmit" disabled={loading}>
              {loading ? t("auth.register.loading") : t("auth.register.submit")}
            </button>
          </form>
        )}

        {error ? <p className="errorMessage">{error}</p> : null}
        {successMessage ? (
          <p className="successMessage">{successMessage}</p>
        ) : null}
      </article>
    </section>
  );
}