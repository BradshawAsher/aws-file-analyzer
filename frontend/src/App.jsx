import React, { useState, useEffect } from "react";
import FileUploadAnalyzer from "./FileUploadAnalyze";
import AuthContainer from "./AuthContainer";
import AiVoicePlayer from "./AiVoicePlayer";
import GuestLanding from "./GuestLanding";
import GalleryView from "./GalleryView";
import apiClient from "./apiClient";
import { getJwtRole, isJwtUsable } from "./tokenUtils";

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCheckingToken, setIsCheckingToken] = useState(true);
  const [currentView, setCurrentView] = useState("home"); // "home" | "analyzer" | "gallery" | "auth"
  const [sessionType, setSessionType] = useState(null);
  const [isStartingGuest, setIsStartingGuest] = useState(false);
  const [guestError, setGuestError] = useState("");
  const [aiAnalysisText, setAiAnalysisText] = useState("");

  const setAnalysisText = (analysisText) => {
    setAiAnalysisText(analysisText);
  };

  const cleanAnalysisText = () => {
    setAiAnalysisText("");
  };

  // --- Initial Check (Login Persistence) ---
  useEffect(() => {
    // Check if a token exists in local storage when the app first loads
    const token = localStorage.getItem('authToken');
    if (isJwtUsable(token)) {
      setIsLoggedIn(true);
      setSessionType(getJwtRole(token) === "Guest" ? "guest" : "user");
      setCurrentView("analyzer");
    } else if (token) {
      localStorage.removeItem('authToken');
    }
    setIsCheckingToken(false); // Done checking
    cleanAnalysisText();
  }, []);

  // Handler passed to the LoginForm
  const handleSuccessfulLogin = () => {
    setIsLoggedIn(true);
    setSessionType("user");
    setCurrentView("analyzer");
    if (!localStorage.getItem('pending_guest_claim')) {
      cleanAnalysisText();
    }
  };

  // Handler for Log Out
  const handleLogout = () => {
    localStorage.removeItem('authToken'); // Clear the stored token
    localStorage.removeItem('pending_guest_claim');
    setIsLoggedIn(false);
    setSessionType(null);
    setCurrentView("home");
    cleanAnalysisText();
  };

  const handleGuestSession = async () => {
    setIsStartingGuest(true);
    setGuestError("");

    try {
      const response = await apiClient.post("/api/Security/guest-session");
      localStorage.setItem("authToken", response.data.accessToken);
      setIsLoggedIn(true);
      setSessionType("guest");
      setCurrentView("analyzer");
      cleanAnalysisText();
    } catch (error) {
      const detail = error.response?.data?.message || error.response?.data;
      setGuestError(typeof detail === "string" ? detail : "The guest demo is temporarily unavailable.");
    } finally {
      setIsStartingGuest(false);
    }
  };

  const handleOpenGalleryFromLanding = async () => {
    const token = localStorage.getItem('authToken');
    if (isJwtUsable(token)) {
      setIsLoggedIn(true);
      setSessionType(getJwtRole(token) === "Guest" ? "guest" : "user");
      setCurrentView("gallery");
      return;
    }

    setIsStartingGuest(true);
    setGuestError("");
    try {
      const response = await apiClient.post("/api/Security/guest-session");
      localStorage.setItem("authToken", response.data.accessToken);
      setIsLoggedIn(true);
      setSessionType("guest");
      setCurrentView("gallery");
    } catch (error) {
      const detail = error.response?.data?.message || error.response?.data;
      setGuestError(typeof detail === "string" ? detail : "Unable to load gallery demo.");
    } finally {
      setIsStartingGuest(false);
    }
  };

  const handleSignInFromGuest = () => {
    localStorage.removeItem("authToken");
    setIsLoggedIn(false);
    setSessionType(null);
    setCurrentView("auth");
  };

  // Show a loading screen while checking for a token
  if (isCheckingToken) {
    return <div className="min-h-screen flex items-center justify-center text-slate-600">Loading Application...</div>;
  }

  if (currentView === "gallery" && isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-100 p-4 sm:p-6">
        <GalleryView
          onBackToAnalyzer={() => setCurrentView("analyzer")}
          onSignIn={handleSignInFromGuest}
          isGuest={sessionType === "guest"}
          handleLogout={handleLogout}
        />
      </div>
    );
  }

  if (currentView === "analyzer" && isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 p-4 sm:p-6">
        {/* Top Navigation Bar */}
        <div className="w-full max-w-xl mb-4 flex items-center justify-between bg-white px-4 py-2.5 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentView("analyzer")}
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-blue-600 text-white shadow-sm"
            >
              🚀 Analyzer
            </button>
            <button
              onClick={() => setCurrentView("gallery")}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
            >
              🗺️ Photo Gallery & Map
            </button>
          </div>
          <div className="flex items-center gap-2">
            {sessionType === "guest" ? (
              <button
                onClick={handleSignInFromGuest}
                className="text-xs font-semibold px-2.5 py-1 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                Sign in to account
              </button>
            ) : (
              <button
                onClick={handleLogout}
                className="text-xs font-semibold px-2.5 py-1 text-rose-600 hover:bg-rose-50 rounded-lg transition"
              >
                Log Out
              </button>
            )}
          </div>
        </div>

        <FileUploadAnalyzer
          handleLogout={handleLogout}
          isGuest={sessionType === "guest"}
          onSignIn={handleSignInFromGuest}
          onViewGallery={() => setCurrentView("gallery")}
          setAnalysisText={setAnalysisText}
          cleanAnalysisText={cleanAnalysisText}
        />
        {aiAnalysisText && (
          <div className="mt-4">
            <AiVoicePlayer analysisText={aiAnalysisText} />
          </div>
        )}
      </div>
    );
  }

  if (currentView === "auth") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 p-6">
        <AuthContainer
          onLoginSuccess={handleSuccessfulLogin}
          onBack={() => setCurrentView("home")}
        />
      </div>
    );
  }

  return (
    <GuestLanding
      onLogin={() => setCurrentView("auth")}
      onTryGuest={handleGuestSession}
      onViewGallery={handleOpenGalleryFromLanding}
      isStartingGuest={isStartingGuest}
      guestError={guestError}
    />
  );
}
