"""Browser smoke test against the BUILT GitHub Pages bundle.
Exercise buttons that stopped working when history.js was not published.
Never touches a real user's IndexedDB/localStorage or a PLC.
"""
import base64
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

    # Local variables must be offered by all compatible widget selectors,
    # not just unified Text. Exercise read, write and feedback with no PLC binding.
    select_sidebar("variables")
    page.locator("#addInternalVar").click()  # Internal_1 BOOL
    page.locator("#addInternalVar").click()  # Internal_2 INT
    page.locator('#internalVarList [data-iv="1"][data-key="type"]').select_option("INT")
    page.locator('#internalVarList [data-iv="1"][data-key="value"]').fill("1")
    page.locator('#internalVarList [data-iv="1"][data-key="value"]').press("Tab")
    select_sidebar("elements")
    page.locator("#canvas .widget.button").click()
    page.locator("#properties [data-p='binding']").select_option("Internal_1")
    page.locator("#properties [data-p='feedbackBinding']").select_option("Internal_1")
    assert page.locator("#properties [data-p='feedbackBinding']").input_value() == "Internal_1"
    page.locator(".tool-grid [data-kind='status']").click()
    page.locator("#properties [data-p='binding']").select_option("Internal_1")
    # Widgets start at identical coordinates; place the indicator beside the button.
    page.locator("#properties [data-p='x']").fill("300")
    page.locator("#properties [data-p='x']").press("Tab")
    assert page.locator("#diagnostics .diagnostic.error").count() == 0
    page.locator("#previewBtn").click()
    assert page.locator("#previewDialog").is_visible()
    status = page.frame_locator("#previewFrame").locator("#stage .o.status .status-visual")
    status.wait_for()
    page.frame_locator("#previewFrame").locator("#stage .o.button .in").click()
    assert "#15803d" in status.locator("svg").evaluate("(el) => el.innerHTML")
    # The preview must use only the area BELOW its HMI title, status, nav and recipes.
    # Resize the dialog in both directions, then via accessible keyboard controls.
    def assert_preview_fits():
        page.wait_for_function("""() => {
            const f = document.getElementById('previewFrame');
            const d = f.contentDocument;
            if (!d || !d.getElementById('viewport')) return false;
            const viewport = d.getElementById('viewport').getBoundingClientRect();
            const fit = d.getElementById('fit').getBoundingClientRect();
            const body = d.body;
            return viewport.height > 80 &&
                fit.width <= viewport.width + 2 &&
                fit.height <= viewport.height + 2 &&
                d.documentElement.scrollHeight <= d.documentElement.clientHeight + 2 &&
                body.scrollHeight <= body.clientHeight + 2;
        }""")
    assert_preview_fits()
    dlg = page.locator("#previewDialog")
    original = dlg.bounding_box()
    grip = page.locator("#previewResizeHandle")
    assert grip.is_visible()
    corner = grip.bounding_box()
    assert corner is not None
    mx, my = corner["x"] + corner["width"]/2, corner["y"] + corner["height"]/2
    page.mouse.move(mx, my)
    page.mouse.down()
    page.mouse.move(mx - 220, my - 190, steps=12)
    page.mouse.up()
    smaller = dlg.bounding_box()
    assert smaller is not None and original is not None
    assert smaller["width"] <= original["width"] - 150
    assert smaller["height"] <= original["height"] - 120
    assert_preview_fits()
    grip.focus()
    page.keyboard.press("Shift+ArrowRight")
    page.keyboard.press("Shift+ArrowDown")
    keyboard_size = dlg.bounding_box()
    assert keyboard_size is not None
    assert keyboard_size["width"] >= smaller["width"] + 45
    assert keyboard_size["height"] >= smaller["height"] + 45
    assert_preview_fits()
    page.locator("#closePreview").click()
    checks.append("preview_window_resize_pointer_keyboard_and_hmi_auto_fit_below_nav")
    page.locator("#undoBtn").click()  # status positioning
    page.locator("#undoBtn").click()  # status binding
    page.locator("#undoBtn").click()  # status creation
    page.locator(".tool-grid [data-kind='slider']").click()
    page.locator("#properties [data-p='binding']").select_option("Internal_2")
    assert page.locator("#properties [data-p='binding']").input_value() == "Internal_2"
    assert page.locator("#diagnostics .diagnostic.error").count() == 0
    page.locator("#undoBtn").click()
    page.locator("#undoBtn").click()
    assert page.locator("#canvas .widget").count() == 1
    checks.append("internal_variables_bind_to_buttons_feedback_status_and_numeric_widgets")

    # An uploaded image must use the same pointer drag as other widgets.
    # Without preventing native <img> dragging the browser steals pointermove events.
    page.locator("#imageFile").set_input_files({
        "name": "drag-test.png",
        "mimeType": "image/png",
        "buffer": base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6M9sAAAAASUVORK5CYII=")
    })
    image_widget = page.locator("#canvas .widget.image")
    image_widget.wait_for()
    assert image_widget.locator("img").get_attribute("draggable") == "false"
    assert image_widget.locator("img").evaluate("(el) => getComputedStyle(el).pointerEvents") == "none"
    x_before = image_widget.evaluate("(el) => parseFloat(el.style.left)")
    y_before = image_widget.evaluate("(el) => parseFloat(el.style.top)")
    rect = image_widget.bounding_box()
    assert rect is not None
    px = rect["x"] + rect["width"] / 2
    py = rect["y"] + rect["height"] / 2
    page.mouse.move(px, py)
    page.mouse.down()
    page.mouse.move(px + 55, py + 35, steps=8)
    page.mouse.up()
    assert image_widget.evaluate("(el) => parseFloat(el.style.left)") >= x_before + 40
    assert image_widget.evaluate("(el) => parseFloat(el.style.top)") >= y_before + 25

    # Eight handles are visible when selected. Resize an uploaded image
    # and verify the same width/height fields can still edit its dimensions.
    assert image_widget.locator(".resize-handle").count() == 8
    width_before = image_widget.evaluate("(el) => parseFloat(el.style.width)")
    height_before = image_widget.evaluate("(el) => parseFloat(el.style.height)")
    corner = image_widget.locator(".resize-se").bounding_box()
    assert corner is not None
    cx, cy = corner["x"] + corner["width"]/2, corner["y"] + corner["height"]/2
    page.mouse.move(cx, cy)
    page.mouse.down()
    page.mouse.move(cx + 54, cy + 36, steps=8)
    page.mouse.up()
    assert image_widget.evaluate("(el) => parseFloat(el.style.width)") >= width_before + 45
    assert image_widget.evaluate("(el) => parseFloat(el.style.height)") >= height_before + 27
    assert float(page.locator("#properties [data-p='w']").input_value()) >= width_before + 45

    moved_x = image_widget.evaluate("(el) => parseFloat(el.style.left)")
    moved_y = image_widget.evaluate("(el) => parseFloat(el.style.top)")
    nw = image_widget.locator(".resize-nw").bounding_box()
    assert nw is not None
    page.mouse.move(nw["x"] + nw["width"]/2, nw["y"] + nw["height"]/2)
    page.mouse.down()
    page.mouse.move(nw["x"] + nw["width"]/2 + 25, nw["y"] + nw["height"]/2 + 20, steps=8)
    page.mouse.up()
    assert image_widget.evaluate("(el) => parseFloat(el.style.left)") >= moved_x + 18
    assert image_widget.evaluate("(el) => parseFloat(el.style.top)") >= moved_y + 14
    page.locator("#undoBtn").click()  # NW resize
    page.locator("#undoBtn").click()  # SE resize
    assert image_widget.evaluate("(el) => parseFloat(el.style.width)") == width_before
    assert image_widget.evaluate("(el) => parseFloat(el.style.height)") == height_before
    page.locator("#undoBtn").click()  # move
    assert image_widget.evaluate("(el) => parseFloat(el.style.left)") == x_before
    assert image_widget.evaluate("(el) => parseFloat(el.style.top)") == y_before
    page.locator("#undoBtn").click()  # insert
    assert page.locator("#canvas .widget.image").count() == 0
    checks.append("images_move_and_resize_from_eight_handles_with_undo")

    # Text is now one widget, with optional variable mappings and expressions.
    assert page.locator(".tool-grid [data-kind='dynamicText']").count() == 0
    page.locator(".tool-grid [data-kind='text']").click()
    text_widget = page.locator("#canvas .widget.text")
    assert text_widget.count() == 1
    assert page.locator("#properties [data-p='binding']").count() == 1
    assert page.locator("#properties [data-p='optionsText']").count() == 1
    assert page.locator("#properties [data-p='expressionText']").count() == 1
    page.locator("#properties [data-p='w']").fill("318")
    page.locator("#properties [data-p='w']").press("Tab")
    page.locator("#properties [data-p='h']").fill("82")
    page.locator("#properties [data-p='h']").press("Tab")
    assert text_widget.evaluate("(el) => parseFloat(el.style.width)") == 318
    assert text_widget.evaluate("(el) => parseFloat(el.style.height)") == 82
    # A clear field retains the original font, setting px affects the real preview.
    font_size = page.locator("#properties [data-p='fontSize']")
    assert font_size.input_value() == ""
    font_size.fill("38")
    font_size.press("Tab")
    assert font_size.input_value() == "38"
    assert text_widget.locator(".inner").evaluate("(el) => getComputedStyle(el).fontSize") == "38px"
    page.locator("#undoBtn").click()  # font size
    assert font_size.input_value() == ""
    page.locator("#undoBtn").click()  # height
    page.locator("#undoBtn").click()  # width
    page.locator("#undoBtn").click()  # insertion
    assert text_widget.count() == 0
    checks.append("unified_text_and_numeric_width_height_properties")

    # Numbers and editable numeric inputs have independent font sizes.
    page.locator(".tool-grid [data-kind='value']").click()
    value_widget = page.locator("#canvas .widget.value")
    font_size = page.locator("#properties [data-p='fontSize']")
    font_size.fill("44")
    font_size.press("Tab")
    assert value_widget.locator(".inner").evaluate("(el) => getComputedStyle(el).fontSize") == "44px"
    page.locator("#undoBtn").click()
    page.locator("#undoBtn").click()
    page.locator(".tool-grid [data-kind='input']").click()
    input_widget = page.locator("#canvas .widget.input")
    font_size = page.locator("#properties [data-p='fontSize']")
    font_size.fill("26")
    font_size.press("Tab")
    assert input_widget.locator(".inner").evaluate("(el) => getComputedStyle(el).fontSize") == "26px"
    page.locator("#undoBtn").click()
    page.locator("#undoBtn").click()
    assert page.locator("#canvas .widget").count() == 1
    checks.append("per_object_font_size_for_static_text_values_and_inputs_with_undo")

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
