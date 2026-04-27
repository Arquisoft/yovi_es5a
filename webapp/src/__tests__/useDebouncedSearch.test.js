import React from "react";
import { act, render, screen } from "@testing-library/react";
import useDebouncedValue from "../hooks/useDebouncedValue";

function Harness({ value }) {
  const debounced = useDebouncedValue(value, 400);
  return React.createElement("div", null, debounced);
}

describe("useDebouncedValue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retrasa actualización del valor", () => {
    const { rerender } = render(React.createElement(Harness, { value: "a" }));
    rerender(React.createElement(Harness, { value: "abc" }));

    expect(screen.getByText("a")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByText("abc")).toBeInTheDocument();
  });
});
