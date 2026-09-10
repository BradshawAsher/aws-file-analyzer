import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "./App";
import apiClient from "./apiClient";

vi.mock("./apiClient");

describe("App guest session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  test("starts the real analyzer as a guest and offers sign in", async () => {
    apiClient.post.mockResolvedValueOnce({
      data: { accessToken: "guest-jwt", expiresInSeconds: 900, isGuest: true },
    });

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Try the live analyzer as a guest/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith("/api/Security/guest-session");
      expect(localStorage.getItem("authToken")).toBe("guest-jwt");
    });

    expect(screen.getByText(/short-lived guest session/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Sign in$/i }));
    expect(await screen.findByRole("heading", { name: /^Log In$/i })).toBeInTheDocument();
    expect(localStorage.getItem("authToken")).toBeNull();
  });

  test("restores staged guest uploads and claims them on user login", async () => {
    localStorage.setItem(
      "pending_guest_claim",
      JSON.stringify({
        fileUrls: ["https://example.com/test.png"],
        fileNames: ["test.png"],
        analyzeResults: [{ caption: "Staged test image", summary: "A claimed image" }],
      })
    );

    apiClient.post.mockResolvedValueOnce({
      data: { claimedCount: 1, message: "Claimed successfully" },
    });

    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const payload = btoa(JSON.stringify({ role: "User", name: "alice", exp: futureExp }));
    const userJwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${payload}.dummy`;
    localStorage.setItem("authToken", userJwt);

    render(<App />);

    expect(
      await screen.findByText(/Your guest demo upload and AI analysis were successfully claimed/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Staged test image/i)).toBeInTheDocument();
    expect(localStorage.getItem("pending_guest_claim")).toBeNull();
  });
});

