"use client";

interface IconButtonProps {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export function IconButton({ label, active, disabled, onClick }: IconButtonProps) {
  const iconMap: Record<string, string> = {
    rect: "▭",
    circle: "○",
    diamond: "◇",
    pencil: "✎",
    text: "T",
    select: "↖",
    eraser: "⌫",
    undo: "↶",
    redo: "↷",
    "zoom-in": "＋",
    "zoom-out": "－",
    "zoom-reset": "⌂",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      style={{
        padding: "0.375rem 0.625rem",
        background: active ? "#ffffff" : "transparent",
        color: disabled ? "#555" : active ? "#000000" : "#dddddd",
        border: active ? "2px solid #ffffff" : "2px solid transparent",
        borderRadius: "0.375rem",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: "1.1rem",
        fontWeight: active ? "bold" : "normal",
        lineHeight: 1,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {iconMap[label] || label}
    </button>
  );
}