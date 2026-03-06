import React from "react";
import { useBoardStore } from "../store/boardStore";
import "./StartGameForm.css";

export default function StartGameForm() {
  const setGameConfig = useBoardStore((state) => state.setGameConfig);
  const startGameFromConfig = useBoardStore((state) => state.startGameFromConfig);

  const [gameMode, setGameMode] = React.useState("1vs1");
  const [player1Name, setPlayer1Name] = React.useState("");
  const [player2Name, setPlayer2Name] = React.useState("");
  const [difficulty, setDifficulty] = React.useState("Facil");
  const [boardSize, setBoardSize] = React.useState(8);

  function handleSubmit(event) {
    event.preventDefault();

    setGameConfig({
      gameMode,
      player1Name,
      player2Name,
      difficulty,
      boardSize,
    });

    startGameFromConfig();
  }

  return (
    <form className="startGameForm" onSubmit={handleSubmit}>
      <h2>Configurar partida</h2>

      <div className="fieldGroup">
        <label htmlFor="gameMode">Modo</label>
        <select
          id="gameMode"
          className="startInput"
          value={gameMode}
          onChange={(event) => setGameMode(event.target.value)}
        >
          <option value="1vs1">2 jugadores (1vs1)</option>
          <option value="1vsbot">1 jugador (1vsbot)</option>
        </select>
      </div>

      <div className="fieldGroup">
        <label htmlFor="player1Name">Nombre jugador 1</label>
        <input
          id="player1Name"
          className="startInput"
          type="text"
          value={player1Name}
          onChange={(event) => setPlayer1Name(event.target.value)}
          placeholder={gameMode === "1vsbot" ? "Tu nombre" : "Jugador 1"}
          required
        />
      </div>

      {gameMode === "1vs1" ? (
        <div className="fieldGroup">
          <label htmlFor="player2Name">Nombre jugador 2</label>
          <input
            id="player2Name"
            className="startInput"
            type="text"
            value={player2Name}
            onChange={(event) => setPlayer2Name(event.target.value)}
            placeholder="Jugador 2"
            required
          />
        </div>
      ) : (
        <div className="fieldGroup">
          <label htmlFor="difficulty">Dificultad</label>
          <select
            id="difficulty"
            className="startInput"
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value)}
          >
            <option value="Facil">Facil</option>
            <option value="Media">Media</option>
            <option value="Dificil">Dificil</option>
          </select>
        </div>
      )}

      <div className="fieldGroup">
        <label htmlFor="boardSize">Tamaño tablero (6-15)</label>
        <input
          id="boardSize"
          className="startInput"
          type="number"
          min={6}
          max={15}
          value={boardSize}
          onChange={(event) => setBoardSize(event.target.value)}
        />
      </div>

      <button className="startButton" type="submit">
        Empezar partida
      </button>
    </form>
  );
}
