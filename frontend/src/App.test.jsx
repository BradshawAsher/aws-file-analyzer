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
});
