import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

export default function LeaderboardTable({ rows, highlightedUsername }) {
  const { t } = useTranslation();

  if (!rows.length) {
    return <p className="emptyState">{t("leaderboard.emptyState")}</p>;
  }

  return (
    <div className="tableWrap">
      <table className="leaderboardTable">
        <thead>
          <tr>
            <th>{t("leaderboard.position")}</th>
            <th>{t("leaderboard.player")}</th>
            <th>{t("leaderboard.bestScore")}</th>
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
