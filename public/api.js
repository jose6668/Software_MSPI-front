const prefix = '/api/v1';

export class ApiError extends Error {
  constructor(status, code) {
    super(code || 'API_NO_DISPONIBLE');
    this.status = status;
    this.code = code;
  }
}

async function send(path, { method = 'GET', body, token } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers['X-CSRF-TOKEN'] = token;
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetch(prefix + path, {
    method, headers, credentials: 'same-origin', cache: 'no-store', redirect: 'error',
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 204) return;
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, data?.code);
  if (data === null) throw new ApiError(502, 'API_NO_DISPONIBLE');
  return data;
}

async function csrf() {
  const data = await send('/identidad/csrf');
  if (data.headerName?.toLowerCase() !== 'x-csrf-token' || typeof data.token !== 'string') {
    throw new ApiError(502, 'API_NO_DISPONIBLE');
  }
  return data.token;
}

export const session = () => send('/identidad/sesion');
export const login = async (correo, contrasena) =>
  send('/identidad/sesion', { method: 'POST', token: await csrf(), body: { correo, contrasena } });
export const logout = async () =>
  send('/identidad/sesion', { method: 'DELETE', token: await csrf() });
export const companies = (page) => send('/mis-empresas?pagina=' + page + '&tamano=20');
export const company = (id) => send('/empresas/' + encodeURIComponent(id) + '/contexto');

const evaluationListPath = (companyId) => '/empresas/' + encodeURIComponent(companyId) + '/evaluaciones';
const evaluationPath = (companyId, id) => evaluationListPath(companyId) + '/' + encodeURIComponent(id);
const pagination = (page) => '?pagina=' + page + '&tamano=20';

export const evaluations = (companyId, page) => send(evaluationListPath(companyId) + pagination(page));
export const evaluation = (companyId, id) => send(evaluationPath(companyId, id));
export const evaluationResults = (companyId, id) => send(evaluationPath(companyId, id) + '/resultados');
export const responses = (companyId, id, page) => send(evaluationPath(companyId, id) + '/respuestas' + pagination(page));
const evidencePath = (companyId, id, responseId) =>
  evaluationPath(companyId, id) + '/respuestas/' + encodeURIComponent(responseId) + '/evidencias';
export const evidence = (companyId, id, responseId, page) => send(evidencePath(companyId, id, responseId) + pagination(page));
export const evidenceFile = (companyId, id, responseId, evidenceId) =>
  prefix + evidencePath(companyId, id, responseId) + '/' + encodeURIComponent(evidenceId) + '/archivo';

const companyPath = id => '/empresas/' + encodeURIComponent(id);
const assetPath = (companyId, id) => companyPath(companyId) + '/activos/' + encodeURIComponent(id);
export function assets(companyId, page, { estado, tipo, texto }) {
  const query = new URLSearchParams({ pagina: page, tamano: 20 });
  if (estado) query.set('estado', estado);
  if (tipo) query.set('tipo', tipo);
  if (texto) query.set('texto', texto);
  return send(companyPath(companyId) + '/activos?' + query);
}
export const asset = (companyId, id) => send(assetPath(companyId, id));
export const classifications = (companyId, id) => send(assetPath(companyId, id) + '/clasificaciones' + pagination(0));
export const process = (companyId, id) => send(companyPath(companyId) + '/procesos/' + encodeURIComponent(id));
export const responsible = (companyId, id) => send(companyPath(companyId) + '/responsables-negocio/' + encodeURIComponent(id));
