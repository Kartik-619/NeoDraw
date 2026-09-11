import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthPage } from "@/components/AuthPage";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/auth",
}));

const setItemMock = vi.fn();

async function fillSignUpForm(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole("tab", { name: "Sign Up" }));
  await user.type(screen.getByLabelText("Name"), "Ada");
  await user.type(screen.getByLabelText("Email"), "ada@example.com");
  await user.type(screen.getByLabelText("Password"), "password123");
}

describe("AuthPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    pushMock.mockClear();
    setItemMock.mockClear();
    (window.localStorage.setItem as ReturnType<typeof vi.fn>).mockClear();
  });

  it("starts in signin mode with no name field", () => {
    render(<AuthPage />);
    expect(screen.getByRole("tab", { name: "Sign In" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  it("switches to signup mode and shows the name field", async () => {
    const user = userEvent.setup();
    render(<AuthPage />);
    await user.click(screen.getByRole("tab", { name: "Sign Up" }));
    expect(screen.getByRole("tab", { name: "Sign Up" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();
    render(<AuthPage />);
    const pwd = screen.getByLabelText("Password") as HTMLInputElement;
    const toggle = screen.getByRole("button", { name: "Show password" });
    await user.click(toggle);
    expect(pwd.type).toBe("text");
    expect(screen.getByRole("button", { name: "Hide password" })).toBeInTheDocument();
  });

  it("submits signin and navigates to the dashboard", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ token: "jwt-token" }),
      }),
    );
    (window.localStorage.setItem as ReturnType<typeof vi.fn>).mockImplementation(setItemMock);

    render(<AuthPage />);
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(setItemMock).toHaveBeenCalledWith("token", "jwt-token");
    });
    expect(pushMock).toHaveBeenCalledWith("/dashboard");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/signIn"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("shows an error message when signin fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ message: "Invalid credentials" }),
      }),
    );

    render(<AuthPage />);
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid credentials");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("submits signup and switches back to signin", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ user: { name: "Ada" } }),
      }),
    );

    render(<AuthPage />);
    await fillSignUpForm(user);
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Sign In" })).toHaveAttribute("aria-selected", "true");
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/signup"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("handles network errors gracefully", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    render(<AuthPage />);
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Network error");
  });
});