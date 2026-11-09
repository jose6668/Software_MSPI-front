import { readFileSync } from 'node:fs';
import { Agent, createServer, request } from 'node:https';
import { pipeline } from 'node:stream';

const uuid = '[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}';
const companyRoute = new RegExp('^/empresas/' + uuid + '$');
const contextRoute = new RegExp('^/api/v1/empresas/' + uuid + '/contexto$');
const evaluationListPath = '/empresas/' + uuid + '/evaluaciones';
const evaluationPath = evaluationListPath + '/' + uuid;
const evidencePath = evaluationPath + '/respuestas/' + uuid + '/evidencias';
const evaluationView = new RegExp('^' + evaluationListPath + '(?:/' + uuid + ')?$');
const evaluationDetail = new RegExp('^/api/v1' + evaluationPath + '$');
const pagedEvaluations = new RegExp('^/api/v1(?:' + evaluationListPath + '|' + evaluationPath + '/respuestas|' + evidencePath + ')$');
const evidenceDownload = new RegExp('^/api/v1' + evidencePath + '/' + uuid + '/archivo$');
const evidenceTypes = ['application/pdf', 'image/png', 'image/jpeg'];
const maxBody = 16 * 1024;
const securityHeaders = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; object-src 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};
const assets = new Map([
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/api.js', ['api.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/marca.svg', ['marca.svg', 'image/svg+xml']],
]);

export function route(method, target) {
  // Reject absolute URLs, duplicate slashes and alternate encodings before URL normalization.
  if (typeof target !== 'string' || !/^\/[a-zA-Z0-9_./?=&-]*$/.test(target) || target.includes('//')) return;
  const [path, query] = target.split('?');
  if (target.split('?').length > 2) return;
  if (method === 'GET' && (path === '/api/v1/mis-empresas' || pagedEvaluations.test(path))) {
    if (query === undefined || /^pagina=(0|[1-9][0-9]{0,7})&tamano=20$/.test(query)) return { upstream: target };
    return;
  }
  if (query !== undefined) return;
  if (method === 'GET' && evidenceDownload.test(path)) return { upstream: path, download: true };
  if (path === '/api/v1/identidad/sesion' && ['GET', 'POST', 'DELETE'].includes(method)) {
    return { upstream: path };
  }
  if (method === 'GET' && (path === '/api/v1/identidad/csrf' || contextRoute.test(path) || evaluationDetail.test(path))) {
    return { upstream: path };
  }
  if (['GET', 'HEAD'].includes(method)) {
    if (assets.has(path)) return { asset: assets.get(path) };
    if (path === '/' || path === '/empresas' || companyRoute.test(path) || evaluationView.test(path)) {
      return { asset: ['index.html', 'text/html; charset=utf-8'] };
    }
  }
}

function finish(res, status, headers, body) {
  if (res.destroyed || res.headersSent) return;
  res.writeHead(status, { ...securityHeaders, ...headers }).end(body);
}

function reject(res, status, code) {
  finish(res, status, { 'Content-Type': 'application/problem+json', Connection: 'close' }, JSON.stringify({ code }));
}

async function bodyOf(req) {
  const parts = [];
  let size = 0;
  // Keep the socket open long enough to send 413 on chunked overflow.
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > maxBody) return null;
    parts.push(chunk);
  }
  return Buffer.concat(parts, size);
}

export function gateway({ tls, ca, origin, apiHost = 'mspi-api', apiPort = 8443 }) {
  const authority = new URL(origin).host;
  const files = new Map(['index.html', ...Array.from(assets.values(), ([file]) => file)]
    .map(file => [file, readFileSync(new URL('../public/' + file, import.meta.url))]));
  const agent = new Agent({ ca, servername: 'localhost', minVersion: 'TLSv1.2', maxSockets: 24 });
  const server = createServer({ ...tls, minVersion: 'TLSv1.2', maxHeaderSize: 8192,
    handshakeTimeout: 6000, headersTimeout: 6000, requestTimeout: 10000,
    keepAliveTimeout: 4000, connectionsCheckingInterval: 1000 },
  async (req, res) => {
    if (req.headers.host !== authority) return reject(res, 421, 'ORIGEN_INVALIDO');
    const selected = route(req.method, req.url);
    if (!selected) return reject(res, 404, 'NO_ENCONTRADO');
    const hasBody = req.headers['transfer-encoding'] || Number(req.headers['content-length'] || 0) > 0;
    if (req.method !== 'POST' && hasBody) return reject(res, 400, 'CUERPO_INESPERADO');

    if (selected.asset) {
      const [file, type] = selected.asset;
      const content = files.get(file);
      return finish(res, 200, { 'Content-Type': type, 'Content-Length': content.length },
        req.method === 'HEAD' ? undefined : content);
    }

    if (['POST', 'DELETE'].includes(req.method) && req.headers.origin !== origin) {
      return reject(res, 403, 'ORIGEN_INVALIDO');
    }

    let body;
    const headers = { Accept: 'application/json, application/problem+json' };
    if (selected.download) headers.Accept = [...evidenceTypes, headers.Accept].join(', ');
    if (req.headers.cookie) headers.Cookie = req.headers.cookie;
    if (req.headers['x-csrf-token']) headers['X-CSRF-TOKEN'] = req.headers['x-csrf-token'];
    if (req.method === 'POST') {
      if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
        return reject(res, 415, 'TIPO_CONTENIDO_NO_ADMITIDO');
      }
      if (Number(req.headers['content-length']) > maxBody) return reject(res, 413, 'CARGA_DEMASIADO_GRANDE');
      try { body = await bodyOf(req); } catch { return; }
      if (!body) return reject(res, 413, 'CARGA_DEMASIADO_GRANDE');
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = body.length;
    }

    const upstream = request({ hostname: apiHost, port: apiPort, path: selected.upstream,
      method: req.method, headers, agent, servername: 'localhost', rejectUnauthorized: true }, reply => {
      if (res.destroyed) return reply.destroy();
      if (reply.statusCode >= 300 && reply.statusCode < 400) {
        reply.destroy();
        return reject(res, 502, 'API_NO_DISPONIBLE');
      }
      const forwarded = {};
      for (const key of ['content-type', 'content-length', 'set-cookie', 'retry-after', 'x-correlation-id']) {
        if (reply.headers[key] !== undefined) forwarded[key] = reply.headers[key];
      }
      if (selected.download && reply.statusCode < 300) {
        const disposition = reply.headers['content-disposition'];
        if (reply.statusCode !== 200 || !evidenceTypes.includes(reply.headers['content-type']) ||
            !/^attachment(?:;|$)/i.test(disposition || '')) {
          reply.destroy();
          return reject(res, 502, 'API_NO_DISPONIBLE');
        }
        forwarded['Content-Disposition'] = disposition;
      }
      if (selected.download) forwarded['Content-Security-Policy'] = "sandbox; default-src 'none'";
      res.writeHead(reply.statusCode, { ...securityHeaders, ...forwarded });
      pipeline(reply, res, () => {});
    });
    const deadline = setTimeout(() => upstream.destroy(), 8000);
    upstream.once('close', () => clearTimeout(deadline));
    upstream.on('error', () => reject(res, 502, 'API_NO_DISPONIBLE'));
    res.on('close', () => { if (!res.writableEnded) upstream.destroy(); });
    upstream.end(body);
  });
  server.maxConnections = 64;
  server.maxRequestsPerSocket = 100;
  server.on('close', () => agent.destroy());
  return server;
}
