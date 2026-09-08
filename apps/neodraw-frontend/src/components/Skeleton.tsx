"use client";

import type { CSSProperties } from "react";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  style?: CSSProperties;
}

export function Skeleton({ width = "100%", height = "1rem", style }: SkeletonProps) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: "0.375rem",
        background: "linear-gradient(90deg, #2a2a3e 25%, #3a3a52 50%, #2a2a3e 75%)",
        backgroundSize: "200% 100%",
        animation: "neodrawShimmer 1.5s infinite",
        ...style,
      }}
    />
  );
}

export function Spinner() {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: "1rem",
        height: "1rem",
        border: "2px solid rgba(255,255,255,0.3)",
        borderTopColor: "#fff",
        borderRadius: "50%",
        animation: "neodrawSpin 0.7s linear infinite",
      }}
    />
  );
}

export function CanvasSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#1a1a2e" }}>
      <div style={{ display: "flex", gap: "0.5rem", padding: "0.5rem 1rem", background: "#16162a", borderBottom: "1px solid #333" }}>
        <Skeleton width={38} height={34} />
        <Skeleton width={38} height={34} />
        <Skeleton width={38} height={34} />
        <Skeleton width={38} height={34} />
        <div style={{ marginLeft: "auto", display: "flex", gap: "0.75rem" }}>
          <Skeleton width={90} height={34} />
          <Skeleton width={38} height={34} />
        </div>
      </div>
      <div style={{ flex: 1, padding: "2rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <Skeleton width="45%" height={16} />
        <Skeleton width="70%" height={16} />
        <Skeleton width="30%" height={16} />
      </div>
    </div>
  );
}