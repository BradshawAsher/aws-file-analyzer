export function isJwtUsable(token, now = Date.now()) {
  if (!token || typeof token !== "string") return false;

  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return false;

    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded));

    return typeof payload.exp === "number" && payload.exp * 1000 > now;
  } catch {
    return false;
  }
}
