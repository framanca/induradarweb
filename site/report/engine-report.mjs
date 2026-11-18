export function engineMetadata(report) { return report.metadata?.research_engine || report; }
// RE1 projection of a frozen approved JSON; no network, models, clock or scoring.
export function reportRows(report) {
  const engine=engineMetadata(report);
  const layers = report.portfolio_summary.client_layers;
  const signalRows = engine.signal_dispositions.map(s => ({
    Empresa: layers.company_universe.find(c => c.company_id === s.company_id)?.company || 'Actor relacionado',
    Hecho: s.title, Tipo: s.signal_type, Fase: s.phase, Papel: s.role,
    Acontecimiento: s.happened_at, Publicación: s.published_at, Captura: s.captured_at,
    Verificación: s.last_verified_at, Estado: s.disposition, Motivo: s.decision_reason,
    'Signal Strength': s.signal_strength, Earliness: s.earliness, Temperature: s.temperature,
    Fuentes: s.evidence_refs.map(id => report.source_index.find(r => r.id === id)?.url).filter(Boolean).join('\n'),
  }));
  const projects = new Map();
  for (const s of engine.signal_dispositions) if (s.project_id) {
    const group = projects.get(s.project_id) || {Proyecto:s.project_id,Fases:[],Hechos:[],Participantes:[],Fuentes:[]};
    group.Fases.push(s.phase || 'Desconocida'); group.Hechos.push(s.title);
    group.Participantes.push(`${layers.company_universe.find(c => c.company_id === s.company_id)?.company || 'Actor relacionado'}: ${s.role || 'papel pendiente'}`);
    group.Fuentes.push(...s.evidence_refs.map(id => report.source_index.find(r => r.id === id)?.url).filter(Boolean));
    projects.set(s.project_id, group);
  }
  const nameOf = id => layers.company_universe.find(c => c.company_id === id || c.member_key === id)?.company || 'Entidad pendiente';
  const workLabel = key => {
    const target=layers.company_universe.find(c => key.includes(c.company_id || '\u0000') || key.includes(c.member_key || '\u0000'));
    const kind=key.startsWith('minimum:')?'Revisión mínima':key.startsWith('sweep:')?'Barrido ligero':key.startsWith('verify:')?'Verificación material':'Ruta de descubrimiento';
    return target?`${kind} · ${target.company}`:kind;
  };
  return {
    Resumen: [
      {Campo:'Referencia',Valor:report.metadata.report_reference},
      {Campo:'Estado',Valor:engine.approval.status},
      {Campo:'Entorno',Valor:report.metadata.environment},
      {Campo:'Fecha de corte',Valor:report.metadata.as_of},
      {Campo:'Oportunidades',Valor:layers.signal_opportunities.length},
      {Campo:'Objetivos conservados',Valor:layers.company_universe.length},
      {Campo:'Motivo de cierre',Valor:engine.closure.reason},
      {Campo:'Búsquedas de esta pasada',Valor:engine.closure.budget.pass_query_count},
      {Campo:'Límite de la pasada',Valor:engine.closure.budget.query_budget},
      {Campo:'Coste observado',Valor:engine.costs?.observed_cost?.searches ?? null},
    ],
    Oportunidades: layers.signal_opportunities.map(o => ({
      Orden:o.rank, Empresa:o.company, 'Opportunity Rank':o.opportunity_rank_score,
      'Señal principal':o.signals.find(s => s.id === o.primary_signal_id)?.title,
      Fase:o.phase,Papel:o.company_role,'Signal Strength':o.signal_strength,
      Earliness:o.earliness,Temperature:o.temperature,Encaje:o.request_fit.status,
      Prioridad:o.ranking_reason,Hechos:o.editorial.confirmed_facts.join('\n'),
      'Hipótesis comercial':o.editorial.probable_need,'Próxima acción':o.editorial.next_action,
      'Función objetivo':o.target_role,'Canal corporativo':o.corporate_channel,
      'Pregunta pendiente':o.editorial.pending_question,Fuentes:o.source_refs.map(s => s.url).join('\n'),
    })),
    Universo: layers.company_universe.map(c => ({
      Empresa:c.company,Actividad:c.activity,Tipo:c.company_type,Web:c.website,Encaje:c.request_fit.status,
      'Motivo de encaje':c.request_fit.reason,'Estado de revisión':c.review_status,
      'Revisión mínima':c.minimum_review?.as_of,'Barrido de señales':c.signal_review?.as_of,
      Instalaciones:c.sites.map(s => `${s.country} · ${s.province || ''} · ${s.municipality || ''}`).join('\n'),
      Facturación:c.revenue,Plantilla:c.employees,Fuentes:c.source_refs.map(s => s.url).join('\n'),
    })),
    Señales: signalRows,
    Proyectos: [...projects.values()].map((p,i) => ({Proyecto:`Proyecto ${i+1}`,Fases:[...new Set(p.Fases)].join('\n'),
      Hechos:[...new Set(p.Hechos)].join('\n'),Participantes:[...new Set(p.Participantes)].join('\n'),Fuentes:[...new Set(p.Fuentes)].join('\n')})),
    Fuentes: report.source_index.map(s => ({Documento:s.title,URL:s.url,Publicación:s.published_at,
      Captura:s.captured_at,Verificación:s.verified_at,'Documento revisado':s.document_reviewed,'Evidencia aprobada':s.approved})),
    Cambios: engine.delta.map(d => ({Entidad:d.entity,Empresa:nameOf(d.id),Cambio:d.label,
      'Nuevo en conocimiento':d.new_to_database,'Nuevo frente al precedente':d.new_to_predecessor})),
    Pendientes: [
      ...engine.closure.resolvable_without_search.map(x => ({Trabajo:workLabel(x),Motivo:'Resoluble sin búsqueda'})),
      ...engine.closure.requires_extension.map(x => ({Trabajo:workLabel(x),Motivo:'Requiere ampliación autorizada'})),
      ...engine.closure.failed_routes.map(x => ({Trabajo:workLabel(x),Motivo:'Fuente o tarea fallida con trazabilidad'})),
      ...report.limitations.map(x => ({Trabajo:'Cobertura',Motivo:x})),
    ],
  };
}

