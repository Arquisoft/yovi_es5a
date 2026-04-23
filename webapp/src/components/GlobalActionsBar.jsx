import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useSessionStore } from "../store/sessionStore";
import { logout as logoutApi } from "../services/authApi";
import HelpModal from "./HelpModal";

export default function GlobalActionsBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const refreshToken = useSessionStore((state) => state.refreshToken);
  const clearSession = useSessionStore((state) => state.clearSession);
  const [isHelpOpen, setIsHelpOpen] = React.useState(false);

  useEffect(() => {
    const onKey = (e) => {
      // ignore when user types in inputs or uses modifiers
      const tag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : null;
      const isFormElement = tag === "input" || tag === "textarea" || tag === "select" || e.target?.isContentEditable;
      if (isFormElement) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      if (e.key === "h" || e.key === "H") {
        setIsHelpOpen(true);
      }

      if (e.key === "F1") {
        // try prevent browser help and open our modal
        try {
          e.preventDefault();
        } catch (err) {
          // ignore
        }
        setIsHelpOpen(true);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleLogout = async () => {
    try {
      await logoutApi({ refreshToken });
    } catch {
      // Si falla el servidor, cerramos sesión localmente igualmente.
    } finally {
      clearSession();
      navigate("/auth");
    }
  };

  return (
    <>
      <div className="topBar">
        <Link className="topActionButton" to="/puntuaciones" aria-label={t("app.viewLeaderboardAria")}>
          {t("app.viewLeaderboard")}
        </Link>
        <button
          type="button"
          className="topActionButton"
          onClick={() => setIsHelpOpen(true)}
          aria-label={t("help.openAria")}
        >
          {t("help.button")}
        </button>
        {isAuthenticated ? (
          <button
            type="button"
            className="topActionButton logoutButton"
            onClick={handleLogout}
            aria-label="Cerrar sesión"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Salir
          </button>
        ) : null}
      </div>
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </>
  );
}
