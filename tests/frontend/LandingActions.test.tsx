import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LandingActions } from "@/components/LandingActions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
}));

describe("LandingActions", () => {
  it("shows unauthenticated actions when no token is stored", () => {
    (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
    render(<LandingActions />);
    expect(screen.getByRole("button", { name: "Start Drawing" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
  });

  it("shows authenticated actions when a token is stored", () => {
    (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue("abc");
    render(<LandingActions />);
    expect(screen.getByRole("button", { name: "Your Boards" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join a Room" })).toBeInTheDocument();
  });

  it("dispatches neodraw:fade with /signup when unauthenticated user starts drawing", async () => {
    (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const user = userEvent.setup();
    const listener = vi.fn();
    window.addEventListener("neodraw:fade", listener);

    render(<LandingActions />);
    await user.click(screen.getByRole("button", { name: "Start Drawing" }));

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ detail: "/signup", type: "neodraw:fade" }),
    );
    window.removeEventListener("neodraw:fade", listener);
  });

  it("dispatches neodraw:fade with /dashboard when authenticated", async () => {
    (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue("abc");
    const user = userEvent.setup();
    const listener = vi.fn();
    window.addEventListener("neodraw:fade", listener);

    render(<LandingActions />);
    await user.click(screen.getByRole("button", { name: "Your Boards" }));

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ detail: "/dashboard", type: "neodraw:fade" }),
    );
    window.removeEventListener("neodraw:fade", listener);
  });
});