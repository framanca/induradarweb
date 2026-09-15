import { buildReportViewModel, renderReport } from './renderer.js';

const statusNode = document.querySelector('#report-status');
const reportNode = document.querySelector('#report-root');
const referenceNode = document.querySelector('#report-reference');
const dateNode = document.querySelector('#report-date');
const printButton = document.querySelector('#print-report');

function setStatus(message, kind = 'info') {
  statusNode.textContent = message;
  statusNode.dataset.kind = kind;
  statusNode.hidden = !message;
}

function reportReference() {
  const value = new URLSearchParams(window.location.search).get('ref')?.trim().toUpperCase() ?? '';
  return /^IR-[0-9]{8}-[0-9A-HJKMNP-TV-Z]{6}$/.test(value) ? value : '';
}

function getAccessToken() {
  const provider = window.INDURADAR_AUTH;
  if (provider && typeof provider.getAccessToken === 'function') {
    const value = provider.getAccessToken();
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return sessionStorage.getItem('induradar_access_token')
    || localStorage.getItem('induradar_access_token')
    || '';
}

function endpoint() {
  const value = window.INDURADAR_CONFIG?.reportEndpoint;
  return typeof value === 'string' ? value.trim() : '';
}

async function fetchReport(reference) {
  const reportEndpoint = endpoint();
  if (!reportEndpoint) throw new Error('report_endpoint_not_configured');

  const token = getAccessToken();
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
  }
}

printButton.addEventListener('click', () => window.print());
start();
