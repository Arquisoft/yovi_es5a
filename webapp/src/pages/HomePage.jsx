import React from "react";

import StartGameForm from "../components/StartGameForm";
import GameBoard from "../components/GameBoard";
import { useBoardStore } from "../store/boardStore";
import { useSessionStore } from "../store/sessionStore";

export default function HomePage() {
  const isConfigured = useBoardStore((state) => state.isConfigured);
  const user = useSessionStore((state) => state.user);

  return (
    <div className="App">
      <div className="homeHero">
        <h1 className="homeTitle">Juego Y</h1>
        {user ? (
          <p className="homeSessionBadge">
            <span className="homeSessionBadge__dot" />
            {user.username}
          </p>
        ) : null}
      </div>
      {isConfigured ? <GameBoard /> : <StartGameForm />}
    </div>
  );
}
