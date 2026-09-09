import React, { useState } from 'react';
import LoginForm from './LoginForm';      // Your existing component
import RegisterForm from './RegisterForm'; // A new component you will create

function AuthContainer({ onLoginSuccess, onBack }) {
  // State to toggle between 'login' and 'register' view
  const [currentView, setCurrentView] = useState('login'); 

  const switchToRegister = () => {
    setCurrentView('register');
  };

  const switchToLogin = () => {
    setCurrentView('login');
  };

  return (
    <div className="w-full max-w-md">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 text-sm font-semibold text-slate-600 transition hover:text-blue-700"
      >
        ← Back to project overview
      </button>
      {currentView === 'login' ? (
        // --- Display Login Form ---
        <LoginForm 
          onLoginSuccess={onLoginSuccess}
          // Pass the function to switch to Register
          onSwitchToRegister={switchToRegister} 
        />
      ) : (
        // --- Display Register Form ---
        <RegisterForm 
          onLoginSuccess={onLoginSuccess}
          // Pass the function to switch back to Login
          onSwitchToLogin={switchToLogin} 
        />
      )}
    </div>
  );
}

export default AuthContainer;
