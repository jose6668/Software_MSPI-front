import * as api from './api.js';

const work = document.querySelector('#workspace');
const layout = document.querySelector('#layout');
const navigation = document.querySelector('#workspace-navigation');
const uuid = '[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}';
const uuidPattern = new RegExp('^' + uuid + '$');
const companyPath = new RegExp('^/empresas/(' + uuid + ')(?:/(evaluaciones|activos)(?:/(' + uuid + '))?)?$');
const roles = { AE: 'Administrador empresarial', GS: 'Gestor de seguridad', RA: 'Responsable asignado', AU: 'Auditor' };
const states = { BORRADOR: 'Borrador', EN_REVISION: 'En revisión', CERRADA: 'Cerrada' };
const applicability = { SIN_DECIDIR: 'Sin decidir', APLICA: 'Aplica', NO_APLICA: 'No aplica' };
const types = { CONTROL: 'Control', CLAUSULA: 'Cláusula' };
const assetTypes = { INFORMACION: 'Información', HARDWARE: 'Hardware', SOFTWARE: 'Software', SERVICIO: 'Servicio',
  RECURSO_HUMANO: 'Recurso humano', INSTALACION: 'Instalación', RED: 'Red' };
const assetStates = { ACTIVO: 'Activo', ARCHIVADO: 'Archivado' };
const assetLevels = { BAJA: 'Baja', MEDIA: 'Media', ALTA: 'Alta' };
const assetDimensions = { 1: 'Baja', 3: 'Media', 5: 'Alta' };
const resultStates = { SIN_ELEMENTOS: 'Sin elementos', NO_APLICA: 'No aplica', PENDIENTE: 'Pendiente',
  PROVISIONAL: 'Resultado provisional', CALCULADO: 'Calculado' };
const domains = { ORGANIZACIONAL: 'Organizacionales', PERSONAS: 'Personas', FISICO: 'Físicos', TECNOLOGICO: 'Tecnológicos' };
const domainOrder = new Map(Object.keys(domains).map((name, index) => [name, index]));
const dateFormat = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: 'UTC' });
const sizeFormat = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });
const resultFormat = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const groupOrder = new Intl.Collator('es-CO', { numeric: true });
let generation = 0;
let page = 0;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function template(id) { return document.querySelector('#' + id).content.cloneNode(true); }
function move(path, replace = false) {
  if (location.pathname !== path) history[replace ? 'replaceState' : 'pushState'](null, '', path);
}
function button(text, handler, className = 'secondary') {
  const node = element('button', text, className);
  node.type = 'button';
  node.addEventListener('click', handler);
  return node;
}
function message(text) {
  const node = element('p', text, 'message');
  node.setAttribute('role', 'alert');
  return node;
}
function heading(label, title, description) {
  const group = document.createDocumentFragment();
  group.append(element('span', label, 'eyebrow label'), element('h1', title));
  if (description) group.append(element('p', description, 'intro'));
  return group;
}
function describe(error) {
  if (error.code === 'CREDENCIALES_INVALIDAS') return 'El correo o la contraseña no son correctos.';
  if (error.status === 429) return 'Hay demasiados intentos. Espera un momento y vuelve a intentar.';
  if (error.code === 'CSRF_INVALIDO') return 'No pudimos validar la solicitud. Intenta de nuevo.';
  if (error.status === 403 || error.status === 404) return 'Esta empresa no está disponible para tu cuenta.';
  return 'No pudimos conectar con el servicio. Intenta de nuevo.';
}
function mount(content, signedIn, focus = false, companyUrl, context) {
  work.replaceChildren(content);
  layout.classList.toggle('signed-in', signedIn);
  navigation.replaceChildren();
  navigation.hidden = !signedIn;
  if (signedIn) navigation.append(workspaceNav(companyUrl, context));
  work.setAttribute('aria-busy', 'false');
  if (focus) {
    const target = work.querySelector('h1');
    if (target) { target.tabIndex = -1; target.focus(); }
  }
}
function signIn(notice = '', focus = false) {
  move('/', true);
  const view = template('login-view');
  const form = view.querySelector('form');
  const password = view.querySelector('#contrasena');
  const toggle = view.querySelector('#mostrar');
  const feedback = view.querySelector('.message');
  const submit = view.querySelector('button[type=submit]');
  function announce(text) {
    feedback.hidden = !text;
    feedback.textContent = text;
  }
  announce(notice);
  toggle.addEventListener('click', () => {
    const show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    toggle.textContent = show ? 'Ocultar' : 'Mostrar';
    toggle.setAttribute('aria-pressed', String(show));
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    const own = ++generation;
    announce('');
    const email = form.elements.correo.value.trim();
    let secret = password.value;
    password.value = '';
    submit.disabled = true;
    submit.textContent = 'Entrando…';
    try {
      const result = await api.login(email, secret);
      if (own !== generation) return;
      page = 0;
      move('/empresas', true);
      await showCompanies(result, own, true);
    } catch (error) {
      if (own === generation) announce(describe(error));
    } finally {
      secret = '';
      if (form.isConnected) {
        submit.disabled = false;
        submit.textContent = 'Entrar';
      }
    }
  });
  mount(view, false, focus);
}

