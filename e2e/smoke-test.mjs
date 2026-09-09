/**
 * Multi-Cloud End-to-End Smoke Test Suite
 * Tests live endpoints across Cloudflare Pages, Azure App Service, Azure SQL, AWS S3, and Google Gemini.
 */

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://aws-file-analyzer.pages.dev';
const BACKEND_URL = process.env.BACKEND_URL || 'https://app-afa-eycaz6z3q3pp4.azurewebsites.net';

console.log('--- Multi-Cloud End-to-End Smoke Test ---');
console.log(`Frontend Target: ${FRONTEND_URL}`);
console.log(`Backend Target:  ${BACKEND_URL}\n`);

let passed = 0;
let failed = 0;

async function runStep(name, fn) {
  try {
    process.stdout.write(`Testing: ${name} ... `);
    await fn();
    console.log('✅ PASSED');
    passed++;
  } catch (err) {
    console.log(`❌ FAILED: ${err.message}`);
    failed++;
  }
}

async function main() {
  // Step 1: Frontend Edge Health
  await runStep('Cloudflare Pages Edge CDN availability', async () => {
    const res = await fetch(FRONTEND_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });

  // Step 2: Backend Health
  await runStep('Azure App Service Linux Health Endpoint', async () => {
    const res = await fetch(`${BACKEND_URL}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== 'healthy') throw new Error(`Status was ${data.status}`);
  });

  // Step 3: CORS Preflight
  await runStep('Cross-Origin Resource Sharing (CORS) Preflight Headers', async () => {
    const res = await fetch(`${BACKEND_URL}/api/Security/login`, {
      method: 'OPTIONS',
      headers: {
        'Origin': FRONTEND_URL,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type'
      }
    });
    const allowOrigin = res.headers.get('access-control-allow-origin');
    if (allowOrigin !== FRONTEND_URL && allowOrigin !== '*') {
      throw new Error(`Invalid Access-Control-Allow-Origin: ${allowOrigin}`);
    }
  });

  // Step 4: Google OAuth 2.0 Endpoint Validation
  await runStep('Google OAuth 2.0 Security Endpoint Validation', async () => {
    const res = await fetch(`${BACKEND_URL}/api/Security/google-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: '' })
    });
    if (res.status !== 400) throw new Error(`Expected HTTP 400, got ${res.status}`);
    const text = await res.text();
    if (!text.includes('Empty Google ID token!')) {
      throw new Error(`Unexpected error body: ${text}`);
    }
  });

  // Step 5: Authentication & Azure SQL
  let authToken = '';
  await runStep('Azure SQL Serverless Authentication & JWT Token Issuance', async () => {
    const res = await fetch(`${BACKEND_URL}/api/Security/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'portfolio_tester', password: 'SecurePassword123!' })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.accessToken) throw new Error('No access token returned');
    authToken = data.accessToken;
  });

  // Step 5: AWS S3 Connectivity
  await runStep('AWS S3 Bucket Object Listing with Presigned URLs', async () => {
    const res = await fetch(`${BACKEND_URL}/OpenAIAws/ListS3Files`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });

  // Step 6: Google Gemini AI
  await runStep('Google Gemini LLM Inference Pipeline', async () => {
    const res = await fetch(`${BACKEND_URL}/OpenAIAws/GeminiChat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify('Ping test for multi-cloud deployment verification.')
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (!text || text.length === 0) throw new Error('Empty AI response');
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('Fatal error during smoke test:', err);
  process.exit(1);
});
