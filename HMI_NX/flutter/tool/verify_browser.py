"""Exercise the bundled editor against the actual Dart native-file server."""
import base64
import json
import os
import subprocess
import tempfile
import time
import zipfile
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

APP = Path(__file__).resolve().parents[1]
DART = os.environ.get("DART", "dart")
OUT = APP / "test-results"
OUT.mkdir(exist_ok=True)
checks = []


def start(directory):
    url_file = directory / "url.txt"
    url_file.unlink(missing_ok=True)
    process = subprocess.Popen([DART, "tool/browser_fixture.dart", str(directory)], cwd=APP, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    deadline = time.monotonic() + 25
    while not url_file.exists():
        if process.poll() is not None:
            raise RuntimeError(process.stderr.read().decode())
        if time.monotonic() > deadline:
            process.kill()
            raise RuntimeError("Native fixture startup timed out")
        time.sleep(0.1)
    return process, url_file.read_text()


def stop(process):
    process.communicate(input=b"stop\n", timeout=10)
    assert process.returncode == 0


with tempfile.TemporaryDirectory(prefix="webhmi-browser-") as temporary, sync_playwright() as pw:
    directory = Path(temporary)
    demo = subprocess.check_output(["node", "-e", "require('./assets/editor/model.js');process.stdout.write(JSON.stringify(NXST.demoProject()));"], cwd=APP)
    (directory / "import.nxst").write_bytes(demo)
    (directory / "variables.tsv").write_text("Name\tData Type\tComment\nSpeed\tREAL\tSpeed\nRun\tBOOL\tRun\n")
    (directory / "image.png").write_bytes(base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6M9sAAAAASUVORK5CYII="))
    process, url = start(directory)
    try:
        browser = pw.chromium.launch(headless=True, executable_path=os.environ.get('CHROMIUM'))
    except Exception:
        stop(process)
        raise
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    page.set_default_timeout(15000)
    errors = []
    requests = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("request", lambda request: requests.append(request.url))
    page.on("dialog", lambda dialog: dialog.accept())
    try:
        page.goto(url, wait_until="load")
        expect(page.locator("#saveStatus")).to_contain_text("Guardado en disco")
        assert page.locator("#canvas .widget").count() == 0
        checks.append("first_launch_empty_project_no_demo")
        page.locator("#projectName").fill("Proyecto offline real")
        page.locator("#projectName").press("Tab")
        page.locator(".tool-grid [data-kind='text']").click()
        assert page.locator("#canvas .widget").count() == 1
        checks.append("editing_commits_to_native_storage")
        page.locator("#undoBtn").click()
        assert page.locator("#canvas .widget").count() == 0
        page.locator("#redoBtn").click()
        assert page.locator("#canvas .widget").count() == 1
        checks.append("undo_redo_preserved")
        page.reload(wait_until="load")
        assert page.locator("#projectName").input_value() == "Proyecto offline real"
        assert page.locator("#canvas .widget").count() == 1
        checks.append("reload_restores_real_project")
        # New process, new port, new token: browser-origin storage cannot provide this restoration.
        page.close()
        stop(process)
        process, url = start(directory)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("request", lambda request: requests.append(request.url))
        page.on("dialog", lambda dialog: dialog.accept())
        page.goto(url, wait_until="load")
        assert page.locator("#projectName").input_value() == "Proyecto offline real"
        checks.append("app_restart_with_different_origin_restores_disk_project")
        page.locator("#saveBtn").click()
        expect(page.locator("#toast")).to_have_text("Proyecto guardado")
        assert json.loads((directory / "Proyecto_offline_real.nxst").read_text())["name"] == "Proyecto offline real"
        checks.append("native_project_export_bytes")
        page.locator("#loadBtn").click()
        expect(page.locator("#projectName")).to_have_value("Demo NX ST")
        checks.append("native_project_picker_import")
        page.locator("#exportBtn").click()
        expect(page.locator("#toast")).to_have_text("Paquete Sysmac guardado")
        with zipfile.ZipFile(directory / "Demo_NX_ST_Sysmac.zip") as archive:
            assert "WebHMI_Server.st" in archive.namelist()
            assert "HMI_Embedded.html" in archive.namelist()
            assert json.loads(archive.read("project.nxst"))["name"] == "Demo NX ST"
        checks.append("native_sysmac_zip_preserves_ST_HTML_and_project")
        page.locator("#previewBtn").click()
        page.wait_for_selector("#previewDialog[open]")
        assert page.frame_locator("#previewFrame").locator("#stage").is_visible()
        page.locator("#closePreview").click()
        checks.append("runtime_preview_offline")
        page.get_by_role("button", name="Versiones en disco", exact=True).click()
        page.wait_for_selector(".offline-versions[open]")
        assert page.locator(".offline-versions .recovery-item").count() > 0
        page.locator(".offline-versions").get_by_role("button", name="Cerrar", exact=True).click()
        checks.append("native_versions_accessible")
        page.set_viewport_size({"width": 390, "height": 844})
        page.get_by_role("button", name="Propiedades", exact=True).click()
        assert page.locator(".right").is_visible()
        page.get_by_role("button", name="Herramientas", exact=True).click()
        assert page.locator(".left").is_visible()
        assert page.locator(".tool-grid button").count() == 16
        checks.append("all_widgets_and_properties_accessible_on_phone")
        page.locator("#newBtn").click()
        page.locator("#importFileBtn").click()
        expect(page.locator("#varList .var-row")).to_have_count(2)
        checks.append("native_variables_import")
        page.locator("#imageBtn").click()
        expect(page.locator("#toast")).to_contain_text("Imagen añadida")
        assert page.locator("#canvas .widget.image").count() == 1
        checks.append("native_image_import")
        page.get_by_role("button", name="Lienzo", exact=True).click()
        page.screenshot(path=str(OUT / "phone-editor.png"), full_page=True)
        page.set_viewport_size({"width": 1440, "height": 1000})
        page.screenshot(path=str(OUT / "desktop-editor.png"), full_page=True)
        assert not errors, errors
        assert all(address.startswith("http://127.0.0.1:") or address.startswith(("data:", "blob:", "about:")) for address in requests), requests
        checks.append("no_external_requests_and_no_javascript_errors")
        (OUT / "browser-checks.json").write_text(json.dumps({"status": "PASS", "checks": checks, "hardware_tested": False}, indent=2))
        print(f"PASS: {len(checks)} browser and native-file integration checks.")
    finally:
        browser.close()
        if process.poll() is None:
            stop(process)
