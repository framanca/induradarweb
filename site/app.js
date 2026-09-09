import { calculateCreditsQuote } from './credits.js';

const form = document.querySelector('#lead-form');
const sectionsRoot = document.querySelector('#form-sections');
const submitButton = document.querySelector('#submit-button');
const statusBox = document.querySelector('#form-status');
const progressValue = document.querySelector('#progress-value');
const stepLabel = document.querySelector('#step-label');
const creditsTotal = document.querySelector('#credits-total');
const creditsBreakdown = document.querySelector('#credits-breakdown');
const contactForm = document.querySelector('#contact-form');
const contactStatus = document.querySelector('#contact-status');

const FORM_VERSION = '3.13.1';
const CONTRACT_VERSION = '1.3.2';
const EXECUTION_CONTRACT_VERSION = '1.12.3';
const SPAIN = 'España';
const PORTUGAL = 'Portugal';
const SPAIN_ALL = 'Toda España';
const SPAIN_BY_PROVINCE = 'Seleccionar provincias';
const OTHER_OFFER = 'Otra';
const OTHER_PROBLEM = 'Otro';
const OTHER_SECTOR = 'Otros';
const OTHER_COMPANY_TYPE = 'Otro';
const OTHER_VALUE = 'Otro';
const OTHER_NEED = 'Otra';

let creditsCatalog = null;
let submissionSucceeded = false;

const options = {
  offerCategories: [
    'Maquinaria y equipos industriales',
    'Componentes, repuestos y suministros',
    'Productos químicos, materiales y consumibles',
    'Packaging, envases y embalajes',
    'Tecnología, automatización y software',
    'Energía, utilities y sostenibilidad',
    'Ingeniería, mantenimiento y servicios industriales',
    'Logística, intralogística e instalaciones',
    'Calidad, laboratorio, certificación y seguridad',
    'Servicios profesionales / consultoría',
    OTHER_OFFER,
  ],
  problems: [
    'Reducir costes',
    'Aumentar productividad o capacidad',
    'Mejorar calidad',
    'Reducir consumos de energía, agua o materias primas',
    'Resolver problemas técnicos o de proceso',
    'Cumplir normativa o requisitos de clientes',
    'Mejorar seguridad o fiabilidad',
    'Reducir mermas, residuos o emisiones',
    'Sustituir productos, materiales o proveedores',
    'Mejorar trazabilidad, control o digitalización',
    'Mejorar prestaciones, acabado o vida útil',
    OTHER_PROBLEM,
  ],
  sectors: [
    'Alimentación y bebidas',
    'Química y petroquímica',
    'Farmacéutica, biotecnología y cosmética',
    'Cerámica, vidrio y materiales de construcción',
    'Automoción y movilidad',
    'Metal, mecanizado y transformación metálica',
    'Maquinaria y bienes de equipo',
    'Plástico, caucho y materiales compuestos',
    'Papel, cartón, impresión y packaging',
    'Textil, calzado y cuero',
    'Madera y mueble',
    'Electrónica y material eléctrico',
    'Energía y utilities',
    'Agua, medioambiente y residuos',
    'Logística, almacenamiento y distribución',
    'Minería, cemento y minerales',
    'Aeroespacial, ferroviario y naval',
    'Construcción e infraestructuras',
    OTHER_SECTOR,
  ],
  companyTypes: [
    'Fabricante industrial o planta productiva',
    'Fabricante de maquinaria / OEM',
    'Ingeniería, integrador o EPC',
    'Fabricante de componentes',
    'Proveedor tecnológico',
    'Distribuidor o suministrador industrial',
    'Mantenimiento o servicios industriales',
    'Operador logístico',
    'Constructora / infraestructuras',
    'Consultora',
    'Inversor, fondo o grupo empresarial',
    'Administración u organismo público',
    'Centro tecnológico o de investigación',
    OTHER_COMPANY_TYPE,
  ],
  provinces: [
    'A Coruña', 'Álava', 'Albacete', 'Alicante', 'Almería', 'Asturias', 'Ávila',
    'Badajoz', 'Barcelona', 'Bizkaia', 'Burgos', 'Cáceres', 'Cádiz', 'Cantabria',
    'Castellón', 'Ciudad Real', 'Córdoba', 'Cuenca', 'Girona', 'Granada',
    'Guadalajara', 'Gipuzkoa', 'Huelva', 'Huesca', 'Illes Balears', 'Jaén',
    'La Rioja', 'Las Palmas', 'León', 'Lleida', 'Lugo', 'Madrid', 'Málaga',
    'Murcia', 'Navarra', 'Ourense', 'Palencia', 'Pontevedra', 'Salamanca',
    'Santa Cruz de Tenerife', 'Segovia', 'Sevilla', 'Soria', 'Tarragona',
    'Teruel', 'Toledo', 'Valencia', 'Valladolid', 'Zamora', 'Zaragoza',
  ],
  investmentSignals: [
    'Nueva fábrica, planta, nave o centro',
    'Ampliación de instalaciones',
    'Nueva línea de producción',
    'Aumento de capacidad',
    'Compra o renovación de maquinaria/equipos',
    'Modernización de instalaciones',
    'Nueva instalación logística o almacén',
    'Inversión industrial anunciada',
    'Financiación obtenida para inversión',
    'Permiso, licencia o evaluación ambiental',
  ],
  innovationSignals: [
    'Nuevo producto o gama',
    'Nuevo diseño, formato o aplicación',
    'Nuevo proceso productivo',
    'Patente o desarrollo tecnológico relevante',
    'Proyecto I+D+i',
    'Proyecto piloto o demostrador',
    'Presentación o lanzamiento en feria',
    'Contratación de perfiles de I+D / ingeniería',
  ],
  growthSignals: [
    'Nuevo directivo o responsable',
    'Crecimiento significativo de plantilla',
    'Nueva filial, sede o presencia territorial',
    'Expansión geográfica / internacional',
    'Fusión',
    'Adquisición',
    'Cambio de propiedad',
    'Nueva alianza o acuerdo estratégico',
    'Nuevo contrato o cliente relevante',
  ],
  publicFinanceSignals: [
    'Subvención o ayuda concedida',
    'Licitación o concurso',
    'Adjudicación',
    'Contrato público',
    'Incentivo fiscal o financiación pública relevante',
  ],
  needs: [
    'Maquinaria y automatización', 'Energía y descarbonización',
    'Instalaciones industriales', 'Construcción e infraestructuras',
    'Logística e intralogística', 'Mantenimiento industrial',
    'Digitalización e Industria 4.0', 'Calidad, inspección y laboratorio',
    'Medioambiente y residuos', 'Seguridad industrial',
    'Packaging y final de línea', 'Componentes y suministros',
    'Ingeniería e integración', 'Servicios ligados a inversión industrial',
    'Inmobiliario industrial', 'Telecomunicaciones e IT industrial',
    'Movilidad industrial y flotas', 'Recursos humanos industriales',
    'Limpieza, higiene y servicios auxiliares', 'Materias primas y consumibles',
    OTHER_NEED,
  ],
  serviceTypes: [
    'Estudio puntual', 'Revisión semanal', 'Revisión mensual',
    'Vigilancia continua de cuentas concretas', 'Vigilancia de un sector',
    'Vigilancia de una zona geográfica', 'Monitorización de proyectos concretos',
    'Alertas prioritarias ante cambios relevantes',
  ],
};

