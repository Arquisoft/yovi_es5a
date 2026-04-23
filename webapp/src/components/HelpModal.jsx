import React, { useEffect, useRef } from "react";

export default function HelpModal({ isOpen, onClose }) {
  if (!isOpen) {
    return null;
  }

  const closeButtonRef = useRef(null);

  const handleBackdropKey = (e) => {
    const key = e.key;
    if (key === "Enter" || key === " " || key === "Spacebar") {
      e.preventDefault();
      onClose();
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    // Focus close button when modal opens
    const t = setTimeout(() => closeButtonRef.current?.focus(), 0);

    const onKey = (ev) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  return (
    <div
      className="helpModalBackdrop"
      onClick={onClose}
      role="button"
      aria-label="Cerrar ayuda"
      tabIndex={0}
      onKeyDown={handleBackdropKey}
    >
      <section
        className="helpModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="helpModalTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="helpModalHeader">
          <h2 id="helpModalTitle">Guía rápida de YOVI</h2>
          <button
            type="button"
            ref={closeButtonRef}
            className="helpCloseButton"
            onClick={onClose}
            aria-label="Cerrar ayuda"
          >
            ×
          </button>
        </header>
        <div className="helpModalContent">
          <h3>Reglas (explicadas para principiantes)</h3>
          <p>
            Y es un juego para dos jugadores. Puedes jugar en local contra un amigo o contra uno de nuestros bots.
             Cada turno, un jugador coloca una ficha en una casilla vacía del tablero triangular. 
             El objetivo es conectar tus fichas de manera que formen una cadena que toque las tres aristas
            del tablero; el primer jugador que lo consiga gana la partida.
          </p>

          <h3>Cómo jugar — pasos básicos</h3>
          <ol>
            <li>Los jugadores juegan por turnos alternos; el jugador A comienza.</li>
            <li>En tu turno coloca una ficha en cualquier casilla vacía, haciendo click con el ratón</li>
            <li>No puedes colocar una ficha en una casilla ya ocupada.</li>
            <li> Si tienes duda de que movimiento hacer, siempre puedes utilizar el botón de sugerencia</li>
            <li> Tras colocar una ficha el turno pasa al otro jugador o al bot</li>
            <li>El motor de juego valida las jugadas y detecta automáticamente la victoria.</li>
          </ol>

          <h3>Tamaño del tablero y estrategia</h3>
          <p>
            El tamaño del tablero cambia la naturaleza del juego: en tableros pequeños
            el juego es principalmente táctico (cada movimiento tiene gran impacto),
            mientras que en tableros grandes la partida se vuelve más estratégica,
            con planificación a largo plazo y control de zonas.
          </p>

          <h3>Consejos rápidos</h3>
          <ul>
            <li>Prioriza crear conexiones continuas en vez de fichas aisladas.</li>
            <li>Bloquea rutas que permitan a tu rival conectar varios lados.</li>
            <li>Dominar el centro al principio suele ofrecer más opciones de conexión.</li>
          </ul>

          <p>¡Disfruta la partida y prueba diferentes tamaños de tablero para variar la estrategia!</p>
        </div>
      </section>
    </div>
  );
}
