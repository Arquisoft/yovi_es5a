import React from 'react';
import "./App.css";

import StartGameForm from "./components/StartGameForm";
import GameBoard from "./components/GameBoard";
import { useBoardStore } from "./store/boardStore";

function App() {
  const isConfigured = useBoardStore((state) => state.isConfigured);

  return (
    <div className="App">
      <h1>Juego Y</h1>

      {isConfigured ? <GameBoard /> : <StartGameForm />}
    </div>
  );
}

export default App;
