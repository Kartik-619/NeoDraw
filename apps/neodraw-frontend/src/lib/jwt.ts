interface JwtPayload {
  userId: string;
  exp?: number;
  iat?: number;
}

export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64url = parts[1];
    if (!base64url) return null;
    const raw = base64url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = raw.padEnd(Math.ceil(raw.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded)) as JwtPayload;
    if (typeof payload.userId !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}

export function getCurrentUserId(): string | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("token");
  if (!token) return null;
  return decodeJwtPayload(token)?.userId ?? null;
}