import { getSupabaseClient, currentSession } from '../auth-client.js';

const authView = document.querySelector('#auth-view');
const portalView = document.querySelector('#portal-view');
const authStatus = document.querySelector('#auth-status');
const portalStatus = document.querySelector('#portal-status');
const sessionActions = document.querySelector('#session-actions');
const adminView = document.querySelector('#admin-view');

let portalData = { session: null, profile: null, requests: [], reports: [], users: [], memberships: [], ledger: [], catalog: null };
let recoveryInProgress = /[?#].*\btype=recovery\b/.test(`${window.location.search}${window.location.hash}`);

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function setStatus(node, message = '', kind = 'success') {
  node.hidden = !message;
  node.className = `status ${kind}`;
  node.textContent = message;
}

function errorMessage(error) {
  const message = error?.message ?? '';
  if (message.includes('Invalid login credentials')) return 'El email o la contraseña no son correctos.';
  if (message.includes('Email not confirmed')) return 'Confirma tu email antes de entrar.';
  if (message.includes('User already registered')) return 'No hemos podido crear la cuenta. Si ya existe, entra o restablece la contraseña.';
  return 'No se ha podido completar la operación. Inténtalo de nuevo.';
}

function setAuthMode(mode) {
  document.querySelector('#sign-in-form').hidden = mode !== 'sign-in';
  document.querySelector('#sign-up-form').hidden = mode !== 'sign-up';
  document.querySelector('#new-password-form').hidden = mode !== 'new-password';
  document.querySelector('.auth-secondary').hidden = mode !== 'sign-in';
  setStatus(authStatus);
}

function formatDate(value) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(value));
}

function statusLabel(status) {
  return ({ received: 'Recibida', clarified: 'Pendiente de aclaración', researching: 'En investigación', review: 'En revisión', ready: 'Lista', delivered: 'Entregada', archived: 'Archivada' }[status] ?? status ?? 'Sin estado');
}

function balanceFor(accountId) {
  return portalData.ledger.filter((entry) => entry.account_id === accountId).reduce((total, entry) => total + Number(entry.credits_delta ?? 0), 0);
}