const sectorCodes = {
  'Alimentación y bebidas': 'food_beverage',
  'Química y petroquímica': 'chemicals_petrochemicals',
  'Farmacéutica, biotecnología y cosmética': 'pharma_biotech_cosmetics',
  'Cerámica, vidrio y materiales de construcción': 'ceramics_glass_building_materials',
  'Automoción y movilidad': 'automotive_mobility',
  'Metal, mecanizado y transformación metálica': 'metal_machining',
  'Maquinaria y bienes de equipo': 'machinery_capital_goods',
  'Plástico, caucho y materiales compuestos': 'plastics_rubber_composites',
  'Papel, cartón, impresión y packaging': 'paper_cardboard_printing_packaging',
  'Textil, calzado y cuero': 'textile_footwear_leather',
  'Madera y mueble': 'wood_furniture',
  'Electrónica y material eléctrico': 'electronics_electrical_equipment',
  'Energía y utilities': 'energy_utilities',
  'Agua, medioambiente y residuos': 'water_environment_waste',
  'Logística, almacenamiento y distribución': 'logistics_warehousing_distribution',
  'Minería, cemento y minerales': 'mining_cement_minerals',
  'Aeroespacial, ferroviario y naval': 'aerospace_rail_naval',
  'Construcción e infraestructuras': 'construction_infrastructure',
};

const companyTypeCodes = {
  'Fabricante industrial o planta productiva': 'industrial_manufacturer',
  'Fabricante de maquinaria / OEM': 'machine_builder_oem',
  'Ingeniería, integrador o EPC': 'engineering_integrator_epc',
  'Fabricante de componentes': 'component_manufacturer',
  'Proveedor tecnológico': 'technology_provider',
  'Distribuidor o suministrador industrial': 'industrial_distributor',
  'Mantenimiento o servicios industriales': 'industrial_services_maintenance',
  'Operador logístico': 'logistics_operator',
  'Constructora / infraestructuras': 'construction_infrastructure_company',
  'Consultora': 'consultant',
  'Inversor, fondo o grupo empresarial': 'investor_corporate_group',
  'Administración u organismo público': 'public_administration',
  'Centro tecnológico o de investigación': 'technology_research_center',
};

const signalCodes = {
  'Nueva fábrica, planta, nave o centro': 'new_factory',
  'Ampliación de instalaciones': 'facility_expansion',
  'Nueva línea de producción': 'new_production_line',
  'Aumento de capacidad': 'capacity_increase',
  'Compra o renovación de maquinaria/equipos': 'machinery_purchase_renewal',
  'Modernización de instalaciones': 'maintenance_modernization',
  'Nueva instalación logística o almacén': 'industrial_real_estate_move',
  'Nuevo producto o gama': 'product_machine_redesign',
  'Nuevo diseño, formato o aplicación': 'product_machine_redesign',
  'Presentación o lanzamiento en feria': 'fair_product_launch',
  'Contratación de perfiles de I+D / ingeniería': 'key_hiring',
  'Nuevo directivo o responsable': 'new_executive',
  'Crecimiento significativo de plantilla': 'key_hiring',
  'Expansión geográfica / internacional': 'international_expansion',
  'Fusión': 'merger_acquisition_ownership_change',
  'Adquisición': 'merger_acquisition_ownership_change',
  'Cambio de propiedad': 'merger_acquisition_ownership_change',
  'Nueva alianza o acuerdo estratégico': 'strategic_partnership',
  'Subvención o ayuda concedida': 'grant_public_aid',
  'Licitación o concurso': 'tender_procurement',
  'Adjudicación': 'tender_procurement',
  'Contrato público': 'tender_procurement',
  'Incentivo fiscal o financiación pública relevante': 'grant_public_aid',
};

const needCodes = {
  'Maquinaria y automatización': 'machinery_automation',
  'Energía y descarbonización': 'energy_decarbonization',
  'Instalaciones industriales': 'industrial_facilities',
  'Construcción e infraestructuras': 'construction_infrastructure',
  'Logística e intralogística': 'logistics_intralogistics',
  'Mantenimiento industrial': 'industrial_maintenance',
  'Digitalización e Industria 4.0': 'digitalization_industry_4',
  'Calidad, inspección y laboratorio': 'quality_inspection_laboratory',
  'Medioambiente y residuos': 'environment_waste',
  'Seguridad industrial': 'industrial_safety',
  'Packaging y final de línea': 'packaging_end_of_line',
  'Componentes y suministros': 'components_supplies',
  'Ingeniería e integración': 'engineering_integration',
  'Servicios ligados a inversión industrial': 'industrial_investment_services',
  'Inmobiliario industrial': 'industrial_real_estate',
  'Telecomunicaciones e IT industrial': 'industrial_it_telecom',
  'Movilidad industrial y flotas': 'industrial_mobility_fleets',
  'Recursos humanos industriales': 'industrial_human_resources',
  'Limpieza, higiene y servicios auxiliares': 'cleaning_hygiene_auxiliary',
  'Materias primas y consumibles': 'raw_materials_consumables',
};

const technologyCodes = {
  'Automatización y control': 'automation_control',
  'Automatización industrial': 'automation_control',
  'PLC, HMI y SCADA': 'plc_hmi_scada',
  'Robótica y cobots': 'robotics_cobots',
  'Robótica': 'robotics_cobots',
  'Motion, servos y variadores': 'motion_servos_drives',
  'Visión e inspección': 'machine_vision_inspection',
  'Visión artificial': 'machine_vision_inspection',
  'Seguridad de máquinas y procesos': 'machine_process_safety',
  'Sensórica e instrumentación': 'sensors_instrumentation',
  'Identificación y trazabilidad': 'identification_traceability',
  'IIoT, conectividad y Edge': 'iiot_connectivity_edge',
  'Datos, IA y analítica': 'industrial_data_ai_analytics',
  'Mantenimiento predictivo': 'predictive_maintenance',
  'Gestión energética': 'energy_management',
  'Electrificación y descarbonización': 'electrification_decarbonization',
  'Hidrógeno y nuevas energías': 'hydrogen_new_energy',
  'Intralogística, AGV y AMR': 'agv_amr_intralogistics',
  'Almacenamiento automático': 'automated_storage',
  'Ciberseguridad industrial': 'industrial_cybersecurity',
  'Control de procesos, temperatura y combustión': 'process_temperature_combustion',
  'Neumática, hidráulica y mecánica': 'pneumatics_hydraulics_mechanics',
  'Componentes eléctricos/electrónicos': 'electrical_electronic_components',
  'Software industrial': 'industrial_software',
  'Ingeniería e integración': 'engineering_integration',
};

