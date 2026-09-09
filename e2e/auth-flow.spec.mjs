import { test, expect } from '@playwright/test';

test.describe('AWS File Analyzer Multi-Cloud E2E Flow', () => {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'https://aws-file-analyzer.pages.dev';

  test('Login form renders credentials inputs and Google Sign-In button', async ({ page }) => {
    await page.goto(baseURL);
    await expect(page.locator('h2')).toHaveText('Log In');
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toHaveText('Log In');
    await expect(page.locator('text=Sign in with Google')).toBeVisible();
  });

  test('Form switching between Log In and Register views with validation', async ({ page }) => {
    await page.goto(baseURL);

    // Switch to Register view
    const switchRegisterBtn = page.getByRole('button', { name: 'Register' });
    await expect(switchRegisterBtn).toBeVisible();
    await switchRegisterBtn.click();

    // Verify Register view fields
    await expect(page.locator('h2')).toHaveText('Register');
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
    await expect(page.locator('h2')).toHaveText('Log In');
  });

  test('End-to-End Live User Login, Dashboard View, and Logout', async ({ page }) => {
    await page.goto(baseURL);

    // Enter test credentials
    await page.locator('#username').fill('portfolio_tester');
    await page.locator('#password').fill('SecurePassword123!');
    await page.locator('button[type="submit"]').click();

    // Dashboard should become visible
    await expect(page.locator('h1')).toHaveText('AI File Analyzer', { timeout: 15000 });
    await expect(page.locator('input[type="file"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Upload' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Analyze' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();

    // Test Logout
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page.locator('h2')).toHaveText('Log In', { timeout: 5000 });
    await expect(page.locator('#username')).toBeVisible();
  });
});