async function requireData(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function loadPortal() {
  const supabase = getSupabaseClient();
  if (!supabase || !portalData.session) return;
  setStatus(portalStatus, 'Cargando tu información…');
  try {
    const userId = portalData.session.user.id;
    const [profile, memberships, requests, reports, ledger, catalogRows] = await Promise.all([
      requireData(supabase.from('user_profiles').select('user_id,email,display_name,is_platform_admin').eq('user_id', userId).single()),
      requireData(supabase.from('memberships').select('account_id,user_id,role').eq('user_id', userId)),
      requireData(supabase.from('service_requests').select('id,account_id,request_key,title,status,received_at,delivered_at,credits_charged,created_by').order('received_at', { ascending: false })),
      requireData(supabase.rpc('portal_list_available_reports')),
      requireData(supabase.from('credit_ledger').select('id,account_id,user_id,service_request_id,entry_type,credits_delta,catalog_version,description,created_at').order('created_at', { ascending: false })),
      requireData(supabase.from('credit_pricing_catalog').select('catalog').eq('singleton', true).single()),
    ]);
    portalData = { ...portalData, profile, memberships, requests, reports, ledger, catalog: catalogRows.catalog };
    if (profile.is_platform_admin) {
      const [users, allMemberships] = await Promise.all([
        requireData(supabase.from('user_profiles').select('user_id,email,display_name,is_platform_admin,created_at').order('created_at')),
        requireData(supabase.from('memberships').select('account_id,user_id,role')),
      ]);
      portalData = { ...portalData, users, memberships: allMemberships };
    }
    renderPortal();
    setStatus(portalStatus);
  } catch (error) {
    console.error('Portal load failed', error);
    setStatus(portalStatus, 'No hemos podido cargar tu información. Recarga la página e inténtalo de nuevo.', 'error');
  }
}

function renderPortal() {
  const { profile, session, requests, reports, memberships } = portalData;
  const ownMembership = memberships.find((membership) => membership.user_id === session.user.id);
  const balance = ownMembership ? balanceFor(ownMembership.account_id) : 0;
  document.querySelector('#welcome-name').textContent = `Hola, ${profile.display_name || session.user.email}`;
  document.querySelector('#portal-role').textContent = profile.is_platform_admin ? 'Panel maestro' : 'Portal de clientes';
  document.querySelector('#portal-subtitle').textContent = profile.is_platform_admin ? 'Puedes revisar todos los trabajos, sus informes y los saldos de los usuarios.' : 'Consulta tus solicitudes, saldo e informes aprobados.';
  document.querySelector('#credit-balance').textContent = `${balance} créditos`;
  document.querySelector('#request-count').textContent = String(requests.length);
  document.querySelector('#report-count').textContent = String(reports.length);
  sessionActions.innerHTML = `<span class="session-email">${escapeHtml(session.user.email)}</span><button type="button" id="sign-out">Salir</button>`;
  document.querySelector('#sign-out').addEventListener('click', signOut);
  renderLedger(ownMembership?.account_id);
  renderRequests(requests);
  renderReports(reports);
  adminView.hidden = !profile.is_platform_admin;
  if (profile.is_platform_admin) renderAdmin();
}

function renderLedger(accountId) {
  const entries = portalData.ledger.filter((entry) => entry.account_id === accountId);
  const root = document.querySelector('#ledger-list');
  root.innerHTML = entries.length ? `<div class="row-list">${entries.map((entry) => `
    <article class="row"><div><strong>${escapeHtml(entry.description)}</strong><span class="meta">${formatDate(entry.created_at)}</span></div><strong class="${Number(entry.credits_delta) < 0 ? 'negative' : 'positive'}">${Number(entry.credits_delta) > 0 ? '+' : ''}${entry.credits_delta} créditos</strong></article>`).join('')}</div>` : 'Aún no hay movimientos de créditos.';
}

function renderRequests(requests) {
  const root = document.querySelector('#request-list');
  root.innerHTML = requests.length ? `<div class="row-list">${requests.map((request) => `
    <article class="row"><div><strong>${escapeHtml(request.title || request.request_key)}</strong><span class="meta">${escapeHtml(request.request_key)} · ${formatDate(request.received_at)}${request.credits_charged == null ? '' : ` · ${request.credits_charged} créditos`}</span></div><span class="badge ${escapeHtml(request.status)}">${escapeHtml(statusLabel(request.status))}</span></article>`).join('')}</div>` : 'Todavía no has encargado ningún trabajo.';
}

function renderReports(reports) {
  const root = document.querySelector('#report-list');
  root.innerHTML = reports.length ? `<div class="row-list">${reports.map((report) => `
    <article class="row"><div><strong>${escapeHtml(report.title)}</strong><span class="meta">${escapeHtml(report.report_reference)} · ${formatDate(report.delivered_at || report.generated_at)}</span></div><a class="report-link" href="/report/?ref=${encodeURIComponent(report.report_reference)}">Abrir informe</a></article>`).join('')}</div>` : 'Aún no hay informes aprobados para consultar.';
}

function userAccount(userId) {
  return portalData.memberships.find((membership) => membership.user_id === userId)?.account_id;
}

function renderAdmin() {
  const userRoot = document.querySelector('#admin-users');
  const requestRoot = document.querySelector('#admin-requests');
  const assignableUsers = portalData.users.filter((user) => !user.is_platform_admin);
  userRoot.innerHTML = portalData.users.length ? `<div class="row-list">${portalData.users.map((user) => {
    const accountId = userAccount(user.user_id);
    const balance = accountId ? balanceFor(accountId) : 0;
    return `<article class="row"><div><strong>${escapeHtml(user.display_name || user.email)}</strong><span class="meta">${escapeHtml(user.email)} · Saldo: ${balance} créditos</span>${user.is_platform_admin ? '<span class="badge">Maestro</span>' : ''}</div>${user.is_platform_admin ? '' : `<form class="adjust-form" data-adjust-user="${user.user_id}"><label>Créditos<input name="credits" type="number" required step="1" placeholder="Ej. 100"></label><label>Motivo<input name="description" type="text" required maxlength="240" placeholder="Recarga o ajuste"></label><button type="submit">Aplicar</button></form>`}</article>`;
  }).join('')}</div>` : 'Todavía no hay usuarios registrados.';
  requestRoot.innerHTML = portalData.requests.length ? `<div class="row-list admin-requests">${portalData.requests.map((request) => {
    const currentUser = portalData.users.find((user) => userAccount(user.user_id) === request.account_id);
    return `<article class="row"><div><strong>${escapeHtml(request.title || request.request_key)}</strong><span class="meta">${escapeHtml(request.request_key)} · ${escapeHtml(statusLabel(request.status))} · ${escapeHtml(currentUser?.email || 'Sin usuario asignado')}</span></div><form class="assignment" data-request-id="${request.id}"><select name="user_id" aria-label="Asignar trabajo"><option value="">Asignar a usuario…</option>${assignableUsers.map((user) => `<option value="${user.user_id}" ${userAccount(user.user_id) === request.account_id ? 'selected' : ''}>${escapeHtml(user.display_name || user.email)}</option>`).join('')}</select><button class="assign-button" type="submit">Asignar</button></form></article>`;
  }).join('')}</div>` : 'No hay trabajos disponibles.';
  userRoot.querySelectorAll('.adjust-form').forEach((form) => form.addEventListener('submit', adjustCredits));
  requestRoot.querySelectorAll('.assignment').forEach((form) => form.addEventListener('submit', assignRequest));
  renderPricingForm();
}

function bandRows(catalog, key, label) {
  return `<section><h3>${label}</h3><table class="pricing-table"><thead><tr><th>Desde</th><th>Hasta</th><th>Créditos</th></tr></thead><tbody>${catalog[key].map((band, index) => `<tr><td><input required type="number" min="0" data-band="${key}" data-index="${index}" data-field="from" value="${band.from}"></td><td><input type="number" min="0" data-band="${key}" data-index="${index}" data-field="to" value="${band.to ?? ''}" placeholder="Sin límite"></td><td><input required type="number" min="0" data-band="${key}" data-index="${index}" data-field="credits_per_unit" value="${band.credits_per_unit}"></td></tr>`).join('')}</tbody></table></section>`;
}

function renderPricingForm() {
  const catalog = portalData.catalog;
  const root = document.querySelector('#pricing-form');
  root.innerHTML = `<div class="pricing-top">
    <label>Versión<input required data-catalog="catalog_version" value="${escapeHtml(catalog.catalog_version)}"></label>
    <label>Créditos base<input required type="number" min="0" data-catalog="base_credits" value="${catalog.base_credits}"></label>
    <label>Provincias incluidas<input required type="number" min="0" data-catalog="included.provinces" value="${catalog.included.provinces}"></label>
    <label>Sectores incluidos<input required type="number" min="0" data-catalog="included.sectors" value="${catalog.included.sectors}"></label>
    <label>Señales incluidas<input required type="number" min="0" data-catalog="included.signals" value="${catalog.included.signals}"></label>
    <label>Toda España (provincias)<input required type="number" min="0" data-catalog="country_scopes.spain_all_provinces" value="${catalog.country_scopes.spain_all_provinces}"></label>
    <label>Equivalente Portugal<input required type="number" min="0" data-catalog="country_scopes.portugal_province_equivalent" value="${catalog.country_scopes.portugal_province_equivalent}"></label>
  </div>${bandRows(catalog, 'province_bands', 'Provincias adicionales')}${bandRows(catalog, 'sector_bands', 'Sectores adicionales')}${bandRows(catalog, 'signal_bands', 'Suplemento por señales')}<button class="primary" type="submit">Guardar tarifa</button>`;
  root.onsubmit = savePricing;
}

async function adjustCredits(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const credits = Number(form.elements.credits.value);
  const description = form.elements.description.value.trim();
  if (!Number.isInteger(credits) || credits === 0 || !description) return;
  try {
    const { error } = await getSupabaseClient().rpc('adjust_user_credit_balance', { p_user_id: form.dataset.adjustUser, p_credits_delta: credits, p_description: description });
    if (error) throw error;
    await loadPortal();
    setStatus(portalStatus, 'Saldo actualizado.');
  } catch (error) { setStatus(portalStatus, errorMessage(error), 'error'); }
}

async function assignRequest(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const userId = form.elements.user_id.value;
  if (!userId) return;
  try {
    const { error } = await getSupabaseClient().rpc('assign_service_request_to_user', { p_service_request_id: form.dataset.requestId, p_user_id: userId });
    if (error) throw error;
    await loadPortal();
    setStatus(portalStatus, 'Trabajo asignado y sus informes se han transferido al usuario.');
  } catch (error) { setStatus(portalStatus, errorMessage(error), 'error'); }
}

async function savePricing(event) {
  event.preventDefault();
  const catalog = structuredClone(portalData.catalog);
  event.currentTarget.querySelectorAll('[data-catalog]').forEach((input) => {
    const path = input.dataset.catalog.split('.');
    let parent = catalog;
    path.slice(0, -1).forEach((part) => { parent = parent[part]; });
    parent[path.at(-1)] = input.type === 'number' ? Number(input.value) : input.value.trim();
  });
  event.currentTarget.querySelectorAll('[data-band]').forEach((input) => {
    const band = catalog[input.dataset.band][Number(input.dataset.index)];
    band[input.dataset.field] = input.dataset.field === 'to' && input.value === '' ? null : Number(input.value);
  });
  try {
    const { data, error } = await getSupabaseClient().rpc('update_credit_pricing_catalog', { p_catalog: catalog });
    if (error) throw error;
    portalData.catalog = data;
    renderPricingForm();
    setStatus(portalStatus, 'Tarifa actualizada. Las nuevas solicitudes usarán estos importes.');
  } catch (error) { setStatus(portalStatus, errorMessage(error), 'error'); }
}

function showSignedOut() {
  portalData = { session: null, profile: null, requests: [], reports: [], users: [], memberships: [], ledger: [], catalog: null };
  portalView.hidden = true;
  authView.hidden = false;
  sessionActions.replaceChildren();
  setAuthMode('sign-in');
}

async function signOut() {
  try {
    const { error } = await getSupabaseClient().auth.signOut();
    if (error) throw error;
  } catch (error) {
    setStatus(portalStatus, 'No se ha podido cerrar la sesión. Inténtalo de nuevo.', 'error');
    return;
  }
  showSignedOut();
}

async function signIn(event) {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    const { error } = await getSupabaseClient().auth.signInWithPassword({ email: form.elements.email.value.trim(), password: form.elements.password.value });
    if (error) throw error;
  } catch (error) { setStatus(authStatus, errorMessage(error), 'error'); }
}

