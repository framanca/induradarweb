# Acceptance coverage added after the 0.2 release

`v2.test.cjs` adds independent regression checks for project migration, typed tags, operation policy, faceplate bindings, selective subscriptions, authorization, invalid commands, idempotency, competing revisions, recipe atomicity, alarm lifecycle/delays, event gaps, session expiry, storage failures, exports and a real loopback HTTP service.

`acceptance_browser.py` exercises operator/observer/maintenance behavior, masters/faceplates, alarms outside the visible screen, recipes, new editor controls, import, undo/redo, image handling and both SD export formats. With `HMI_BROWSER_ORIGIN` it also verifies IndexedDB storage across an actual HTTP-origin reload. Exported runtimes are executed in isolated DOM fixtures to make view fetch counts deterministic.

Existing model/service/export/server/browser tests and their historical RESULTS.json are preserved. The GitHub Actions result for the exact commit is authoritative for the combined suite; do not treat an older test count as the current total.

Local reproduction:

```bash
node --test HMI_NX/tests/*.test.cjs
python -m pip install playwright==1.57.0
python -m playwright install chromium
python -m http.server 8765 --bind 127.0.0.1
# In another terminal, from the repository root:
HMI_BROWSER_ORIGIN=http://127.0.0.1:8765/HMI_NX/ python HMI_NX/tests/acceptance_browser.py
```

Without HMI_BROWSER_ORIGIN the browser test uses an offline DOM fixture. This option is useful in environments that prohibit browser navigation; it does not validate IndexedDB origin persistence. HMI_TEST_PHASE=runtime, editor or export runs an individual block.

All service values in these tests are simulated. No test here validates an NX102, a compiled Omron HTTP FB, real machine motion, SD limits or security certification. The installed-policy/reference-service semantics remain separate from physical integration.
