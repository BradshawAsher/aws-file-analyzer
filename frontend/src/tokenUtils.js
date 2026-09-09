export function getJwtPayload(token) {
  if (!token || typeof token !== "string") return null;

  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return false;

    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export function isJwtUsable(token, now = Date.now()) {
  const payload = getJwtPayload(token);
  return Boolean(payload && typeof payload.exp === "number" && payload.exp * 1000 > now);
}

export function getJwtRole(token) {
  return getJwtPayload(token)?.role ?? null;
}