const provinceRegions = {
  'A Coruña': 'Galicia', 'Álava': 'País Vasco', 'Albacete': 'Castilla-La Mancha',
  Alicante: 'Comunitat Valenciana', 'Almería': 'Andalucía', Asturias: 'Asturias',
  'Ávila': 'Castilla y León', Badajoz: 'Extremadura', Barcelona: 'Cataluña',
  Bizkaia: 'País Vasco', Burgos: 'Castilla y León', Cáceres: 'Extremadura',
  Cádiz: 'Andalucía', Cantabria: 'Cantabria', Castellón: 'Comunitat Valenciana',
  'Ciudad Real': 'Castilla-La Mancha', Córdoba: 'Andalucía', Cuenca: 'Castilla-La Mancha',
  Girona: 'Cataluña', Granada: 'Andalucía', Guadalajara: 'Castilla-La Mancha',
  Gipuzkoa: 'País Vasco', Huelva: 'Andalucía', Huesca: 'Aragón',
  'Illes Balears': 'Illes Balears', Jaén: 'Andalucía', 'La Rioja': 'La Rioja',
  'Las Palmas': 'Canarias', León: 'Castilla y León', Lleida: 'Cataluña', Lugo: 'Galicia',
  Madrid: 'Comunidad de Madrid', Málaga: 'Andalucía', Murcia: 'Región de Murcia',
  Navarra: 'Navarra', Ourense: 'Galicia', Palencia: 'Castilla y León',
  Pontevedra: 'Galicia', Salamanca: 'Castilla y León', 'Santa Cruz de Tenerife': 'Canarias',
  Segovia: 'Castilla y León', Sevilla: 'Andalucía', Soria: 'Castilla y León',
  Tarragona: 'Cataluña', Teruel: 'Aragón', Toledo: 'Castilla-La Mancha',
  Valencia: 'Comunitat Valenciana', Valladolid: 'Castilla y León', Zamora: 'Castilla y León',
  Zaragoza: 'Aragón',
};

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);
}

function textField(name, label, { type = 'text', required = false, hint = '', rows = 0 } = {}) {
  const id = `field-${name}`;
  const requiredMarker = required ? ' *' : '';
  const input = rows
    ? `<textarea id="${id}" name="${name}" rows="${rows}"${required ? ' aria-required="true"' : ''} placeholder="${escapeHtml(hint)}"></textarea>`
    : `<input id="${id}" name="${name}" type="${type}"${required ? ' aria-required="true"' : ''} placeholder="${escapeHtml(hint)}">`;
  return `<div class="field"><label for="${id}">${escapeHtml(label)}${requiredMarker}</label>${hint && !rows ? `<span class="helper">${escapeHtml(hint)}</span>` : ''}${input}<p class="field-error" data-error-for="${name}" hidden></p></div>`;
}

function checkboxGroup(name, label, values, { help = '', selected = [], selectAll = false, excludeFromSelectAll = '' } = {}) {
  const allControl = selectAll
    ? `<div class="selector-actions"><button class="text-action" type="button" data-select-all="${name}"${excludeFromSelectAll ? ` data-exclude-value="${escapeHtml(excludeFromSelectAll)}"` : ''}>Seleccionar todos</button></div>`
    : '';
  const selection = new Set(selected);
  return `<fieldset class="option-group" data-group="${name}"><legend>${escapeHtml(label)}</legend>${help ? `<span class="helper">${escapeHtml(help)}</span>` : ''}${allControl}<div class="option-list">${values.map((value, index) => `<label class="option" for="${name}-${index}"><input id="${name}-${index}" name="${name}" type="checkbox" value="${escapeHtml(value)}"${selection.has(value) ? ' checked' : ''}><span>${escapeHtml(value)}</span></label>`).join('')}</div><p class="field-error" data-error-for="${name}" hidden></p></fieldset>`;
}

function radioGroup(name, label, values, { help = '' } = {}) {
  return `<fieldset class="option-group" data-group="${name}"><legend>${escapeHtml(label)}</legend>${help ? `<span class="helper">${escapeHtml(help)}</span>` : ''}<div class="option-list">${values.map((value, index) => `<label class="option" for="${name}-${index}"><input id="${name}-${index}" name="${name}" type="radio" value="${escapeHtml(value)}"><span>${escapeHtml(value)}</span></label>`).join('')}</div><p class="field-error" data-error-for="${name}" hidden></p></fieldset>`;
}

function section(id, title, body) {
  return `<details class="form-section" id="section-${id}"><summary><span>${title}<small class="section-state" data-section-state="${id}">Faltan datos obligatorios</small></span></summary><div class="section-body">${body}</div></details>`;
}

function optionalFields(title, description, body) {
  return `<details class="optional-fields"><summary>${escapeHtml(title)}</summary><p class="helper">${escapeHtml(description)}</p>${body}</details>`;
}

