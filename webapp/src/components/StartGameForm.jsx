import React from "react";
import { useBoardStore } from "../store/boardStore";
import { useSessionStore } from "../store/sessionStore";
import "./StartGameForm.css";

export default function StartGameForm() {
  const setGameConfig = useBoardStore((state) => state.setGameConfig);
  const startGameFromConfig = useBoardStore((state) => state.startGameFromConfig);
  const user = useSessionStore((state) => state.user);

  const [gameMode, setGameMode] = React.useState("1vs1");
  const [guestName, setGuestName] = React.useState("");
  const [difficulty, setDifficulty] = React.useState("Facil");
  const [boardSize, setBoardSize] = React.useState(8);

  const [error, setError] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
<<<<<<< iniciarSession
      const normalizedPlayerName = String(user?.username || "").trim();
      if (!normalizedPlayerName) {
        throw new Error("No hay sesión activa. Inicia sesión de nuevo.");
      }

      if (gameMode === "1vs1" && !String(guestName || "").trim()) {
        throw new Error("Debes indicar el nombre del invitado.");
      }
=======
      await createUser(player1Name);
      
      if (gameMode === "1vs1") {
       await createUser(player2Name);
      } 
>>>>>>> development

      setGameConfig({
        gameMode,
        player1Name: normalizedPlayerName,
        player2Name: gameMode === "1vs1" ? guestName : "Bot",
        difficulty,
        boardSize,
      });

      startGameFromConfig();
    } catch (err) {
    setError(err.message);
    } finally {
      setLoading(false);
    }
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
        <label htmlFor="player1Name">Jugador autenticado</label>
        <input
          id="player1Name"
          className="startInput"
          type="text"
          value={user?.username || ""}
          readOnly
        />
      </div>

      {gameMode === "1vs1" ? (
        <div className="fieldGroup">
          <label htmlFor="guestName">Nombre invitado</label>
          <input
            id="guestName"
            className="startInput"
            type="text"
            value={guestName}
            onChange={(event) => setGuestName(event.target.value)}
            placeholder="Invitado"
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

      <button className="startButton" type="submit" disabled={loading}>
        {loading ? "Preparando partida..." : "Empezar partida"}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
