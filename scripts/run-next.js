const path = require('path');
const { spawn } = require('child_process');
const nextBin = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
const child = spawn(process.execPath, [nextBin, 'dev'], {
  stdio: 'inherit',
  env: { ...process.env, PATH: process.env.PATH }
});
child.on('exit', (code) => process.exit(code || 0));
