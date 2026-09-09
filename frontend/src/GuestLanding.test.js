import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import GuestLanding from "./GuestLanding";

describe("GuestLanding", () => {
  test("lets guests explore the project and open authentication", () => {
    const onLogin = jest.fn();
    const onTryGuest = jest.fn();
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
    render(<GuestLanding onLogin={jest.fn()} onTryGuest={jest.fn()} />);

    fireEvent.click(screen.getByRole("tab", { name: "Document" }));
    expect(screen.getByText("research-notes.pdf")).toBeInTheDocument();
    expect(screen.getByText(/compares managed cloud storage patterns/i)).toBeInTheDocument();
  });
});
