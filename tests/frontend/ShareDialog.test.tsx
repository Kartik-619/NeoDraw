import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShareDialog } from "@/components/ShareDialog";
import { clipboardMocks } from "./setup";

const { updateRoomPermissionMock } = vi.hoisted(() => ({
  updateRoomPermissionMock: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/draw/http", () => ({
  updateRoomPermission: updateRoomPermissionMock,
}));

describe("ShareDialog", () => {
  afterEach(() => {
    updateRoomPermissionMock.mockReset();
    updateRoomPermissionMock.mockResolvedValue(true);
    clipboardMocks.writeText.mockClear();
  });

  const baseProps = {
    roomSlug: "my-room",
    isAdmin: true,
    editPermission: "anyone" as const,
    onPermissionChange: vi.fn(),
    onClose: vi.fn(),
  };

  it("renders the share panel with the room heading", () => {
    render(<ShareDialog {...baseProps} />);
    expect(screen.getByText("Share this room")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });

  it("closes when the backdrop is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(<ShareDialog {...baseProps} onClose={onClose} />);
    await user.click(container.firstChild as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when the inner card is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ShareDialog {...baseProps} onClose={onClose} />);
    const card = screen.getByRole("heading", { name: "Share this room" }).parentElement;
    await user.click(card as Element);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("copies the current URL to the clipboard", async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, "location", {
      value: { href: "http://test.local/canvas/my-room" },
      writable: true,
    });
    render(<ShareDialog {...baseProps} />);
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(clipboardMocks.writeText).toHaveBeenCalledWith("http://test.local/canvas/my-room");
    expect(await screen.findByText("Copied!")).toBeInTheDocument();
  });

  it("updates permission via the API when admin changes radios", async () => {
    const user = userEvent.setup();
    const onPermissionChange = vi.fn();
    let resolvePermission: ((value: boolean) => void) | undefined;
    updateRoomPermissionMock.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolvePermission = resolve;
        }),
    );

    render(<ShareDialog {...baseProps} onPermissionChange={onPermissionChange} />);
    await user.click(screen.getByLabelText("Only the owner can edit"));

    expect(await screen.findByText("Saving…")).toBeInTheDocument();
    expect(updateRoomPermissionMock).toHaveBeenCalledWith("my-room", "admin");
    resolvePermission?.(true);
    await waitFor(() => {
      expect(onPermissionChange).toHaveBeenCalledWith("admin");
    });
    expect(screen.queryByText("Saving…")).not.toBeInTheDocument();
  });

  it("disables permission radios for non-admins", async () => {
    render(<ShareDialog {...baseProps} isAdmin={false} />);
    expect(screen.getByLabelText("Anyone with the link can edit")).toBeDisabled();
    expect(screen.getByLabelText("Only the owner can edit")).toBeDisabled();
    expect(screen.getByText(/Only the room owner/)).toBeInTheDocument();
  });

  it("closes when the Close button is pressed", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ShareDialog {...baseProps} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});