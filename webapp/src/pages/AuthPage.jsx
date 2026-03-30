import React from "react";
import { useNavigate } from "react-router-dom";
import { login, register } from "../services/authApi";
import { useSessionStore } from "../store/sessionStore";
import "./AuthPage.css";

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

export default function AuthPage() {
  const navigate = useNavigate();
  const setSession = useSessionStore((state) => state.setSession);

  const [activeTab, setActiveTab] = React.useState("login");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const [loginIdentifier, setLoginIdentifier] = React.useState("");
  const [loginPassword, setLoginPassword] = React.useState("");

  const [registerEmail, setRegisterEmail] = React.useState("");
  const [registerUsername, setRegisterUsername] = React.useState("");
  const [registerPassword, setRegisterPassword] = React.useState("");
  const [registerPasswordRepeat, setRegisterPasswordRepeat] = React.useState("");

  async function handleLoginSubmit(event) {
    event.preventDefault();
    setError("");

    if (!loginIdentifier.trim()) {
      setError("Debes indicar un usuario o correo electrónico.");
      return;
    }

    if (!loginPassword.trim()) {
      setError("Debes indicar la contraseña.");
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
      setError(err.message || "No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterSubmit(event) {
    event.preventDefault();
    setError("");

    if (!isEmail(registerEmail)) {
      setError("Debes indicar un correo electrónico válido.");
      return;
    }

    if (!registerUsername.trim()) {
      setError("Debes indicar el nombre de usuario.");
      return;
    }

    if (registerPassword.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (registerPassword !== registerPasswordRepeat) {
      setError("Las contraseñas no coinciden.");
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
      setError("Registro enviado. Ya puedes iniciar sesión.");
    } catch (err) {
      setError(err.message || "No se pudo completar el registro.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="authPage">
      <article className="authCard">
        <header className="authHeader">
          <h1 className="authTitle">Juego Y</h1>
          <p className="authSubtitle">Accede para empezar la partida</p>
        </header>

        <div className="authTabs" role="tablist" aria-label="Autenticación">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "login"}
            className={activeTab === "login" ? "isActive" : ""}
            onClick={() => {
              setActiveTab("login");
              setError("");
            }}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "register"}
            className={activeTab === "register" ? "isActive" : ""}
            onClick={() => {
              setActiveTab("register");
              setError("");
            }}
          >
            Registro
          </button>
        </div>

        {activeTab === "login" ? (
          <form className="authForm" onSubmit={handleLoginSubmit}>
            <label htmlFor="identifier">Usuario o correo electrónico</label>
            <input
              id="identifier"
              value={loginIdentifier}
              onChange={(event) => setLoginIdentifier(event.target.value)}
              placeholder="usuario o correo"
              autoComplete="username"
            />

            <label htmlFor="loginPassword">Contraseña</label>
            <input
              id="loginPassword"
              type="password"
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
              autoComplete="current-password"
            />

            <button type="submit" disabled={loading}>
              {loading ? "Comprobando..." : "Entrar"}
            </button>
          </form>
        ) : (
          <form className="authForm" onSubmit={handleRegisterSubmit}>
            <label htmlFor="registerEmail">Correo electrónico</label>
            <input
              id="registerEmail"
              type="email"
              value={registerEmail}
              onChange={(event) => setRegisterEmail(event.target.value)}
              autoComplete="email"
            />

            <label htmlFor="registerUsername">Nombre de usuario</label>
            <input
              id="registerUsername"
              value={registerUsername}
              onChange={(event) => setRegisterUsername(event.target.value)}
              autoComplete="username"
            />

            <label htmlFor="registerPassword">Contraseña</label>
            <input
              id="registerPassword"
              type="password"
              value={registerPassword}
              onChange={(event) => setRegisterPassword(event.target.value)}
              autoComplete="new-password"
            />

            <label htmlFor="registerPasswordRepeat">Repite la contraseña</label>
            <input
              id="registerPasswordRepeat"
              type="password"
              value={registerPasswordRepeat}
              onChange={(event) => setRegisterPasswordRepeat(event.target.value)}
              autoComplete="new-password"
            />

            <button type="submit" disabled={loading}>
              {loading ? "Enviando..." : "Crear cuenta"}
            </button>
          </form>
        )}

        {error ? <p className="authError">{error}</p> : null}
      </article>
    </section>
  );
}
