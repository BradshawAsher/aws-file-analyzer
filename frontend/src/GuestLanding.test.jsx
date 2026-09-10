import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import GuestLanding from "./GuestLanding";

describe("GuestLanding", () => {
  test("lets guests explore the project and open authentication", () => {
    const onLogin = vi.fn();
    const onTryGuest = vi.fn();
    render(<GuestLanding onLogin={onLogin} onTryGuest={onTryGuest} />);

    expect(screen.getByRole("heading", { name: /Analyze files across four cloud platforms/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Explore Swagger API/i })).toHaveAttribute(
      "href",
      "https://localhost:5000/swagger/index.html"
    );

    fireEvent.click(screen.getByRole("button", { name: /Try the live analyzer as a guest/i }));
    expect(onTryGuest).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /^Log in$/i }));
    expect(onLogin).toHaveBeenCalledTimes(1);
  });

  test("switches the interactive sample", () => {
    render(<GuestLanding onLogin={vi.fn()} onTryGuest={vi.fn()} />);

    fireEvent.click(screen.getByRole("tab", { name: "Document" }));
    expect(screen.getByText("research-notes.pdf")).toBeInTheDocument();
    expect(screen.getByText(/compares managed cloud storage patterns/i)).toBeInTheDocument();
  });

  test("renders authenticated navigation when user is logged in", () => {
    const onGoToAnalyzer = vi.fn();
    const onLogout = vi.fn();

    render(
      <GuestLanding
        isLoggedIn={true}
        onGoToAnalyzer={onGoToAnalyzer}
        onLogout={onLogout}
      />
    );

    const openBtn = screen.getByRole("button", { name: /Open Analyzer/i });
    expect(openBtn).toBeInTheDocument();
    fireEvent.click(openBtn);
    expect(onGoToAnalyzer).toHaveBeenCalledTimes(1);

    const heroBtn = screen.getByRole("button", { name: /Open Live Analyzer/i });
    expect(heroBtn).toBeInTheDocument();

    const logoutBtn = screen.getByRole("button", { name: /Log out/i });
    expect(logoutBtn).toBeInTheDocument();
    fireEvent.click(logoutBtn);
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
