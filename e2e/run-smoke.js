import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const defaultCert = 'C:\\Users\\s-bas\\.aws\\norton-web-shield-root.pem';
const env = { ...process.env };

if (!env.NODE_EXTRA_CA_CERTS && fs.existsSync(defaultCert)) {
  env.NODE_EXTRA_CA_CERTS = defaultCert;
}

const child = spawn(process.execPath, [path.resolve('e2e/smoke-test.mjs')], {
  stdio: 'inherit',
  env,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
