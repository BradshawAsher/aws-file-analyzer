import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import apiClient from './apiClient';

jest.mock('./apiClient');

describe('LoginForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('renders login form elements', () => {
    render(<LoginForm onLoginSuccess={jest.fn()} onSwitchToRegister={jest.fn()} />);

    expect(screen.getByRole('heading', { name: /Log In/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Log In$/i })).toBeInTheDocument();
  });

  test('successfully submits login and stores access token', async () => {
    const mockOnLoginSuccess = jest.fn();
    apiClient.post.mockResolvedValueOnce({
      status: 200,
      data: { accessToken: 'mock-jwt-token' }
    });

    render(<LoginForm onLoginSuccess={mockOnLoginSuccess} onSwitchToRegister={jest.fn()} />);

    fireEvent.change(screen.getByLabelText(/Username/i), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /^Log In$/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/api/Security/login', {
        username: 'testuser',
        password: 'password123'
      });
      expect(localStorage.getItem('authToken')).toBe('mock-jwt-token');
      expect(mockOnLoginSuccess).toHaveBeenCalledTimes(1);
    });
  });

  test('displays error message on invalid credentials', async () => {
    apiClient.post.mockRejectedValueOnce({
      response: { data: { message: 'Invalid username or password.' } }
    });

    render(<LoginForm onLoginSuccess={jest.fn()} onSwitchToRegister={jest.fn()} />);

    fireEvent.change(screen.getByLabelText(/Username/i), { target: { value: 'wronguser' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: /^Log In$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Invalid username or password./i)).toBeInTheDocument();
    });
  });

  test('invokes onSwitchToRegister when link button clicked', () => {
    const mockSwitch = jest.fn();
    render(<LoginForm onLoginSuccess={jest.fn()} onSwitchToRegister={mockSwitch} />);

    fireEvent.click(screen.getByRole('button', { name: /^Register$/i }));
    expect(mockSwitch).toHaveBeenCalledTimes(1);
  });

  test('renders Sign in with Google button and shows configuration hint on click when client ID is unset', () => {
    render(<LoginForm onLoginSuccess={jest.fn()} onSwitchToRegister={jest.fn()} />);

    const googleBtn = screen.getByRole('button', { name: /Sign in with Google/i });
    expect(googleBtn).toBeInTheDocument();

    fireEvent.click(googleBtn);
    expect(screen.getByText(/To enable Google Sign-In, configure REACT_APP_GOOGLE_CLIENT_ID/i)).toBeInTheDocument();
  });
});

describe('RegisterForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('validates password mismatch locally', async () => {
    render(<RegisterForm onSwitchToLogin={jest.fn()} />);

    fireEvent.change(screen.getByLabelText(/Username/i), { target: { value: 'newuser' } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'pass123' } });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: 'differentpass' } });
    fireEvent.click(screen.getByRole('button', { name: /^Register$/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/Error: Passwords do not match./i).length).toBeGreaterThan(0);
      expect(apiClient.post).not.toHaveBeenCalled();
    });
  });
});
