import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import GalleryView from "./GalleryView";
import apiClient from "./apiClient";

vi.mock("./apiClient", () => ({
  default: {
    get: vi.fn(),
  },
}));

describe("GalleryView Component", () => {
  const mockItems = [
    {
      id: 1,
      localFileName: "eiffel.jpg",
      fileExtension: "image/jpeg",
      presignedUrl: "https://s3.amazonaws.com/test/eiffel.jpg",
      loadTime: "2026-09-09T12:00:00Z",
      analysisText: JSON.stringify({
        landmark: "Eiffel Tower",
        city: "Paris",
        country: "France",
        category: "architecture",
        caption: "Iconic wrought-iron lattice tower in Paris.",
        confidence: 0.98,
        justification: "Clear view of the Eiffel Tower from Champ de Mars.",
      }),
    },
    {
      id: 2,
      localFileName: "serverless_guide.pdf",
      fileExtension: "application/pdf",
      presignedUrl: "https://s3.amazonaws.com/test/serverless.pdf",
      loadTime: "2026-09-09T13:00:00Z",
      analysisText: JSON.stringify({
        summary: "Architectural overview of serverless microservices.",
        category: "document",
        caption: "Cloud architecture guide for resilient distributed systems.",
      }),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders gallery cards and allows filtering", async () => {
    apiClient.get.mockResolvedValueOnce({ data: mockItems });

    const onBack = vi.fn();
    render(<GalleryView onBackToAnalyzer={onBack} />);

    // Wait for items to load
    expect(await screen.findByText(/Photo Gallery & Geolocation Map/i)).toBeInTheDocument();
    expect(await screen.findByText("Eiffel Tower")).toBeInTheDocument();
    expect(screen.getAllByText("serverless_guide.pdf")[0]).toBeInTheDocument();
    expect(screen.getByText(/Paris, France/i)).toBeInTheDocument();

    // Test back button
    fireEvent.click(screen.getByRole("button", { name: /Back to Analyzer/i }));
    expect(onBack).toHaveBeenCalledTimes(1);

    // Test switching to map view
    const mapTab = screen.getByRole("button", { name: /World Map View/i });
    fireEvent.click(mapTab);
    expect(screen.getByText(/Showing \d+ photos with detected geographic landmarks/i)).toBeInTheDocument();
  });

  test("handles empty gallery gracefully", async () => {
    apiClient.get.mockRejectedValueOnce({
      response: { status: 404, data: "No files analyzed" },
    });

    const onBack = vi.fn();
    render(<GalleryView onBackToAnalyzer={onBack} />);

    expect(await screen.findByText(/No analyzed files found/i)).toBeInTheDocument();
    const goBtn = screen.getByRole("button", { name: /Go to Analyzer →/i });
    fireEvent.click(goBtn);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
