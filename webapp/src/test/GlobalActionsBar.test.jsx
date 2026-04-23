import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

// Mock session store so component renders without real store
vi.mock("../store/sessionStore", () => ({
  useSessionStore: (selector) =>
    selector({ isAuthenticated: false, refreshToken: null, clearSession: vi.fn() }),
}));

import GlobalActionsBar from "../src/components/GlobalActionsBar";

describe("GlobalActionsBar — ayuda por teclado", () => {
  beforeEach(() => {
    // ensure clean DOM
    document.body.innerHTML = "";
  });

  it("abre la ayuda al pulsar 'h'", async () => {
    render(
      <MemoryRouter>
        <GlobalActionsBar />
      </MemoryRouter>
    );

    expect(screen.queryByText("Guía rápida de YOVI")).toBeNull();

    fireEvent.keyDown(window, { key: "h" });

    expect(await screen.findByText("Guía rápida de YOVI")).toBeInTheDocument();
  });

  it("abre la ayuda al pulsar 'F1' y trata de prevenir el comportamiento por defecto", async () => {
    render(
      <MemoryRouter>
        <GlobalActionsBar />
      </MemoryRouter>
    );

    const prevent = vi.fn();
    const ev = new KeyboardEvent("keydown", { key: "F1", bubbles: true, cancelable: true });
    // override preventDefault to spy on it
    ev.preventDefault = prevent;
    window.dispatchEvent(ev);

    expect(await screen.findByText("Guía rápida de YOVI")).toBeInTheDocument();
    expect(prevent).toHaveBeenCalled();
  });

  it("no abre la ayuda si el foco está en un input (teclear 'h' en un input)", () => {
    render(
      <MemoryRouter>
        <div>
          <input data-testid="in" />
          <GlobalActionsBar />
        </div>
      </MemoryRouter>
    );

    const input = screen.getByTestId("in");
    input.focus();

    fireEvent.keyDown(input, { key: "h" });

    expect(screen.queryByText("Guía rápida de YOVI")).toBeNull();
  });

  it("cierra la ayuda al pulsar Escape", async () => {
    render(
      <MemoryRouter>
        <GlobalActionsBar />
      </MemoryRouter>
    );

    // abrir ayuda
    fireEvent.keyDown(window, { key: "h" });
    expect(await screen.findByText("Guía rápida de YOVI")).toBeInTheDocument();

    // pulsar Escape
    fireEvent.keyDown(window, { key: "Escape" });

    // ahora debería desaparecer
    expect(screen.queryByText("Guía rápida de YOVI")).toBeNull();
  });
});
