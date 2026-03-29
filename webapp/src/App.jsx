import React from 'react';
import "./App.css";
import { Link, Navigate, Route, Routes } from "react-router-dom";

import StartGameForm from "./components/StartGameForm";
import GameBoard from "./components/GameBoard";
import { useBoardStore } from "./store/boardStore";
import LeaderboardPage from "./pages/LeaderboardPage";
import UserProfilePage from "./pages/UserProfilePage";
import AuthPage from "./pages/AuthPage";
import { useSessionStore } from "./store/sessionStore";

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

  return (
    <div className="App">
      <h1>Juego Y</h1>
      {user ? <p>Sesión iniciada: {user.username}</p> : null}
      <div className="homeActions">
        <Link className="primaryLinkButton" to="/puntuaciones">
          Ver puntuaciones
        </Link>
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
