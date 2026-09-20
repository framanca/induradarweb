create or replace function private.induradar_html_ecosystem_role_label_v1(p_value text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select case nullif(btrim(coalesce(p_value,'')),'')
    when 'channel_or_prescriber' then 'Canal / prescriptor'
    when 'ecosystem_actor' then 'Actor del ecosistema'
    when 'partner_or_project_actor' then 'Socio / actor de proyecto'
    when 'association_or_prescriber' then 'Asociación / prescriptor'
    when 'technical_prescriber' then 'Prescriptor técnico'
    when 'technology_partner' then 'Socio tecnológico'
    when 'research_center' then 'Centro de investigación'
    when 'technology_center' then 'Centro tecnológico'
    when 'public_body' then 'Organismo público'
    when 'supplier' then 'Proveedor'
    when 'partner' then 'Socio'
    when 'customer' then 'Cliente'
    when 'prescriber' then 'Prescriptor'
    when 'channel' then 'Canal'
    else case
      when coalesce(p_value,'') ~ '^[a-z0-9]+(_[a-z0-9]+)+$'
        then initcap(replace(p_value,'_',' '))
      else nullif(btrim(coalesce(p_value,'')),'')
    end
  end;
$function$;

create or replace function private.induradar_html_ecosystem_card_v1(p_item jsonb)
returns text
language plpgsql
immutable
set search_path to 'pg_catalog','private','public','pg_temp'
as $function$
declare
  v_name text;
  v_role text;
  v_desc text;
  v_html text;
  v_ref jsonb;
  v_url text;
begin
  v_name:=coalesce(
    nullif(btrim(p_item->>'actor'),''),
    nullif(btrim(p_item->>'company'),''),
    nullif(btrim(p_item->>'name'),''),
    nullif(btrim(p_item->>'title'),''),
    nullif(btrim(p_item->>'legal_name'),''),
    'Actor del ecosistema'
  );

  v_role:=private.induradar_html_ecosystem_role_label_v1(
    coalesce(
      nullif(btrim(p_item->>'role'),''),
      nullif(btrim(p_item->>'type'),''),
      nullif(btrim(p_item->>'classification'),'')
    )
  );

  v_desc:=coalesce(
    nullif(btrim(p_item->>'commercial_relevance'),''),
    nullif(btrim(p_item->>'summary'),''),
    nullif(btrim(p_item->>'rationale'),''),
    nullif(btrim(p_item->>'relevance'),''),
    nullif(btrim(p_item->>'description'),'')
  );

  v_html:='<article class="card"><h3>'
    ||public.induradar_html_escape_v1(v_name)
    ||'</h3>';

  if v_role is not null then
    v_html:=v_html||'<div class="card-meta"><span>'
      ||public.induradar_html_escape_v1(v_role)
      ||'</span></div>';
  end if;

  if v_desc is not null then
    v_html:=v_html||'<p>'||public.induradar_html_escape_v1(v_desc)||'</p>';
  end if;

  if jsonb_typeof(coalesce(p_item->'source_refs','[]'::jsonb))='array'
     and jsonb_array_length(coalesce(p_item->'source_refs','[]'::jsonb))>0 then
    v_html:=v_html||'<div class="card-meta">';
    for v_ref in select value from jsonb_array_elements(p_item->'source_refs') loop
      v_url:=case
        when jsonb_typeof(v_ref)='string' then v_ref#>>'{}'
        when jsonb_typeof(v_ref)='object' then coalesce(v_ref->>'canonical_url',v_ref->>'url')
        else null
      end;
      if v_url ~ '^https?://' then
        v_html:=v_html||'<a href="'
          ||public.induradar_html_escape_v1(v_url)
          ||'" target="_blank" rel="noopener">Fuente</a>';
      end if;
    end loop;
    v_html:=v_html||'</div>';
  end if;

  return v_html||'</article>';
end;
$function$;

do $migration$
declare
  v_def text;
  v_old text;
  v_new text;
begin
  v_def:=pg_get_functiondef('private.render_induradar_canonical_html_v1(jsonb)'::regprocedure);

  v_old:=$old$      h:=h||'<article class="card"><h3>'||public.induradar_html_escape_v1(coalesce(x->>'company',x->>'name',x->>'title','Actor'))||'</h3>'
        ||case when nullif(coalesce(x->>'role',x->>'type',x->>'classification'),'') is not null then '<div class="card-meta"><span>'||public.induradar_html_escape_v1(coalesce(x->>'role',x->>'type',x->>'classification'))||'</span></div>' else '' end
        ||case when nullif(coalesce(x->>'summary',x->>'rationale',x->>'relevance'),'') is not null then '<p>'||public.induradar_html_escape_v1(coalesce(x->>'summary',x->>'rationale',x->>'relevance'))||'</p>' else '' end
        ||'</article>';$old$;

  v_new:=$new$      h:=h||private.induradar_html_ecosystem_card_v1(x);$new$;

  if position(v_old in v_def)=0 then
    raise exception 'canonical_html_ecosystem_renderer_expected_block_not_found';
  end if;

  execute replace(v_def,v_old,v_new);

  v_def:=pg_get_functiondef('public.materialize_web_report_payload_v1(uuid,boolean)'::regprocedure);
  if position('v_html_renderer_version text:=''1.0.0''' in v_def)=0 then
    raise exception 'materialize_html_renderer_version_1_0_0_not_found';
  end if;
  execute replace(
    v_def,
    'v_html_renderer_version text:=''1.0.0''',
    'v_html_renderer_version text:=''1.0.1'''
  );

  v_def:=pg_get_functiondef('public.get_web_report_html_v1(uuid)'::regprocedure);
  if position('c.html_renderer_version=''1.0.0''' in v_def)=0 then
    raise exception 'get_html_renderer_version_1_0_0_not_found';
  end if;
  execute replace(
    v_def,
    'c.html_renderer_version=''1.0.0''',
    'c.html_renderer_version=''1.0.1'''
  );
end
$migration$;

comment on function private.induradar_html_ecosystem_card_v1(jsonb)
is 'Canonical client HTML projection for ecosystem items. Supports canonical actor/company/name/title aliases, client-friendly role labels, commercial_relevance, and source_refs without mutating the approved Report JSON.';

comment on function private.induradar_html_ecosystem_role_label_v1(text)
is 'Maps internal ecosystem role codes to client-facing labels; non-code human labels are preserved.';
