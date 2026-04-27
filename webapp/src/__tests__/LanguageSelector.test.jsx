import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LanguageSelector from "../components/LanguageSelector";
import i18n from "../i18n";

describe("LanguageSelector", () => {
  it("renderiza el selector de idioma y cambia el idioma seleccionado", async () => {
    render(<LanguageSelector />);

    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue("es");
    expect(screen.getByLabelText(/idioma|language|langue/i)).toBeInTheDocument();

    await userEvent.selectOptions(select, "en");
    expect(i18n.language?.split("-")[0]).toBe("en");
  });
});
