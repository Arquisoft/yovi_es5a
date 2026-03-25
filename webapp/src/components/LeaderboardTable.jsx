import React from "react";
import { Link } from "react-router-dom";

export default function LeaderboardTable({ rows, highlightedUsername }) {
  if (!rows.length) {
    return <p className="emptyState">No hay jugadores para mostrar.</p>;
  }

  return (
    <div className="tableWrap">
      <table className="leaderboardTable">
        <thead>
          <tr>
            <th>Posición</th>
            <th>Jugador</th>
            <th>Puntuación máxima</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isCurrentUser = highlightedUsername && row.username.toLowerCase() === highlightedUsername.toLowerCase();
            return (
              <tr key={`${row.globalPosition}-${row.username}`} className={isCurrentUser ? "highlightRow" : ""}>
                <td>{row.globalPosition}</td>
                <td>
                  <Link className="usernameLink" to={`/user/${encodeURIComponent(row.username)}`}>
                    {row.username}
                  </Link>
                </td>
                <td>{row.bestScore}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
