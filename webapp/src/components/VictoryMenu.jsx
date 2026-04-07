import React from "react";
import { useNavigate } from "react-router-dom";
import "./VictoryMenu.css";
import { requestMatchScore } from "../services/usersScoreApi";
import { useBoardStore } from "../store/boardStore";

export default function VictoryMenu({
  playerName,
  title = "¡Victoria!",
  message,
  subtitle = "Enhorabuena por esta partida.",
  matchSummary,
}) {
  const navigate = useNavigate();
  const resetGameConfig = useBoardStore((state) => state.resetGameConfig);
  const [score, setScore] = React.useState(null);
  const [scoreError, setScoreError] = React.useState("");

  React.useEffect(() => {
    let isMounted = true;

    async function loadScore() {
      try {
        const result = await requestMatchScore(matchSummary);

        if (!isMounted) {
          return;
        }

        setScore(result.score);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setScoreError(error instanceof Error ? error.message : "Error desconocido al cargar la puntuación.");
      }
    }

    loadScore();

    return () => {
      isMounted = false;
    };
  }, [matchSummary]);

  function handleFinish() {
    resetGameConfig();
    navigate('/');
  }

  const resolvedMessage = message || `${playerName} ha ganado la partida.`;

  return (
    <div className="victoryOverlay" role="dialog" aria-modal="true">
      <div className="victoryCard">
        <h2>{title}</h2>
        <p>{resolvedMessage}</p>
        {typeof score === "number" ? <p>Puntuación: {score}</p> : null}
        {!scoreError && typeof score !== "number" ? <p>Cargando puntuación...</p> : null}
        {scoreError ? (
          <p>
            No se ha podido cargar la puntuacion
            <br />
            {scoreError}
          </p>
        ) : null}
        <p>{subtitle}</p>
        <button type="button" onClick={handleFinish}>
          Finalizar
        </button>
      </div>
    </div>
  );
}
