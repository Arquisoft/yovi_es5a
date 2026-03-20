/* import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PlayerBadge from "../header/PlayerBadge";

describe("PlayerBadge", () => {
  it("muestra el label pasado por props", () => {
    render(<PlayerBadge label="Jugador 1" />);
    expect(screen.getByText("Jugador 1")).toBeInTheDocument();
  });

  it("usa el color por defecto cuando no se pasa color", () => {
    render(<PlayerBadge label="J1" />);
    const circle = screen.getByText("J1").previousSibling; 
    expect(circle).toHaveStyle({ background: "#ccc" });
  });

  it("usa el color proporcionado en la prop color", () => {
    render(<PlayerBadge label="J1" color="#ff0000" />);
    const circle = screen.getByText("J1").previousSibling;
    expect(circle).toHaveStyle({ background: "#ff0000" });
  });

  it("cuando active=false no aplica sombra y baja un poco la opacidad", () => {
    render(<PlayerBadge label="J1" active={false} />);
    const circle = screen.getByText("J1").previousSibling;
    expect(circle).toHaveStyle({ boxShadow: "none" });
    expect(circle).toHaveStyle({ opacity: "0.9" });
  });

  it("cuando active=true aplica sombra y opacidad 1", () => {
    render(<PlayerBadge label="J1" color="#00ff00" active={true} />);
    const circle = screen.getByText("J1").previousSibling;

    expect(circle).toHaveStyle({
      boxShadow: "0 6px 14px rgba(100,112,255,0.22)",
    });
    expect(circle).toHaveStyle({ opacity: "1" });
  });
});
 */