/* import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { act } from "react-dom/test-utils";
import Header from "../header/Header";

vi.mock("../store/boardStore", () => ({ useBoardStore: vi.fn() }));
vi.mock("../header/PlayerBadge", () => ({
  default: ({ label, active }) => (
    <div>
      <span>{label}</span>
      <span>{active ? "ACTIVE" : "INACTIVE"}</span>
    </div>
  ),
}));

import { useBoardStore } from "../store/boardStore";

describe("Header", () => {
  const incrementElapsedSeconds = vi.fn();

  function mockStore({ elapsedSeconds = 0 } = {}) {
    useBoardStore.mockImplementation((selector) =>
      selector({ elapsedSeconds, incrementElapsedSeconds })
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockStore({ elapsedSeconds: 0 });
  });

  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("renderiza turno y tiempo formateado (mm:ss)", () => {
    mockStore({ elapsedSeconds: 65 }); // 01:05

    render(
      <Header
        currentPlayer="player1"
        turnNumber={3}
        playerColors={{ player1: "red", player2: "blue" }}
        playerOneName="Alice"
        playerTwoName="Bob"
      />
    );

    expect(screen.getByText(/turno 3/i)).toBeInTheDocument();
    expect(screen.getByText("01:05")).toBeInTheDocument();
  });

  it("marca como activo el badge del jugador actual", () => {
    render(
      <Header
        currentPlayer="player2"
        turnNumber={1}
        playerColors={{}}
        playerOneName="Alice"
        playerTwoName="Bob"
      />
    );
    const alice = screen.getByText("Alice").parentElement;
    const bob = screen.getByText("Bob").parentElement;
    
    expect(alice).toHaveTextContent("INACTIVE");
    expect(bob).toHaveTextContent("ACTIVE");
  });

  it("crea un intervalo y llama incrementElapsedSeconds cada 1 segundo", () => {
    render(
      <Header
        currentPlayer="player1"
        turnNumber={1}
        playerColors={{}}
        playerOneName="Alice"
        playerTwoName="Bob"
      />
    );

    expect(incrementElapsedSeconds).toHaveBeenCalledTimes(0);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(incrementElapsedSeconds).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(incrementElapsedSeconds).toHaveBeenCalledTimes(5);
  });

  it("limpia el intervalo al desmontar (no incrementa después)", () => {
    const { unmount } = render(
      <Header
        currentPlayer="player1"
        turnNumber={1}
        playerColors={{}}
        playerOneName="Alice"
        playerTwoName="Bob"
      />
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(incrementElapsedSeconds).toHaveBeenCalledTimes(2);

    unmount();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(incrementElapsedSeconds).toHaveBeenCalledTimes(2);
  });
});
 */