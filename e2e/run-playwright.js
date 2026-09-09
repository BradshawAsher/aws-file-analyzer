import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const defaultCert = 'C:\\Users\\s-bas\\.aws\\norton-web-shield-root.pem';
const env = { ...process.env };

if (!env.NODE_EXTRA_CA_CERTS && fs.existsSync(defaultCert)) {
  env.NODE_EXTRA_CA_CERTS = defaultCert;
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const child = spawn(npx, ['playwright', 'test', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
  shell: true,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
