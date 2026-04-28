import React from "react";
import { render, screen, fireEvent, createEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockNavigate = vi.fn();
const mockClearSession = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../store/sessionStore", () => ({
  useSessionStore: (selector) =>
    selector({
      isAuthenticated: false,
      refreshToken: null,
      clearSession: mockClearSession,
    }),
}));

// OJO: si este mock no te engancha (porque ya se está usando el HelpModal real),
// puedes borrar completamente este vi.mock y funcionará igual, ya que ahora
// testamos por rol "dialog" y no por texto "Help modal".
vi.mock("../components/HelpModal", () => ({
  default: ({ isOpen, onClose }) =>
    isOpen ? (
      <div role="dialog" aria-modal="true">
        <h2>Help modal</h2>
        <button onClick={onClose}>Cerrar</button>
      </div>
    ) : null,
}));

import GlobalActionsBar from "../components/GlobalActionsBar";

describe("GlobalActionsBar — ayuda por teclado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("abre la ayuda al pulsar 'h'", async () => {
    render(
      <MemoryRouter>
        <GlobalActionsBar />
      </MemoryRouter>
    );

    // inicialmente no hay diálogo
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "h" });

    // se abre el modal (mock o real) identificado por role="dialog"
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("abre la ayuda al pulsar 'F1' y previene el comportamiento por defecto", () => {
    render(
      <MemoryRouter>
        <GlobalActionsBar />
      </MemoryRouter>
    );

    const ev = createEvent.keyDown(window, {
      key: "F1",
      bubbles: true,
      cancelable: true,
    });

    fireEvent(window, ev);

    // el modal se ha abierto
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // y se ha llamado preventDefault
    expect(ev.defaultPrevented).toBe(true);
  });

  it("no abre la ayuda si el evento ocurre en un input", () => {
    render(
      <MemoryRouter>
        <div>
          <input data-testid="in" />
          <GlobalActionsBar />
        </div>
      </MemoryRouter>
    );

    const input = screen.getByTestId("in");

    fireEvent.keyDown(input, { key: "h" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("no abre la ayuda si se pulsa con Ctrl", () => {
    render(
      <MemoryRouter>
        <GlobalActionsBar />
      </MemoryRouter>
    );

    fireEvent.keyDown(window, { key: "h", ctrlKey: true });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("no abre la ayuda si se pulsa con Alt o Meta", () => {
    render(
      <MemoryRouter>
        <GlobalActionsBar />
      </MemoryRouter>
    );

    fireEvent.keyDown(window, { key: "h", altKey: true });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "h", metaKey: true });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});