import React, { useState, useEffect, useRef, useMemo } from "react";
import apiClient from "./apiClient";
import AiVoicePlayer from "./AiVoicePlayer";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Geolocation coordinate dictionary for landmarks, cities, and countries
const GEO_DICTIONARY = {
  // Landmarks
  "eiffel tower": [48.8584, 2.2945],
  "louvre": [48.8606, 2.3376],
  "notre dame": [48.8530, 2.3499],
  "arc de triomphe": [48.8738, 2.2950],
  "big ben": [51.5007, -0.1246],
  "tower bridge": [51.5055, -0.0754],
  "london eye": [51.5033, -0.1195],
  "statue of liberty": [40.6892, -74.0445],
  "empire state building": [40.7484, -73.9857],
  "times square": [40.7580, -73.9855],
  "central park": [40.7829, -73.9654],
  "brooklyn bridge": [40.7061, -73.9969],
  "golden gate bridge": [37.8199, -122.4783],
  "alcatraz": [37.8267, -122.4230],
  "space needle": [47.6205, -122.3493],
  "hollywood": [34.1016, -118.3268],
  "mount fuji": [35.3606, 138.7274],
  "tokyo tower": [35.6586, 139.7454],
  "shibuya crossing": [35.6595, 139.7005],
  "colosseum": [41.8902, 12.4922],
  "vatican": [41.9029, 12.4534],
  "trevi fountain": [41.9009, 12.4833],
  "sydney opera house": [-33.8568, 151.2153],
  "sydney harbour bridge": [-33.8523, 151.2108],
  "pyramids": [29.9792, 31.1342],
  "giza": [29.9792, 31.1342],
  "sphinx": [29.9753, 31.1376],
  "burj khalifa": [25.1972, 55.2744],
  "great wall": [40.4319, 116.5704],
  "taj mahal": [27.1751, 78.0421],
  "machu picchu": [-13.1631, -72.5450],
  "christ the redeemer": [-22.9519, -43.2105],
  "sagrada familia": [41.4036, 2.1744],
  "cn tower": [43.6426, -79.3871],
  "taipei 101": [25.0339, 121.5645],

  // Cities
  "paris": [48.8566, 2.3522],
  "london": [51.5074, -0.1278],
  "new york": [40.7128, -74.0060],
  "new york city": [40.7128, -74.0060],
  "san francisco": [37.7749, -122.4194],
  "seattle": [47.6062, -122.3321],
  "los angeles": [34.0522, -118.2437],
  "chicago": [41.8781, -87.6298],
  "tokyo": [35.6762, 139.6503],
  "rome": [41.9028, 12.4964],
  "sydney": [-33.8688, 151.2093],
  "cairo": [30.0444, 31.2357],
  "dubai": [25.2048, 55.2708],
  "beijing": [39.9042, 116.4074],
  "shanghai": [31.2304, 121.4737],
  "hong kong": [22.3193, 114.1694],
  "singapore": [1.3521, 103.8198],
  "seoul": [37.5665, 126.9780],
  "berlin": [52.5200, 13.4050],
  "barcelona": [41.3879, 2.1699],
  "madrid": [40.4168, -3.7038],
  "amsterdam": [52.3676, 4.9041],
  "toronto": [43.6532, -79.3832],
  "vancouver": [49.2827, -123.1207],
  "rio de janeiro": [-22.9068, -43.1729],
  "mexico city": [19.4326, -99.1332],
  "mumbai": [19.0760, 72.8777],
  "bangkok": [13.7563, 100.5018],
  "taipei": [25.0330, 121.5654],

  // Countries
  "france": [46.2276, 2.2137],
  "united states": [37.0902, -95.7129],
  "usa": [37.0902, -95.7129],
  "united kingdom": [55.3781, -3.4360],
  "uk": [55.3781, -3.4360],
  "italy": [41.8719, 12.5674],
  "japan": [36.2048, 138.2529],
  "australia": [-25.2744, 133.7751],
  "germany": [51.1657, 10.4515],
  "canada": [56.1304, -106.3468],
  "spain": [40.4637, -3.7492],
  "china": [35.8617, 104.1954],
  "brazil": [-14.2350, -51.9253],
  "india": [20.5937, 78.9629],
  "egypt": [26.8206, 30.8025],
  "united arab emirates": [23.4241, 53.8478],
  "uae": [23.4241, 53.8478],
  "mexico": [23.6345, -102.5528],
  "south korea": [35.9078, 127.7669],
  "taiwan": [23.6978, 120.9605]
};

