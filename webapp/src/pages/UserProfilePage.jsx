import React from "react";
import { Link, useParams } from "react-router-dom";
import LeaderboardTable from "../components/LeaderboardTable";
import PaginationControls from "../components/PaginationControls";
import {
  fetchCenteredLeaderboard,
  fetchUserHistory,
  fetchUserProfile,
} from "../services/leaderboardApi";
import "./Leaderboard.css";

export default function UserProfilePage() {
  const { nombreUsuario } = useParams();
  const decodedUsername = decodeURIComponent(nombreUsuario || "");

  const [profile, setProfile] = React.useState(null);
  const [history, setHistory] = React.useState({
    botItems: [],
    pvpItems: [],
    botPage: 1,
    botPageSize: 25,
    botTotalPages: 1,
    pvpPage: 1,
    pvpPageSize: 25,
    pvpTotalPages: 1,
  });
  const [centered, setCentered] = React.useState({ items: [], page: null, pageSize: 25, totalPages: 1, highlightedUsername: decodedUsername });
  const [loadingProfile, setLoadingProfile] = React.useState(false);
  const [loadingHistory, setLoadingHistory] = React.useState(false);
  const [loadingCentered, setLoadingCentered] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let active = true;
    setLoadingProfile(true);
    setError("");

    fetchUserProfile({ username: decodedUsername })
      .then((response) => {
        if (active) {
          setProfile(response);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || "No se pudo cargar el perfil");
        }
      })
      .finally(() => {
        if (active) {
          setLoadingProfile(false);
        }
      });

    return () => {
      active = false;
    };
  }, [decodedUsername]);

  React.useEffect(() => {
    let active = true;
    setLoadingHistory(true);
    fetchUserHistory({
      username: decodedUsername,
      botPage: history.botPage,
      botPageSize: history.botPageSize,
      pvpPage: history.pvpPage,
      pvpPageSize: history.pvpPageSize,
    })
      .then((response) => {
        if (active) {
          setHistory((prev) => ({
            ...prev,
            botItems: response.botItems || response.items || [],
            pvpItems: response.pvpItems || [],
            botPage: response.botPage || prev.botPage,
            botPageSize: response.botPageSize || prev.botPageSize,
            botTotalPages: response.botTotalPages || response.totalPages || 1,
            pvpPage: response.pvpPage || prev.pvpPage,
            pvpPageSize: response.pvpPageSize || prev.pvpPageSize,
            pvpTotalPages: response.pvpTotalPages || 1,
          }));
        }
      })
      .catch(() => {
        if (active) {
          setHistory((prev) => ({ ...prev, botItems: [], pvpItems: [] }));
        }
      })
      .finally(() => {
        if (active) {
          setLoadingHistory(false);
        }
      });

    return () => {
      active = false;
    };
  }, [decodedUsername, history.botPage, history.botPageSize, history.pvpPage, history.pvpPageSize]);

  React.useEffect(() => {
    setCentered((prev) => ({
      ...prev,
      items: [],
      page: null,
      totalPages: 1,
      highlightedUsername: decodedUsername,
    }));
  }, [decodedUsername]);

  React.useEffect(() => {
    let active = true;
    setLoadingCentered(true);
    fetchCenteredLeaderboard({
      username: decodedUsername,
      page: centered.page ?? undefined,
      pageSize: centered.pageSize,
    })
      .then((response) => {
        if (active) {
          setCentered((prev) => ({
            ...prev,
            items: response.items || [],
            highlightedUsername: response.highlightedUsername || decodedUsername,
            page: response.page || prev.page,
            totalPages: response.totalPages || 1,
          }));
        }
      })
      .catch(() => {
        if (active) {
          setCentered((prev) => ({ ...prev, items: [] }));
        }
      })
      .finally(() => {
        if (active) {
          setLoadingCentered(false);
        }
      });

    return () => {
      active = false;
    };
  }, [decodedUsername, centered.page, centered.pageSize]);

  return (
    <section className="leaderboardPage">
      <header className="pageHeader">
        <h2>Usuario: {decodedUsername}</h2>
        <div className="pageLinks">
          <Link className="secondaryLinkButton" to="/">
            Volver al juego
          </Link>
          <Link className="secondaryLinkButton" to="/puntuaciones">
            Volver a puntuaciones
          </Link>
        </div>
      </header>

      {error ? <p className="errorText">{error}</p> : null}
      {loadingProfile ? <p className="loadingText">Cargando perfil...</p> : null}

      {profile ? (
        <article className="profileCard">
          <p><strong>Nombre:</strong> {profile.username}</p>
          <p><strong>Posición global:</strong> {profile.globalPosition}</p>
          <p><strong>Puntuación máxima:</strong> {profile.bestScore}</p>
          <p><strong>Partidas totales:</strong> {profile.totalGames}</p>
        </article>
      ) : null}

      <section>
        <h3>Leaderboard (centrado en usuario)</h3>
        {loadingCentered ? <p className="loadingText">Cargando clasificación...</p> : null}
        {!loadingCentered ? (
          <LeaderboardTable rows={centered.items || []} highlightedUsername={centered.highlightedUsername} />
        ) : (
          <div className="tablePlaceholder" />
        )}

        <PaginationControls
          page={centered.page || 1}
          totalPages={centered.totalPages || 1}
          pageSize={centered.pageSize}
          onPageChange={(nextPage) => setCentered((prev) => ({ ...prev, page: nextPage }))}
          onPageSizeChange={(nextSize) =>
            setCentered((prev) => ({ ...prev, pageSize: nextSize, page: null }))
          }
        />
      </section>

      <section>
        <h3>Historial de partidas</h3>
        {loadingHistory ? <p className="loadingText">Cargando historial...</p> : null}
        {!loadingHistory && !(history.botItems || []).length && !(history.pvpItems || []).length ? (
          <p className="emptyState">Este usuario no tiene partidas.</p>
        ) : null}

        {!!(history.botItems || []).length ? (
          <>
            <h4>Partidas contra bot</h4>
            <div className="tableWrap">
              <table className="leaderboardTable">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Puntuación</th>
                    <th>Tablero</th>
                    <th>Turnos</th>
                    <th>Dificultad</th>
                    <th>Ganador</th>
                  </tr>
                </thead>
                <tbody>
                  {history.botItems.map((item) => (
                    <tr key={`bot-${item.id}`}>
                      <td>{item.id}</td>
                      <td>{item.score}</td>
                      <td>{item.boardSize}</td>
                      <td>{item.totalTurns}</td>
                      <td>{item.difficulty}</td>
                      <td>{item.winnerName || item.winner}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationControls
              page={history.botPage}
              totalPages={history.botTotalPages || 1}
              pageSize={history.botPageSize}
              onPageChange={(nextPage) => setHistory((prev) => ({ ...prev, botPage: nextPage }))}
              onPageSizeChange={(nextSize) =>
                setHistory((prev) => ({ ...prev, botPageSize: nextSize, botPage: 1 }))
              }
            />
          </>
        ) : null}

        {!!(history.pvpItems || []).length ? (
          <>
            <h4>Partidas jugador contra jugador</h4>
            <div className="tableWrap">
              <table className="leaderboardTable">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Puntuación</th>
                    <th>Tablero</th>
                    <th>Turnos</th>
                    <th>Jugador 1</th>
                    <th>Jugador 2</th>
                    <th>Ganador</th>
                  </tr>
                </thead>
                <tbody>
                  {history.pvpItems.map((item) => (
                    <tr key={`pvp-${item.id}`}>
                      <td>{item.id}</td>
                      <td>{item.score}</td>
                      <td>{item.boardSize}</td>
                      <td>{item.totalTurns}</td>
                      <td>{item.player1Name}</td>
                      <td>{item.player2Name}</td>
                      <td>{item.winnerName || item.winner}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationControls
              page={history.pvpPage}
              totalPages={history.pvpTotalPages || 1}
              pageSize={history.pvpPageSize}
              onPageChange={(nextPage) => setHistory((prev) => ({ ...prev, pvpPage: nextPage }))}
              onPageSizeChange={(nextSize) =>
                setHistory((prev) => ({ ...prev, pvpPageSize: nextSize, pvpPage: 1 }))
              }
            />
          </>
        ) : null}
      </section>
    </section>
  );
}
