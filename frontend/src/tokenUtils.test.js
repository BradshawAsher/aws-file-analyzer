import { isJwtUsable } from "./tokenUtils";

function tokenWithExpiration(expiration) {
  const payload = btoa(JSON.stringify({ exp: expiration }))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `header.${payload}.signature`;
}

describe("isJwtUsable", () => {
  test("accepts an unexpired JWT", () => {
    expect(isJwtUsable(tokenWithExpiration(2_000), 1_000_000)).toBe(true);
  });

  test("rejects expired and malformed tokens", () => {
    expect(isJwtUsable(tokenWithExpiration(500), 1_000_000)).toBe(false);
    expect(isJwtUsable("not-a-jwt", 1_000_000)).toBe(false);
  });
});
