-- SFP2 verifies this branch as part of its published contract fingerprint.
-- Keep the existing implementation and restore the exact predicate spelling
-- expected by that verification.
do $migration$
declare
  definition text;
begin
  select pg_get_functiondef(
    'public.dispatch_research_kernel_chat_v1(text,text,text,text,text,jsonb)'::regprocedure
  ) into definition;

  if position('if p_intent = ''deepen'' then' in definition) = 0 then
    raise exception 'expected deepen predicate was not found in chat dispatcher';
  end if;

  execute replace(
    definition,
    'if p_intent = ''deepen'' then',
    'if p_intent=''deepen'' then'
  );
end
$migration$;
