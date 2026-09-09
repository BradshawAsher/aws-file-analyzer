import React, { useState, useEffect } from "react";
import FileUploadAnalyzer from "./FileUploadAnalyze";
import AuthContainer from "./AuthContainer";
import AiVoicePlayer from "./AiVoicePlayer";
import GuestLanding from "./GuestLanding";
import apiClient from "./apiClient";
import { getJwtRole, isJwtUsable } from "./tokenUtils";

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCheckingToken, setIsCheckingToken] = useState(true);
  const [currentView, setCurrentView] = useState("home");
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
    cleanAnalysisText();
  };

  // Handler for Log Out
  const handleLogout = () => {
    localStorage.removeItem('authToken'); // Clear the stored token
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

  const handleSignInFromGuest = () => {
    localStorage.removeItem("authToken");
    setIsLoggedIn(false);
    setSessionType(null);
    setCurrentView("auth");
    cleanAnalysisText();
  };

  // Show a loading screen while checking for a token
  if (isCheckingToken) {
      return <div>Loading Application...</div>;
  }

  if (currentView === "analyzer" && isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 p-6">
        <>
        <FileUploadAnalyzer
          handleLogout={handleLogout}
          isGuest={sessionType === "guest"}
          onSignIn={handleSignInFromGuest}
          setAnalysisText={setAnalysisText}
          cleanAnalysisText={cleanAnalysisText}/>
        {aiAnalysisText &&
          <AiVoicePlayer analysisText={aiAnalysisText}/>}
        </>
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
      isStartingGuest={isStartingGuest}
      guestError={guestError}
    />
  );
}
