import * as api from './api.js';

const work = document.querySelector('#workspace');
const layout = document.querySelector('#layout');
const companyPath = /^\/empresas\/([0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12})$/;
const roles = { AE: 'Administrador empresarial', GS: 'Gestor de seguridad', RA: 'Responsable asignado', AU: 'Auditor' };
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
function mount(content, signedIn, focus = false) {
  work.replaceChildren(content);
  layout.classList.toggle('signed-in', signedIn);
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

function sessionBar(identity) {
  const bar = template('session-bar');
  const name = identity.nombreVisible || 'Mi cuenta';
  bar.querySelector('.account-name').textContent = name;
  bar.querySelector('.account-icon').textContent = Array.from(name.trim())[0]?.toUpperCase() || 'M';
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
        if (!companyPath.test('/empresas/' + item.empresaId)) continue;
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
    if (page > 0 || data.hayMas) {
      const nav = element('nav', undefined, 'pager');
      nav.setAttribute('aria-label', 'Páginas de empresas');
      const change = (delta) => { page += delta; load(true); };
      if (page > 0) nav.append(button('Anterior', () => change(-1)));
      nav.append(element('span', 'Página ' + (page + 1)));
      if (data.hayMas) nav.append(button('Siguiente', () => change(1)));
      view.append(nav);
    }
    mount(view, true, focus);
  } catch (error) { failed(error, identity, own, focus); }
}
function failed(error, identity, own, focus) {
  if (own !== generation) return;
  if (error.status === 401) return signIn('Tu sesión ya no está activa. Vuelve a entrar.', focus);
  const view = document.createDocumentFragment();
  if (identity) view.append(sessionBar(identity));
  view.append(heading('ACCESO', 'No pudimos abrir esta vista'), message(describe(error)),
    button('Reintentar', () => load(true)));
  if (identity && location.pathname !== '/empresas') view.append(link('Volver a mis empresas', '/empresas', 'back'));
  mount(view, Boolean(identity), focus);
}
async function load(focus = false) {
  const own = ++generation;
  const match = companyPath.exec(location.pathname);
  work.replaceChildren(element('p', 'Cargando…', 'loading'));
  work.setAttribute('aria-busy', 'true');
  let identity;
  try {
    identity = await api.session();
    if (own !== generation) return;
    if (!match) {
      move('/empresas', true);
      return await showCompanies(identity, own, focus);
    }
    const context = await api.company(match[1]);
    if (own !== generation) return;
    const view = document.createDocumentFragment();
    view.append(sessionBar(identity), link('← Mis empresas', '/empresas', 'back'),
      heading('EMPRESA SELECCIONADA', context.nombre));
    const details = element('dl', undefined, 'details');
    details.append(element('dt', 'Roles de tu cuenta'), element('dd', roleNames(context)),
      element('dt', 'Zona horaria'), element('dd', context.zonaHoraria));
    view.append(details);
    mount(view, true, focus);
  } catch (error) {
    if (error.status === 401 && own === generation && !identity) {
      signIn(match ? 'Inicia sesión para acceder a una empresa.' : '', focus);
    } else failed(error, identity, own, focus);
  }
}

addEventListener('popstate', () => load(true));
addEventListener('pageshow', event => { if (event.persisted) load(); });
load();
