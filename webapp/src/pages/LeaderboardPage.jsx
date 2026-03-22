import React from "react";
import { Link } from "react-router-dom";
import LeaderboardTable from "../components/LeaderboardTable";
import PaginationControls from "../components/PaginationControls";
import UserSearchBar from "../components/UserSearchBar";
import { fetchLeaderboard } from "../services/leaderboardApi";
import "./Leaderboard.css";

export default function LeaderboardPage() {
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [data, setData] = React.useState({ items: [], totalPages: 1 });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    fetchLeaderboard({ page, pageSize })
      .then((response) => {
        if (!active) {
          return;
        }
        setData(response);
      })
      .catch((err) => {
        if (!active) {
          return;
        }
        setError(err.message || "No se pudo cargar la tabla de puntuaciones");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [page, pageSize]);

  return (
    <section className="leaderboardPage">
      <header className="pageHeader">
        <h2>Leaderboard</h2>
        <div className="pageLinks">
          <Link className="secondaryLinkButton" to="/">
            Volver al juego
          </Link>
        </div>
      </header>

      <UserSearchBar />

      {loading ? <p className="loadingText">Cargando puntuaciones...</p> : null}
      {error ? <p className="errorText">{error}</p> : null}

      {!loading && !error ? <LeaderboardTable rows={data.items || []} /> : <div className="tablePlaceholder" />}

      <PaginationControls
        page={page}
        totalPages={data.totalPages || 1}
        pageSize={pageSize}
        onPageChange={(nextPage) => setPage(nextPage)}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setPage(1);
        }}
      />
    </section>
  );
}
