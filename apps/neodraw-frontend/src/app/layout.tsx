import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NeoDraw — Collaborative Whiteboard",
  description: "Real-time collaborative drawing platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