async function signUp(event) {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    const { error } = await getSupabaseClient().auth.signUp({
      email: form.elements.email.value.trim(), password: form.elements.password.value,
      options: { data: { full_name: form.elements.full_name.value.trim() }, emailRedirectTo: `${window.location.origin}/portal/` },
    });
    if (error) throw error;
    form.reset();
    setStatus(authStatus, 'Revisa tu email y confirma la cuenta para poder entrar.');
  } catch (error) { setStatus(authStatus, errorMessage(error), 'error'); }
}

async function requestPasswordReset() {
  const emailInput = document.querySelector('#sign-in-form [name="email"]');
  const email = emailInput.value.trim();
  if (!emailInput.checkValidity()) {
    emailInput.focus();
    setStatus(authStatus, 'Escribe tu email para recibir el enlace de restablecimiento.', 'error');
    return;
  }
  try {
    const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/portal/` });
    if (error) throw error;
    setStatus(authStatus, 'Si existe una cuenta con ese email, recibirás un enlace para restablecer la contraseña.');
  } catch (error) { setStatus(authStatus, errorMessage(error), 'error'); }
}

async function setNewPassword(event) {
  event.preventDefault();
  try {
    const { error } = await getSupabaseClient().auth.updateUser({ password: event.currentTarget.elements.password.value });
    if (error) throw error;
    event.currentTarget.reset();
    recoveryInProgress = false;
    setStatus(authStatus, 'Contraseña actualizada. Ya puedes entrar.', 'success');
    setAuthMode('sign-in');
  } catch (error) { setStatus(authStatus, errorMessage(error), 'error'); }
}

async function showPortal(session) {
  portalData.session = session;
  authView.hidden = true;
  portalView.hidden = false;
  await loadPortal();
}

function wireAuth() {
  document.querySelectorAll('[data-auth-action]').forEach((button) => button.addEventListener('click', () => {
    if (button.dataset.authAction === 'forgot') void requestPasswordReset();
    else setAuthMode(button.dataset.authAction === 'sign-up' ? 'sign-up' : 'sign-in');
  }));
  document.querySelector('#sign-in-form').addEventListener('submit', signIn);
  document.querySelector('#sign-up-form').addEventListener('submit', signUp);
  document.querySelector('#new-password-form').addEventListener('submit', setNewPassword);
}

async function start() {
  wireAuth();
  const supabase = getSupabaseClient();
  if (!supabase) { setStatus(authStatus, 'El portal todavía no está conectado al servicio de acceso.', 'error'); return; }
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      recoveryInProgress = true;
      authView.hidden = false;
      portalView.hidden = true;
      setAuthMode('new-password');
    }
    if (event === 'SIGNED_IN' && session && !recoveryInProgress) void showPortal(session);
    if (event === 'SIGNED_OUT') showSignedOut();
  });
  const session = await currentSession();
  if (recoveryInProgress) setAuthMode('new-password');
  else if (session) await showPortal(session);
  else setAuthMode('sign-in');
}

start();
