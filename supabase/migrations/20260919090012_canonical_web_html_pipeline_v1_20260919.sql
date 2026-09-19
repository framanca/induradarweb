
-- Canonical deterministic HTML pipeline for future InduRadar report versions.
-- Report JSON remains the only substantive report input. No web/LLM work occurs here.

alter table private.report_web_payload_cache
  add column if not exists html_renderer_version text,
  add column if not exists html_document text,
  add column if not exists html_document_hash text,
  add column if not exists html_materialized_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='report_web_payload_cache_html_hash_chk'
      and conrelid='private.report_web_payload_cache'::regclass
  ) then
    alter table private.report_web_payload_cache
      add constraint report_web_payload_cache_html_hash_chk
      check (html_document_hash is null or html_document_hash ~ '^[a-f0-9]{64}$');
  end if;
end $$;

comment on column private.report_web_payload_cache.html_document is
'Canonical self-contained HTML generated once from the persisted Web Document. Future web display and exported HTML must use these exact bytes.';
comment on column private.report_web_payload_cache.html_document_hash is
'SHA-256 of canonical HTML bytes.';
comment on column private.report_web_payload_cache.html_renderer_version is
'Canonical HTML renderer version. Independent from the legacy browser/web-document renderer version.';

create or replace function private.trg_embed_report_company_profiles_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, private, public, pg_temp
as $$
declare
  v_existing jsonb;
  v_profiles jsonb;
  v_sections jsonb;
begin
  if new.report_schema_generation <> 2
     or jsonb_typeof(coalesce(new.report_payload,'{}'::jsonb)) <> 'object'
     or coalesce(new.finalization_status,'draft')='finalized' then
    return new;
  end if;

  v_existing := new.report_payload#>'{section_narratives,company_profiles_v1}';
  if jsonb_typeof(v_existing)='object'
     and jsonb_typeof(v_existing->'items')='array'
     and jsonb_array_length(v_existing->'items') > 0 then
    return new;
  end if;

  v_profiles := public.get_report_company_profiles_v1(new.id);
  if jsonb_typeof(v_profiles) <> 'object' then
    return new;
  end if;

  v_sections := case
    when jsonb_typeof(new.report_payload->'section_narratives')='object'
      then new.report_payload->'section_narratives'
    else '{}'::jsonb
  end;

  new.report_payload := jsonb_set(
    new.report_payload,
    '{section_narratives}',
    v_sections || jsonb_build_object('company_profiles_v1',v_profiles),
    true
  );
  return new;
end;
$$;

drop trigger if exists zz19d_report_company_profiles_snapshot on public.report_versions;
create trigger zz19d_report_company_profiles_snapshot
before update of report_payload on public.report_versions
for each row execute function private.trg_embed_report_company_profiles_v1();

comment on function private.trg_embed_report_company_profiles_v1() is
'Before report hashes are frozen, embeds the deterministic company-profile snapshot already available from canonical company master + approved reusable facts. It performs no new research and does not overwrite an explicit non-empty profile snapshot.';

create or replace function private.induradar_html_scope_block_v1(p_label text, p_value jsonb)
returns text
language plpgsql
immutable
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_body text := '';
  v_type text;