function sessionBar(identity, context) {
  const bar = template('session-bar');
  const name = identity.nombreVisible || 'Mi cuenta';
  bar.querySelector('.account-name').textContent = name;
  bar.querySelector('.account-icon').textContent = Array.from(name.trim())[0]?.toUpperCase() || 'M';
  if (context) {
    const company = bar.querySelector('.company-context');
    company.hidden = false;
    const copy = element('div', undefined, 'company-copy');
    copy.append(element('span', 'EMPRESA ACTIVA', 'eyebrow label'), element('strong', context.nombre),
      element('small', roleNames(context)));
    company.append(copy, link('Cambiar empresa', '/empresas', 'switch-company'));
  }
  const control = bar.querySelector('.logout');
  control.addEventListener('click', async () => {
    if (control.disabled) return;
    const own = ++generation;
    control.disabled = true;
    try {
      await api.logout();
      if (own === generation) signIn('Sesión cerrada.', true);
    } catch (error) {
      if (own !== generation) return;
      if (error.status === 401) return signIn('Tu sesión ya no está activa.', true);
      control.disabled = false;
      work.querySelector('.operation-feedback')?.remove();
      const feedback = message(describe(error));
      feedback.classList.add('operation-feedback');
      control.closest('header').after(feedback);
    }
  });
  return bar;
}
function link(label, path, className) {
  const node = element('a', label, className);
  node.href = path;
  node.addEventListener('click', event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    move(path);
    load(true);
  });
  return node;
}
function roleNames(company) {
  return company.roles.map(role => roles[role] || role).join(' · ');
}
function canReadCompanyRecords(company) {
  return company.roles.some(role => ['AE', 'GS', 'AU'].includes(role));
}
function workspaceNav(companyUrl, context) {
  const nav = element('nav', undefined, 'workspace-nav');
  nav.setAttribute('aria-label', 'Espacio de trabajo');
  const entries = context ? [['Resumen de empresa', companyUrl]] : [['Mis empresas', '/empresas']];
  if (context && canReadCompanyRecords(context)) {
    entries.push(['Activos', companyUrl + '/activos'], ['Evaluaciones', companyUrl + '/evaluaciones']);
  }
  const list = element('div', undefined, 'workspace-links');
  const select = element('select', undefined, 'workspace-select');
  select.setAttribute('aria-label', 'Ir a una sección');
  for (const [label, path] of entries) {
    const current = location.pathname === path ||
      (context && path !== companyUrl && location.pathname.startsWith(path + '/'));
    const entry = link(label, path);
    if (current) entry.setAttribute('aria-current', 'location');
    list.append(entry);
    const option = element('option', label);
    option.value = path;
    option.selected = current;
    select.append(option);
  }
  select.addEventListener('change', () => { move(select.value); load(true); });
  nav.append(list);
  if (entries.length > 1) nav.append(select);
  return nav;
}
function pager(label, current, hasMore, change) {
  if (current === 0 && !hasMore) return document.createDocumentFragment();
  const nav = element('nav', undefined, 'pager');
  nav.setAttribute('aria-label', 'Páginas de ' + label);
  if (current > 0) nav.append(button('Anterior', () => change(current - 1)));
  nav.append(element('span', 'Página ' + (current + 1)));
  if (hasMore) nav.append(button('Siguiente', () => change(current + 1)));
  return nav;
}
async function showCompanies(identity, own, focus) {
  try {
    const data = await api.companies(page);
    if (own !== generation) return;
    const view = document.createDocumentFragment();
    view.append(sessionBar(identity), heading('ORGANIZACIONES', 'Mis empresas', 'Elige la empresa con la que quieres trabajar.'));
    if (!data.empresas.length) view.append(element('p', 'Tu cuenta no tiene empresas disponibles.', 'empty'));
    else {
      const list = element('ul', undefined, 'company-list');
      for (const item of data.empresas) {
        if (!uuidPattern.test(item.empresaId)) continue;
        const row = element('li');
        const entry = link(undefined, '/empresas/' + item.empresaId, 'company-link');
        const text = element('span', undefined, 'company-copy');
        text.append(element('strong', item.nombre), element('small', roleNames(item)));
        const arrow = element('span', '→', 'arrow');
        arrow.setAttribute('aria-hidden', 'true');
        entry.append(text, arrow);
        row.append(entry);
        list.append(row);
      }
      view.append(list);
    }
    view.append(pager('empresas', page, data.hayMas, next => { page = next; load(true); }));
    mount(view, true, focus);
  } catch (error) { failed(error, identity, own, focus); }
}
function failed(error, identity, own, focus, sectionPath, section, evaluationPage) {
  if (own !== generation) return;
  if (error.status === 401) return signIn('Tu sesión ya no está activa. Vuelve a entrar.', focus);
  const view = document.createDocumentFragment();
  if (identity) view.append(sessionBar(identity));
  const unavailable = sectionPath && (error.status === 403 || error.status === 404);
  const description = unavailable ? 'Esta consulta no está disponible para tu cuenta.' : describe(error);
  const actions = element('div', undefined, 'view-actions');
  if (!unavailable) actions.append(button('Reintentar', () => load(true, evaluationPage)));
  if (sectionPath && location.pathname !== sectionPath) {
    actions.append(link('Volver a ' + section, sectionPath, 'back'));
  }
  if (identity && location.pathname !== '/empresas') actions.append(link('Volver a mis empresas', '/empresas', 'back'));
  view.append(heading('ACCESO', 'No pudimos abrir esta vista'), message(description), actions);
  mount(view, Boolean(identity), focus);
}

