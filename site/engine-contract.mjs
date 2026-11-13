// RE1 request normalization. Authority is issued by server policy + authenticated intake.
export const POLICY_VERSION = 'RE1.0.0';
export const MODES = ['signal_discovery', 'universe_discovery'];
export const SCOPES = ['open_market', 'exclusive_portfolio'];

export function parsePortfolio(text) {
  return String(text || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean).map((line, index) => {
    const [name, rawDomain, companyId] = line.split('|').map(x => x.trim());
    const domain = rawDomain ? new URL(rawDomain.includes('://') ? rawDomain : `https://${rawDomain}`).hostname : null;
    return { member_key: `member-${index + 1}`, name, domain, company_id: companyId || null, tax_id: null };
  });
}

export function normalizeEngineRequest(raw, context) {
  if (raw?.policy_version !== POLICY_VERSION) throw new Error('Política RE1 explícita requerida');
  const modeAliases={'detectar oportunidades':'signal_discovery','ampliar empresas':'universe_discovery'};
  const modeKey=String(raw.mode || '').trim().toLowerCase().replaceAll('-','_');
  const mode = modeAliases[modeKey] || modeKey;
  if (!MODES.includes(mode)) throw new Error('Las solicitudes nuevas admiten solo dos modalidades');
  const scopeKey=String(raw.scope || 'open_market').trim().toLowerCase().replaceAll('-','_');
  const scope = ({'mercado abierto':'open_market','cartera exclusiva':'exclusive_portfolio'})[scopeKey] || scopeKey;
  if (!SCOPES.includes(scope)) throw new Error('Alcance no reconocido');
  const portfolio = (Array.isArray(raw.portfolio) ? raw.portfolio : parsePortfolio(raw.portfolio_text)).map(p => ({
    member_key:p.member_key,name:p.name,company_id:p.company_id || null,domain:p.domain || null,tax_id:p.tax_id || null,
  }));
  if (scope === 'exclusive_portfolio' && !portfolio.length) throw new Error('Indica las empresas de la cartera exclusiva');
  if (new Set(portfolio.map(p => p.member_key)).size !== portfolio.length) throw new Error('Miembros de cartera duplicados sin resolver');
  const types = [...new Set(raw.target_company_types || [])];
  const countries={es:'España',espana:'España','españa':'España',spain:'España',pt:'Portugal',portugal:'Portugal'};
  const territories = (raw.territories || []).map(t=>({...t,country:countries[String(t.country).trim().toLowerCase()] || t.country}));
  if (!String(raw.offer || '').trim() || !types.length || !territories.length) throw new Error('Faltan oferta, tipos o territorio');
  if (territories.some(t => !['España', 'Portugal'].includes(t.country))) throw new Error('Territorio no normalizado');
  if (raw.named_contacts_authorized === true) throw new Error('La investigación de personas requiere un módulo separado');
  if (mode === 'signal_discovery' && raw.signal_sweep === false) throw new Error('Detectar oportunidades requiere barrido ligero');
  if (!context.account_id || !context.submission_id || !context.as_of) throw new Error('Falta el contexto de solicitud del servidor');
  return {
    policy_version: POLICY_VERSION, submission_id: context.submission_id, account_id: context.account_id,
    mode, scope, offer: String(raw.offer).trim(), target_company_types: types,
    signal_types: [...new Set(raw.signal_types || [])],
    territories: territories.map(t => ({country:t.country,province:t.province || null,municipality:t.municipality || null})),
    must_have: raw.must_have || [], preferences: raw.preferences || [], exclusions: raw.exclusions || [],
    signal_sweep: mode === 'signal_discovery' || raw.signal_sweep === true, portfolio,
    as_of: context.as_of, predecessor_id: raw.predecessor_id || null,
    extension_authorization: context.extension_authorization || null,
    ambiguities: raw.ambiguities || [], named_contacts_authorized: false,
  };
}

export function contractFromLead(payload, options) {
  const request = payload.request || {}, seller = payload.seller_profile || {};
  return {
    policy_version: POLICY_VERSION, mode: request.research_objective,
    scope: options.scope, portfolio_text: options.portfolio_text, signal_sweep: options.signal_sweep,
    offer: seller.offer, target_company_types: request.target_company_types,
    signal_types: request.signal_types,
    territories: (request.geographies || []).map(t => ({country:t.country,province:t.province,municipality:t.city})),
    must_have: seller.must_have || [], preferences: options.preferences || [], exclusions: seller.exclusions || [],
    named_contacts_authorized: false,
  };
}