begin
  if p_value is null or p_value='null'::jsonb then return ''; end if;
  v_type:=jsonb_typeof(p_value);

  if v_type='array' then
    if jsonb_array_length(p_value)=0 then return ''; end if;
    v_body:=public.induradar_html_text_list_v1(p_value);
  elsif v_type='string' then
    if nullif(btrim(p_value#>>'{}'),'') is null then return ''; end if;
    v_body:='<p>'||public.induradar_html_escape_v1(p_value#>>'{}')||'</p>';
  elsif v_type in ('number','boolean') then
    v_body:='<p>'||public.induradar_html_escape_v1(p_value::text)||'</p>';
  else
    return '';
  end if;

  return '<div class="scope-card"><div class="label">'
    ||public.induradar_html_escape_v1(p_label)||'</div>'||v_body||'</div>';
end;
$$;

create or replace function private.render_induradar_canonical_html_v1(p_document jsonb)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, private, public, pg_temp
as $$
declare
  p jsonb:=coalesce(p_document->'payload','{}'::jsonb);
  metadata jsonb:=coalesce(p->'metadata','{}'::jsonb);
  scope jsonb:=coalesce(p->'scope','{}'::jsonb);
  exec jsonb:=coalesce(p->'executive_summary','{}'::jsonb);
  profiles jsonb:=coalesce(p#>'{section_narratives,company_profiles_v1,items}','[]'::jsonb);
  opps jsonb:=coalesce(p#>'{portfolio_summary,client_layers,signal_opportunities}','[]'::jsonb);
  universe jsonb:=coalesce(p#>'{portfolio_summary,client_layers,company_universe}','[]'::jsonb);
  watch jsonb:=coalesce(p#>'{portfolio_summary,client_layers,signal_watchlist}','[]'::jsonb);
  near jsonb:=coalesce(p#>'{portfolio_summary,client_layers,near_promotion}','[]'::jsonb);
  candidates jsonb:=coalesce(p#>'{portfolio_summary,client_layers,discovery_candidates}','[]'::jsonb);
  sigs jsonb:=coalesce(p->'signals','[]'::jsonb);
  ecosystem jsonb:=coalesce(p->'ecosystem','[]'::jsonb);
  actions jsonb:=coalesce(p->'client_actions','[]'::jsonb);
  limitations jsonb:=coalesce(p->'limitations','[]'::jsonb);
  sources jsonb:=coalesce(p->'source_index','[]'::jsonb);
  x jsonb;
  y jsonb;
  prof jsonb;
  ed jsonb;
  loc text;
  web text;
  geo text:='';
  h text:='';
  search_text text;
  title text;
  ref text:=coalesce(p_document->>'report_reference',p->>'report_reference','');
  asof text:=coalesce(p_document->>'as_of',metadata->>'as_of','');
  opp_count int:=case when jsonb_typeof(opps)='array' then jsonb_array_length(opps) else 0 end;
  profile_count int:=case when jsonb_typeof(profiles)='array' then jsonb_array_length(profiles) else 0 end;
  signal_count int:=case when jsonb_typeof(sigs)='array' then jsonb_array_length(sigs) else 0 end;
  source_count int:=case when jsonb_typeof(sources)='array' then jsonb_array_length(sources) else 0 end;
begin
  if jsonb_typeof(profiles)<>'array' then profiles:='[]'::jsonb; end if;
  if jsonb_typeof(opps)<>'array' then opps:='[]'::jsonb; end if;
  if jsonb_typeof(universe)<>'array' then universe:='[]'::jsonb; end if;
  if jsonb_typeof(watch)<>'array' then watch:='[]'::jsonb; end if;
  if jsonb_typeof(near)<>'array' then near:='[]'::jsonb; end if;
  if jsonb_typeof(candidates)<>'array' then candidates:='[]'::jsonb; end if;
  if jsonb_typeof(sigs)<>'array' then sigs:='[]'::jsonb; end if;
  if jsonb_typeof(ecosystem)<>'array' then ecosystem:='[]'::jsonb; end if;
  if jsonb_typeof(actions)<>'array' then actions:='[]'::jsonb; end if;
  if jsonb_typeof(limitations)<>'array' then limitations:='[]'::jsonb; end if;
  if jsonb_typeof(sources)<>'array' then sources:='[]'::jsonb; end if;

  title:=coalesce(nullif(metadata->>'report_title',''),nullif(scope->>'title',''),'Informe de señales y oportunidades industriales');

  if jsonb_typeof(coalesce(scope->'geographies','[]'::jsonb))='array' then
    for x in select value from jsonb_array_elements(scope->'geographies') loop
      loc:=concat_ws(', ',
        nullif(x->>'city',''),
        nullif(x->>'province',''),
        nullif(x->>'region',''),
        nullif(x->>'country',''),
        nullif(x->>'free_text','')
      );
      if loc<>'' then
        if geo<>'' then geo:=geo||' · '; end if;
        geo:=geo||loc;
      end if;
    end loop;
  end if;

  h:='<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    ||'<meta name="robots" content="noindex,nofollow,noarchive"><title>'
    ||public.induradar_html_escape_v1(ref)||' | InduRadar</title><style>'
    ||':root{--navy:#0b2f4a;--blue:#146aa1;--cyan:#38a9c9;--ink:#17212b;--muted:#5f6b76;--line:#dbe4ea;--soft:#f4f8fb;--white:#fff;--good:#e9f6f9}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#eef3f7;color:var(--ink);font-family:Inter,Segoe UI,Arial,sans-serif;line-height:1.48}a{color:var(--blue);text-decoration:none}a:hover{text-decoration:underline}.wrap{max-width:1240px;margin:0 auto;background:white;min-height:100vh;box-shadow:0 0 32px rgba(20,47,70,.08)}header{padding:34px 48px 26px;border-bottom:5px solid var(--navy);background:linear-gradient(135deg,#fff 0%,#f3f9fc 100%)}.brand{font-size:34px;font-weight:800;letter-spacing:-1px;color:var(--navy)}.brand span{color:var(--blue)}.kicker{margin-top:6px;color:var(--muted);font-size:13px;text-transform:uppercase;letter-spacing:.08em}.report-title{font-size:30px;line-height:1.15;margin:26px 0 10px;color:#111}.meta{display:flex;flex-wrap:wrap;gap:9px 18px;color:var(--muted);font-size:14px}.container{padding:0 48px 56px}.nav{position:sticky;top:0;z-index:20;display:flex;gap:8px;flex-wrap:wrap;align-items:center;background:rgba(255,255,255,.97);backdrop-filter:blur(8px);padding:12px 0;border-bottom:1px solid var(--line)}.nav a,.nav button{border:1px solid #abc2d2;background:white;color:var(--navy);padding:8px 11px;border-radius:999px;font:inherit;font-size:13px;cursor:pointer}.nav .print{margin-left:auto;background:var(--navy);color:white}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:28px 0}.metric{padding:18px;border:1px solid var(--line);border-radius:12px;background:var(--soft)}.metric b{display:block;font-size:28px;color:var(--navy)}.metric span{font-size:13px;color:var(--muted)}h2{font-size:24px;color:var(--navy);border-bottom:2px solid var(--line);padding-bottom:8px;margin:38px 0 18px}h3{font-size:20px;color:var(--navy);margin:0 0 8px}h4{font-size:15px;color:var(--navy);margin:8px 0}.summary{font-size:17px;background:#f7fafc;border-left:4px solid var(--blue);padding:18px 20px;border-radius:5px}.scope-grid,.profile-grid,.editorial{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.scope-card,.fact-group,.editorial>div{border:1px solid var(--line);border-radius:10px;padding:12px 14px;background:#fbfdfe}.scope-card p{margin:4px 0}.label,.fact-title{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--blue);font-weight:800;margin-bottom:5px}.compact-list,.fact-group ul{margin:4px 0 0;padding-left:20px}.fact-group li{margin:5px 0}.fact-group li span{display:block;color:var(--muted);font-size:13px;margin-top:2px}.card{border:1px solid var(--line);border-radius:14px;padding:20px;background:white;box-shadow:0 4px 14px rgba(15,43,65,.04);margin-bottom:16px}.card.opportunity{border-left:5px solid var(--blue)}.badge{display:inline-block;background:var(--good);color:var(--navy);border-radius:999px;padding:4px 9px;font-size:12px;font-weight:700;margin-right:6px}.badge.gray{background:#eef1f3;color:#46525d}.card-meta{display:flex;flex-wrap:wrap;gap:8px 18px;color:var(--muted);font-size:13px;margin-bottom:12px}.editorial{margin-top:14px}.editorial .wide{grid-column:1/-1}.signals{margin-top:12px}.signal{padding:10px 0;border-top:1px solid var(--line)}.signal:first-child{border-top:0}.signal .date{color:var(--muted);font-size:12px}.toolbar{position:sticky;top:54px;z-index:10;background:rgba(255,255,255,.97);padding:12px 0;border-bottom:1px solid var(--line);display:flex;gap:10px;flex-wrap:wrap}.toolbar input{flex:1;min-width:240px;border:1px solid #b8c8d2;border-radius:8px;padding:10px 12px;font-size:14px}.toolbar button{border:1px solid #abc2d2;background:white;color:var(--navy);padding:9px 13px;border-radius:8px;cursor:pointer}.toolbar button.active{background:var(--navy);color:white}.company-index{width:100%;border-collapse:collapse;font-size:14px;margin-top:12px}.company-index th,.company-index td{padding:10px;border-bottom:1px solid var(--line);text-align:left}.company-index th{color:var(--navy);background:var(--soft)}.source-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 20px}.source-item{padding:9px 0;border-bottom:1px solid var(--line);font-size:13px}.source-item small{display:block;color:var(--muted)}.trace-note{font-size:12px;color:var(--muted);margin-top:28px;padding-top:16px;border-top:1px solid var(--line)}.hidden{display:none!important}@media(max-width:780px){header,.container{padding-left:20px;padding-right:20px}.metrics{grid-template-columns:repeat(2,1fr)}.scope-grid,.profile-grid,.editorial,.source-list{grid-template-columns:1fr}.editorial .wide{grid-column:auto}.nav{position:static}.toolbar{top:0}.company-index{font-size:12px}.company-index th:nth-child(3),.company-index td:nth-child(3){display:none}}@media print{body{background:white}.wrap{box-shadow:none;max-width:none}.nav,.toolbar{display:none}.card{box-shadow:none;break-inside:avoid}.source-list{grid-template-columns:1fr 1fr}a{color:inherit;text-decoration:none}}'
    ||'</style></head><body><div class="wrap"><header><div class="brand">Indu<span>Radar</span></div><div class="kicker">Inteligencia de oportunidades industriales</div>'
    ||'<div class="report-title">'||public.induradar_html_escape_v1(title)||'</div><div class="meta"><span><strong>'
    ||public.induradar_html_escape_v1(ref)||'</strong></span>'
    ||case when asof<>'' then '<span>Fecha de corte '||public.induradar_html_escape_v1(asof)||'</span>' else '' end
    ||'</div></header><main class="container">'
    ||'<nav class="nav"><a href="#resumen">Resumen</a><a href="#alcance">Alcance</a><a href="#oportunidades">Oportunidades</a><a href="#empresas">Empresas</a><a href="#senales">Señales</a><a href="#fuentes">Fuentes</a><button class="print" onclick="window.print()">Imprimir / PDF</button></nav>';

  h:=h||'<div class="metrics"><div class="metric"><b>'||opp_count||'</b><span>empresas con señales</span></div><div class="metric"><b>'||profile_count||'</b><span>empresas con ficha</span></div><div class="metric"><b>'||signal_count||'</b><span>señales conservadas</span></div><div class="metric"><b>'||source_count||'</b><span>fuentes indexadas</span></div></div>';

  h:=h||'<section id="resumen"><h2>Conclusión ejecutiva</h2>';
  if nullif(exec->>'conclusion','') is not null then
    h:=h||'<div class="summary">'||public.induradar_html_escape_v1(exec->>'conclusion')||'</div>';
  elsif nullif(exec->>'summary','') is not null then
    h:=h||'<div class="summary">'||public.induradar_html_escape_v1(exec->>'summary')||'</div>';
  else
    h:=h||'<div class="summary">Conclusión ejecutiva no disponible en el Report JSON aprobado.</div>';
  end if;
  if jsonb_array_length(actions)>0 then
    h:=h||'<h3>Acciones recomendadas</h3>'||public.induradar_html_text_list_v1(actions);
  end if;
  h:=h||'</section>';

  h:=h||'<section id="alcance"><h2>Alcance y criterios del estudio</h2><div class="scope-grid">';
  h:=h||private.induradar_html_scope_block_v1('Oferta analizada',scope->'offer');
  h:=h||private.induradar_html_scope_block_v1('Objetivo de investigación',scope->'research_objective');
  h:=h||private.induradar_html_scope_block_v1('Sectores',scope->'sectors');
  h:=h||private.induradar_html_scope_block_v1('Subsectores',scope->'subsectors');
  h:=h||private.induradar_html_scope_block_v1('Tipos de empresa',scope->'target_company_types');
  if geo<>'' then h:=h||'<div class="scope-card"><div class="label">Geografía</div><p>'||public.induradar_html_escape_v1(geo)||'</p></div>'; end if;
  h:=h||private.induradar_html_scope_block_v1('Áreas de oportunidad',scope->'opportunity_areas');
  h:=h||private.induradar_html_scope_block_v1('Señales priorizadas',scope->'signal_types');
  h:=h||private.induradar_html_scope_block_v1('Tecnologías',scope->'technologies');
  h:=h||private.induradar_html_scope_block_v1('Capacidades',scope->'capabilities');
  h:=h||private.induradar_html_scope_block_v1('Requisitos',scope->'must_have');
  h:=h||private.induradar_html_scope_block_v1('Exclusiones',scope->'exclusions');
  h:=h||private.induradar_html_scope_block_v1('Descripción de la solicitud',scope->'description');
  h:=h||'</div></section>';

  h:=h||'<section id="oportunidades"><h2>Oportunidades con señales verificadas</h2>';
  for x in select value from jsonb_array_elements(opps) loop
    prof:='{}'::jsonb;
    select value into prof
    from jsonb_array_elements(profiles)
    where (
      nullif(x->>'company_id','') is not null
      and value->>'company_id'=x->>'company_id'
    ) or lower(coalesce(value->>'name',''))=lower(coalesce(x->>'company',''))
    limit 1;
    prof:=coalesce(prof,'{}'::jsonb);
    ed:=coalesce(x->'editorial','{}'::jsonb);
    loc:=concat_ws(', ',
      nullif(prof#>>'{primary_location,municipality}',''),
      nullif(prof#>>'{primary_location,province}',''),
      nullif(prof#>>'{primary_location,country}','')
    );
    web:=coalesce(prof->>'website',x->>'website','');

    h:=h||'<article class="card opportunity"><span class="badge">Oportunidad #'
      ||public.induradar_html_escape_v1(coalesce(x->>'rank',''))||'</span><span class="badge gray">'
      ||public.induradar_html_escape_v1(coalesce(x->>'signal_count','0'))||' señales</span><h3>'
      ||public.induradar_html_escape_v1(coalesce(x->>'company',prof->>'name','Empresa'))||'</h3><div class="card-meta">';
    if nullif(prof->>'legal_name','') is not null then h:=h||'<span>'||public.induradar_html_escape_v1(prof->>'legal_name')||'</span>'; end if;
    if nullif(prof->>'tax_id','') is not null then h:=h||'<span>CIF/NIF '||public.induradar_html_escape_v1(prof->>'tax_id')||'</span>'; end if;
    if loc<>'' then h:=h||'<span>'||public.induradar_html_escape_v1(loc)||'</span>'; end if;
    if web<>'' then h:=h||'<span><a href="'||public.induradar_html_escape_v1(web)||'" target="_blank" rel="noopener">Web</a></span>'; end if;
    if nullif(prof->>'company_type_code','') is not null then h:=h||'<span>'||public.induradar_html_escape_v1(prof->>'company_type_code')||'</span>'; end if;
    h:=h||'</div>';

    if nullif(prof->>'activity_summary','') is not null then h:=h||'<p>'||public.induradar_html_escape_v1(prof->>'activity_summary')||'</p>'; end if;
    h:=h||'<div class="profile-grid">'
      ||public.induradar_html_fact_group_v1('Familias de producto',prof->'product_family')
      ||public.induradar_html_fact_group_v1('Áreas de aplicación',prof->'application_area')
      ||public.induradar_html_fact_group_v1('Servicios',prof->'service')
      ||public.induradar_html_fact_group_v1('Capacidades',prof->'capability')
      ||'</div>';

    if jsonb_typeof(coalesce(x->'signals','[]'::jsonb))='array' and jsonb_array_length(coalesce(x->'signals','[]'::jsonb))>0 then
      h:=h||'<div class="signals"><div class="label">Señales verificadas</div>';
      for y in select value from jsonb_array_elements(x->'signals') loop
        h:=h||'<div class="signal"><strong>'||public.induradar_html_escape_v1(coalesce(y->>'title','Señal'))||'</strong>'
          ||case when nullif(y->>'signal_at','') is not null then '<div class="date">'||public.induradar_html_escape_v1(left(y->>'signal_at',10))||'</div>' else '' end
          ||case when nullif(y->>'summary','') is not null then '<div>'||public.induradar_html_escape_v1(y->>'summary')||'</div>' else '' end;
        if jsonb_typeof(coalesce(y->'source_refs','[]'::jsonb))='array' and jsonb_array_length(coalesce(y->'source_refs','[]'::jsonb))>0 then
          h:=h||'<div class="card-meta">';
          for prof in select value from jsonb_array_elements(y->'source_refs') loop
            if jsonb_typeof(prof)='string' and (prof#>>'{}') ~ '^https?://' then
              h:=h||'<a href="'||public.induradar_html_escape_v1(prof#>>'{}')||'" target="_blank" rel="noopener">Fuente</a>';
            end if;
          end loop;
          h:=h||'</div>';
        end if;
        h:=h||'</div>';
      end loop;
      h:=h||'</div>';
    end if;

    h:=h||'<div class="editorial">';
    if nullif(ed->>'signal_synopsis','') is not null then h:=h||'<div class="wide"><div class="label">Lectura de la señal</div>'||public.induradar_html_escape_v1(ed->>'signal_synopsis')||'</div>'; end if;
    if jsonb_typeof(coalesce(ed->'confirmed_facts','[]'::jsonb))='array' and jsonb_array_length(coalesce(ed->'confirmed_facts','[]'::jsonb))>0 then h:=h||'<div class="wide"><div class="label">Hechos confirmados</div>'||public.induradar_html_text_list_v1(ed->'confirmed_facts')||'</div>'; end if;
    if nullif(ed->>'why_now','') is not null then h:=h||'<div><div class="label">Por qué importa ahora</div>'||public.induradar_html_escape_v1(ed->>'why_now')||'</div>'; end if;
    if nullif(ed->>'probable_need','') is not null then h:=h||'<div><div class="label">Necesidad probable / área de compra</div>'||public.induradar_html_escape_v1(ed->>'probable_need')||'</div>'; end if;
    if nullif(ed->>'fit_and_role','') is not null then h:=h||'<div><div class="label">Encaje y rol objetivo</div>'||public.induradar_html_escape_v1(ed->>'fit_and_role')||'</div>'; end if;
    if nullif(ed->>'actor_chain','') is not null then h:=h||'<div><div class="label">Actores y cadena de decisión</div>'||public.induradar_html_escape_v1(ed->>'actor_chain')||'</div>'; end if;
    if jsonb_typeof(coalesce(ed->'validation_gaps','[]'::jsonb))='array' and jsonb_array_length(coalesce(ed->'validation_gaps','[]'::jsonb))>0 then h:=h||'<div><div class="label">Qué falta por validar</div>'||public.induradar_html_text_list_v1(ed->'validation_gaps')||'</div>'; end if;
    if nullif(ed->>'risk_cautions','') is not null then h:=h||'<div><div class="label">Riesgos y cautelas</div>'||public.induradar_html_escape_v1(ed->>'risk_cautions')||'</div>'; end if;
    if nullif(ed->>'next_action','') is not null then h:=h||'<div><div class="label">Siguiente acción recomendada</div>'||public.induradar_html_escape_v1(ed->>'next_action')||'</div>'; end if;
    h:=h||'</div></article>';
  end loop;
  h:=h||'</section>';

  h:=h||'<section id="empresas"><h2>Fichas de empresa y universo</h2><p>Las fichas muestran únicamente datos ya aprobados en el Report JSON. Un campo vacío no implica ausencia de actividad.</p>'
    ||'<div class="toolbar"><input id="companySearch" type="search" placeholder="Buscar empresa, producto, servicio, capacidad o ubicación…"><button class="active" data-filter="all">Todas</button><button data-filter="opportunity">Con señales</button><button data-filter="universe">Universo</button></div>';

  if profile_count>0 then
    h:=h||'<table class="company-index"><thead><tr><th>Empresa</th><th>Situación</th><th>Ubicación</th><th>Web</th></tr></thead><tbody>';
    for x in select value from jsonb_array_elements(profiles) loop
      loc:=concat_ws(', ',nullif(x#>>'{primary_location,municipality}',''),nullif(x#>>'{primary_location,province}',''),nullif(x#>>'{primary_location,country}',''));
      web:=coalesce(x->>'website','');
      h:=h||'<tr><td>'||public.induradar_html_escape_v1(coalesce(x->>'name','Empresa'))||'</td><td>'
        ||case when nullif(x->>'opportunity_rank','') is not null then 'Oportunidad #'||public.induradar_html_escape_v1(x->>'opportunity_rank') else 'Universo' end
        ||'</td><td>'||public.induradar_html_escape_v1(loc)||'</td><td>'
        ||case when web<>'' then '<a href="'||public.induradar_html_escape_v1(web)||'" target="_blank" rel="noopener">web</a>' else '—' end
        ||'</td></tr>';
    end loop;
    h:=h||'</tbody></table><div style="margin-top:20px">';
    for x in select value from jsonb_array_elements(profiles) loop
      loc:=concat_ws(', ',nullif(x#>>'{primary_location,municipality}',''),nullif(x#>>'{primary_location,province}',''),nullif(x#>>'{primary_location,country}',''));
      web:=coalesce(x->>'website','');
      search_text:=lower(concat_ws(' ',x->>'name',x->>'legal_name',loc,x->>'activity_summary',x->'product_family'::text,x->'application_area'::text,x->'service'::text,x->'capability'::text));
      h:=h||'<article class="card company-card" data-kind="'||case when nullif(x->>'opportunity_rank','') is not null then 'opportunity' else 'universe' end||'" data-search="'
        ||public.induradar_html_escape_v1(search_text)||'"><span class="badge '||case when nullif(x->>'opportunity_rank','') is not null then '' else 'gray' end||'">'
        ||case when nullif(x->>'opportunity_rank','') is not null then 'Oportunidad #'||public.induradar_html_escape_v1(x->>'opportunity_rank') else 'Universo' end
        ||'</span><h3>'||public.induradar_html_escape_v1(coalesce(x->>'name','Empresa'))||'</h3><div class="card-meta">';
      if nullif(x->>'legal_name','') is not null then h:=h||'<span>'||public.induradar_html_escape_v1(x->>'legal_name')||'</span>'; end if;
      if nullif(x->>'tax_id','') is not null then h:=h||'<span>CIF/NIF '||public.induradar_html_escape_v1(x->>'tax_id')||'</span>'; end if;
      if loc<>'' then h:=h||'<span>'||public.induradar_html_escape_v1(loc)||'</span>'; end if;
      if web<>'' then h:=h||'<span><a href="'||public.induradar_html_escape_v1(web)||'" target="_blank" rel="noopener">'||public.induradar_html_escape_v1(web)||'</a></span>'; end if;
      if nullif(x->>'company_type_code','') is not null then h:=h||'<span>'||public.induradar_html_escape_v1(x->>'company_type_code')||'</span>'; end if;
      h:=h||'</div>';
      if nullif(x->>'activity_summary','') is not null then h:=h||'<p>'||public.induradar_html_escape_v1(x->>'activity_summary')||'</p>'; end if;
      h:=h||'<div class="profile-grid">'
        ||public.induradar_html_fact_group_v1('Familias de producto',x->'product_family')
        ||public.induradar_html_fact_group_v1('Áreas de aplicación',x->'application_area')
        ||public.induradar_html_fact_group_v1('Servicios',x->'service')
        ||public.induradar_html_fact_group_v1('Capacidades',x->'capability')
        ||'</div></article>';
    end loop;
    h:=h||'</div>';
  else
    h:=h||'<p>No hay fichas empresariales materializadas en este Report JSON.</p>';
  end if;
  h:=h||'</section>';

  h:=h||'<section id="senales"><h2>Inventario de señales</h2>';
  if signal_count>0 then
    for x in select value from jsonb_array_elements(sigs) loop
      h:=h||'<article class="card"><strong>'||public.induradar_html_escape_v1(coalesce(x->>'title','Señal'))||'</strong><div class="card-meta">'
        ||case when nullif(x->>'signal_at','') is not null then '<span>'||public.induradar_html_escape_v1(left(x->>'signal_at',10))||'</span>' else '' end
        ||case when nullif(coalesce(x->>'signal_type_code',x->>'signal_type'),'') is not null then '<span>'||public.induradar_html_escape_v1(coalesce(x->>'signal_type_code',x->>'signal_type'))||'</span>' else '' end
        ||'</div>'
        ||case when nullif(x->>'summary','') is not null then '<p>'||public.induradar_html_escape_v1(x->>'summary')||'</p>' else '' end
        ||'</article>';
    end loop;
  else
    h:=h||'<p>No hay señales cliente-visibles en esta proyección.</p>';
  end if;
  h:=h||'</section>';

  if jsonb_array_length(near)+jsonb_array_length(watch)+jsonb_array_length(candidates)>0 then
    h:=h||'<section id="seguimiento"><h2>Seguimiento y pendientes</h2>';
    for x in
      select value from jsonb_array_elements(near)
      union all select value from jsonb_array_elements(watch)
      union all select value from jsonb_array_elements(candidates)
    loop
      h:=h||'<article class="card"><h3>'||public.induradar_html_escape_v1(coalesce(x->>'company',x->>'name',x->>'title','Elemento de seguimiento'))||'</h3>'
        ||case when nullif(coalesce(x->>'summary',x->>'reason',x->>'rationale'),'') is not null then '<p>'||public.induradar_html_escape_v1(coalesce(x->>'summary',x->>'reason',x->>'rationale'))||'</p>' else '' end
        ||case when nullif(coalesce(x->>'next_action',x->>'action'),'') is not null then '<div class="label">Siguiente acción</div><p>'||public.induradar_html_escape_v1(coalesce(x->>'next_action',x->>'action'))||'</p>' else '' end
        ||'</article>';
    end loop;
    h:=h||'</section>';
  end if;

  if jsonb_array_length(ecosystem)>0 then
    h:=h||'<section id="ecosistema"><h2>Ecosistema relevante</h2>';
    for x in select value from jsonb_array_elements(ecosystem) loop
      h:=h||'<article class="card"><h3>'||public.induradar_html_escape_v1(coalesce(x->>'company',x->>'name',x->>'title','Actor'))||'</h3>'
        ||case when nullif(coalesce(x->>'role',x->>'type',x->>'classification'),'') is not null then '<div class="card-meta"><span>'||public.induradar_html_escape_v1(coalesce(x->>'role',x->>'type',x->>'classification'))||'</span></div>' else '' end
        ||case when nullif(coalesce(x->>'summary',x->>'rationale',x->>'relevance'),'') is not null then '<p>'||public.induradar_html_escape_v1(coalesce(x->>'summary',x->>'rationale',x->>'relevance'))||'</p>' else '' end
        ||'</article>';
    end loop;
    h:=h||'</section>';
  end if;

  if jsonb_array_length(actions)>0 then
    h:=h||'<section id="acciones"><h2>Plan de acción comercial</h2>'||public.induradar_html_text_list_v1(actions)||'</section>';
  end if;

  if jsonb_array_length(limitations)>0 then
    h:=h||'<section id="limitaciones"><h2>Limitaciones de interpretación</h2>'||public.induradar_html_text_list_v1(limitations)||'</section>';
  end if;

  h:=h||'<section id="fuentes"><h2>Fuentes públicas</h2>';
  if source_count>0 then
    h:=h||'<div class="source-list">';
    for x in select value from jsonb_array_elements(sources) loop
      h:=h||'<div class="source-item"><strong>'||public.induradar_html_escape_v1(coalesce(x->>'title',x->>'source_name','Fuente'))||'</strong><small>'
        ||public.induradar_html_escape_v1(concat_ws(' · ',nullif(x->>'source_name',''),nullif(x->>'domain',''),nullif(x->>'source_type','')))||'</small>'
        ||case when nullif(coalesce(x->>'canonical_url',x->>'url'),'') is not null then '<a href="'||public.induradar_html_escape_v1(coalesce(x->>'canonical_url',x->>'url'))||'" target="_blank" rel="noopener">Consultar fuente</a>' else '' end
        ||'</div>';
    end loop;
    h:=h||'</div>';
  else
    h:=h||'<p>No hay fuentes cliente-visibles en esta proyección.</p>';
  end if;
  h:=h||'</section>';

  h:=h||'<div class="trace-note">HTML canónico generado una sola vez desde el Web Document derivado del Report JSON aprobado. Esta vista no realiza búsquedas, no llama a IA y no añade hechos sustantivos.</div></main></div>'
    ||'<script>(()=>{const input=document.getElementById("companySearch"),cards=[...document.querySelectorAll(".company-card")],buttons=[...document.querySelectorAll("[data-filter]")];let filter="all";function apply(){const q=(input?.value||"").toLowerCase().trim();cards.forEach(c=>{const okF=filter==="all"||c.dataset.kind===filter;const okQ=!q||(c.dataset.search||"").includes(q);c.classList.toggle("hidden",!(okF&&okQ));});}input?.addEventListener("input",apply);buttons.forEach(b=>b.addEventListener("click",()=>{buttons.forEach(x=>x.classList.remove("active"));b.classList.add("active");filter=b.dataset.filter;apply();}));})();</script></body></html>';
  return h;
end;
$$;

comment on function private.render_induradar_canonical_html_v1(jsonb) is
'Pure deterministic HTML renderer over one persisted client-safe Web Document. It performs no database research, no web access and no AI work.';

create or replace function public.materialize_web_report_payload_v1(
  p_report_version_id uuid,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, private, public, auth, extensions, pg_temp
as $$
declare
  r public.report_versions%rowtype;
  v_account uuid;
  v_gate jsonb;
  v_payload jsonb;
  v_document jsonb;
  v_source_hash text;
  v_document_hash text;
  v_renderer_version text;
  v_html_renderer_version text:='1.0.0';
  v_html text;
  v_html_hash text;
  v_cached private.report_web_payload_cache%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('induradar.web-payload:'||p_report_version_id::text,0));

  select rv.* into r
  from public.report_versions rv
  where rv.id=p_report_version_id;
  if not found then raise exception 'Report not found'; end if;

  select rp.account_id into v_account
  from public.reports rp
  where rp.id=r.report_id;
  if v_account is null then raise exception 'Report account not found'; end if;
  if auth.uid() is not null and not public.is_account_member(v_account) then
    raise exception 'Not authorized';
  end if;

  if r.status not in ('ready','delivered')
     or r.report_payload_status<>'ready'
     or r.finalization_status<>'finalized' then
    return jsonb_build_object(
      'materialized',false,
      'reason','report_not_ready_for_web_materialization',
      'report_version_id',r.id,
      'report_reference',r.report_reference
    );
  end if;

  v_renderer_version:=public.induradar_web_renderer_contract_v1()->>'web_report_renderer_version';
  v_source_hash:=coalesce(
    nullif(r.finalized_payload_hash,''),
    nullif(r.report_payload_hash,''),
    encode(digest(r.report_payload::text,'sha256'),'hex')
  );

  select * into v_cached
  from private.report_web_payload_cache
  where report_version_id=r.id;

  if found and not p_force
     and v_cached.source_payload_hash=v_source_hash
     and v_cached.renderer_version=v_renderer_version
     and v_cached.html_renderer_version=v_html_renderer_version
     and v_cached.html_document is not null
     and v_cached.html_document_hash is not null then
    return jsonb_build_object(
      'materialized',true,
      'reused',true,
      'report_version_id',r.id,
      'report_reference',r.report_reference,
      'renderer_version',v_renderer_version,
      'html_renderer_version',v_html_renderer_version,
      'source_payload_hash',v_source_hash,
      'web_document_hash',v_cached.web_document_hash,
      'html_document_hash',v_cached.html_document_hash,
      'materialized_at',v_cached.materialized_at
    );
  end if;

  v_gate:=public.evaluate_web_report_payload_gate_v1(r.id);
  if not coalesce((v_gate->>'pass')::boolean,false) then
    return jsonb_build_object(
      'materialized',false,
      'reason','web_delivery_gate_failed',
      'report_version_id',r.id,
      'report_reference',r.report_reference,
      'gate',v_gate
    );
  end if;

  v_payload:=public.induradar_client_sanitize_jsonb(
    public.induradar_strip_request_knowledge_internal_v1(r.report_payload)
  );
  v_payload:=jsonb_set(v_payload,'{render_contract}',public.induradar_web_renderer_contract_v1(),true);

  v_document:=jsonb_build_object(
    'report_reference',r.report_reference,
    'as_of',r.as_of,
    'renderer_version',v_renderer_version,
    'canonical_html_renderer_version',v_html_renderer_version,
    'payload',v_payload
  );
  v_document_hash:=encode(digest(v_document::text,'sha256'),'hex');
  v_html:=private.render_induradar_canonical_html_v1(v_document);
  v_html_hash:=encode(digest(convert_to(v_html,'UTF8'),'sha256'),'hex');

  insert into private.report_web_payload_cache(
    report_version_id,report_reference,source_payload_hash,renderer_version,
    web_document,web_document_hash,gate_snapshot,materialized_at,updated_at,
    html_renderer_version,html_document,html_document_hash,html_materialized_at
  ) values (
    r.id,r.report_reference,v_source_hash,v_renderer_version,
    v_document,v_document_hash,v_gate,clock_timestamp(),clock_timestamp(),
    v_html_renderer_version,v_html,v_html_hash,clock_timestamp()
  )
  on conflict(report_version_id) do update set
    report_reference=excluded.report_reference,
    source_payload_hash=excluded.source_payload_hash,
    renderer_version=excluded.renderer_version,
    web_document=excluded.web_document,
    web_document_hash=excluded.web_document_hash,
    gate_snapshot=excluded.gate_snapshot,
    materialized_at=excluded.materialized_at,
    updated_at=clock_timestamp(),
    html_renderer_version=excluded.html_renderer_version,
    html_document=excluded.html_document,
    html_document_hash=excluded.html_document_hash,
    html_materialized_at=excluded.html_materialized_at;

  return jsonb_build_object(
    'materialized',true,
    'reused',false,
    'report_version_id',r.id,
    'report_reference',r.report_reference,
    'renderer_version',v_renderer_version,
    'html_renderer_version',v_html_renderer_version,
    'source_payload_hash',v_source_hash,
    'web_document_hash',v_document_hash,
    'html_document_hash',v_html_hash,
    'materialized_at',clock_timestamp()
  );
end;
$$;

create or replace function public.get_web_report_html_v1(p_report_version_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, private, public, auth, pg_temp
as $$
declare
  r public.report_versions%rowtype;
  v_account uuid;
  v_source_hash text;
  v_html text;
begin
  select * into r from public.report_versions where id=p_report_version_id;
  if not found then raise exception 'Report not found'; end if;

  select rp.account_id into v_account from public.reports rp where rp.id=r.report_id;
  if v_account is null then raise exception 'Report account not found'; end if;
  if auth.uid() is not null and not public.is_account_member(v_account) then
    raise exception 'Not authorized';
  end if;

  if r.status not in ('ready','delivered')
     or r.report_payload_status<>'ready'
     or r.finalization_status<>'finalized' then
    raise exception 'Report not ready';
  end if;

  v_source_hash:=coalesce(nullif(r.finalized_payload_hash,''),nullif(r.report_payload_hash,''));
  select c.html_document into v_html
  from private.report_web_payload_cache c
  where c.report_version_id=r.id
    and c.source_payload_hash=v_source_hash
    and c.html_renderer_version='1.0.0'
    and c.html_document_hash is not null;

  return v_html;
end;
$$;

create or replace function public.get_web_report_html_by_reference_v1(p_report_reference text)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, private, public, auth, pg_temp
as $$
declare
  v_id uuid;
begin
  select rv.id into v_id
  from public.report_versions rv
  where rv.report_reference=p_report_reference
    and rv.status in ('ready','delivered')
    and rv.report_payload_status='ready'
    and rv.finalization_status='finalized'
  order by rv.generated_at desc
  limit 1;

  if v_id is null then raise exception 'Report not found'; end if;
  return public.get_web_report_html_v1(v_id);
end;
$$;

create or replace function public.render_induradar_html_v1(p_report_version_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_html text;
begin
  v_html:=public.get_web_report_html_v1(p_report_version_id);
  if v_html is null then
    raise exception 'Canonical HTML is not materialized for this report version';
  end if;
  return v_html;
end;
$$;

revoke all on function public.get_web_report_html_v1(uuid) from public, anon;
revoke all on function public.get_web_report_html_by_reference_v1(text) from public, anon;
revoke all on function public.render_induradar_html_v1(uuid) from public, anon;
grant execute on function public.get_web_report_html_v1(uuid) to authenticated, service_role;
grant execute on function public.get_web_report_html_by_reference_v1(text) to authenticated, service_role;
grant execute on function public.render_induradar_html_v1(uuid) to authenticated, service_role;