function renderForm() {
  const signals = [...options.investmentSignals, ...options.innovationSignals, ...options.growthSignals, ...options.publicFinanceSignals];
  sectionsRoot.innerHTML = [
    section('offer', '1. ¿Qué vendes?', [
      textField('offerDescription', '¿Qué ofrece tu empresa?', { required: true, rows: 4, hint: 'Productos o servicios que quieres vender o promocionar.' }),
      textField('fullName', 'Nombre y apellidos', { required: true }),
      textField('company', 'Empresa', { required: true, type: 'text', hint: 'Nombre de la empresa.' }),
      textField('email', 'Email profesional', { required: true, type: 'email' }),
      textField('jobTitle', 'Cargo / función (opcional)'),
      textField('phone', 'Teléfono (opcional)', { type: 'tel' }),
      textField('website', 'Web de la empresa (opcional)', { type: 'url' }),
      textField('address', 'Dirección (opcional)', { hint: 'Ciudad, provincia o dirección profesional.' }),
      `<div class="offer-refinement"><div class="offer-refinement__heading"><h3>Afinar tu oferta</h3><p>Categorías, problemas que resuelves y soluciones prioritarias.</p></div>${[
        checkboxGroup('offerCategories', 'Categoría principal de tu oferta *', options.offerCategories),
        `<div id="other-offer-category" class="conditional" hidden>${textField('otherOfferCategory', 'Otra categoría', { required: true, hint: 'Puedes separar varios valores con comas.' })}</div>`,
        checkboxGroup('problemsSolved', '¿Qué problemas ayudas a resolver?', options.problems),
        `<div id="other-problem" class="conditional" hidden>${textField('otherProblem', 'Otro problema', { required: true, hint: 'Puedes separar varios valores con comas.' })}</div>`,
        textField('prioritySolutions', 'Productos, soluciones o servicios que quieres priorizar (opcional)', { rows: 3, hint: 'Familias, especialidades, marcas, tecnologías, aplicaciones o servicios.' }),
      ].join('')}</div>`,
    ].join('')),
    section('target', '2. ¿Qué empresas buscas?', [
      checkboxGroup('targetSectors', 'Sectores objetivo *', options.sectors),
      `<div id="other-sector" class="conditional" hidden>${textField('otherSector', 'Otros sectores', { required: true, hint: 'Puedes separar varios valores con comas.' })}</div>`,
      checkboxGroup('targetCompanyTypes', 'Tipo de empresa objetivo *', options.companyTypes),
      `<div id="other-company-type" class="conditional" hidden>${textField('otherTargetCompanyType', 'Otro tipo de empresa objetivo', { required: true, hint: 'Puedes separar varios valores con comas.' })}</div>`,
      checkboxGroup('geographyCountries', 'Países *', [PORTUGAL, SPAIN], { help: 'Puedes seleccionar España, Portugal o ambos.' }),
      `<div id="spain-coverage" class="conditional" hidden>${radioGroup('spainCoverage', 'Cobertura en España *', [SPAIN_ALL, SPAIN_BY_PROVINCE])}</div>`,
      `<div id="spain-provinces" class="conditional" hidden>${checkboxGroup('geographyProvinces', 'Provincias *', options.provinces, { selectAll: true })}</div>`,
      optionalFields('Criterios avanzados', 'Tamaño, valor mínimo y características de la empresa ideal.', [
        radioGroup('targetRevenueRange', 'Facturación anual aproximada', ['Indiferente', '< 2 M€', '2-10 M€', '10-50 M€', '50-250 M€', '> 250 M€']),
        radioGroup('targetEmployeeRange', 'Empleo / tamaño de la operación industrial', ['Indiferente', '< 20 empleados', '20-100 empleados', '101-500 empleados', '> 500 empleados']),
        radioGroup('minimumOpportunityValue', '¿A partir de qué valor aproximado merece la pena investigar una oportunidad?', ['Cualquier importe', '> 5.000 €', '> 10.000 €', '> 25.000 €', '> 50.000 €', '> 100.000 €', OTHER_VALUE], { help: 'Sirve para priorizar; no implica que conozcamos el importe real del proyecto.' }),
        `<div id="other-minimum-value" class="conditional" hidden>${textField('otherMinimumValue', 'Otro valor aproximado', { required: true })}</div>`,
        textField('targetCompanyDescription', 'Define tu empresa objetivo ideal (opcional)', { rows: 4, hint: 'Producción propia, decisión local, varias plantas, exportación, tecnologías concretas, certificaciones o tamaño mínimo.' }),
      ].join('')),
    ].join('')),
    section('signals', '3. ¿Qué cambios quieres detectar?', [
      `<div class="selector-actions"><button class="text-action" type="button" data-select-all-groups="investmentSignals,innovationSignals,growthSignals,publicFinanceSignals">Seleccionar todos los cambios</button></div>`,
      checkboxGroup('investmentSignals', 'A. Inversión y capacidad', options.investmentSignals, { selected: options.investmentSignals, selectAll: true }),
      checkboxGroup('innovationSignals', 'B. Innovación y producto', options.innovationSignals, { selected: options.innovationSignals, selectAll: true }),
      checkboxGroup('growthSignals', 'C. Organización y crecimiento', options.growthSignals, { selected: options.growthSignals, selectAll: true }),
      checkboxGroup('publicFinanceSignals', 'D. Compra pública y apoyo financiero', options.publicFinanceSignals, { selected: options.publicFinanceSignals, selectAll: true }),
    ].join('')),
    section('needs', '4. ¿Qué necesidades quieres detectar?', [
      checkboxGroup('commercialNeeds', '¿En qué áreas de oportunidad quieres clasificar los resultados?', options.needs, { help: 'La sección 2 define en qué empresas buscar; aquí defines qué necesidades podrían encajar con tu oferta. Todas están incluidas en la tarifa.', selected: options.needs.filter((option) => option !== OTHER_NEED), selectAll: true, excludeFromSelectAll: OTHER_NEED }),
      `<div id="other-need" class="conditional" hidden>${textField('otherNeed', 'Otra área de oportunidad', { required: true, hint: 'Puedes separar varios valores con comas.' })}</div>`,
      textField('opportunityTriggerDescription', 'Describe una oportunidad comercial que justificaría una acción de tu equipo de ventas', { required: true, rows: 5, hint: 'Qué tendría que ocurrir para que merezca una llamada, visita, reunión o investigación adicional.' }),
      optionalFields('Referencias y exclusiones', 'Casos, clientes, cuentas y límites que nos ayudan a afinar el encaje.', [
        textField('recentCaseDescription', 'Ayúdanos con un caso real o reciente (opcional)', { rows: 4, hint: 'Qué estaba ocurriendo en ese cliente antes de que surgiera la oportunidad.' }),
        `<div class="inline-fields">${textField('currentClients', 'Clientes actuales para buscar perfiles similares (opcional)', { rows: 4, hint: 'Hasta 5, una empresa por línea.' })}${textField('idealClients', 'Clientes ideales: clientes de la competencia a seguir (opcional)', { rows: 4, hint: 'Hasta 5, una empresa por línea.' })}</div>`,
        `<div class="inline-fields">${textField('watchlistAccounts', 'Cuentas estratégicas para búsqueda especializada (opcional)', { rows: 4, hint: 'Hasta 5, una empresa por línea.' })}${textField('competitors', 'Competidores (opcional)', { rows: 4, hint: 'Indica si quieres excluirlos o monitorizarlos.' })}</div>`,
        textField('excludedCompanies', 'Empresas excluidas (opcional)', { rows: 3, hint: 'Clientes protegidos, cuentas ya trabajadas o empresas excluidas.' }),
        textField('noBuyReason', '¿Por qué una empresa aparentemente ideal no os compraría? (opcional)', { rows: 4, hint: 'Decisión centralizada, consumo insuficiente, tecnología incompatible o ticket demasiado pequeño.' }),
      ].join('')),
    ].join('')),
    section('service', '5. ¿Cómo quieres recibir los resultados?', [
      checkboxGroup('serviceTypes', 'Selecciona el tipo de servicio que mejor encaja con tu necesidad', options.serviceTypes),
      `<p class="helper">Las revisiones requieren un estudio puntual previo activo del mismo alcance. Si amplías sectores o provincias, primero se presupuesta la ampliación puntual.</p>`,
      textField('serviceComments', 'Comentarios sobre cuentas concretas, frecuencia, fechas o alcance (opcional)', { rows: 3 }),
      `<label class="privacy-option"><input name="privacyAccepted" type="checkbox"><span>He leído y acepto la <a href="privacidad/" target="_blank" rel="noopener">Política de privacidad</a>. *</span></label><p class="field-error" data-error-for="privacyAccepted" hidden></p>`,
      `<label class="privacy-option"><input name="marketingConsent" type="checkbox"><span>Quiero recibir novedades y comunicaciones de InduRadar.</span></label>`,
    ].join('')),
  ].join('');

  connectInteractions();
  updateDerivedState();
}

function inputsByName(name) {
  return [...form.querySelectorAll(`input[name="${name}"]`)];
}

function selectedValues(name) {
  return inputsByName(name).filter((input) => input.checked).map((input) => input.value);
}

function fieldValue(name) {
  return form.elements.namedItem(name)?.value.trim() ?? '';
}

function updateConditionalFields() {
  toggleHidden('#other-offer-category', selectedValues('offerCategories').includes(OTHER_OFFER));
  toggleHidden('#other-problem', selectedValues('problemsSolved').includes(OTHER_PROBLEM));
  toggleHidden('#other-sector', selectedValues('targetSectors').includes(OTHER_SECTOR));
  toggleHidden('#other-company-type', selectedValues('targetCompanyTypes').includes(OTHER_COMPANY_TYPE));
  toggleHidden('#other-minimum-value', selectedValues('minimumOpportunityValue').includes(OTHER_VALUE));
  toggleHidden('#other-need', selectedValues('commercialNeeds').includes(OTHER_NEED));

  const hasSpain = selectedValues('geographyCountries').includes(SPAIN);
  toggleHidden('#spain-coverage', hasSpain);
  if (hasSpain && !selectedValues('spainCoverage').length) {
    inputsByName('spainCoverage').find((input) => input.value === SPAIN_ALL).checked = true;
  }
  if (!hasSpain) {
    inputsByName('spainCoverage').forEach((input) => { input.checked = false; });
    inputsByName('geographyProvinces').forEach((input) => { input.checked = false; });
  }
  const provinceScope = hasSpain && selectedValues('spainCoverage').includes(SPAIN_BY_PROVINCE);
  toggleHidden('#spain-provinces', provinceScope);
  if (!provinceScope) {
    inputsByName('geographyProvinces').forEach((input) => { input.checked = false; });
  }
}

function toggleHidden(selector, visible) {
  document.querySelector(selector).hidden = !visible;
}

