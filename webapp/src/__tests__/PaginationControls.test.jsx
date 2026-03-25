import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PaginationControls from "../components/PaginationControls";

describe("PaginationControls", () => {
  it("deshabilita anterior/siguiente en límites", () => {
    render(
      <PaginationControls
        page={1}
        totalPages={1}
        pageSize={25}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /anterior/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /siguiente/i })).toBeDisabled();
  });

  it("dispara callbacks de cambio de página y tamaño", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();

    render(
      <PaginationControls
        page={2}
        totalPages={5}
        pageSize={25}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    );

    await user.click(screen.getByRole("button", { name: /anterior/i }));
    await user.click(screen.getByRole("button", { name: /siguiente/i }));
    await user.selectOptions(screen.getByRole("combobox"), "50");

    expect(onPageChange).toHaveBeenCalledWith(1);
    expect(onPageChange).toHaveBeenCalledWith(3);
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });
});