function evaluationDate(value) {
  return dateFormat.format(new Date(value + 'T00:00:00Z'));
}
function evaluationListView(data, company, path, current) {
  const view = document.createDocumentFragment();
  view.append(heading(company, 'Evaluaciones', 'Consulta las evaluaciones de esta empresa.'));
  if (!data.elementos.length) {
    view.append(element('p', current === 0 ? 'No hay evaluaciones disponibles para tu cuenta.' : 'No hay evaluaciones en esta página.', 'empty'));
  } else {
    const list = element('ul', undefined, 'company-list');
    for (const item of data.elementos) {
      if (!uuidPattern.test(item.evaluacionId)) continue;
      const row = element('li');
      const entry = link(undefined, path + '/' + item.evaluacionId, 'company-link evaluation-link');
      const copy = element('span', undefined, 'company-copy');
      copy.append(element('strong', item.nombre), element('small', evaluationDate(item.fechaEvaluacion)));
      entry.append(copy, element('span', states[item.estado] || item.estado, 'status'));
      row.append(entry);
      list.append(row);
    }
    view.append(list);
  }
  view.append(pager('evaluaciones', current, data.hayMas, next => load(true, next)));
  return view;
}
function evidencePanel(companyId, evaluationId, responseId) {
  const panel = element('details', undefined, 'evidence-panel');
  const body = element('div', undefined, 'evidence-body');
  body.setAttribute('aria-live', 'polite');
  panel.append(element('summary', 'Evidencias'), body);
  let request = 0;

  async function show(current = 0, focus = false) {
    const own = generation;
    const call = ++request;
    const active = () => own === generation && call === request && panel.isConnected && panel.open;
    body.replaceChildren(element('p', 'Consultando evidencias…', 'loading'));
    try {
      const data = await api.evidence(companyId, evaluationId, responseId, current);
      if (!active()) return;
      const list = element('ul', undefined, 'evidence-list');
      for (const item of data.elementos) {
        if (!uuidPattern.test(item.evidenciaId)) continue;
        const entry = element('li');
        const file = element('a', item.nombreOriginal);
        file.href = api.evidenceFile(companyId, evaluationId, responseId, item.evidenciaId);
        file.setAttribute('aria-label', 'Descargar ' + item.nombreOriginal);
        const size = item.tamanoBytes < 1000
          ? item.tamanoBytes + ' B' : sizeFormat.format(item.tamanoBytes / 1000) + ' kB';
        entry.append(file, element('small', size));
        if (item.descripcion) entry.append(element('p', item.descripcion, 'preserve-lines'));
        list.append(entry);
      }
      body.replaceChildren(list.childElementCount ? list : element('p', 'No hay evidencias en esta página.', 'empty'),
        pager('evidencias', current, data.hayMas, next => show(next, true)));
    } catch (error) {
      if (!active()) return;
      if (error.status === 401) {
        ++generation;
        return signIn('Tu sesión ya no está activa. Vuelve a entrar.', true);
      }
      const unavailable = error.status === 403 || error.status === 404;
      body.replaceChildren(message(unavailable ? 'No se pueden consultar las evidencias de esta respuesta.' : describe(error)));
      if (!unavailable) body.append(button('Reintentar', () => show(current, true)));
    }
    if (focus) panel.querySelector('summary').focus();
  }

  panel.addEventListener('toggle', () => {
    if (panel.open) show();
    else {
      ++request;
      body.replaceChildren();
    }
  });
  return panel;
}
function resultGroup(title, data, groupName) {
  const group = element('section', undefined, 'result-group');
  const table = element('table');
  table.append(element('caption', title));
  const header = table.createTHead().insertRow();
  for (const name of ['Grupo', 'Evaluados', 'Puntaje']) {
    const cell = element('th', name);
    cell.scope = 'col';
    header.append(cell);
  }
  const rows = table.createTBody();
  for (const { grupo, resultado } of data) {
    const row = rows.insertRow();
    const name = element('th', groupName(grupo));
    name.scope = 'row';
    row.append(name, element('td', resultado.evaluados + ' / ' + resultado.aplicables),
      element('td', resultado.puntaje == null ? 'Sin puntaje' : resultFormat.format(resultado.puntaje)));
  }
  if (rows.rows.length) group.append(table);
  else group.append(element('h3', title), element('p', 'Sin resultados en este grupo.', 'empty'));
  return group;
}
function resultsView(results, evaluation, detailPath) {
  const section = element('section', undefined, 'results-panel');
  const total = results.controlesGlobal;
  const title = element('div', undefined, 'results-heading');
  const label = element('div');
  label.append(element('span', detailPath ? 'EVALUACIÓN MÁS RECIENTE' : 'DIAGNÓSTICO', 'eyebrow label'),
    element('h2', detailPath ? evaluation.nombre : 'Resultados de evaluación'));
  if (detailPath) label.append(element('p', evaluationDate(evaluation.fechaEvaluacion) + ' · ' +
    (states[evaluation.estado] || evaluation.estado), 'result-context'));
  title.append(label, element('span', resultStates[total.estado] || total.estado, 'status'));
  const grid = element('div', undefined, 'results-grid');
  const metrics = element('div', undefined, 'results-metrics');
  metrics.append(element('h3', 'Puntaje de controles evaluados'),
    element('p', total.puntaje == null ? 'Sin puntaje' : resultFormat.format(total.puntaje) + ' / 100', 'result-score'),
    element('h3', 'Avance de evaluación'));
  const percent = total.avance == null ? 'Sin avance calculable' : resultFormat.format(total.avance) + ' %';
  metrics.append(element('p', percent + ' · ' + total.evaluados + ' de ' + total.aplicables + ' controles', 'result-context'));
  if (total.avance != null) {
    const progress = element('progress');
    progress.max = 100;
    progress.value = total.avance;
    progress.setAttribute('aria-label', 'Avance de evaluación');
    metrics.append(progress);
  }
  const counts = element('ul', undefined, 'result-counts');
  for (const [value, text] of [[total.pendientes, 'sin calificar'], [total.sinDecidir, 'sin decidir aplicabilidad'],
    [total.noAplican, 'no aplica']]) counts.append(element('li', value + ' ' + text));
  metrics.append(counts);
  const orderedDomains = [...results.dominios].sort((left, right) =>
    (domainOrder.get(left.grupo) ?? domainOrder.size) - (domainOrder.get(right.grupo) ?? domainOrder.size));
  grid.append(metrics, resultGroup('Resultados por dominio', orderedDomains, group => domains[group] || group));
  const clauses = element('details', undefined, 'results-clauses');
  const orderedClauses = [...results.clausulas].sort((left, right) => groupOrder.compare(left.grupo, right.grupo));
  clauses.append(element('summary', 'Ver resultados por cláusula'),
    resultGroup('Resultados por cláusula', orderedClauses, group => group.replace(/^CLAUSULA_/, 'Cláusula ')));
  section.append(title, grid);
  if (detailPath) section.append(link('Abrir evaluación', detailPath, 'secondary section-link'));
  section.append(clauses);
  return section;
}
function evaluationDetailView(data, responses, results, company, current, companyId, evaluationId) {
  const view = document.createDocumentFragment();
  const details = element('dl', undefined, 'details evaluation-details');
  details.append(element('dt', 'Estado'), element('dd', states[data.estado] || data.estado),
    element('dt', 'Fecha de evaluación'), element('dd', evaluationDate(data.fechaEvaluacion)),
    element('dt', 'Alcance'), element('dd', data.alcance, 'preserve-lines'));
  view.append(heading(company, data.nombre), details, resultsView(results, data), element('h2', 'Respuestas'));
  if (!responses.elementos.length) {
    view.append(element('p', 'No hay respuestas en esta página.', 'empty'));
  } else {
    const list = element('ul', undefined, 'company-list');
    for (const item of responses.elementos) {
      const row = element('li', undefined, 'response-row');
      const answer = item.respuesta;
      const summary = element('div', undefined, 'response-heading');
      const code = [types[item.tipo] || item.tipo, item.codigo, item.grupo].filter(Boolean).join(' · ');
      const copy = element('div', undefined, 'company-copy');
      copy.append(element('small', code), element('h3', item.titulo));
      summary.append(copy, element('span', applicability[answer.aplicabilidad] || answer.aplicabilidad, 'status'));
      row.append(summary);
      if (answer.calificacion != null) row.append(element('p', 'Calificación: ' + answer.calificacion));
      if (answer.justificacionAplicabilidad) {
        row.append(element('h4', 'Justificación de aplicabilidad'), element('p', answer.justificacionAplicabilidad, 'preserve-lines'));
      }
      if (answer.fundamento) row.append(element('h4', 'Fundamento'), element('p', answer.fundamento, 'preserve-lines'));
      if (uuidPattern.test(item.respuestaId)) row.append(evidencePanel(companyId, evaluationId, item.respuestaId));
      list.append(row);
    }
    view.append(list);
  }
  view.append(pager('respuestas', current, responses.hayMas, next => load(true, next)));
  return view;
}

