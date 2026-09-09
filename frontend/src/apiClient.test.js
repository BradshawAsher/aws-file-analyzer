describe('apiClient', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
  });

  test('configures the local API URL in development', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    const { API_BASE_URL } = await import('./apiClient');
    expect(API_BASE_URL).toBe('https://localhost:5000');
  });

  test('strips trailing slashes from VITE_API_BASE_URL', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://app-afa-eycaz6z3q3pp4.azurewebsites.net///');
    const { API_BASE_URL } = await import('./apiClient');
    expect(API_BASE_URL).toBe('https://app-afa-eycaz6z3q3pp4.azurewebsites.net');
  });

  test('attaches Authorization header when authToken exists in localStorage', async () => {
    const fakeToken = 'test-jwt-token-12345';
    localStorage.setItem('authToken', fakeToken);

    const { default: apiClient } = await import('./apiClient');
    const interceptor = apiClient.interceptors.request.handlers[0];
    const modifiedConfig = interceptor.fulfilled({ headers: {} });

    expect(modifiedConfig.headers.Authorization).toBe(`Bearer ${fakeToken}`);
  });

  test('does not attach Authorization header when authToken is absent', async () => {
    const { default: apiClient } = await import('./apiClient');
    const interceptor = apiClient.interceptors.request.handlers[0];
    const modifiedConfig = interceptor.fulfilled({ headers: {} });

    expect(modifiedConfig.headers.Authorization).toBeUndefined();
  });
});
