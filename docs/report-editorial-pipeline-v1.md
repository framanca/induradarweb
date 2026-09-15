# Report Editorial Closure Pipeline v1

New InduRadar report versions use a mandatory editorial step after `prepare_report` and before `finalize_report`.

```text
research complete
  -> prepare_report
  -> get_report_editorial_generation_plan_v1
  -> Chat/Work synthesizes prose from that plan only
  -> finalize_report(content)
  -> Report JSON ready/finalized
  -> Light Report / HTML / DOCX / PDF render from the approved JSON
```

## Hard rules

- Editorial synthesis consumes **0 BRP2 web searches**.
- It must not browse, reopen research, invent facts, contacts, finances, or missing fields.
- It may only synthesize the already approved/canonical report inventory returned by the editorial plan.
- Every client-visible signal opportunity receives: `signal_synopsis`, `confirmed_facts`, `why_now`, `probable_need`, `risk_cautions`, and `next_action`.
- `executive_summary.conclusion` is required.
- Optional prose includes `headline`, `fit_and_role`, `actor_chain`, `validation_gaps`, and `confidence_note`.
- The prose is persisted once in the immutable Report JSON and every renderer reuses it. Viewing/rendering never calls an LLM.
- Existing finalized reports remain `legacy_optional`; their immutable payloads are not rewritten retroactively.

The database gate `REPORT-EDITORIAL-V1` blocks a new report from reaching `report_payload_status=ready` until these requirements pass. Q0 exposes the pipeline under `execution_api.report_editorial_pipeline` and Chat/Work follows the explicit closure sequence recorded in `chat_execution.report_editorial_pipeline`.
