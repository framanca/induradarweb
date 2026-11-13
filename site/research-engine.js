import { contractFromLead } from './engine-contract.mjs';

// No implicit production activation: the accepted deployment supplies this pointer.
const active = window.INDURADAR_RESEARCH_ENGINE_POLICY === 'RE1.0.0';
if (active) {
  document.addEventListener('DOMContentLoaded', () => {
    const root = document.querySelector('#form-sections');
    if (!root) return;
    const section = document.createElement('section');
    section.className = 'research-objective-picker';
    section.innerHTML = `<fieldset><legend>Alcance de la investigación</legend>
      <label><input type="radio" name="researchScope" value="open_market" checked> Mercado abierto</label>
      <label><input type="radio" name="researchScope" value="exclusive_portfolio"> Cartera exclusiva</label>
      <label>Empresas (una por línea: nombre | dominio opcional | ID conocido opcional)
        <textarea name="exclusivePortfolio" rows="6"></textarea></label>
      <label>Importar lista <input type="file" accept=".txt,.csv,text/plain,text/csv" id="portfolio-file"></label>
      <label><input type="checkbox" name="companySignalSweep"> Buscar también novedades en el modo ampliar empresas</label>
      <p>Las identidades pendientes permanecen visibles. Las empresas relacionadas no amplían una cartera exclusiva.</p>
      </fieldset>`;
    root.prepend(section);
    section.querySelector('#portfolio-file').addEventListener('change', async event => {
      const file = event.target.files[0];
      if (file && file.size <= 2_000_000) section.querySelector('textarea').value = await file.text();
    });
    section.querySelector('textarea').addEventListener('input', event => event.target.setCustomValidity(''));
    document.addEventListener('submit', event => {
      const exclusive = document.querySelector('input[name="researchScope"]:checked')?.value === 'exclusive_portfolio';
      if (exclusive && !section.querySelector('textarea').value.trim()) {
        event.preventDefault(); event.stopImmediatePropagation();
        section.querySelector('textarea').setCustomValidity('Indica al menos una empresa');
        section.querySelector('textarea').reportValidity();
      }
    }, true);
  });
  const original = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (typeof init?.body === 'string') {
      try {
        const payload = JSON.parse(init.body);
        if (payload.source === 'induradar_landing' && payload.request) {
          payload.engine_contract = contractFromLead(payload, {
            scope: document.querySelector('input[name="researchScope"]:checked')?.value || 'open_market',
            portfolio_text: document.querySelector('textarea[name="exclusivePortfolio"]')?.value || '',
            signal_sweep: document.querySelector('input[name="companySignalSweep"]')?.checked === true,
          });
          if (payload.request.research_objective === 'signal_discovery') payload.engine_contract.signal_sweep = true;
          return original(input, {...init, body:JSON.stringify(payload)});
        }
      } catch { /* Non-JSON requests retain their original contract. */ }
    }
    return original(input, init);
  };
}
