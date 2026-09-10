import { test, expect } from '@playwright/test';

test.describe('AWS File Analyzer Multi-Cloud E2E Flow', () => {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'https://aws-file-analyzer.bradshin231.workers.dev';

  test.beforeEach(async ({ page }) => {
    await page.goto(baseURL);
    await page.evaluate(() => localStorage.clear());
    await page.goto(baseURL);
  });

  test('Landing page renders portfolio overview and CTA buttons', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Analyze files across four cloud platforms');
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Try the live analyzer/i })).toBeVisible();
  });

  test('Guest session starts live demo analyzer directly without logging in', async ({ page }) => {
    await page.getByRole('button', { name: /Try the live analyzer/i }).click();

    // Guest analyzer dashboard should open
    await expect(page.locator('h1')).toContainText('AI Multi-File Analyzer', { timeout: 15000 });
    await expect(page.getByText('short-lived guest session')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Sign in$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Exit guest demo/i })).toBeVisible();
  });

  test('Login form renders credentials inputs and Google Sign-In button', async ({ page }) => {
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page.getByRole('heading', { name: 'Log In' })).toBeVisible();
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toHaveText('Log In');
    await expect(page.locator('text=Sign in with Google')).toBeVisible();
  });

  test('Form switching between Log In and Register views with validation', async ({ page }) => {
    await page.goto(baseURL);
    await page.getByRole('button', { name: 'Log in' }).click();

    // Switch to Register view
    const switchRegisterBtn = page.getByRole('button', { name: 'Register' });
    await expect(switchRegisterBtn).toBeVisible();
    await switchRegisterBtn.click();

    // Verify Register view fields
    await expect(page.getByRole('heading', { name: 'Register' })).toBeVisible();
    await expect(page.locator('#confirmPassword')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toHaveText('Register');

    // Test mismatched passwords validation
    await page.locator('#username').fill('mismatch_user');
    await page.locator('#password').fill('Password123!');
    await page.locator('#confirmPassword').fill('DifferentPassword123!');
    await page.locator('button[type="submit"]').click();

    await expect(page.getByText('Error: Passwords do not match.').first()).toBeVisible();

    // Switch back to Login view
    const switchLoginBtn = page.getByRole('button', { name: 'Log In' });
    await expect(switchLoginBtn).toBeVisible();
    await switchLoginBtn.click();
    await expect(page.getByRole('heading', { name: 'Log In' })).toBeVisible();
  });

  test('End-to-End Live User Login, Dashboard View, and Logout', async ({ page }) => {
    await page.getByRole('button', { name: 'Log in' }).click();

    // Enter test credentials
    await page.locator('#username').fill('portfolio_tester');
    await page.locator('#password').fill('SecurePassword123!');
    await page.locator('button[type="submit"]').click();

    // Dashboard should become visible
    await expect(page.locator('h1')).toContainText('AI Multi-File Analyzer', { timeout: 15000 });
    await expect(page.getByRole('button', { name: /^Upload/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Analyze/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();

    // Test Logout
    await page.getByRole('button', { name: /log\s*out/i }).first().click();
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible({ timeout: 5000 });
  });

  test('User can open Photo Gallery and switch between Photo Grid and World Map', async ({ page }) => {
    await page.getByRole('button', { name: /Try the live analyzer/i }).click();
    await expect(page.locator('h1')).toContainText('AI Multi-File Analyzer', { timeout: 15000 });

    // Click Gallery & Map tab
    await page.getByRole('button', { name: /Photo Gallery & Map/i }).click();

    // Verify Gallery page loads
    await expect(page.locator('h1')).toContainText('Photo Gallery & Geolocation Map', { timeout: 15000 });
    await expect(page.getByRole('button', { name: /Photo Grid/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /World Map View/i })).toBeVisible();

    // Switch to World Map View
    await page.getByRole('button', { name: /World Map View/i }).click();
    await expect(page.getByText(/photos with detected geographic landmarks/i)).toBeVisible();

    // Return to Analyzer
    await page.getByRole('button', { name: /Back to Analyzer/i }).click();
    await expect(page.locator('h1')).toContainText('AI Multi-File Analyzer', { timeout: 10000 });
  });

  test('New User Registration seamlessly auto-logs in directly to Dashboard without relogging', async ({ page }) => {
    await page.getByRole('button', { name: 'Log in' }).click();

    // Switch to Register view
    await page.getByRole('button', { name: 'Register' }).click();

    const uniqueUser = `pw_${Date.now()}`;
    await page.locator('#username').fill(uniqueUser);
    await page.locator('#password').fill('SecurePassword123!');
    await page.locator('#confirmPassword').fill('SecurePassword123!');
    await page.locator('button[type="submit"]').click();

    // Should immediately auto-login and show the Multi-File Dashboard
    await expect(page.locator('h1')).toContainText('AI Multi-File Analyzer', { timeout: 15000 });
  });

  test('Guest session transition preserves staged claims into newly registered account', async ({ page }) => {
    // Start guest session
    await page.getByRole('button', { name: /Try the live analyzer/i }).click();
    await expect(page.locator('h1')).toContainText('AI Multi-File Analyzer', { timeout: 15000 });

    // Stage a mock upload in localStorage as if guest uploaded a file
    await page.evaluate(() => {
      localStorage.setItem('pending_guest_claim', JSON.stringify({
        fileUrls: ['https://s3.amazonaws.com/test-bucket/claim-demo.txt'],
        fileNames: ['claim-demo.txt'],
        analyzeResults: ['Guest demo summary of claim-demo.txt']
      }));
    });

    // Click Sign in from guest analyzer
    await page.getByRole('button', { name: /^Sign in$/i }).click();

    // Register a new user
    await page.getByRole('button', { name: 'Register' }).click();
    const uniqueUser = `claim_${Date.now()}`;
    await page.locator('#username').fill(uniqueUser);
    await page.locator('#password').fill('SecurePassword123!');
    await page.locator('#confirmPassword').fill('SecurePassword123!');
    await page.locator('button[type="submit"]').click();

    // Verify user is in analyzer and claimed banner is visible
    await expect(page.locator('h1')).toContainText('AI Multi-File Analyzer', { timeout: 15000 });
    await expect(page.getByText(/Your guest demo upload and AI analysis were successfully claimed/i)).toBeVisible();
  });

  test('Direct deep linking opens requested routes (/login, /gallery)', async ({ page }) => {
    // Deep link directly to /login
    await page.goto(`${baseURL}/login`);
    await expect(page.getByRole('heading', { name: 'Log In' })).toBeVisible({ timeout: 15000 });
    expect(page.url()).toContain('/login');

    // Deep link directly to /gallery
    await page.goto(`${baseURL}/gallery`);
    await expect(page.locator('h1')).toContainText('Photo Gallery & Geolocation Map', { timeout: 15000 });
    expect(page.url()).toContain('/gallery');
  });

  test('Browser Back and Forward history navigation works smoothly across SPA routes', async ({ page }) => {
    await page.goto(baseURL);

    // 1. Landing -> Login
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByRole('heading', { name: 'Log In' })).toBeVisible({ timeout: 10000 });
    expect(page.url()).toContain('/login');

    // 2. Browser Back -> Landing
    await page.goBack();
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible({ timeout: 10000 });
    expect(page.url()).not.toContain('/login');

    // 3. Browser Forward -> Login
    await page.goForward();
    await expect(page.getByRole('heading', { name: 'Log In' })).toBeVisible({ timeout: 10000 });
    expect(page.url()).toContain('/login');

    // Return to Landing
    await page.goBack();

    // 4. Start guest analyzer -> /analyzer
    await page.getByRole('button', { name: /Try the live analyzer/i }).click();
    await expect(page.locator('h1')).toContainText('AI Multi-File Analyzer', { timeout: 15000 });
    expect(page.url()).toContain('/analyzer');

    // 5. Navigate to Gallery -> /gallery
    await page.getByRole('button', { name: /Photo Gallery & Map/i }).click();
    await expect(page.locator('h1')).toContainText('Photo Gallery & Geolocation Map', { timeout: 15000 });
    expect(page.url()).toContain('/gallery');

    // 6. Switch to Map view -> /gallery?view=map
    await page.getByRole('button', { name: /World Map View/i }).click();
    await expect(page.getByText(/photos with detected geographic landmarks/i)).toBeVisible();
    expect(page.url()).toContain('view=map');

    // 7. Browser Back -> Grid View (/gallery)
    await page.goBack();
    await expect(page.getByRole('button', { name: /Photo Grid/i })).toBeVisible();
    expect(page.url()).not.toContain('view=map');

    // 8. Browser Back -> Analyzer (/analyzer)
    await page.goBack();
    await expect(page.locator('h1')).toContainText('AI Multi-File Analyzer', { timeout: 10000 });
    expect(page.url()).toContain('/analyzer');

    // 9. Browser Forward -> Gallery (/gallery)
    await page.goForward();
    await expect(page.locator('h1')).toContainText('Photo Gallery & Geolocation Map', { timeout: 10000 });
    expect(page.url()).toContain('/gallery');
  });
});


