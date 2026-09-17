import process from 'node:process';
import { pathToFileURL } from 'node:url';

const parseArguments = (args) => {
    if (args.length !== 2 || args[0] !== '--url' || !args[1]) {
        throw new Error('Usage: verify-observation-host.mjs --url <http(s)://host>');
    }
    const url = new URL(args[1]);
    if (!['http:', 'https:'].includes(url.protocol)
        || url.username
        || url.password
        || url.search
        || url.hash) {
        throw new Error('Observation host URL must be an http(s) URL without credentials, query or hash');
    }
    url.pathname = '/';
    return url;
};

const addCheck = (checks, name, status, outcome) => {
    checks.push({ name, status, outcome });
};

export const verifyObservationHost = async ({ url, fetchImpl = fetch, timeoutMs = 5000 }) => {
    const host = url instanceof URL ? url : new URL(url);
    const checks = [];
    const errors = [];
    const request = (input, init = {}) => fetchImpl(input, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
    });
    const finish = () => ({
        schemaVersion: 1,
        ok: errors.length === 0,
        checks,
        errors,
    });

    try {
        const documentResponse = await request(host, { redirect: 'manual' });
        const documentReady = documentResponse.status === 200
            && String(documentResponse.headers.get('content-type') || '').includes('text/html');
        addCheck(checks, 'document', documentResponse.status, documentReady ? 'pass' : 'fail');
        if (!documentReady) errors.push('DOCUMENT_NOT_READY');

        const proxyUrl = new URL('/api/ai-proxy', host);
        const preflightResponse = await request(proxyUrl, {
            method: 'OPTIONS',
            headers: { Origin: host.origin },
            redirect: 'manual',
        });
        const allowedMethods = String(preflightResponse.headers.get('access-control-allow-methods') || '');
        const preflightReady = preflightResponse.status === 200 && allowedMethods.split(',')
            .map((method) => method.trim().toUpperCase())
            .includes('POST');
        addCheck(checks, 'aiProxyPreflight', preflightResponse.status, preflightReady ? 'pass' : 'fail');
        if (!preflightReady) {
            const routeMissing = [204, 404].includes(preflightResponse.status);
            errors.push(routeMissing
                ? 'AI_PROXY_ROUTE_MISSING'
                : 'AI_PROXY_PREFLIGHT_NOT_READY');
            return finish();
        }

        const unauthorizedResponse = await request(proxyUrl, {
            method: 'POST',
            headers: {
                Origin: host.origin,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ type: 'story', data: {} }),
            redirect: 'manual',
        });
        const unauthorizedReady = unauthorizedResponse.status === 401
            && String(unauthorizedResponse.headers.get('content-type') || '').includes('application/json');
        addCheck(checks, 'aiProxyUnauthorized', unauthorizedResponse.status, unauthorizedReady ? 'pass' : 'fail');
        if (!unauthorizedReady) {
            errors.push(unauthorizedResponse.status === 403
                ? 'AI_PROXY_ORIGIN_REJECTED'
                : 'AI_PROXY_UNAUTHORIZED_CONTRACT_MISSING');
        }
    } catch (error) {
        if (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)) {
            errors.push('HOST_REQUEST_TIMEOUT');
        } else {
            errors.push(`HOST_REQUEST_FAILED:${error instanceof Error ? error.message : String(error)}`);
        }
    }

    return finish();
};

const isMain = process.argv[1]
    && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
    try {
        const url = parseArguments(process.argv.slice(2));
        const report = await verifyObservationHost({ url });
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        if (!report.ok) process.exitCode = 1;
    } catch (error) {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
    }
}
