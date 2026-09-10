import React, { useState, useEffect } from "react";
import FileUploadAnalyzer from "./FileUploadAnalyze";
import AuthContainer from "./AuthContainer";
import AiVoicePlayer from "./AiVoicePlayer";
import GuestLanding from "./GuestLanding";
import GalleryView from "./GalleryView";
import apiClient, { API_BASE_URL } from "./apiClient";
import { getJwtRole, isJwtUsable } from "./tokenUtils";
import { getRouteFromLocation, navigateTo } from "./router";

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCheckingToken, setIsCheckingToken] = useState(true);
  const [currentView, setCurrentView] = useState(() => getRouteFromLocation().view); // "home" | "analyzer" | "gallery" | "auth"
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

  // --- Initial Check (Login Persistence & Deep Linking) ---
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const route = getRouteFromLocation();

    if (isJwtUsable(token)) {
      setIsLoggedIn(true);
      setSessionType(getJwtRole(token) === "Guest" ? "guest" : "user");
      if (localStorage.getItem('pending_guest_claim') || route.view === "auth") {
        navigateTo("/analyzer", { replace: true });
        setCurrentView("analyzer");
      } else {
        setCurrentView(route.view);
      }
    } else {
      if (token) {
        localStorage.removeItem('authToken');
      }
      if (route.view === "gallery") {
        handleOpenGalleryFromLanding();
      } else if (route.view === "analyzer") {
        handleGuestSession();
      } else {
        setCurrentView(route.view);
      }
    }
    setIsCheckingToken(false);
    cleanAnalysisText();
  }, []);

  // --- Browser History (Back / Forward) Listener ---
  useEffect(() => {
    const handlePopState = () => {
      const route = getRouteFromLocation();
      setCurrentView(route.view);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Handler passed to the LoginForm
  const handleSuccessfulLogin = () => {
    setIsLoggedIn(true);
    setSessionType("user");
    setCurrentView("analyzer");
    navigateTo("/analyzer");
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
    navigateTo("/");
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
      navigateTo("/analyzer");
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
      navigateTo("/gallery");
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
      navigateTo("/gallery");
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
    navigateTo("/login");
  };

  // Show a loading screen while checking for a token
  if (isCheckingToken) {
    return <div className="min-h-screen flex items-center justify-center text-slate-600">Loading Application...</div>;
  }

  if (currentView === "gallery" && isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-100 p-4 sm:p-6">
        <GalleryView
          onBackToAnalyzer={() => {
            setCurrentView("analyzer");
            navigateTo("/analyzer");
          }}
          onGoToLanding={() => {
            setCurrentView("home");
            navigateTo("/");
          }}
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
              onClick={() => {
                setCurrentView("home");
                navigateTo("/");
              }}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
            >
              🏠 Landing Page
            </button>
            <button
              onClick={() => {
                setCurrentView("analyzer");
                navigateTo("/analyzer");
              }}
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-blue-600 text-white shadow-sm"
            >
              🚀 Analyzer
            </button>
            <button
              onClick={() => {
                setCurrentView("gallery");
                navigateTo("/gallery");
              }}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
            >
              🗺️ Photo Gallery & Map
            </button>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`${API_BASE_URL}/swagger/index.html`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition flex items-center gap-1"
              title="Open Swagger API documentation in a new tab"
            >
              <span>📜 Swagger API</span>
              <span className="text-[10px]">↗</span>
            </a>
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
          onViewGallery={() => {
            setCurrentView("gallery");
            navigateTo("/gallery");
          }}
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
          onBack={() => {
            setCurrentView("home");
            navigateTo("/");
          }}
        />
      </div>
    );
  }

  return (
    <GuestLanding
      onLogin={() => {
        setCurrentView("auth");
        navigateTo("/login");
      }}
      onTryGuest={handleGuestSession}
      onViewGallery={handleOpenGalleryFromLanding}
      onGoToAnalyzer={() => {
        setCurrentView("analyzer");
        navigateTo("/analyzer");
      }}
      onLogout={handleLogout}
      isLoggedIn={isLoggedIn}
      isStartingGuest={isStartingGuest}
      guestError={guestError}
    />
  );
}