function connectInteractions() {
  form.addEventListener('input', (event) => {
    clearErrorForInput(event.target);
    updateDerivedState();
  });
  form.addEventListener('change', (event) => {
    clearErrorForInput(event.target);
    updateDerivedState();
  });
  sectionsRoot.querySelectorAll('.form-section').forEach((details) => {
    details.addEventListener('toggle', () => {
      if (!details.open) return;
      sectionsRoot.querySelectorAll('.form-section[open]').forEach((openDetails) => {
        if (openDetails !== details) openDetails.open = false;
      });
    });
  });
  sectionsRoot.querySelectorAll('[data-select-all]').forEach((button) => {
    button.addEventListener('click', () => {
      const name = button.dataset.selectAll;
      const fields = inputsByName(name).filter((field) => field.value !== (button.dataset.excludeValue ?? ''));
      const selectAll = fields.some((field) => !field.checked);
      fields.forEach((field) => { field.checked = selectAll; });
      updateDerivedState();
    });
  });
  sectionsRoot.querySelectorAll('[data-select-all-groups]').forEach((button) => {
    button.addEventListener('click', () => {
      const fields = button.dataset.selectAllGroups.split(',').flatMap(inputsByName);
      const selectAll = fields.some((field) => !field.checked);
      fields.forEach((field) => { field.checked = selectAll; });
      updateDerivedState();
    });
  });
}

function updateDerivedState() {
  updateConditionalFields();
  updateSelectAllButtons();
  updateCredits();
  updateProgress();
}

function updateSelectAllButtons() {
  sectionsRoot.querySelectorAll('[data-select-all]').forEach((button) => {
    const fields = inputsByName(button.dataset.selectAll)
      .filter((field) => field.value !== (button.dataset.excludeValue ?? ''));
    button.textContent = fields.every((field) => field.checked) ? 'Quitar todos' : 'Seleccionar todos';
  });
  sectionsRoot.querySelectorAll('[data-select-all-groups]').forEach((button) => {
    const fields = button.dataset.selectAllGroups.split(',').flatMap(inputsByName);
    button.textContent = fields.every((field) => field.checked) ? 'Quitar todos los cambios' : 'Seleccionar todos los cambios';
  });
}

function updateCredits() {
  if (!creditsCatalog) return;
  const quote = creditsQuote();
  creditsTotal.textContent = `${quote.total_credits} créditos`;
  const details = [`${quote.breakdown.base_credits} base`];
  if (quote.breakdown.province_credits) details.push(`+${quote.breakdown.province_credits} provincias`);
  if (quote.breakdown.sector_credits) details.push(`+${quote.breakdown.sector_credits} sectores`);
  if (quote.breakdown.signal_credits) details.push(`+${quote.breakdown.signal_credits} señales`);
  creditsBreakdown.textContent = details.join(' · ');
}

function creditsQuote() {
  const sectorCount = valuesWithOther('targetSectors', OTHER_SECTOR, 'otherSector').length;
  const countries = selectedValues('geographyCountries');
  let provinceCount = 0;
  if (countries.includes(SPAIN)) provinceCount += selectedValues('spainCoverage').includes(SPAIN_ALL)
    ? creditsCatalog.country_scopes.spain_all_provinces : selectedValues('geographyProvinces').length;
  if (countries.includes(PORTUGAL)) provinceCount += creditsCatalog.country_scopes.portugal_province_equivalent;
  const signalCount = ['investmentSignals', 'innovationSignals', 'growthSignals', 'publicFinanceSignals']
    .reduce((total, name) => total + selectedValues(name).length, 0);
  return calculateCreditsQuote(creditsCatalog, { sectorCount, provinceCount, signalCount });
}

function updateProgress() {
  const completeness = [isOfferComplete(), isTargetComplete(), isSignalsComplete(), isNeedsComplete(), isServiceComplete()];
  const states = ['offer', 'target', 'signals', 'needs', 'service'];
  states.forEach((id, index) => {
    const state = document.querySelector(`[data-section-state="${id}"]`);
    const complete = completeness[index];
    state.textContent = complete ? 'Completo' : 'Faltan datos obligatorios';
    state.classList.toggle('complete', complete);
  });
  const completeCount = completeness.filter(Boolean).length;
  progressValue.style.width = `${completeCount * 20}%`;
  stepLabel.textContent = completeCount === 5 ? 'Formulario preparado para enviar' : `${completeCount} de 5 secciones completas`;
}

function isOfferComplete() {
  return Boolean(fieldValue('offerDescription') && fieldValue('fullName') && fieldValue('company') && validEmail(fieldValue('email')) && selectedValues('offerCategories').length && (!selectedValues('offerCategories').includes(OTHER_OFFER) || fieldValue('otherOfferCategory')) && (!selectedValues('problemsSolved').includes(OTHER_PROBLEM) || fieldValue('otherProblem')));
}

function isTargetComplete() {
  const countries = selectedValues('geographyCountries');
  const hasSpain = countries.includes(SPAIN);
  const byProvince = selectedValues('spainCoverage').includes(SPAIN_BY_PROVINCE);
  return Boolean(selectedValues('targetSectors').length && selectedValues('targetCompanyTypes').length && countries.length && (!hasSpain || selectedValues('spainCoverage').length) && (!byProvince || selectedValues('geographyProvinces').length) && (!selectedValues('targetSectors').includes(OTHER_SECTOR) || fieldValue('otherSector')) && (!selectedValues('targetCompanyTypes').includes(OTHER_COMPANY_TYPE) || fieldValue('otherTargetCompanyType')) && (!selectedValues('minimumOpportunityValue').includes(OTHER_VALUE) || fieldValue('otherMinimumValue')));
}

function isSignalsComplete() { return ['investmentSignals', 'innovationSignals', 'growthSignals', 'publicFinanceSignals'].some((name) => selectedValues(name).length); }
function isNeedsComplete() { return Boolean(fieldValue('opportunityTriggerDescription') && (!selectedValues('commercialNeeds').includes(OTHER_NEED) || fieldValue('otherNeed'))); }
function isServiceComplete() { return Boolean(form.elements.privacyAccepted.checked); }
function validEmail(email) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email); }

function clearErrors() {
  form.querySelectorAll('[aria-invalid="true"]').forEach((field) => field.removeAttribute('aria-invalid'));
  form.querySelectorAll('[data-error-for]').forEach((element) => { element.hidden = true; element.textContent = ''; });
  form.querySelectorAll('.has-error').forEach((element) => element.classList.remove('has-error'));
}

function showError(name, message) {
  const field = form.elements.namedItem(name);
  if (field instanceof RadioNodeList) [...field].forEach((input) => input.setAttribute('aria-invalid', 'true'));
  else if (field) field.setAttribute('aria-invalid', 'true');
  const error = form.querySelector(`[data-error-for="${name}"]`);
  if (error) { error.textContent = message; error.hidden = false; }
  const input = field instanceof RadioNodeList ? field[0] : field;
  input?.closest('.field, .option-group, .privacy-option')?.classList.add('has-error');
}

function clearErrorForInput(input) {
  if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) return;
  const { name } = input;
  if (!name) return;
  inputsByName(name).forEach((field) => field.removeAttribute('aria-invalid'));
  const error = form.querySelector(`[data-error-for="${name}"]`);
  if (error) { error.hidden = true; error.textContent = ''; }
  const container = input.closest('.field, .option-group, .privacy-option');
  container?.classList.remove('has-error');
  const section = input.closest('.form-section');
  if (section && !section.querySelector('.field.has-error, .option-group.has-error, .privacy-option.has-error')) section.classList.remove('has-error');
}

