import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import useDebouncedValue from "../hooks/useDebouncedValue";

function Harness({ value }) {
  const debounced = useDebouncedValue(value, 400);
  return <div>{debounced}</div>;
}

describe("useDebouncedValue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retrasa actualización del valor", () => {
    const { rerender } = render(<Harness value="a" />);
    rerender(<Harness value="abc" />);

    expect(screen.getByText("a")).toBeInTheDocument();
    vi.advanceTimersByTime(400);
    expect(screen.getByText("abc")).toBeInTheDocument();
  });
});
