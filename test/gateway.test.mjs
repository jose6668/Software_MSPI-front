import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, rmdirSync } from 'node:fs';
import { createServer, request } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { gateway, route } from '../server/gateway.mjs';

const directory = mkdtempSync(join(tmpdir(), 'mspi-front-test-'));
const origin = 'https://localhost:6443';
const companyId = 'e01b03ee-a2d7-4b42-a76e-e307737a3300';
const evaluationId = '3afedfc1-4cc8-484b-b513-e7990a701bab';
const evidenceList = `/api/v1/empresas/${companyId}/evaluaciones/${evaluationId}/respuestas/${evaluationId}/evidencias`;
const file = evidenceList + '/' + evaluationId + '/archivo';
const unsafeFile = evidenceList + '/' + companyId + '/archivo';
const inlineFile = evidenceList + '/3afedfc1-4cc8-484b-b513-e7990a701bac/archivo';
const attachment = "attachment; filename*=UTF-8''acta%20de%20revisi%C3%B3n.pdf";
let publicServer;
let api;
let tls;
let apiTls;
let last;

function certificate(name) {
  const cert = join(directory, name + '.pem');
  const key = join(directory, name + '.key');
  execFileSync(process.env.OPENSSL_BIN || 'openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '1',
    '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost',
    '-keyout', key, '-out', cert,
  ], { stdio: 'ignore' });
  return { cert: readFileSync(cert), key: readFileSync(key) };
}
function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}
function close(server) {
  return new Promise(resolve => server ? server.close(resolve) : resolve());
}
function call(server, path, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: server.address().port, servername: 'localhost',
      ca: tls.cert, path, method, headers: { Host: 'localhost:6443', ...headers } }, res => {
      const parts = [];
      res.on('data', data => parts.push(data));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(parts).toString() }));
    });
    req.on('error', reject);
    req.end(body);
  });
}

before(async () => {
  tls = certificate('front');
  apiTls = certificate('api');
  api = await listen(createServer(apiTls, async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    last = { path: req.url, method: req.method, headers: req.headers, body: Buffer.concat(chunks).toString() };
    if (req.url === file || req.url === unsafeFile || req.url === inlineFile) {
      res.writeHead(200, { 'Content-Type': req.url === unsafeFile ? 'text/html' : 'application/pdf',
        'Content-Disposition': req.url === inlineFile ? 'inline' : attachment });
      return res.end('fixture');
    }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': 'MSPISESSION=fixture; Path=/; Secure; HttpOnly',
      'Cache-Control': 'public', 'X-Internal-Detail': 'omitted' });
    res.end('{}');
  }));
  publicServer = await listen(gateway({ tls, ca: apiTls.cert, origin, apiHost: '127.0.0.1', apiPort: api.address().port }));
});
after(async () => {
  await close(publicServer);
  await close(api);
  for (const name of ['front.pem', 'front.key', 'api.pem', 'api.key']) {
    rmSync(join(directory, name), { force: true });
  }
  rmdirSync(directory);
});

test('routes only explicitly permitted endpoints', () => {
  assert.deepEqual(route('GET', '/api/v1/mis-empresas?pagina=1&tamano=20'),
    { upstream: '/api/v1/mis-empresas?pagina=1&tamano=20' });
  for (const path of ['/api/v1/identidad/sesion?contrasena=ignored', '/actuator/health',
    '/api/v1/empresas/../identidad/sesion', '/api/v1/identidad/%73esion', '//mspi-api/',
    '/api/v1/mis-empresas?pagina=0&tamano=100', 'https://outside.example/']) {
    assert.equal(route('GET', path), undefined, path);
  }
  assert.equal(route('PUT', '/api/v1/identidad/sesion'), undefined);
});

test('exposes only the read-only evaluation routes with bounded pagination', () => {
  const company = 'e01b03ee-a2d7-4b42-a76e-e307737a3300';
  const evaluation = '3afedfc1-4cc8-484b-b513-e7990a701bab';
  const list = '/empresas/' + company + '/evaluaciones';
  const detail = list + '/' + evaluation;
  const answers = '/api/v1' + detail + '/respuestas';
  const page = '?pagina=1&tamano=20';
  for (const path of ['/api/v1' + list + page, '/api/v1' + detail, answers + page]) {
    assert.deepEqual(route('GET', path), { upstream: path });
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal(route(method, path), undefined);
  }
  for (const path of [list, detail]) {
    for (const method of ['GET', 'HEAD']) assert.equal(route(method, path).asset[0], 'index.html');
  }
  for (const path of ['/api/v1' + detail + page, answers + '?pagina=-1&tamano=20',
    answers + '?pagina=0&tamano=21', answers + page + '&tamano=20', answers + page + '&grupo=a',
    answers + '/' + evaluation, '/api/v1' + detail + '/resultados', '/api/v1' + list + '/bad-id']) {
    assert.equal(route('GET', path), undefined, path);
  }
});

