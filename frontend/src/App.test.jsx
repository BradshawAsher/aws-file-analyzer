import React, { act } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "./App";
import apiClient from "./apiClient";

vi.mock("./apiClient");

describe("App guest session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.history.replaceState({}, "", "/");
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

  test("deep links directly to /login on page load", async () => {
    window.history.replaceState({}, "", "/login");

    render(<App />);

    expect(await screen.findByRole("heading", { name: /^Log In$/i })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/login");
  });

  test("handles browser back and forward history transitions", async () => {
    window.history.replaceState({}, "", "/");

    render(<App />);

    // Click Log In on landing page
    const loginButton = await screen.findByRole("button", { name: /^Log in$/i });
    fireEvent.click(loginButton);

    expect(await screen.findByRole("heading", { name: /^Log In$/i })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/login");

    // Simulate browser Back button to "/"
    act(() => {
      window.history.replaceState({}, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(await screen.findByRole("button", { name: /Try the live analyzer as a guest/i })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");

    // Simulate browser Forward button to "/login"
    act(() => {
      window.history.replaceState({}, "", "/login");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(await screen.findByRole("heading", { name: /^Log In$/i })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/login");
  });
});

