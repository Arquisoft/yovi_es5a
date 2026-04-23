import React from "react";
import { Link, useNavigate } from "react-router-dom";

import { useSessionStore } from "../store/sessionStore";
import { logout as logoutApi } from "../services/authApi";
import HelpModal from "./HelpModal";

export default function GlobalActionsBar() {
  const navigate = useNavigate();
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const refreshToken = useSessionStore((state) => state.refreshToken);
  const clearSession = useSessionStore((state) => state.clearSession);
  const [isHelpOpen, setIsHelpOpen] = React.useState(false);

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
        <Link className="topActionButton" to="/puntuaciones" aria-label="Ir a clasificación">
          Clasificación
        </Link>
        <button
          type="button"
          className="topActionButton"
          onClick={() => setIsHelpOpen(true)}
          aria-label="Abrir menú de ayuda"
        >
          Ayuda
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
