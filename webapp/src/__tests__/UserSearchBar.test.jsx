import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import UserSearchBar from "../components/UserSearchBar";

const mockedNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockedNavigate,
  };
});

vi.mock("../services/leaderboardApi", () => ({
  fetchUserSuggestions: vi.fn(),
  resolveUserExact: vi.fn(),
}));

import { fetchUserSuggestions, resolveUserExact } from "../services/leaderboardApi";

describe("UserSearchBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchUserSuggestions.mockResolvedValue({ items: ["Anabel"] });
  });

  it("hace debounce y muestra sugerencias", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <UserSearchBar />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/buscar usuario/i), "anabe");
    await waitFor(() => expect(fetchUserSuggestions).toHaveBeenCalled(), { timeout: 2000 });
    expect(screen.getByRole("button", { name: "Anabel" })).toBeInTheDocument();
  });

  it("al pulsar enter con coincidencia exacta navega al perfil", async () => {
    const user = userEvent.setup();
    resolveUserExact.mockResolvedValue({ username: "Ana" });

    render(
      <MemoryRouter>
        <UserSearchBar />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/buscar usuario/i), "Ana");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(resolveUserExact).toHaveBeenCalled(), { timeout: 2000 });
    expect(mockedNavigate).toHaveBeenCalledWith("/user/Ana");
  });
});
