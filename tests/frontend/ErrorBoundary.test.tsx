import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "@/components/ErrorBoundary";

function Bomb(): never {
  throw new Error("kaboom");
}

describe("ErrorBoundary", () => {
  it("renders children when no error occurs", () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("All good")).toBeInTheDocument();
  });

  it("catches child errors and shows a fallback UI", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
    expect(screen.getByText(/kaboom/)).toBeInTheDocument();
    spy.mockRestore();
  });

  it("recovers and calls onReset when Try again is pressed", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    const onReset = vi.fn();
    const { rerender } = render(
      <ErrorBoundary onReset={onReset}>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();

    rerender(
      <ErrorBoundary onReset={onReset}>
        <p>Recovered</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Recovered")).toBeInTheDocument();
    spy.mockRestore();
  });
});