function parseAnalysisText(text) {
  if (!text) return {};
  if (typeof text === "object") return text;
  try {
    let clean = text.trim();
    if (clean.startsWith("```json")) clean = clean.slice(7);
    if (clean.startsWith("```")) clean = clean.slice(3);
    if (clean.endsWith("```")) clean = clean.slice(0, -3);
    return JSON.parse(clean.trim());
  } catch {
    return { caption: text };
  }
}

function resolveCoordinates(parsed) {
  if (!parsed) return null;
  const lookup = (key) => {
    if (!key || typeof key !== "string") return null;
    const clean = key.trim().toLowerCase();
    return GEO_DICTIONARY[clean] || null;
  };

  return (
    lookup(parsed.landmark) ||
    lookup(parsed.city) ||
    lookup(parsed.region) ||
    lookup(parsed.country) ||
    null
  );
}

function getCategoryColor(category) {
  const c = (category || "").toLowerCase();
  if (c.includes("arch") || c.includes("build") || c.includes("urban")) return "bg-purple-100 text-purple-800 border-purple-200";
  if (c.includes("nat") || c.includes("out") || c.includes("land")) return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (c.includes("tech") || c.includes("code") || c.includes("app")) return "bg-blue-100 text-blue-800 border-blue-200";
  if (c.includes("food") || c.includes("drink")) return "bg-amber-100 text-amber-800 border-amber-200";
  if (c.includes("peop") || c.includes("port")) return "bg-pink-100 text-pink-800 border-pink-200";
  return "bg-slate-100 text-slate-800 border-slate-200";
}