function assetPage(page, filters) {
  history.replaceState({ inventory: { page, filters } }, '');
  load(true);
}
function assetFilters(filters) {
  const form = element('form', undefined, 'asset-filters');
  form.setAttribute('aria-label', 'Filtros del inventario');
  const field = (id, title, control) => {
    const wrapper = element('div', undefined, 'asset-filter-field');
    const label = element('label', title);
    label.htmlFor = id;
    control.id = id;
    wrapper.append(label, control);
    form.append(wrapper);
  };
  const search = element('input');
  search.type = 'search';
  search.maxLength = 250;
  search.value = filters.texto || '';
  search.placeholder = 'Ej. ACT-001 o respaldos';
  field('asset-search', 'Buscar por nombre o código', search);
  const select = (id, title, entries, selected) => {
    const control = element('select');
    for (const [value, name] of Object.entries({ '': 'Todos', ...entries })) {
      const option = element('option', name);
      option.value = value;
      control.append(option);
    }
    control.value = selected || '';
    field(id, title, control);
    return control;
  };
  const type = select('asset-type', 'Tipo', assetTypes, filters.tipo);
  const state = select('asset-state', 'Estado', assetStates, filters.estado);
  const submit = element('button', 'Aplicar filtros', 'primary');
  submit.type = 'submit';
  const actions = element('div', undefined, 'asset-filter-actions');
  actions.append(submit);
  if (Object.values(filters).some(Boolean)) actions.append(button('Limpiar', () => assetPage(0, {})));
  form.append(actions);
  form.addEventListener('submit', event => {
    event.preventDefault();
    assetPage(0, { texto: search.value.trim(), tipo: type.value, estado: state.value });
  });
  return form;
}
function assetListView(data, company, path, { page, filters }) {
  const view = document.createDocumentFragment();
  view.append(heading(company, 'Activos', 'Consulta el inventario y la clasificación de los activos de información.'),
    assetFilters(filters));
  if (!data.elementos.length) {
    const empty = page ? 'No hay activos disponibles en esta página.' : 'Esta empresa no tiene activos disponibles.';
    view.append(element('p', Object.values(filters).some(Boolean)
      ? 'No hay activos que coincidan con los filtros.' : empty, 'empty'));
  } else {
    const list = element('ul', undefined, 'company-list asset-list');
    for (const item of data.elementos) {
      if (!uuidPattern.test(item.activoId)) continue;
      const row = element('li');
      const entry = link(undefined, path + '/' + item.activoId, 'company-link asset-link');
      const copy = element('span', undefined, 'company-copy');
      copy.append(element('small', item.codigo), element('strong', item.nombre),
        element('small', (assetTypes[item.tipo] || item.tipo) + ' · ' + (assetStates[item.estado] || item.estado)));
      const complete = item.estadoClasificacion === 'COMPLETO';
      const status = element('span', complete ? 'Clasificado' : 'Clasificación pendiente',
        complete ? 'status' : 'status asset-pending');
      const arrow = element('span', '→', 'arrow');
      arrow.setAttribute('aria-hidden', 'true');
      entry.append(copy, status, arrow);
      row.append(entry);
      list.append(row);
    }
    view.append(list);
  }
  view.append(pager('activos', page, data.hayMas, next => assetPage(next, filters)));
  return view;
}
function assetFacts(items) {
  const facts = element('dl', undefined, 'asset-facts');
  for (const [label, value] of items) {
    const item = element('div');
    item.append(element('dt', label), element('dd', value));
    facts.append(item);
  }
  return facts;
}
function classificationView(valuation) {
  const section = element('section', undefined, 'asset-valuation');
  const title = valuation.vigente ? 'Clasificación vigente' : 'Clasificación pendiente';
  const input = valuation.entradas;
  section.append(element('h3', title), assetFacts([
    ['Confidencialidad', assetDimensions[input.confidencialidad] || 'Pendiente'],
    ['Integridad', assetDimensions[input.integridad] || 'Pendiente'],
    ['Disponibilidad', assetDimensions[input.disponibilidad] || 'Pendiente'],
    ['Criticidad', valuation.vigente ? assetLevels[valuation.nivel] : 'Pendiente'],
  ]));
  if (input.fundamento) section.append(element('p', input.fundamento, 'preserve-lines'));
  return section;
}
async function assetDetailView(companyId, id, company) {
  const [data, classifications] = await Promise.all([api.asset(companyId, id), api.classifications(companyId, id)]);
  const ownerRequest = api.responsible(companyId, data.propietarioId);
  const custodianRequest = data.custodioId === data.propietarioId ? ownerRequest :
    data.custodioId ? api.responsible(companyId, data.custodioId) : null;
  const [process, owner, custodian] = await Promise.all([
    api.process(companyId, data.procesoId), ownerRequest, custodianRequest,
  ]);
  const view = document.createDocumentFragment();
  view.append(heading(company + ' · ' + data.codigo, data.nombre),
    element('p', data.descripcion, 'intro preserve-lines'), assetFacts([
      ['Tipo', assetTypes[data.tipo] || data.tipo], ['Estado', assetStates[data.estado] || data.estado],
      ['Proceso', process.nombre], ['Propietario', owner.nombre], ['Custodio', custodian?.nombre || 'Sin asignar'],
      ['Ubicación', data.ubicacion || 'Sin registrar'],
    ]), element('h2', 'Clasificación'));
  const current = classifications.elementos.find(item => item.vigente);
  const draft = classifications.elementos.find(item => item.estado === 'PENDIENTE');
  if (current) view.append(classificationView(current));
  if (draft) view.append(classificationView(draft));
  if (!current && !draft) view.append(element('p', 'Este activo todavía no tiene una clasificación.', 'empty'));
  return view;
}

