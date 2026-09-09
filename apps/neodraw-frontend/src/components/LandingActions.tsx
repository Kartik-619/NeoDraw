"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

function startScene(path: string): void {
  window.dispatchEvent(new CustomEvent<string>("neodraw:fade", { detail: path }));
}

export function LandingActions() {
  const [authed, setAuthed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setAuthed(Boolean(localStorage.getItem("token")));
  }, [pathname]);

  const startDrawing = useCallback(() => {
    startScene(authed ? "/dashboard" : "/signup");
  }, [authed]);

  const secondary = useCallback(() => {
    startScene(authed ? "/joinroom" : "/signin");
  }, [authed]);

  return (
    <div className="flex flex-col items-center gap-5">
      <button onClick={startDrawing} className="black-btn">
        {authed ? "Your Boards" : "Start Drawing"}
      </button>
      <button onClick={secondary} className="text-link">
        {authed ? "Join a Room" : "Sign In"}
      </button>
    </div>
  );
}