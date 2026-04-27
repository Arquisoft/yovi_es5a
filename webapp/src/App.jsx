import React from 'react';
import "./App.css";

import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import StartGameForm from "./components/StartGameForm";
import GameBoard from "./components/GameBoard";
import LanguageSelector from "./components/LanguageSelector";
import { useBoardStore } from "./store/boardStore";

import LeaderboardPage from "./pages/LeaderboardPage";
import UserProfilePage from "./pages/UserProfilePage";
import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";
import GlobalActionsBar from "./components/GlobalActionsBar";
import { useSessionStore } from "./store/sessionStore";


function RequireAuth({ children }) {
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }
  return children;
}



function App() {
  return (
    <>
      <div className="globalLanguageSelector">
        <LanguageSelector />
      </div>
    
      <GlobalActionsBar />

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
    </>
  );
}


export default App;