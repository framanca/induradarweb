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

    def select_sidebar(tab):
        button = page.locator(f"#sidebar-tab-{tab}")
        button.click()
        assert button.get_attribute("aria-selected") == "true"
        assert page.locator(f"#sidebar-panel-{tab}").is_visible()
        assert page.locator(".left-panels [role='tabpanel']:visible").count() == 1
        for other in ("project", "variables", "elements", "alarms", "recipes"):
            assert page.locator(f"#sidebar-tab-{other}").get_attribute("aria-selected") == ("true" if other == tab else "false")

    assert page.locator(".left-tabs [role='tab']").count() == 5
    # Five compact icons must fit on the same row, without visible labels.
    def assert_compact_icon_row():
        tabs = page.locator(".left-tabs [role='tab']")
        bars = [tabs.nth(i).bounding_box() for i in range(5)]
        assert all(box is not None for box in bars)
        assert max(box["y"] for box in bars) - min(box["y"] for box in bars) <= 1
        assert max(box["height"] for box in bars) <= 46
        for idx, label in enumerate(("Proyecto", "Variables", "Elementos", "Alarmas", "Recetas")):
            tab = tabs.nth(idx)
            assert tab.get_attribute("aria-label") == label
            assert tab.get_attribute("title") == label
            assert tab.locator("svg").count() == 1
            assert tab.locator("span").count() == 0
    assert_compact_icon_row()
    page.set_viewport_size({"width": 990, "height": 800})
    assert_compact_icon_row()
    page.set_viewport_size({"width": 1440, "height": 900})
    checks.append("five_compact_icon_only_tabs_fit_on_one_row")
    assert page.locator(".left-panels [role='tabpanel']:visible").count() == 1
    assert page.locator("#sidebar-tab-project").get_attribute("aria-selected") == "true"
    select_sidebar("variables")
    assert page.locator("#importFileBtn").is_visible()
    select_sidebar("elements")
    assert page.locator(".tool-grid [data-kind='slider']").is_visible()
    select_sidebar("alarms")
    assert page.locator("#addAlarm").is_visible()
    select_sidebar("recipes")
    assert page.locator("#addRecipe").is_visible()
    select_sidebar("project")
    assert page.locator("#projectName").is_visible()
    checks.append("five_icon_tabs_keep_only_active_panel_visible")

    page.locator("#sidebar-tab-project").focus()
    page.keyboard.press("ArrowRight")
    assert page.locator("#sidebar-tab-variables").get_attribute("aria-selected") == "true"
    assert page.locator("#sidebar-tab-variables").evaluate("(e) => document.activeElement === e")
    page.keyboard.press("End")
    assert page.locator("#sidebar-tab-recipes").get_attribute("aria-selected") == "true"
    page.keyboard.press("Home")
    assert page.locator("#sidebar-tab-project").get_attribute("aria-selected") == "true"
    checks.append("sidebar_tabs_support_keyboard_navigation")

    page.locator("#newBtn").click()
    assert page.locator("#projectName").input_value() == "WebHMI ST"
    assert page.locator("#canvas .widget").count() == 0
    checks.append("new_button_creates_empty_project")

    # Screen configuration is edited in a modal, not an inline name field.
    first_id = page.locator("#screenSelect option").first.get_attribute("value")
    page.locator("#editScreen").click()
    assert page.locator("#screenSettingsDialog").is_visible()
    page.locator("#screenSettingsName").fill("Principal personalizada")
    page.locator("#screenSettingsNumber").fill("5")
    page.locator("#screenSettingsBackground").evaluate("(el) => { el.value = '#cceeff'; el.dispatchEvent(new Event('input', {bubbles:true})); }")
    page.locator("#screenSettingsForm button[type=submit]").click()
    assert not page.locator("#screenSettingsDialog").is_visible()
    assert "5 · Principal personalizada" in page.locator("#screenSelect option").first.inner_text()
    assert page.locator("#canvas").evaluate("(e) => getComputedStyle(e).backgroundColor") == "rgb(204, 238, 255)"
    checks.append("screen_dialog_edits_name_number_and_background")

    page.locator("#copyScreen").click()
    assert page.locator("#screenSelect option").count() == 2
    assert "1 · Principal personalizada (copia)" in page.locator("#screenSelect option").last.inner_text()
    assert page.locator("#canvas").evaluate("(e) => getComputedStyle(e).backgroundColor") == "rgb(204, 238, 255)"
    page.locator("#screenSelect").select_option(first_id)
    checks.append("copy_screen_preserves_background_and_assigns_unique_number")

    # Import a PLC integer variable and bind it as the screen controller.
    select_sidebar("variables")
    page.locator("#pasteBtn").click()
    page.locator("#pasteText").fill("Name,Data Type\nPantallaActual,UINT\n")
    page.locator("#pasteImport").click()
    select_sidebar("project")
    page.locator("#screenBinding").select_option("PantallaActual")
    assert page.locator("#screenBinding").input_value() == "PantallaActual"
    checks.append("screen_binding_selects_integer_plc_variable")

    select_sidebar("elements")
    page.locator(".tool-grid [data-kind='button']").click()
    assert page.locator("#canvas .widget").count() == 1
    page.locator("#undoBtn").click()
    assert page.locator("#canvas .widget").count() == 0
    page.locator("#redoBtn").click()
    assert page.locator("#canvas .widget").count() == 1
    checks.append("undo_and_redo_buttons_work")

    # Alarmas y recetas siguen siendo editables; cambiar de pestaña no altera el lienzo.
    select_sidebar("alarms")
    alarm_count = page.locator("#alarmEditor .editor-card").count()
    page.locator("#addAlarm").click()
    assert page.locator("#alarmEditor .editor-card").count() == alarm_count + 1
    page.locator("#undoBtn").click()
    assert page.locator("#alarmEditor .editor-card").count() == alarm_count
    select_sidebar("recipes")
    recipe_count = page.locator("#recipeEditor .editor-card").count()
    page.locator("#addRecipe").click()
    assert page.locator("#recipeEditor .editor-card").count() == recipe_count + 1
    page.locator("#undoBtn").click()
    assert page.locator("#recipeEditor .editor-card").count() == recipe_count
    assert page.locator("#canvas .widget").count() == 1
    select_sidebar("project")
    checks.append("tab_switching_preserves_widgets_and_alarm_recipe_actions")

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

    # Convertir una pantalla ya creada en base desde el editor de propiedades.
    page.locator("#newBtn").click()
    main_id = page.locator("#screenSelect option").first.get_attribute("value")
    assert page.locator("#baseScreenBtn").count() == 0
    page.locator("#editScreen").click()
    assert not page.locator("#screenSettingsIsBase").is_checked()
    assert not page.locator("#screenSettingsUseBase").is_checked()
    assert page.locator("#screenSettingsUseBase").is_disabled()
    page.locator("#screenSettingsCancel").click()
    page.locator("#addScreen").click()
    source_id = page.locator("#screenSelect").input_value()
    select_sidebar("elements")
    page.locator(".tool-grid [data-kind='text']").click()
    page.locator("#properties [data-p='text']").fill("Cabecera compartida")
    page.locator("#properties [data-p='text']").press("Tab")
    page.locator("#editScreen").click()
    page.locator("#screenSettingsIsBase").check()
    assert not page.locator("#screenSettingsUseBase").is_checked()
    assert not page.locator("#screenSettingsNumberRow").is_visible()
    page.locator("#screenSettingsForm button[type=submit]").click()
    assert page.locator("#screenSelect").input_value() == source_id
    assert page.locator("#screenSelect option").count() == 2
    assert page.locator("#canvas .widget").count() == 1
    page.locator("#editScreen").click()
    assert page.locator("#screenSettingsIsBase").is_checked()
    assert page.locator("#screenSettingsUseBase").is_disabled()
    page.locator("#screenSettingsCancel").click()
    page.locator("#screenSelect").select_option(main_id)
    assert page.locator("#canvas .widget.inherited").count() == 0
    page.locator("#editScreen").click()
    assert page.locator("#screenSettingsIsBase").is_disabled()
    assert page.locator("#screenSettingsUseBase").is_visible()
    page.locator("#screenSettingsUseBase").check()
    assert not page.locator("#screenSettingsIsBase").is_checked()
    page.locator("#screenSettingsForm button[type=submit]").click()
    assert page.locator("#canvas .widget.inherited").count() == 1
    assert "Cabecera compartida" in page.locator("#canvas .widget.inherited").inner_text()
    page.locator("#screenSelect").select_option(source_id)
    page.locator("#canvas .widget").click()
    page.locator("#properties [data-p='text']").fill("Cabecera actualizada")
    page.locator("#properties [data-p='text']").press("Tab")
    page.locator("#screenSelect").select_option(main_id)
    assert "Cabecera actualizada" in page.locator("#canvas .widget.inherited").inner_text()
    page.reload(wait_until="load")
    assert page.locator("#canvas .widget.inherited").count() == 1
    assert "Cabecera actualizada" in page.locator("#canvas .widget.inherited").inner_text()
    page.locator("#editScreen").click()
    assert page.locator("#screenSettingsUseBase").is_checked()
    page.locator("#screenSettingsUseBase").uncheck()
    page.locator("#screenSettingsForm button[type=submit]").click()
    assert page.locator("#canvas .widget.inherited").count() == 0
    # Desmarcar ambas opciones de la pantalla base la devuelve a una pantalla normal.
    page.locator("#screenSelect").select_option(source_id)
    page.locator("#editScreen").click()
    page.locator("#screenSettingsIsBase").uncheck()
    assert not page.locator("#screenSettingsUseBase").is_checked()
    assert page.locator("#screenSettingsNumberRow").is_visible()
    page.locator("#screenSettingsForm button[type=submit]").click()
    assert page.locator("#screenSelect").input_value() == source_id
    assert page.locator("#canvas .widget").count() == 1
    assert page.locator("#screenSelect option").count() == 2
    checks.append("screen_properties_convert_and_inherit_base_without_widget_loss")

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
