import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const viteBin = path.resolve(
  rootDir,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'vite.cmd' : 'vite',
);

const disallowedWarnings = [
  {
    name: 'relics mixed import warning',
    pattern: /src\/data\/relics\.js is dynamically imported/i,
  },
  {
    name: 'oversized chunk warning',
    pattern: /Some chunks are larger than \d+ kB after minification/i,
  },
  {
    name: 'manual chunk cycle warning',
    pattern: /Circular chunk:/i,
  },
];

const child = spawn(viteBin, ['build'], {
  cwd: rootDir,
  env: process.env,
  stdio: ['inherit', 'pipe', 'pipe'],
});

let combinedOutput = '';

const forward = (stream, target) => {
  stream.on('data', (chunk) => {
    const text = chunk.toString();
    combinedOutput += text;
    target.write(text);
  });
};

forward(child.stdout, process.stdout);
forward(child.stderr, process.stderr);

child.on('close', (code) => {
  if (code !== 0) {
    process.exit(code ?? 1);
  }

  const detectedWarnings = disallowedWarnings
    .filter(({ pattern }) => pattern.test(combinedOutput))
    .map(({ name }) => name);

  if (detectedWarnings.length > 0) {
    console.error('\n[build-guard] disallowed build warnings detected:');
    detectedWarnings.forEach((warning) => console.error(`- ${warning}`));
    process.exit(1);
  }

  console.log('\n[build-guard] ok');
});
