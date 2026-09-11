import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { IconButton } from "@/components/IconButton";

describe("IconButton", () => {
  it("renders the icon character for a known label", () => {
    render(<IconButton label="rect" onClick={() => {}} />);
    expect(screen.getByTitle("rect")).toHaveTextContent("▭");
  });

  it("falls back to the raw label for unknown labels", () => {
    render(<IconButton label="custom-tool" onClick={() => {}} />);
    expect(screen.getByTitle("custom-tool")).toHaveTextContent("custom-tool");
  });

  it("applies active styling", () => {
    render(<IconButton label="pencil" active onClick={() => {}} />);
    const btn = screen.getByTitle("pencil");
    expect(btn).toHaveStyle({ background: "#ffffff", fontWeight: "bold" });
  });

  it("disables the button and reflects it in styling", () => {
    render(<IconButton label="undo" disabled onClick={() => {}} />);
    const btn = screen.getByTitle("undo");
    expect(btn).toBeDisabled();
    expect(btn).toHaveStyle({ opacity: "0.5", cursor: "not-allowed" });
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<IconButton label="redo" onClick={onClick} />);
    fireEvent.click(screen.getByTitle("redo"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});