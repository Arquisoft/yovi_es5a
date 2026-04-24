import React from "react";
import { useTranslation } from "react-i18next";

import StartGameForm from "../components/StartGameForm";
import GameBoard from "../components/GameBoard";
import { useBoardStore } from "../store/boardStore";
import { useSessionStore } from "../store/sessionStore";

export default function HomePage() {
  const isConfigured = useBoardStore((state) => state.isConfigured);
  const user = useSessionStore((state) => state.user);
  const clearSession = useSessionStore((state) => state.clearSession);

  const { t } = useTranslation();

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
      </div>

      {isConfigured ? <GameBoard /> : <StartGameForm />}
    </div>
  );
}
