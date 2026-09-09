/**
 * Safe multi-cloud smoke tests.
 *
 * Public checks always run. Authenticated AWS/Gemini checks run only when
 * credentials are supplied. The suite never registers users or uploads files,
 * so scheduled CI runs do not pollute Azure SQL or AWS S3.
 */

const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://aws-file-analyzer.pages.dev').replace(/\/$/, '');
const BACKEND_URL = (process.env.BACKEND_URL || 'https://app-afa-eycaz6z3q3pp4.azurewebsites.net').replace(/\/$/, '');
const SMOKE_TEST_USERNAME = process.env.SMOKE_TEST_USERNAME;
const SMOKE_TEST_PASSWORD = process.env.SMOKE_TEST_PASSWORD;
const RUN_AI_SMOKE = process.env.RUN_AI_SMOKE === 'true';

console.log('--- Multi-Cloud Smoke Tests ---');
console.log(`Frontend Target: ${FRONTEND_URL}`);
console.log(`Backend Target:  ${BACKEND_URL}\n`);

let passed = 0;
let failed = 0;
let skipped = 0;

async function runStep(name, fn) {
  try {
    process.stdout.write(`Testing: ${name} ... `);
    await fn();
    console.log('PASSED');
    passed++;
  } catch (error) {
    console.log(`FAILED: ${error.message}`);
    failed++;
  }
}

function skipStep(name, reason) {
  console.log(`Skipping: ${name} ... ${reason}`);
  skipped++;
}

async function main() {
  await runStep('Cloudflare Pages availability', async () => {
    const response = await fetch(FRONTEND_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    if (!html.includes('id="root"')) throw new Error('React application root was not found');
  });

  await runStep('Azure App Service health endpoint', async () => {
    const response = await fetch(`${BACKEND_URL}/health`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.status !== 'healthy') throw new Error(`Status was ${data.status}`);
  });

  await runStep('Cloudflare-to-Azure CORS preflight', async () => {
    const response = await fetch(`${BACKEND_URL}/api/Security/login`, {
      method: 'OPTIONS',
      headers: {
        Origin: FRONTEND_URL,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    });
    const allowOrigin = response.headers.get('access-control-allow-origin');
    if (allowOrigin !== FRONTEND_URL && allowOrigin !== '*') {
      throw new Error(`Invalid Access-Control-Allow-Origin: ${allowOrigin}`);
    }
  });

  await runStep('Google OAuth endpoint validation', async () => {
    const response = await fetch(`${BACKEND_URL}/api/Security/google-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: '' }),
    });
    if (response.status !== 400) throw new Error(`Expected HTTP 400, got ${response.status}`);
  });

  await runStep('Swagger UI and OpenAPI document', async () => {
    const uiResponse = await fetch(`${BACKEND_URL}/swagger/index.html`);
    if (!uiResponse.ok) throw new Error(`HTTP ${uiResponse.status}`);
    if (!(await uiResponse.text()).includes('Swagger UI')) throw new Error('Swagger UI HTML not found');

    const specResponse = await fetch(`${BACKEND_URL}/swagger/v1/swagger.json`);
    if (!specResponse.ok) throw new Error(`HTTP ${specResponse.status} on swagger.json`);
    const spec = await specResponse.json();
    if (!spec.paths?.['/api/ai/ListS3Files']) throw new Error('Canonical /api/ai routes were not found');
  });

  if (!SMOKE_TEST_USERNAME || !SMOKE_TEST_PASSWORD) {
    skipStep('Azure SQL authentication and JWT issuance', 'GitHub smoke-test credentials are not configured');
    skipStep('AWS S3 authenticated connectivity', 'authentication was skipped');
    skipStep('Google Gemini inference', 'authentication was skipped');
  } else {
    let authToken = '';
    await runStep('Azure SQL authentication and JWT issuance', async () => {
      const response = await fetch(`${BACKEND_URL}/api/Security/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: SMOKE_TEST_USERNAME, password: SMOKE_TEST_PASSWORD }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data.accessToken) throw new Error('No access token returned');
      authToken = data.accessToken;
    });

    if (authToken) {
      await runStep('AWS S3 authenticated connectivity', async () => {
        const response = await fetch(`${BACKEND_URL}/api/ai/ListS3Files`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      });

      if (RUN_AI_SMOKE) {
        await runStep('Google Gemini inference', async () => {
          const response = await fetch(`${BACKEND_URL}/api/ai/GeminiChat`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${authToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify('Reply with the single word healthy.'),
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          if (!(await response.text()).trim()) throw new Error('Empty AI response');
        });
      } else {
        skipStep('Google Gemini inference', 'RUN_AI_SMOKE is not true');
      }
    } else {
      skipStep('AWS S3 authenticated connectivity', 'login failed');
      skipStep('Google Gemini inference', 'login failed');
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} skipped.`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error('Fatal smoke-test error:', error);
  process.exit(1);
});
