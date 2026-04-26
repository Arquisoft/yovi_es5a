import React from 'react';
import "./App.css";
import { Navigate, Route, Routes } from "react-router-dom";

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