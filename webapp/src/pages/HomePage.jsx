import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import StartGameForm from "../components/StartGameForm";
import GameBoard from "../components/GameBoard";
import { useBoardStore } from "../store/boardStore";
import { useSessionStore } from "../store/sessionStore";

export default function HomePage() {
  const isConfigured = useBoardStore((state) => state.isConfigured);
  const user = useSessionStore((state) => state.user);
  const refreshToken = useSessionStore((state) => state.refreshToken);
  const clearSession = useSessionStore((state) => state.clearSession);

  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleLogout = async () => {
    try {
      await logoutApi({ refreshToken });
    } catch {
      // si falla el servidor, cerramos sesión igualmente
    } finally {
      clearSession();
      navigate("/auth");
    }
  };

  return (
    <div className="App">
      

      <div className="homeHero">
        <h1 className="homeTitle">{t("app.title")}</h1>

        {user && (
          <p className="homeSessionBadge">
            <span className="homeSessionBadge__dot" />
            {user.username}
          </p>
        )}

        <div className="homeActions">
          <Link className="primaryLinkButton" to="/puntuaciones">
            {t("app.viewLeaderboard")}
          </Link>
        </div>
      </div>

      {isConfigured ? <GameBoard /> : <StartGameForm />}
    </div>
  );
}