export default function GalleryView({ onBackToAnalyzer, onSignIn, isGuest, handleLogout }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "map"
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  const fetchGallery = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiClient.get("/api/ai/ListAnalysisResults");
      const data = Array.isArray(response.data) ? response.data : [];
      setItems(data);
    } catch (err) {
      if (err.response?.status === 404) {
        setItems([]);
      } else {
        const detail = err.response?.data?.message || err.response?.data || "Unable to fetch gallery";
        setError(typeof detail === "string" ? detail : "Failed to load gallery results.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGallery();
  }, []);

  // Filter items
  const processedItems = useMemo(() => {
    return items.map((item) => {
      const parsed = parseAnalysisText(item.analysisText);
      const coords = resolveCoordinates(parsed);
      const category = (parsed.category || (item.fileExtension?.includes("image") ? "Image" : "Document")).toLowerCase();
      const locationText = [parsed.landmark, parsed.city, parsed.country].filter(Boolean).join(", ");
      return {
        ...item,
        parsed,
        coords,
        category,
        locationText
      };
    });
  }, [items]);

  const categories = useMemo(() => {
    const set = new Set();
    processedItems.forEach((it) => {
      if (it.parsed?.category) set.add(it.parsed.category.toLowerCase());
    });
    return ["all", ...Array.from(set)];
  }, [processedItems]);

  const filteredItems = useMemo(() => {
    return processedItems.filter((item) => {
      if (selectedCategory !== "all" && item.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.localFileName?.toLowerCase().includes(q);
        const matchesCaption = item.parsed?.caption?.toLowerCase().includes(q);
        const matchesSummary = item.parsed?.summary?.toLowerCase().includes(q);
        const matchesLandmark = item.parsed?.landmark?.toLowerCase().includes(q);
        const matchesLocation = item.locationText?.toLowerCase().includes(q);
        return matchesName || matchesCaption || matchesSummary || matchesLandmark || matchesLocation;
      }
      return true;
    });
  }, [processedItems, selectedCategory, searchQuery]);

  // Leaflet Map Initialization
  useEffect(() => {
    if (viewMode !== "map" || !mapContainerRef.current) return;
    if (typeof window === "undefined") return;

    // Destroy existing map instance if any
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    try {
      const map = L.map(mapContainerRef.current, {
        center: [25, 10],
        zoom: 2,
        minZoom: 2,
        maxZoom: 18,
        worldCopyJump: true
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(map);

      const markers = [];
      filteredItems.forEach((item) => {
        if (!item.coords) return;
        const [lat, lng] = item.coords;

        // Custom pulsing marker
        const pinIcon = L.divIcon({
          className: "custom-pin",
          html: `
            <div style="
              width: 34px;
              height: 34px;
              border-radius: 50%;
              background: linear-gradient(135deg, #2563eb, #7c3aed);
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 16px;
              box-shadow: 0 0 12px rgba(37,99,235,0.7);
              border: 2px solid white;
              cursor: pointer;
            ">
              📍
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 34],
          popupAnchor: [0, -34]
        });

        const popupContent = document.createElement("div");
        popupContent.style.maxWidth = "220px";
        popupContent.style.padding = "4px";

        const thumbnailHtml = item.presignedUrl && item.fileExtension?.includes("image")
          ? `<img src="${item.presignedUrl}" alt="${item.localFileName}" style="width: 100%; height: 110px; object-fit: cover; border-radius: 8px; margin-bottom: 8px;" />`
          : `<div style="background: #f1f5f9; padding: 12px; border-radius: 8px; font-size: 11px; margin-bottom: 8px; text-align: center;">📄 ${item.localFileName}</div>`;

        popupContent.innerHTML = `
          ${thumbnailHtml}
          <div style="font-weight: 700; font-size: 13px; color: #0f172a; margin-bottom: 2px;">
            ${item.parsed?.landmark || item.localFileName}
          </div>
          ${item.locationText ? `<div style="font-size: 11px; color: #2563eb; margin-bottom: 4px;">📍 ${item.locationText}</div>` : ""}
          <div style="font-size: 11px; color: #475569; margin-bottom: 8px; max-height: 48px; overflow: hidden; text-overflow: ellipsis;">
            ${item.parsed?.caption || item.parsed?.summary || "No description available"}
          </div>
          <button id="view-pin-${item.id}" style="
            background: #2563eb;
            color: white;
            border: none;
            border-radius: 6px;
            padding: 4px 10px;
            font-size: 11px;
            font-weight: 600;
            width: 100%;
            cursor: pointer;
          ">
            View Analysis Details
          </button>
        `;

        const marker = L.marker([lat, lng], { icon: pinIcon }).addTo(map);
        marker.bindPopup(popupContent);

        marker.on("popupopen", () => {
          const btn = document.getElementById(`view-pin-${item.id}`);
          if (btn) {
            btn.onclick = () => setSelectedItem(item);
          }
        });

        markers.push(marker);
      });

      // Fit map to markers if there are pins
      if (markers.length > 0) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.3));
      }

      mapInstanceRef.current = map;
    } catch (e) {
      console.warn("Leaflet map initialization skipped or not supported in this environment:", e);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [viewMode, filteredItems]);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 bg-white/90 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-blue-100 text-blue-700 text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
              Durable Cloud Storage & AI Archive
            </span>
            {isGuest && (
              <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                Guest Demo
              </span>
            )}
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Photo Gallery & Geolocation Map
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Browse files and images stored in AWS S3 with multimodal Gemini intelligence persisted in Azure SQL.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onBackToAnalyzer}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition"
          >
            ← Back to Analyzer
          </button>
          {isGuest && onSignIn ? (
            <button
              onClick={onSignIn}
              className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition"
            >
              Sign In
            </button>
          ) : handleLogout ? (
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition"
            >
              Log Out
            </button>
          ) : null}
        </div>
      </div>

      {/* View Switcher, Search, and Category Filters */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-8 space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Mode Toggle: Grid vs Map */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${
                viewMode === "grid"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>🖼️</span> Photo Grid ({filteredItems.length})
            </button>
            <button
              onClick={() => setViewMode("map")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${
                viewMode === "map"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>🗺️</span> World Map View
            </button>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Search landmark, city, caption..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="absolute left-3 top-2.5 text-slate-400 text-sm">🔍</span>
          </div>
        </div>

        {/* Category Pills */}
        {categories.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <span className="text-xs font-semibold text-slate-400 mr-1 uppercase">Categories:</span>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition ${
                  selectedCategory === cat
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white rounded-2xl p-16 text-center border border-slate-200 shadow-sm">
          <div className="inline-block animate-spin text-3xl mb-4">🌀</div>
          <div className="text-slate-600 font-medium">Fetching gallery archive from Azure SQL & S3...</div>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center text-rose-800">
          <div className="text-2xl mb-2">⚠️</div>
          <div className="font-bold text-base mb-1">Failed to load gallery</div>
          <div className="text-sm text-rose-600 mb-4">{error}</div>
          <button
            onClick={fetchGallery}
            className="px-4 py-2 bg-rose-600 text-white text-sm font-semibold rounded-xl hover:bg-rose-700"
          >
            Try Again
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 text-center border border-slate-200 shadow-sm">
          <div className="text-4xl mb-3">📁</div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">No analyzed files found</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
            Upload images or documents in the Analyzer tab to have Gemini extract landmarks, locations, and descriptions into this gallery!
          </p>
          <button
            onClick={onBackToAnalyzer}
            className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-md hover:bg-blue-700 transition"
          >
            Go to Analyzer →
          </button>
        </div>
      ) : viewMode === "map" ? (
        <div className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600 font-medium">
            <span>
              📍 Showing {filteredItems.filter((i) => i.coords).length} photos with detected geographic landmarks
            </span>
            <span className="text-slate-400">Click any marker pin for details</span>
          </div>
          <div
            ref={mapContainerRef}
            style={{ height: "550px", width: "100%" }}
            className="z-0"
          />
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => {
            const isImage = item.fileExtension?.includes("image") || /\.(png|jpe?g|gif|webp)$/i.test(item.localFileName);
            return (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="group bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-lg transition cursor-pointer flex flex-col"
              >
                {/* Media Preview */}
                <div className="relative aspect-video w-full bg-slate-100 overflow-hidden">
                  {isImage && item.presignedUrl ? (
                    <img
                      src={item.presignedUrl}
                      alt={item.localFileName}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      onError={(e) => {
                        e.target.style.display = "none";
                        e.target.parentElement.innerHTML = `<div class="grid place-items-center h-full text-slate-400 text-sm">🖼️ ${item.localFileName}</div>`;
                      }}
                    />
                  ) : (
                    <div className="grid place-items-center h-full bg-slate-50 text-slate-400">
                      <div className="text-center p-4">
                        <span className="text-4xl block mb-1">📄</span>
                        <span className="text-xs font-semibold text-slate-600 truncate max-w-[200px] block">
                          {item.localFileName}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Category Pill on Image */}
                  <div className="absolute top-3 left-3">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border shadow-sm ${getCategoryColor(item.parsed?.category)}`}>
                      {item.parsed?.category || (isImage ? "Photo" : "Document")}
                    </span>
                  </div>

                  {/* Confidence Pill */}
                  {item.parsed?.confidence && (
                    <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white text-[11px] font-semibold px-2 py-0.5 rounded-full">
                      {Math.round(item.parsed.confidence * 100)}% match
                    </div>
                  )}
                </div>

                {/* Card Body */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    {item.locationText && (
                      <div className="flex items-center gap-1 text-xs font-semibold text-blue-600 mb-1.5">
                        <span>📍</span>
                        <span className="truncate">{item.locationText}</span>
                      </div>
                    )}
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition truncate mb-2">
                      {item.parsed?.landmark || item.localFileName}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed mb-4">
                      {item.parsed?.caption || item.parsed?.summary || "No caption available"}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-[11px] text-slate-400">
                    <span>
                      {item.loadTime ? new Date(item.loadTime).toLocaleDateString() : "Archived"}
                    </span>
                    <span className="font-semibold text-blue-600 group-hover:underline">
                      View Details →
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header Media */}
            <div className="relative bg-slate-950 max-h-80 overflow-hidden flex items-center justify-center">
              {selectedItem.fileExtension?.includes("image") && selectedItem.presignedUrl ? (
                <img
                  src={selectedItem.presignedUrl}
                  alt={selectedItem.localFileName}
                  className="w-full h-full max-h-80 object-contain"
                />
              ) : (
                <div className="p-12 text-center text-slate-400">
                  <span className="text-6xl block mb-2">📄</span>
                  <span className="text-sm font-semibold">{selectedItem.localFileName}</span>
                </div>
              )}
              <button
                onClick={() => setSelectedItem(null)}
                className="absolute top-4 right-4 bg-black/60 hover:bg-black/90 text-white rounded-full h-8 w-8 grid place-items-center transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full border ${getCategoryColor(selectedItem.parsed?.category)}`}>
                    {selectedItem.parsed?.category || "Analyzed Asset"}
                  </span>
                  {selectedItem.parsed?.confidence && (
                    <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                      Confidence: {Math.round(selectedItem.parsed.confidence * 100)}%
                    </span>
                  )}
                </div>
                <AiVoicePlayer analysisText={selectedItem.analysisText} />
              </div>

              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {selectedItem.parsed?.landmark || selectedItem.localFileName}
                </h2>
                {selectedItem.locationText && (
                  <p className="text-sm font-semibold text-blue-600 mt-1">
                    📍 {selectedItem.locationText}
                  </p>
                )}
              </div>

              {/* Caption / Summary */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Gemini AI Description
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {selectedItem.parsed?.caption || selectedItem.parsed?.summary || "No caption available."}
                </p>
              </div>

              {/* Justification */}
              {selectedItem.parsed?.justification && (
                <div className="bg-blue-50/60 rounded-2xl p-4 border border-blue-100">
                  <div className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-1">
                    AI Vision Reasoning & Analysis
                  </div>
                  <p className="text-xs text-blue-900 leading-relaxed">
                    {selectedItem.parsed.justification}
                  </p>
                </div>
              )}

              {/* Technical Cloud Metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Storage Bucket</span>
                  <span className="font-semibold text-slate-800">AWS S3 (Private)</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Database</span>
                  <span className="font-semibold text-slate-800">Azure SQL Serverless</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Multimodal AI</span>
                  <span className="font-semibold text-slate-800">Google Cloud Gemini</span>
                </div>
              </div>

              {/* Close Button */}
              <div className="pt-2 text-right">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="px-5 py-2 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