function validateForm() {
  clearErrors();
  const invalidSections = new Set();
  const requiredText = [
    ['offerDescription', 'Indica qué ofrece tu empresa.', 'offer'],
    ['fullName', 'Indica tu nombre y apellidos.', 'offer'],
    ['company', 'Indica el nombre de tu empresa.', 'offer'],
    ['opportunityTriggerDescription', 'Describe la oportunidad que te interesa detectar.', 'needs'],
  ];
  requiredText.forEach(([name, message, sectionId]) => {
    if (!fieldValue(name)) { showError(name, message); invalidSections.add(sectionId); }
  });
  if (!validEmail(fieldValue('email'))) { showError('email', 'Indica un email profesional válido.'); invalidSections.add('offer'); }
  if (!selectedValues('offerCategories').length) { showError('offerCategories', 'Selecciona al menos una categoría de oferta.'); invalidSections.add('offer'); }
  if (selectedValues('offerCategories').includes(OTHER_OFFER) && !fieldValue('otherOfferCategory')) { showError('otherOfferCategory', 'Describe la otra categoría.'); invalidSections.add('offer'); }
  if (selectedValues('problemsSolved').includes(OTHER_PROBLEM) && !fieldValue('otherProblem')) { showError('otherProblem', 'Describe el otro problema.'); invalidSections.add('offer'); }
  if (!selectedValues('targetSectors').length) { showError('targetSectors', 'Selecciona al menos un sector objetivo.'); invalidSections.add('target'); }
  if (!selectedValues('targetCompanyTypes').length) { showError('targetCompanyTypes', 'Selecciona al menos un tipo de empresa objetivo.'); invalidSections.add('target'); }
  if (!selectedValues('geographyCountries').length) { showError('geographyCountries', 'Selecciona al menos un país.'); invalidSections.add('target'); }
  if (selectedValues('geographyCountries').includes(SPAIN) && !selectedValues('spainCoverage').length) { showError('spainCoverage', 'Elige la cobertura para España.'); invalidSections.add('target'); }
  if (selectedValues('spainCoverage').includes(SPAIN_BY_PROVINCE) && !selectedValues('geographyProvinces').length) { showError('geographyProvinces', 'Selecciona al menos una provincia.'); invalidSections.add('target'); }
  if (selectedValues('targetSectors').includes(OTHER_SECTOR) && !fieldValue('otherSector')) { showError('otherSector', 'Describe los otros sectores.'); invalidSections.add('target'); }
  if (selectedValues('targetCompanyTypes').includes(OTHER_COMPANY_TYPE) && !fieldValue('otherTargetCompanyType')) { showError('otherTargetCompanyType', 'Describe el otro tipo de empresa.'); invalidSections.add('target'); }
  if (selectedValues('minimumOpportunityValue').includes(OTHER_VALUE) && !fieldValue('otherMinimumValue')) { showError('otherMinimumValue', 'Indica el valor aproximado.'); invalidSections.add('target'); }
  if (selectedValues('commercialNeeds').includes(OTHER_NEED) && !fieldValue('otherNeed')) { showError('otherNeed', 'Describe la otra área de oportunidad.'); invalidSections.add('needs'); }
  if (!form.elements.privacyAccepted.checked) { showError('privacyAccepted', 'Necesitamos tu consentimiento para responderte.'); invalidSections.add('service'); }
  if (invalidSections.size) {
    invalidSections.forEach((sectionId) => document.querySelector(`#section-${sectionId}`)?.classList.add('has-error'));
    const first = invalidSections.values().next().value;
    const details = document.querySelector(`#section-${first}`);
    details.open = true;
    details.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return false;
  }
  return true;
}

function valuesWithOther(name, otherOption, otherField) {
  const values = selectedValues(name);
  if (!values.includes(otherOption)) return values;
  const otherValues = fieldValue(otherField).split(/[\n,;]/).map((value) => value.trim()).filter(Boolean);
  return values.filter((value) => value !== otherOption).concat(otherValues);
}

function canonicalCodes(values, map, fallback = null) {
  return [...new Set(values.map((value) => map[value] ?? fallback).filter(Boolean))];
}

function splitLines(name) {
  return fieldValue(name).split('\n').map((value) => value.trim()).filter(Boolean);
}

function nullIfBlank(value) { return value || null; }

function calculateScope(data) {
  const uniqueCount = (values) => new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean)).size;
  const additionalCount = (values) => Math.max(0, uniqueCount(values) - 1);
  const hasSpain = data.countries.includes(SPAIN);
  const hasPortugal = data.countries.includes(PORTUGAL);
  let geography = 0;
  if (hasSpain && hasPortugal) geography = 85;
  else if (hasPortugal) geography = 40;
  else if (hasSpain && data.spainCoverage === SPAIN_ALL) geography = 60;
  else if (hasSpain && data.spainCoverage === SPAIN_BY_PROVINCE && data.provinces.length > 1) geography = new Set(data.provinces.map((province) => provinceRegions[province] ?? province)).size === 1 ? 15 : 35;
  const raw = 60 + additionalCount(data.sectors) * 10 + additionalCount(data.companyTypes) * 3 + geography + uniqueCount(data.investmentSignals) * 2 + uniqueCount(data.innovationSignals) * 4 + uniqueCount(data.growthSignals) * 3 + uniqueCount(data.publicFinanceSignals) * 3 + uniqueCount(data.needs) * 6 + uniqueCount(data.currentClients) * .5 + uniqueCount(data.idealClients) * .5 + uniqueCount(data.watchlistAccounts) * 2 + uniqueCount(data.competitors) * 1.5 + uniqueCount(data.excludedCompanies) * .2;
  const units = Math.round(raw * 10) / 10;
  const level = units < 100 ? 'Ligero' : units <= 175 ? 'Medio' : units <= 275 ? 'Amplio' : 'Muy amplio';
  return { units, level };
}

