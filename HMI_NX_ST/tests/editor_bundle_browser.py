"""Browser smoke test against the BUILT GitHub Pages bundle.
Exercise buttons that stopped working when history.js was not published.
Never touches a real user's IndexedDB/localStorage or a PLC.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ORIGIN = os.environ.get("HMI_ST_BROWSER_ORIGIN", "http://127.0.0.1:8766/HMI_NX_ST/")
OUT = Path(os.environ.get("HMI_ST_TEST_OUTPUT", "HMI_NX_ST_TEST_RESULTS"))
OUT.mkdir(parents=True, exist_ok=True)
checks = []
errors = []

try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--no-sandbox"])
        context = browser.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True)
        page = context.new_page()
        page.set_default_timeout(10000)
        page.on("pageerror", lambda err: errors.append(str(err)))
        page.on("dialog", lambda dialog: dialog.accept())
        response = page.goto(ORIGIN, wait_until="load")
        assert response is not None and response.status == 200
        page.wait_for_function("document.querySelector('#saveStatus').textContent.includes('Guardado local')")
        checks.append("startup_scripts_loaded_and_autosave_ready")

        page.locator("#newBtn").click()
        assert page.locator("#projectName").input_value() == "WebHMI ST"
        assert page.locator("#canvas .widget").count() == 0
        checks.append("new_button_creates_empty_project")

        page.locator(".tool-grid [data-kind='button']").click()
        assert page.locator("#canvas .widget").count() == 1
        page.locator("#undoBtn").click()
        assert page.locator("#canvas .widget").count() == 0
        page.locator("#redoBtn").click()
        assert page.locator("#canvas .widget").count() == 1
        checks.append("undo_and_redo_buttons_work")

        page.locator("#projectName").fill("Prueba de recuperación")
        page.locator("#projectName").press("Tab")
        with page.expect_download() as download_event:
            page.locator("#saveBtn").click()
        saved = download_event.value
        assert saved.suggested_filename.endswith(".nxst")
        backup = OUT / "project_test.nxst"
        saved.save_as(backup)
        assert json.loads(backup.read_text(encoding="utf-8"))["name"] == "Prueba de recuperación"
        checks.append("save_button_downloads_project")

        page.locator("#demoBtn").click()
        assert page.locator("#projectName").input_value() == "Demo NX ST"
        checks.append("demo_button_loads_demo_explicitly")

        with page.expect_download() as export_event:
            page.locator("#exportBtn").click()
        exported = export_event.value
        assert exported.suggested_filename.endswith(".zip")
        checks.append("export_button_downloads_sysmac_package")

        with page.expect_file_chooser() as open_event:
            page.locator("#loadBtn").click()
        open_event.value.set_files(str(backup))
        page.wait_for_function("document.querySelector('#projectName').value === 'Prueba de recuperación'")
        assert page.locator("#canvas .widget").count() == 1
        checks.append("open_button_imports_nxst_project")

        page.reload(wait_until="load")
        page.wait_for_function("document.querySelector('#saveStatus').textContent.includes('Guardado local')")
        assert page.locator("#projectName").input_value() == "Prueba de recuperación"
        assert page.locator("#canvas .widget").count() == 1
        checks.append("refresh_restores_last_project_not_demo")

        page.locator("#recoveryBtn").click()
        assert page.locator("#recoveryDialog").is_visible()
        assert page.locator("#recoveryList").get_by_text("Prueba de recuperación").count() > 0
        page.locator("#closeRecovery").click()
        checks.append("recovery_button_opens_backups")

        assert not errors, "Browser JavaScript errors: " + repr(errors)
        report = {
            "status": "PASS",
            "origin": ORIGIN,
            "checks": checks,
            "browser_errors": errors,
            "browser": "Chromium",
            "hardware_tested": False
        }
        (OUT / "editor_smoke.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps(report, ensure_ascii=False))
        context.close()
        browser.close()

except BaseException as exc:
    import traceback
    traceback.print_exc()
    print('DEBUG_EXCEPTION',repr(exc),flush=True)
