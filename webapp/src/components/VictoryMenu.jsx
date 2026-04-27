import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import "./VictoryMenu.css";
import { requestMatchScore } from "../services/usersScoreApi";
import { useBoardStore } from "../store/boardStore";

export default function VictoryMenu({
  playerName,
  title,
  message,
  subtitle,
  matchSummary,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const resetGameConfig = useBoardStore((state) => state.resetGameConfig);
  const [score, setScore] = React.useState(null);
  const [scoreError, setScoreError] = React.useState("");
  const resolvedTitle = title || t("victory.title");
  const resolvedMessage = message || t("victory.defaultMessage", { playerName });
  const resolvedSubtitle = subtitle || t("victory.defaultSubtitle");

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

        setScoreError(error instanceof Error ? error.message : t("victory.unknownScoreError"));
      }
    }

    loadScore();

    return () => {
      isMounted = false;
    };
  }, [matchSummary, t]);

  function handleFinish() {
    resetGameConfig();
    navigate('/');
  }

  return (
    <div className="victoryOverlay" role="dialog" aria-modal="true">
      <div className="victoryCard">
        <h2>{resolvedTitle}</h2>
        <p>{resolvedMessage}</p>
        {typeof score === "number" ? <p>{t("victory.score", { score })}</p> : null}
        {!scoreError && typeof score !== "number" ? <p>{t("victory.loadingScore")}</p> : null}
        {scoreError ? (
          <p>
            {t("victory.scoreError")}
            <br />
            {scoreError}
          </p>
        ) : null}
        <p>{resolvedSubtitle}</p>
        <button type="button" onClick={handleFinish}>
          {t("victory.finishButton")}
        </button>
      </div>
    </div>
  );
}
