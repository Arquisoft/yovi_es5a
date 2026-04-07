import React from 'react';
import "./App.css";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";

import StartGameForm from "./components/StartGameForm";
import GameBoard from "./components/GameBoard";
import { useBoardStore } from "./store/boardStore";
import LeaderboardPage from "./pages/LeaderboardPage";
import UserProfilePage from "./pages/UserProfilePage";
import AuthPage from "./pages/AuthPage";
import { useSessionStore } from "./store/sessionStore";
import { logout as logoutApi } from "./services/authApi";


function RequireAuth({ children }) {
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }
  return children;
}


function HomePage() {
  const isConfigured = useBoardStore((state) => state.isConfigured);
  const user = useSessionStore((state) => state.user);
  const refreshToken = useSessionStore((state) => state.refreshToken);
  const clearSession = useSessionStore((state) => state.clearSession);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logoutApi({ refreshToken });
    } catch {
      // Si falla el servidor, cerramos sesión localmente igualmente
    } finally {
      clearSession();
      navigate("/auth");
    }
  };

  return (
    <div className="App">
      <div className="topBar">
        <button className="logoutButton" onClick={handleLogout} aria-label="Cerrar sesión">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Salir
        </button>
      </div>

      <div className="homeHero">
        <h1 className="homeTitle">Juego Y</h1>
        {user ? (
          <p className="homeSessionBadge">
            <span className="homeSessionBadge__dot" />
            {user.username}
          </p>
        ) : null}
        <div className="homeActions">
          <Link className="primaryLinkButton" to="/puntuaciones">
            Ver puntuaciones
          </Link>
        </div>
      </div>
      {isConfigured ? <GameBoard /> : <StartGameForm />}
    </div>
  );
}


function App() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route
        path="/"
        element={(
          <RequireAuth>
            <HomePage />
          </RequireAuth>
        )}
      />
      <Route path="/puntuaciones" element={<LeaderboardPage />} />
      <Route path="/user/:nombreUsuario" element={<UserProfilePage />} />
    </Routes>
  );
}


export default App;