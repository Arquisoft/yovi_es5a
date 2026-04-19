import React from "react";
import { useTranslation } from "react-i18next";
import { useBoardStore } from "../store/boardStore";
import { useSessionStore } from "../store/sessionStore";
import { createUrl } from "../services/authApi";
import "./StartGameForm.css";

export default function StartGameForm() {
  const { t } = useTranslation();
  const setGameConfig = useBoardStore((state) => state.setGameConfig);
  const startGameFromConfig = useBoardStore((state) => state.startGameFromConfig);
  const user = useSessionStore((state) => state.user);

  const accessToken = useSessionStore((state) => state.accessToken);
  const clearSession = useSessionStore((state) => state.clearSession);


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
      const normalizedPlayerName = String(user?.username || "").trim();
      if (!normalizedPlayerName) {
        throw new Error(t("startGame.error.noAuth"));
      }

      if (gameMode === "1vs1" && !String(guestName || "").trim()) {
        throw new Error(t("startGame.error.guestNameRequired"));
      }

      // 1. Validar que hay token
      if (!accessToken) {
        clearSession();
        throw new Error(t("startGame.error.sessionExpired"));
      }

      const resp = await fetch(createUrl("/auth/check"), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!resp.ok) {
        clearSession();
        throw new Error(t("startGame.error.sessionExpired"));
      }

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
      <h2>{t("startGame.title")}</h2>

      <div className="fieldGroup">
        <label htmlFor="gameMode">{t("startGame.modeLabel")}</label>
        <select
          id="gameMode"
          className="startInput"
          value={gameMode}
          onChange={(event) => setGameMode(event.target.value)}
        >
          <option value="1vs1">{t("startGame.mode.1vs1")}</option>
          <option value="1vsbot">{t("startGame.mode.1vsbot")}</option>
        </select>
      </div>

      <div className="fieldGroup">
        <label htmlFor="player1Name">{t("startGame.authenticatedPlayer")}</label>
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
          <label htmlFor="guestName">{t("startGame.guestNameLabel")}</label>
          <input
            id="guestName"
            className="startInput"
            type="text"
            value={guestName}
            onChange={(event) => setGuestName(event.target.value)}
            placeholder={t("startGame.guestPlaceholder")}
            required
          />
        </div>
      ) : (
        <div className="fieldGroup">
          <label htmlFor="difficulty">{t("startGame.difficultyLabel")}</label>
          <select
            id="difficulty"
            className="startInput"
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value)}
          >
            <option value="Facil">{t("startGame.easy")}</option>
            <option value="Media">{t("startGame.medium")}</option>
            <option value="Dificil">{t("startGame.hard")}</option>
          </select>
        </div>
      )}

      <div className="fieldGroup">
        <label htmlFor="boardSize">{t("startGame.boardSizeLabel")}</label>
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
        {loading ? t("startGame.loading") : t("startGame.startButton")}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
