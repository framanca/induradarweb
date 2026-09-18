import { buildReportViewModel, renderReport } from './renderer.js';
import { currentSession, getSupabaseClient } from '../auth-client.js';

const statusNode = document.querySelector('#report-status');
const reportNode = document.querySelector('#report-root');
const referenceNode = document.querySelector('#report-reference');
const dateNode = document.querySelector('#report-date');
const printButton = document.querySelector('#print-report');
const reportAuthNode = document.querySelector('#report-auth');
const reportAuthStatusNode = document.querySelector('#report-auth-status');
const reportAuthForm = document.querySelector('#report-auth-form');
let printState = [];

function setStatus(message, kind = 'info') {
  statusNode.textContent = message;
  statusNode.dataset.kind = kind;
  statusNode.hidden = !message;
}

function setAuthStatus(message = '', kind = 'error') {
  reportAuthStatusNode.textContent = message;
  reportAuthStatusNode.dataset.kind = kind;
  reportAuthStatusNode.hidden = !message;
}

function authErrorMessage(error) {
  const message = error?.message ?? '';
  if (message.includes('Invalid login credentials')) return 'El email o la contraseña no son correctos.';
  if (message.includes('Email not confirmed')) return 'Confirma tu email antes de entrar.';
  return 'No se ha podido completar el acceso. Inténtalo de nuevo.';
}

function showReportLogin() {
  reportAuthNode.hidden = false;
  reportAuthForm.elements.email.focus();
}

function reportReference() {
  const value = new URLSearchParams(window.location.search).get('ref')?.trim().toUpperCase() ?? '';
  return /^IR-[0-9]{8}-[0-9A-HJKMNP-TV-Z]{6}$/.test(value) ? value : '';
}

async function getAccessToken() {
  const provider = window.INDURADAR_AUTH;
  if (provider && typeof provider.getAccessToken === 'function') {
    const value = await provider.getAccessToken();
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  const session = await currentSession();
  return session?.access_token || sessionStorage.getItem('induradar_access_token') || '';
}

function endpoint() {
  const value = window.INDURADAR_CONFIG?.reportEndpoint;
  return typeof value === 'string' ? value.trim() : '';
}

async function fetchReport(reference) {
  const reportEndpoint = endpoint();
  if (!reportEndpoint) throw new Error('report_endpoint_not_configured');

  const token = await getAccessToken();
  if (!token) throw new Error('authentication_required');

  const url = new URL(reportEndpoint);
  url.searchParams.set('ref', reference);
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
    credentials: 'omit',
  });

  if (response.status === 401 || response.status === 403) throw new Error('authentication_required');
  if (response.status === 404) throw new Error('report_not_available');
  if (!response.ok) throw new Error('report_load_failed');

  const body = await response.json();
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid_report_payload');
  return body;
}

function messageFor(error) {
  switch (error?.message) {
    case 'authentication_required':
      return 'Este informe requiere una sesión autenticada de InduRadar.';
    case 'report_not_available':
      return 'El informe no está disponible o tu cuenta no tiene acceso.';
    case 'report_endpoint_not_configured':
      return 'El visor de informes todavía no está conectado al portal.';
    case 'invalid_report_payload':
      return 'La respuesta del informe no cumple el formato esperado.';
    default:
      return 'No se ha podido cargar el informe. Inténtalo de nuevo desde el portal.';
  }
}

async function start() {
  const reference = reportReference();
  if (!reference) {
    setStatus('La referencia del informe no es válida.', 'error');
    return;
  }

  referenceNode.textContent = reference;
  document.title = `${reference} | InduRadar`;
  setStatus('Cargando informe…');
  reportAuthNode.hidden = true;
  setAuthStatus();

  try {
    const data = await fetchReport(reference);
    const model = buildReportViewModel(data);
    referenceNode.textContent = model.reference || reference;
    dateNode.textContent = model.asOf ? `Fecha de corte: ${model.asOf}` : '';
    renderReport(reportNode, model);
    setStatus('');
    printButton.hidden = false;
  } catch (error) {
    console.error('InduRadar report viewer error', error?.message ?? error);
    setStatus(messageFor(error), 'error');
    if (error?.message === 'authentication_required') showReportLogin();
  }
}

async function signInToReport(event) {
  event.preventDefault();
  const email = reportAuthForm.elements.email.value.trim();
  const password = reportAuthForm.elements.password.value;
  try {
    const { error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
    if (error) throw error;
    await start();
  } catch (error) {
    setAuthStatus(authErrorMessage(error));
  }
}

async function requestReportPasswordReset() {
  const emailInput = reportAuthForm.elements.email;
  if (!emailInput.checkValidity()) {
    emailInput.focus();
    setAuthStatus('Escribe tu email para recibir el enlace de restablecimiento.');
    return;
  }
  try {
    const { error } = await getSupabaseClient().auth.resetPasswordForEmail(emailInput.value.trim(), { redirectTo: `${window.location.origin}/portal/` });
    if (error) throw error;
    setAuthStatus('Si existe una cuenta con ese email, recibirás un enlace para restablecer la contraseña.', 'success');
  } catch (error) {
    setAuthStatus(authErrorMessage(error));
  }
}

window.addEventListener('beforeprint', () => {
  printState = [...reportNode.querySelectorAll('details')].map((node) => [node, node.open]);
  printState.forEach(([node]) => { node.open = true; });
});
window.addEventListener('afterprint', () => {
  printState.forEach(([node, wasOpen]) => { node.open = wasOpen; });
  printState = [];
});

printButton.addEventListener('click', () => window.print());
reportAuthForm.addEventListener('submit', signInToReport);
document.querySelector('#report-forgot-password').addEventListener('click', () => void requestReportPasswordReset());
start();
