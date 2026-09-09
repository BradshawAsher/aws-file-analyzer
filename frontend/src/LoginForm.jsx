import React, { useState, useEffect, useCallback, useRef } from 'react';
import apiClient from './apiClient';

const LOGIN_URL = '/api/Security/login';
const GOOGLE_LOGIN_URL = '/api/Security/google-login';

const LoginForm = ({ onLoginSuccess, onSwitchToRegister }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [isGsiLoaded, setIsGsiLoaded] = useState(false);
    const googleButtonRef = useRef(null);
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ||
        '911697501509-pvefn5d210oe6so4a2j9sj3ghrqcb9mg.apps.googleusercontent.com';

    const handleGoogleResponse = useCallback(async (response) => {
        if (!response?.credential) return;
        setError('');
        setIsLoading(true);
        try {
            const res = await apiClient.post(GOOGLE_LOGIN_URL, {
                idToken: response.credential,
            });
            if (res.data?.accessToken) {
                localStorage.setItem('authToken', res.data.accessToken);
                onLoginSuccess();
            }
        } catch (err) {
            console.error('Google login error:', err);
            const msg = err.response?.data?.message || err.response?.data || 'Google authentication failed.';
            setError(typeof msg === 'string' ? msg : 'Google authentication failed.');
        } finally {
            setIsLoading(false);
        }
    }, [onLoginSuccess]);

    useEffect(() => {
        if (!googleClientId) return;

        const renderGoogleButton = () => {
            const parent = googleButtonRef.current;
            if (parent && window.google?.accounts?.id) {
                window.google.accounts.id.initialize({
                    client_id: googleClientId,
                    callback: handleGoogleResponse,
                });
                window.google.accounts.id.renderButton(parent, {
                    theme: 'outline',
                    size: 'large',
                    width: 320,
                    text: 'signin_with',
                });
                setIsGsiLoaded(true);
            }
        };

        const scriptId = 'google-gsi-script';
        if (!document.getElementById(scriptId)) {
            const script = document.createElement('script');
            script.id = scriptId;
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = renderGoogleButton;
            document.head.appendChild(script);
        } else if (window.google?.accounts?.id) {
            renderGoogleButton();
        }

        const buttonNode = googleButtonRef.current;
        return () => {
            if (buttonNode) {
                buttonNode.innerHTML = '';
            }
        };
    }, [googleClientId, handleGoogleResponse]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const response = await apiClient.post(LOGIN_URL, {
                username: username,
                password: password
            });

            const authToken = response.data.accessToken;
            localStorage.setItem('authToken', authToken);
            onLoginSuccess();
        } catch (err) {
            console.error('Login failed:', err);
            if (err.response) {
                setError(err.response.data.message || 'Invalid username or password.');
            } else {
                setError('Login failed. Please check your network connection.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleGooglePlaceholderClick = () => {
        if (window.google?.accounts?.id && googleClientId) {
            window.google.accounts.id.prompt();
        } else {
            setError('To enable Google Sign-In, configure VITE_GOOGLE_CLIENT_ID in your deployment settings.');
        }
    };

    return (
        <form 
        onSubmit={handleSubmit} 
        className="bg-white p-8 rounded-lg shadow-xl w-full max-w-sm"
      >
        <h2 className="text-3xl font-bold mb-6 text-center text-gray-800">Log In</h2>
        
        {/* Error Message Display */}
        {error && (
          <p className="p-3 mb-4 text-sm text-red-800 bg-red-100 rounded-lg">
            {error}
          </p>
        )}

        {/* Username Input Group */}
        <div className="mb-4">
          <label htmlFor="username" className="block text-gray-700 text-sm font-semibold mb-2">
            Username
          </label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your username"
          />
        </div>
        
        {/* Password Input Group */}
        <div className="mb-6">
          <label htmlFor="password" className="block text-gray-700 text-sm font-semibold mb-2">
            Password
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="********"
          />
        </div>
        
        {/* Submit Button */}
        <button 
          type="submit" 
          disabled={isLoading}
          className={`
            w-full py-2 px-4 rounded-lg text-white font-semibold transition duration-300 
            ${isLoading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300'
            }
          `}
        >
          {isLoading ? 'Processing...' : 'Log In'}
        </button>

        {/* Or Divider */}
        <div className="my-5 flex items-center before:flex-1 before:border-t before:border-gray-200 after:flex-1 after:border-t after:border-gray-200">
            <span className="px-3 text-xs uppercase tracking-wider text-gray-400">or</span>
        </div>

        {/* Google Sign-In Container */}
        <div 
            id="googleSignInBtn" 
            ref={googleButtonRef} 
            className={`flex justify-center my-2 w-full ${!isGsiLoaded ? 'hidden' : ''}`}
        />
        {!isGsiLoaded && (
            <button
                type="button"
                onClick={handleGooglePlaceholderClick}
                className="w-full flex items-center justify-center gap-3 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-300"
            >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                </svg>
                <span>Sign in with Google</span>
            </button>
        )}

        {/* Link to register form */}
        <p className="mt-4 text-sm text-center text-gray-600">
            Don't have an account?
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="ml-1 border-0 bg-transparent p-0 font-medium text-indigo-600 hover:text-indigo-500"
            >
              Register
            </button>
        </p>
      </form>
    );
};

export default LoginForm;