test('limits evidence to paged listings and downloads of a specific attachment', () => {
  const paged = evidenceList + '?pagina=1&tamano=20';
  assert.deepEqual(route('GET', paged), { upstream: paged });
  assert.deepEqual(route('GET', file), { upstream: file, download: true });
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']) {
    assert.equal(route(method, evidenceList), undefined);
    assert.equal(route(method, file), undefined);
  }
  for (const path of [file + '?pagina=0&tamano=20', evidenceList + '?tamano=100',
    file.replace(evaluationId + '/archivo', 'bad-id/archivo'), evidenceList + '/archivo']) {
    assert.equal(route('GET', path), undefined);
  }
});

test('forwards a sandboxed attachment and rejects inline or unexpected content', async () => {
  const result = await call(publicServer, file, { headers: { Cookie: 'MSPISESSION=fixture' } });
  assert.equal(result.status, 200);
  assert.equal(result.headers['content-disposition'], attachment);
  assert.equal(result.headers['content-type'], 'application/pdf');
  assert.equal(result.headers['content-security-policy'], "sandbox; default-src 'none'");
  assert.equal(result.headers['x-content-type-options'], 'nosniff');
  assert.equal(result.headers['cache-control'], 'no-store');
  assert.equal(result.text, 'fixture');
  assert.equal(last.headers.cookie, 'MSPISESSION=fixture');
  assert.match(last.headers.accept, /application\/pdf/);
  for (const path of [unsafeFile, inlineFile]) {
    assert.equal((await call(publicServer, path)).status, 502);
  }
});

test('proxies HTTPS with the session cookie and CSRF but drops forwarded IP', async () => {
  const body = JSON.stringify({ correo: 'person@example.test', contrasena: 'fixture' });
  const result = await call(publicServer, '/api/v1/identidad/sesion', { method: 'POST', body,
    headers: { Origin: origin, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body),
      'X-CSRF-TOKEN': 'fixture-csrf', Cookie: 'MSPISESSION=fixture', 'X-Forwarded-For': '203.0.113.1' } });
  assert.equal(result.status, 200);
  assert.equal(result.headers['cache-control'], 'no-store');
  assert.deepEqual(result.headers['set-cookie'], ['MSPISESSION=fixture; Path=/; Secure; HttpOnly']);
  assert.equal(result.headers['x-internal-detail'], undefined);
  assert.equal(last.method, 'POST');
  assert.equal(last.headers.cookie, 'MSPISESSION=fixture');
  assert.equal(last.headers['x-csrf-token'], 'fixture-csrf');
  assert.equal(last.headers['x-forwarded-for'], undefined);
  assert.equal(last.body, body);
});

test('rejects a foreign origin, wrong host and oversized chunked body before proxying', async () => {
  const previous = last;
  const path = '/api/v1/identidad/sesion';
  assert.equal((await call(publicServer, path, { method: 'DELETE', headers: { Origin: 'https://outside.example' } })).status, 403);
  assert.equal((await call(publicServer, '/', { headers: { Host: 'outside.example' } })).status, 421);
  const huge = await call(publicServer, path, { method: 'POST', body: 'a'.repeat(20_000),
    headers: { Origin: origin, 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked' } });
  assert.equal(huge.status, 413);
  assert.equal(last, previous);
});

test('rejects an upstream certificate not signed by the configured CA', async () => {
  const misconfigured = await listen(gateway({ tls, ca: tls.cert, origin, apiHost: '127.0.0.1', apiPort: api.address().port }));
  try {
    const result = await call(misconfigured, '/api/v1/identidad/sesion');
    assert.equal(result.status, 502);
    assert.equal(JSON.parse(result.text).code, 'API_NO_DISPONIBLE');
  } finally { await close(misconfigured); }
});