export function workbookFromApprovedJson(XLSX, report) {
  const engine=engineMetadata(report);
  if (engine.approval?.status !== 'approved') throw new Error('El JSON debe estar aprobado; un parcial conserva su estado');
  const wb = XLSX.utils.book_new();
  wb.Props = {Title:report.metadata.report_reference,Author:'InduRadar',
    CreatedDate:new Date('2000-01-01T00:00:00Z'),ModifiedDate:new Date('2000-01-01T00:00:00Z')};
  for (const [name, rows] of Object.entries(reportRows(report))) {
    const dateColumns=new Set(['Acontecimiento','Publicación','Captura','Verificación','Revisión mínima','Barrido de señales']);
    const safe = rows.map(row => Object.fromEntries(Object.entries(row).map(([k,v]) => {
      if(dateColumns.has(k) && typeof v==='string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
        const [y,m,d]=v.slice(0,10).split('-').map(Number);
        return [k,(Date.UTC(y,m-1,d)-Date.UTC(1899,11,30))/86400000];
      }
      return [k,typeof v === 'string' && /^[=+\-@]/.test(v) ? `'${v}` : v ?? null];
    })));
    const ws = safe.length ? XLSX.utils.json_to_sheet(safe) : XLSX.utils.aoa_to_sheet([['Sin datos']]);
    ws['!cols'] = Object.keys(safe[0] || {}).map(key => ({wch: ['Hechos','Fuentes','Actividad','Motivo','Hipótesis comercial'].includes(key) ? 64 : 28}));
    if (ws['!ref']) ws['!autofilter'] = {ref:ws['!ref']};
    for(const [column,key] of Object.keys(safe[0] || {}).entries()) if(dateColumns.has(key)) {
      for(let row=1;row<=safe.length;row++) {const cell=ws[XLSX.utils.encode_cell({r:row,c:column})];if(cell?.t==='n')cell.z='yyyy-mm-dd';}
    }
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  return XLSX.write(wb,{type:'buffer',bookType:'xlsx',compression:true,bookSST:false});
}

export function renderEngineDetails(root, report) {
  root.replaceChildren();
  for (const [name, rows] of Object.entries(reportRows(report))) {
    const details=document.createElement('details'),summary=document.createElement('summary');
    summary.textContent=`${name} · ${rows.length} registros`;details.append(summary);
    const table=document.createElement('table'),head=document.createElement('tr');
    const keys=Object.keys(rows[0] || {});
    for(const key of keys){const cell=document.createElement('th');cell.textContent=key;head.append(cell);}
    table.append(head);
    for(const row of rows){const tr=document.createElement('tr');for(const key of keys){const cell=document.createElement('td');
      cell.textContent=row[key]===null||row[key]===undefined?'Desconocido':String(row[key]);tr.append(cell);}table.append(tr);}
    const filter=document.createElement('input');filter.type='search';filter.placeholder=`Filtrar ${name.toLowerCase()}`;
    filter.setAttribute('aria-label',filter.placeholder);
    filter.addEventListener('input',()=>{for(const row of Array.from(table.rows).slice(1))
      row.hidden=Boolean(filter.value)&&!row.textContent.toLocaleLowerCase('es').includes(filter.value.toLocaleLowerCase('es'));});
    details.append(filter);
    details.append(table);root.append(details);
  }
}
