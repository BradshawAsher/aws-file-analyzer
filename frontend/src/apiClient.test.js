import axios from 'axios';

describe('apiClient', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.resetModules();
  });

  afterEach(() => {
    localStorage.clear();
  });

  test('configures default baseURL when REACT_APP_API_BASE_URL is not set', () => {
    delete process.env.REACT_APP_API_BASE_URL;
    const { API_BASE_URL } = require('./apiClient');
    expect(API_BASE_URL).toBe('https://localhost:5000');
  });

  test('strips trailing slashes from REACT_APP_API_BASE_URL', () => {
    process.env.REACT_APP_API_BASE_URL = 'https://app-afa-eycaz6z3q3pp4.azurewebsites.net///';
    const { API_BASE_URL } = require('./apiClient');
    expect(API_BASE_URL).toBe('https://app-afa-eycaz6z3q3pp4.azurewebsites.net');
  });

  test('attaches Authorization header when authToken exists in localStorage', () => {
    const fakeToken = 'test-jwt-token-12345';
    localStorage.setItem('authToken', fakeToken);

    const apiClient = require('./apiClient').default;
    const interceptor = apiClient.interceptors.request.handlers[0];

    const config = { headers: {} };
    const modifiedConfig = interceptor.fulfilled(config);

    expect(modifiedConfig.headers.Authorization).toBe(`Bearer ${fakeToken}`);
  });

  test('does not attach Authorization header when authToken is absent', () => {
    const apiClient = require('./apiClient').default;
    const interceptor = apiClient.interceptors.request.handlers[0];

    const config = { headers: {} };
    const modifiedConfig = interceptor.fulfilled(config);

    expect(modifiedConfig.headers.Authorization).toBeUndefined();
  });
});
