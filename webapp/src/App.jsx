import React from 'react';
import "./App.css";
import { Link, Route, Routes } from "react-router-dom";

import StartGameForm from "./components/StartGameForm";
import GameBoard from "./components/GameBoard";
import { useBoardStore } from "./store/boardStore";
import LeaderboardPage from "./pages/LeaderboardPage";
import UserProfilePage from "./pages/UserProfilePage";

function HomePage() {
  const isConfigured = useBoardStore((state) => state.isConfigured);

  return (
    <div className="App">
      <h1>Juego Y</h1>
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
      <Route path="/" element={<HomePage />} />
      <Route path="/puntuaciones" element={<LeaderboardPage />} />
      <Route path="/user/:nombreUsuario" element={<UserProfilePage />} />
    </Routes>
  );
}

export default App;