function buildPayload() {
  const fullName = fieldValue('fullName');
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] ?? null;
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;
  const targetSectors = valuesWithOther('targetSectors', OTHER_SECTOR, 'otherSector');
  const targetCompanyTypes = valuesWithOther('targetCompanyTypes', OTHER_COMPANY_TYPE, 'otherTargetCompanyType');
  const countries = selectedValues('geographyCountries');
  const spainCoverage = selectedValues('spainCoverage')[0] ?? null;
  const provinces = spainCoverage === SPAIN_BY_PROVINCE ? selectedValues('geographyProvinces') : [];
  const investmentSignals = selectedValues('investmentSignals');
  const innovationSignals = selectedValues('innovationSignals');
  const growthSignals = selectedValues('growthSignals');
  const publicFinanceSignals = selectedValues('publicFinanceSignals');
  const rawSignalTypes = [...investmentSignals, ...innovationSignals, ...growthSignals, ...publicFinanceSignals];
  const commercialNeeds = valuesWithOther('commercialNeeds', OTHER_NEED, 'otherNeed');
  const prioritySolutions = fieldValue('prioritySolutions');
  const rawTechnologies = prioritySolutions.split(/[\n,;]/).map((value) => value.trim()).filter(Boolean);
  const offerCategories = valuesWithOther('offerCategories', OTHER_OFFER, 'otherOfferCategory');
  const problemsSolved = valuesWithOther('problemsSolved', OTHER_PROBLEM, 'otherProblem');
  const currentClients = splitLines('currentClients');
  const idealClients = splitLines('idealClients');
  const watchlistAccounts = splitLines('watchlistAccounts');
  const competitors = splitLines('competitors');
  const excludedCompanies = splitLines('excludedCompanies');
  const company = fieldValue('company');
  const noBuyReason = fieldValue('noBuyReason');
  const targetCompanyDescription = fieldValue('targetCompanyDescription');
  const serviceTypes = selectedValues('serviceTypes');
  const frequency = serviceTypes.includes('Revisión semanal') ? 'weekly' : serviceTypes.some((value) => ['Revisión mensual', 'Vigilancia continua de cuentas concretas', 'Vigilancia de un sector', 'Vigilancia de una zona geográfica', 'Monitorización de proyectos concretos', 'Alertas prioritarias ante cambios relevantes'].includes(value)) ? 'monthly' : 'one_off';
  const geographies = [];
  if (countries.includes(SPAIN)) {
    if (spainCoverage === SPAIN_BY_PROVINCE && provinces.length) provinces.forEach((province) => geographies.push({ scope: 'province', country: SPAIN, region: provinceRegions[province] ?? null, province, city: null, radius_km: null, free_text: null }));
    else geographies.push({ scope: 'country', country: SPAIN, region: null, province: null, city: null, radius_km: null, free_text: null });
  }
  if (countries.includes(PORTUGAL)) geographies.push({ scope: 'country', country: PORTUGAL, region: null, province: null, city: null, radius_km: null, free_text: null });
  const scope = calculateScope({ sectors: targetSectors, companyTypes: targetCompanyTypes, countries, spainCoverage, provinces, investmentSignals, innovationSignals, growthSignals, publicFinanceSignals, needs: commercialNeeds, currentClients, idealClients, watchlistAccounts, competitors, excludedCompanies });
  const quote = creditsQuote();
  const submittedAt = new Date().toISOString();
  const stackConfiguration = {
    config_name: 'InduRadar Q0-STACK and runtime defaults', config_version: '3.13.1', effective_date: '2026-09-02',
    expected_versions: { workflow_version: '3.13.1', contract_version: '1.3.2', execution_contract_version: '1.12.3', heuristics_version: '1.11.3', tool_registry_version: '1.10.3', golden_test_version: '1.12.3', data_dictionary_version: '1.10.3', document_manifest_version: '1.11.3', report_template_version: '1.10.3', example_request_version: '1.3.2', source_catalog_version: '2.6.1' },
    runtime_defaults: { baseline_mode: 'canonical_fresh', canonical_output: 'report_json_lossless', client_default_output: 'light_report', artifact_default: [], artifacts_explicit_only: ['docx', 'xlsx', 'pdf'], docx_render_mode: 'complete_inventory_with_controlled_synthesis', docx_render_manifest_required: true, renderer_may_omit_inventory_items: false, client_completeness_review_allowed: false },
  };
  const requestExtensions = {
    target_revenue_range: selectedValues('targetRevenueRange')[0] ?? null,
    target_employee_range: selectedValues('targetEmployeeRange')[0] ?? null,
    minimum_opportunity_value: selectedValues('minimumOpportunityValue')[0] === OTHER_VALUE ? fieldValue('otherMinimumValue') : selectedValues('minimumOpportunityValue')[0] ?? null,
    target_company_description: targetCompanyDescription, commercial_needs: commercialNeeds,
    recent_case_description: fieldValue('recentCaseDescription'), current_clients: currentClients,
    ideal_clients: idealClients, watchlist_accounts: watchlistAccounts, competitors,
    excluded_companies: excludedCompanies, no_buy_reason: noBuyReason, service_types: serviceTypes,
    service_comments: fieldValue('serviceComments'),
    taxonomy_labels: { sectors: targetSectors, target_company_types: targetCompanyTypes, signal_types: rawSignalTypes, opportunity_areas: commercialNeeds, technologies: rawTechnologies },
    research_scope_units: scope.units, research_scope_level: scope.level,
    research_scope_model_version: 'InduRadar_Calculadora_Alcance_RU_v1', estimated_credits: quote,
  };
  return {
    source: 'induradar_landing', form_version: FORM_VERSION, contract_version: CONTRACT_VERSION,
    execution_contract_version: EXECUTION_CONTRACT_VERSION, stack_configuration: stackConfiguration,
    intake_metadata: { normalization_target: CONTRACT_VERSION, submission_id_owner: 'supabase_edge_function_submit_lead', baseline_mode: 'canonical_fresh', canonical_output: 'report_json_lossless', client_default_output: 'light_report' },
    research_scope_units: scope.units, research_scope_level: scope.level, research_scope_model_version: 'InduRadar_Calculadora_Alcance_RU_v1',
    channel: 'web_form', submitted_at: submittedAt, credits: quote,
    contact: { first_name: firstName, last_name: lastName, company_name: company, job_title: nullIfBlank(fieldValue('jobTitle')), email: fieldValue('email'), phone: nullIfBlank(fieldValue('phone')), country: null, region_city: nullIfBlank(fieldValue('address')), website: nullIfBlank(fieldValue('website')), linkedin: null },
    organization_profile: { company_type: null, employee_range: 'unknown', team_name: null },
    seller_profile: { generic_supplier_label: fieldValue('offerDescription'), offer: fieldValue('offerDescription'), value_proposition: null, problems_solved: problemsSolved, industrial_processes: [], target_buyer_roles: [], technologies: canonicalCodes(rawTechnologies, technologyCodes, rawTechnologies.length ? 'other_technology' : null), minimum_ticket_eur: null, must_have: targetCompanyDescription ? [targetCompanyDescription] : [], exclusions: excludedCompanies, negative_signals: noBuyReason ? [noBuyReason] : [], competitors_or_installed_base: competitors, offer_categories: offerCategories, priority_solutions: prioritySolutions, technologies_free_text: rawTechnologies },
    request: { title: `Solicitud de radar comercial - ${company}`, sectors: canonicalCodes(targetSectors, sectorCodes, 'other_sector'), target_company_types: canonicalCodes(targetCompanyTypes, companyTypeCodes, 'other_company_type'), opportunity_areas: canonicalCodes(commercialNeeds, needCodes), signal_types: canonicalCodes(rawSignalTypes, signalCodes, 'other_signal'), technologies: canonicalCodes(rawTechnologies, technologyCodes, rawTechnologies.length ? 'other_technology' : null), geographies, description: fieldValue('opportunityTriggerDescription'), cutoff_date: null, delivery_format: [], frequency, neutral_output: true, internal_output_authorized: false, subsectors: [], capabilities: [] },
    request_extensions: requestExtensions,
    privacy: { privacy_notice_accepted: true, commercial_contact_consent: form.elements.marketingConsent.checked, accepted_at: submittedAt },
    first_name: firstName, last_name: lastName, full_name: fullName, company, job_title: fieldValue('jobTitle'), email: fieldValue('email'), phone: fieldValue('phone'), website: fieldValue('website'), address: fieldValue('address'), city_province: fieldValue('address'), offer_description: fieldValue('offerDescription'), offer: fieldValue('offerDescription'), offer_categories: offerCategories, problems_solved: problemsSolved, priority_solutions: prioritySolutions, target_sectors: targetSectors, target_company_types: targetCompanyTypes, geography_countries: countries, geography_spain_scope: spainCoverage, geography_regions: [], geography_provinces: provinces, geography_free_zone: '', target_revenue_range: requestExtensions.target_revenue_range, target_employee_range: requestExtensions.target_employee_range, minimum_opportunity_value: requestExtensions.minimum_opportunity_value, target_company_description: targetCompanyDescription, investment_capacity_signals: investmentSignals, innovation_product_signals: innovationSignals, organization_growth_signals: growthSignals, public_finance_signals: publicFinanceSignals, signal_types: rawSignalTypes, canonical_sector_codes: canonicalCodes(targetSectors, sectorCodes, 'other_sector'), canonical_target_company_type_codes: canonicalCodes(targetCompanyTypes, companyTypeCodes, 'other_company_type'), canonical_signal_type_codes: canonicalCodes(rawSignalTypes, signalCodes, 'other_signal'), canonical_opportunity_area_codes: canonicalCodes(commercialNeeds, needCodes), canonical_technology_codes: canonicalCodes(rawTechnologies, technologyCodes, rawTechnologies.length ? 'other_technology' : null), commercial_needs: commercialNeeds, probable_needs: commercialNeeds, opportunity_trigger_description: fieldValue('opportunityTriggerDescription'), recent_case_description: fieldValue('recentCaseDescription'), current_clients: currentClients, ideal_clients: idealClients, watchlist_accounts: watchlistAccounts, competitors, excluded_companies: excludedCompanies, no_buy_reason: noBuyReason, service_types: serviceTypes, service_comments: fieldValue('serviceComments'), privacy_accepted: true, marketing_consent: form.elements.marketingConsent.checked,
  };
}