async function load(focus = false, evaluationPage = 0) {
  const own = ++generation;
  const match = companyPath.exec(location.pathname);
  navigation.replaceChildren();
  navigation.hidden = true;
  work.replaceChildren(element('p', 'Cargando…', 'loading'));
  work.setAttribute('aria-busy', 'true');
  let identity;
  let sectionPath;
  let section;
  try {
    identity = await api.session();
    if (own !== generation) return;
    if (!match) {
      move('/empresas', true);
      return await showCompanies(identity, own, focus);
    }
    const [, companyId, module, id] = match;
    const companyUrl = '/empresas/' + companyId;
    const context = await api.company(companyId);
    if (own !== generation) return;
    const view = document.createDocumentFragment();
    view.append(sessionBar(identity, context));
    if (module === 'activos') {
      section = 'activos';
      sectionPath = companyUrl + '/activos';
      if (id) {
        const detail = await assetDetailView(companyId, id, context.nombre);
        view.append(link('← Activos', sectionPath, 'back'), detail);
      } else {
        const query = history.state?.inventory || { page: 0, filters: {} };
        const data = await api.assets(companyId, query.page, query.filters);
        view.append(assetListView(data, context.nombre, sectionPath, query));
      }
      if (own === generation) mount(view, true, focus, companyUrl, context);
      return;
    }
    if (module === 'evaluaciones') {
      section = 'evaluaciones';
      sectionPath = companyUrl + '/evaluaciones';
      if (id) {
        const [data, responses, results] = await Promise.all([
          api.evaluation(companyId, id), api.responses(companyId, id, evaluationPage),
          api.evaluationResults(companyId, id),
        ]);
        view.append(link('← Evaluaciones', sectionPath, 'back'),
          evaluationDetailView(data, responses, results, context.nombre, evaluationPage, companyId, id));
      } else {
        const data = await api.evaluations(companyId, evaluationPage);
        view.append(link('← ' + context.nombre, companyUrl, 'back'),
          evaluationListView(data, context.nombre, sectionPath, evaluationPage));
      }
      if (own === generation) mount(view, true, focus, companyUrl, context);
      return;
    }
    view.append(heading('ESPACIO DE TRABAJO', 'Resumen de empresa'),
      element('p', 'Zona horaria · ' + context.zonaHoraria, 'result-context'));
    if (canReadCompanyRecords(context)) {
      section = 'evaluaciones';
      sectionPath = companyUrl + '/evaluaciones';
      const page = await api.evaluations(companyId, 0);
      if (own !== generation) return;
      const latest = page.elementos[0];
      if (latest && uuidPattern.test(latest.evaluacionId)) {
        const results = await api.evaluationResults(companyId, latest.evaluacionId);
        view.append(resultsView(results, latest, sectionPath + '/' + latest.evaluacionId));
      } else {
        view.append(element('p', 'No hay evaluaciones disponibles para mostrar resultados.', 'empty'));
      }
      view.append(link('Ver evaluaciones', sectionPath, 'secondary section-link'));
    }
    if (own === generation) mount(view, true, focus, companyUrl, context);
  } catch (error) {
    if (error.status === 401 && own === generation && !identity) {
      signIn(match ? 'Inicia sesión para acceder a una empresa.' : '', focus);
    } else failed(error, identity, own, focus, sectionPath, section, evaluationPage);
  }
}

addEventListener('popstate', () => load(true));
addEventListener('pageshow', event => { if (event.persisted) load(); });
load();
