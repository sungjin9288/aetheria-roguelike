import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

import { verifyObservationHost } from '../scripts/verify-observation-host.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const verifierPath = fileURLToPath(new URL('../scripts/verify-observation-host.mjs', import.meta.url));

const runVerifier = (args) => new Promise((resolve) => {
    const child = spawn(process.execPath, [verifierPath, ...args], {
        cwd: repoRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (status) => resolve({ status, stdout, stderr }));
});

const withObservationHost = async (handler, run) => {
    const server = createServer(handler);
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    try {
        return await run(`http://127.0.0.1:${address.port}`);
    } finally {
        await new Promise((resolve, reject) => server.close((error) => (
            error ? reject(error) : resolve()
        )));
    }
};

test('observation host verifier accepts HTML plus the real unauthenticated AI proxy contract', async () => {
    const result = await withObservationHost((request, response) => {
        if (request.url === '/' && request.method === 'GET') {
            response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            response.end('<!doctype html><title>Aetheria</title>');
            return;
        }
        if (request.url === '/api/ai-proxy' && request.method === 'OPTIONS') {
            response.writeHead(200, {
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Origin': request.headers.origin || '*',
            });
            response.end();
            return;
        }
        if (request.url === '/api/ai-proxy' && request.method === 'POST') {
            response.writeHead(401, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: 'Unauthorized: missing bearer token' }));
            return;
        }
        response.writeHead(404);
        response.end();
    }, (url) => runVerifier(['--url', url]));

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
    const report = JSON.parse(result.stdout);
    assert.equal(report.schemaVersion, 1);
    assert.equal(report.ok, true);
    assert.deepEqual(report.checks, [
        { name: 'document', status: 200, outcome: 'pass' },
        { name: 'aiProxyPreflight', status: 200, outcome: 'pass' },
        { name: 'aiProxyUnauthorized', status: 401, outcome: 'pass' },
    ]);
    assert.deepEqual(report.errors, []);
});

test('observation host verifier rejects a static SPA host before human observation starts', async () => {
    const result = await withObservationHost((request, response) => {
        if (request.url === '/' && request.method === 'GET') {
            response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            response.end('<!doctype html><title>Aetheria static preview</title>');
            return;
        }
        response.writeHead(404);
        response.end();
    }, (url) => runVerifier(['--url', url]));

    assert.equal(result.status, 1);
    assert.equal(result.stderr, '');
    const report = JSON.parse(result.stdout);
    assert.equal(report.ok, false);
    assert.deepEqual(report.checks, [
        { name: 'document', status: 200, outcome: 'pass' },
        { name: 'aiProxyPreflight', status: 404, outcome: 'fail' },
    ]);
    assert.deepEqual(report.errors, ['AI_PROXY_ROUTE_MISSING']);
});

test('observation host verifier recognizes Vite generic OPTIONS 204 as a missing proxy route', async () => {
    const result = await withObservationHost((request, response) => {
        if (request.url === '/' && request.method === 'GET') {
            response.writeHead(200, { 'Content-Type': 'text/html' });
            response.end('<!doctype html><title>Aetheria static preview</title>');
            return;
        }
        if (request.method === 'OPTIONS') {
            response.writeHead(204, {
                'Access-Control-Allow-Origin': request.headers.origin || '*',
                'Access-Control-Allow-Methods': 'GET,HEAD,PUT,PATCH,POST,DELETE',
            });
            response.end();
            return;
        }
        response.writeHead(404);
        response.end();
    }, (url) => runVerifier(['--url', url]));

    assert.equal(result.status, 1);
    assert.equal(result.stderr, '');
    const report = JSON.parse(result.stdout);
    assert.deepEqual(report.checks.at(-1), {
        name: 'aiProxyPreflight',
        status: 204,
        outcome: 'fail',
    });
    assert.deepEqual(report.errors, ['AI_PROXY_ROUTE_MISSING']);
});

test('observation host verifier distinguishes an origin allowlist rejection from a missing route', async () => {
    const result = await withObservationHost((request, response) => {
        if (request.url === '/' && request.method === 'GET') {
            response.writeHead(200, { 'Content-Type': 'text/html' });
            response.end('<!doctype html><title>Aetheria</title>');
            return;
        }
        if (request.url === '/api/ai-proxy' && request.method === 'OPTIONS') {
            response.writeHead(200, { 'Access-Control-Allow-Methods': 'POST, OPTIONS' });
            response.end();
            return;
        }
        if (request.url === '/api/ai-proxy' && request.method === 'POST') {
            response.writeHead(403, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: 'Origin not allowed' }));
            return;
        }
        response.writeHead(404);
        response.end();
    }, (url) => runVerifier(['--url', url]));

    assert.equal(result.status, 1);
    assert.equal(result.stderr, '');
    const report = JSON.parse(result.stdout);
    assert.equal(report.ok, false);
    assert.deepEqual(report.checks.at(-1), {
        name: 'aiProxyUnauthorized',
        status: 403,
        outcome: 'fail',
    });
    assert.deepEqual(report.errors, ['AI_PROXY_ORIGIN_REJECTED']);
});

test('observation host verifier fails closed when a host request exceeds its timeout', async () => {
    const fetchImpl = async (_url, init) => {
        assert.ok(init.signal, 'each host request must carry an abort signal');
        return new Promise((_resolve, reject) => {
            init.signal.addEventListener('abort', () => {
                const error = new Error('request timed out');
                error.name = 'AbortError';
                reject(error);
            }, { once: true });
        });
    };

    const report = await verifyObservationHost({
        url: 'http://127.0.0.1:1',
        fetchImpl,
        timeoutMs: 5,
    });

    assert.equal(report.ok, false);
    assert.deepEqual(report.checks, []);
    assert.deepEqual(report.errors, ['HOST_REQUEST_TIMEOUT']);
});
