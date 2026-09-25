(() => {
  'use strict';

  const DEFAULT_OBJECTIVE = 'signal_discovery';
  const OBJECTIVES = [
    {
      value: 'signal_discovery',
      title: 'Descubrir oportunidades',
      description:
        'Buscar señales, proyectos e inversiones y centrar la investigación en convertir los mejores hallazgos en oportunidades comerciales.',
    },
    {
      value: 'universe_discovery',
      title: 'Descubrir empresas',
      description:
        'Construir un universo de empresas objetivo y priorizar identidad, encaje, deduplicación y cobertura.',
    },
  ];

  function selectedObjective() {
    const selected = document.querySelector('input[name="researchObjective"]:checked');
    return OBJECTIVES.some((item) => item.value === selected?.value)
      ? selected.value
      : DEFAULT_OBJECTIVE;
  }

  function installStyles() {
    if (document.querySelector('#research-objective-styles')) return;
    const style = document.createElement('style');
    style.id = 'research-objective-styles';
    style.textContent = `
      .research-objective-picker {
        margin: 0 0 14px;
        padding: 16px;
        border: 1px solid #b8dde7;
        border-radius: 8px;
        background: #f8fbfc;
      }
      .research-objective-picker fieldset {
        margin: 0;
        padding: 0;
        border: 0;
      }
      .research-objective-picker legend {
        margin: 0 0 6px;
        padding: 0;
        color: #102335;
        font-size: 1rem;
        font-weight: 800;
      }
      .research-objective-intro {
        margin: 0;
        color: #66717c;
        font-size: .86rem;
        line-height: 1.45;
      }
      .research-objective-options {
        display: grid;
        grid-template-columns: 1fr;
        gap: 8px;
        margin: 12px 0 10px;
      }
      .research-objective-option {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 10px;
        align-items: start;
        padding: 11px 12px;
        border: 1px solid #d8e4ea;
        border-radius: 7px;
        background: #fff;
        cursor: pointer;
      }
      .research-objective-option:has(input:checked) {
        border-color: #075a8f;
        background: #eaf7fa;
        box-shadow: inset 0 0 0 1px #075a8f;
      }
      .research-objective-option input {
        margin: 3px 0 0;
        accent-color: #075a8f;
      }
      .research-objective-option strong {
        display: block;
        color: #102335;
        font-size: .92rem;
      }
      .research-objective-option span {
        display: block;
        margin-top: 3px;
        color: #66717c;
        font-size: .81rem;
        line-height: 1.4;
      }
      @media (min-width: 760px) {
        .research-objective-options {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
    `;
    document.head.append(style);
  }

  function createPicker() {
    const wrapper = document.createElement('section');
    wrapper.id = 'research-objective-picker';
    wrapper.className = 'research-objective-picker';
    wrapper.setAttribute('aria-labelledby', 'research-objective-title');

    const fieldset = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.id = 'research-objective-title';
    legend.textContent = '¿Qué quieres priorizar en este estudio?';
    fieldset.append(legend);

    const options = document.createElement('div');
    options.className = 'research-objective-options';

    for (const objective of OBJECTIVES) {
      const label = document.createElement('label');
      label.className = 'research-objective-option';

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'researchObjective';
      input.value = objective.value;
      input.checked = objective.value === DEFAULT_OBJECTIVE;

      const copy = document.createElement('span');
      const title = document.createElement('strong');
      title.textContent = objective.title;
      const description = document.createElement('span');
      description.textContent = objective.description;
      copy.append(title, description);
      label.append(input, copy);
      options.append(label);
    }

    fieldset.append(options);

    wrapper.append(fieldset);
    return wrapper;
  }

  function ensurePicker() {
    const sectionsRoot = document.querySelector('#form-sections');
    if (!sectionsRoot || document.querySelector('#research-objective-picker')) return;
    installStyles();
    sectionsRoot.prepend(createPicker());
  }

  function patchLeadPayload(payload) {
    if (!payload || payload.source !== 'induradar_landing' || !payload.request) return payload;

    const researchObjective = selectedObjective();
    payload.research_objective = researchObjective;
    payload.request.research_objective = researchObjective;
    payload.request_extensions = {
      ...(payload.request_extensions ?? {}),
      research_objective: researchObjective,
      research_objective_version: '1.0.0',
    };
    payload.intake_metadata = {
      ...(payload.intake_metadata ?? {}),
      research_objective: researchObjective,
    };
    return payload;
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (!init || typeof init.body !== 'string') return originalFetch(input, init);

    try {
      const payload = JSON.parse(init.body);
      const patched = patchLeadPayload(payload);
      if (patched !== payload || patched?.request?.research_objective) {
        return originalFetch(input, { ...init, body: JSON.stringify(patched) });
      }
    } catch {
      // Non-JSON requests are outside the lead form and pass through unchanged.
    }
    return originalFetch(input, init);
  };

  document.addEventListener('DOMContentLoaded', () => {
    ensurePicker();
    const sectionsRoot = document.querySelector('#form-sections');
    if (!sectionsRoot) return;
    const observer = new MutationObserver(ensurePicker);
    observer.observe(sectionsRoot, { childList: true });
  });
})();
