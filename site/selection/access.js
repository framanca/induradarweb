import { validReference, validateSelection } from './renderer.js';

// The public table contains only explicitly released, client-safe snapshots.
// RLS hides revoked snapshots; no private report tables or RPC grants change.
export async function loadSelection(client, reference, authenticated = false) {
  if (!client || !validReference(reference)) throw new Error('invalid_selection_request');
  if (authenticated) {
    const { data, error } = await client.rpc('get_curated_report_v1', {
      p_report_reference: reference, p_format: 'light',
    });
    if (!error && data?.found && data.report_reference === reference && data.payload) {
      validateSelection(data.payload, reference);
      return { payload: data.payload, publicView: false };
    }
  }
  const { data, error } = await client.from('curated_report_publications_v1')
    .select('document').eq('report_reference', reference).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const doc = data.document;
  if (!doc?.found || doc.report_reference !== reference || doc.report_kind !== 'curated_selection') {
    throw new Error('invalid_public_selection');
  }
  validateSelection(doc.payload, reference);
  return { payload: doc.payload, publicView: true };
}