function setStatus(type, message, allowReset = false) {
  statusBox.hidden = false;
  statusBox.className = `form-status ${type}`;
  statusBox.replaceChildren(document.createTextNode(message));
  if (allowReset) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Generar nueva solicitud';
    button.addEventListener('click', resetForm);
    statusBox.append(button);
  }
}

function isConfiguredEndpoint() {
  const endpoint = window.INDURADAR_CONFIG?.leadEndpoint ?? '';
  try { return new URL(endpoint).protocol === 'https:'; } catch { return false; }
}

async function submitLead(event) {
  event.preventDefault();
  if (submissionSucceeded || submitButton.disabled) return;
  if (!validateForm()) return;
  if (!creditsCatalog) { setStatus('error', 'No hemos podido calcular los créditos de la solicitud. Recarga la página e inténtalo de nuevo.'); return; }
  if (!isConfiguredEndpoint()) { console.debug('LEAD_ENDPOINT is not configured.'); setStatus('error', 'Falta configurar el endpoint de recepción del formulario.'); return; }
  submitButton.disabled = true;
  submitButton.textContent = 'Enviando solicitud…';
  statusBox.hidden = true;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(window.INDURADAR_CONFIG.leadEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildPayload()), signal: controller.signal });
    let result;
    try { result = await response.json(); } catch { throw new Error('invalid_json_response'); }
    console.debug('Lead submission', { httpStatus: response.status, success: result?.success === true, submissionId: result?.submission_id ?? null, emailSent: result?.email_sent ?? null });
    if (!response.ok || result?.success !== true) throw new Error(`http_${response.status}`);
    submissionSucceeded = true;
    form.querySelectorAll('input, textarea, select, button').forEach((element) => { element.disabled = true; });
    submitButton.textContent = 'Solicitud recibida';
    setStatus('success', 'Solicitud recibida correctamente. Hemos recibido tu solicitud y comenzaremos a revisarla.', true);
  } catch (error) {
    const detail = error instanceof DOMException && error.name === 'AbortError' ? 'timeout' : error instanceof Error ? error.message : 'unknown_error';
    console.debug('Lead submission failed', { detail });
    setStatus('error', 'No hemos podido enviar la solicitud. Inténtalo de nuevo en unos minutos.');
    submitButton.disabled = false;
    submitButton.textContent = 'Enviar solicitud';
  } finally { window.clearTimeout(timeout); }
}

function resetForm() {
  submissionSucceeded = false;
  form.reset();
  form.querySelectorAll('input, textarea, select, button').forEach((element) => { element.disabled = false; });
  ['investmentSignals', 'innovationSignals', 'growthSignals', 'publicFinanceSignals'].forEach((name) => inputsByName(name).forEach((input) => { input.checked = true; }));
  inputsByName('commercialNeeds').forEach((input) => { input.checked = input.value !== OTHER_NEED; });
  sectionsRoot.querySelectorAll('.form-section').forEach((details) => { details.open = false; });
  statusBox.hidden = true;
  clearErrors();
  submitButton.disabled = false;
  submitButton.textContent = 'Enviar solicitud';
  updateDerivedState();
  document.querySelector('#formulario').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setContactStatus(type, message) {
  contactStatus.hidden = false;
  contactStatus.className = `contact-status ${type}`;
  contactStatus.textContent = message;
}

function clearContactErrors() {
  contactForm.querySelectorAll('[aria-invalid="true"]').forEach((field) => field.removeAttribute('aria-invalid'));
  contactForm.querySelectorAll('.has-error').forEach((element) => element.classList.remove('has-error'));
  contactForm.querySelectorAll('[data-contact-error-for]').forEach((element) => { element.hidden = true; element.textContent = ''; });
}

function showContactError(name, message) {
  const field = contactForm.elements.namedItem(name);
  if (!(field instanceof HTMLElement)) return;
  field.setAttribute('aria-invalid', 'true');
  field.closest('.contact-field')?.classList.add('has-error');
  const error = contactForm.querySelector(`[data-contact-error-for="${name}"]`);
  if (error) { error.textContent = message; error.hidden = false; }
}

function clearContactErrorForInput(input) {
  if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) return;
  input.removeAttribute('aria-invalid');
  input.closest('.contact-field')?.classList.remove('has-error');
  const error = contactForm.querySelector(`[data-contact-error-for="${input.name}"]`);
  if (error) { error.hidden = true; error.textContent = ''; }
}

function submitContact(event) {
  event.preventDefault();
  clearContactErrors();
  contactStatus.hidden = true;
  const name = contactForm.elements.contactName.value.trim();
  const email = contactForm.elements.contactEmail.value.trim();
  const message = contactForm.elements.contactMessage.value.trim();
  let valid = true;
  if (!name) { showContactError('contactName', 'Indica tu nombre.'); valid = false; }
  if (!validEmail(email)) { showContactError('contactEmail', 'Indica un email válido para responderte.'); valid = false; }
  if (!message) { showContactError('contactMessage', 'Escribe tu consulta.'); valid = false; }
  if (!valid) return;
  const subject = `Consulta desde induradar.com - ${name}`;
  const body = `Nombre: ${name}\nEmail: ${email}\n\nConsulta:\n${message}`;
  window.location.href = `mailto:info@induradar.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  setContactStatus('success', 'Se ha abierto tu aplicación de correo con la consulta preparada para enviar a info@induradar.com.');
}

async function loadCreditsCatalog() {
  try {
    const response = await fetch('assets/config/induradar_credits_v1.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`catalog_http_${response.status}`);
    creditsCatalog = await response.json();
    updateCredits();
  } catch (error) {
    console.debug('Credits catalog could not be loaded.', { detail: error instanceof Error ? error.message : 'unknown_error' });
  }
}

renderForm();
form.addEventListener('submit', submitLead);
contactForm?.addEventListener('submit', submitContact);
contactForm?.addEventListener('input', (event) => clearContactErrorForInput(event.target));
void loadCreditsCatalog();
