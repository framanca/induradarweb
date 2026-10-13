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

    # First opening without a saved project must not load the recipe-enabled demo.
    assert page.locator("#projectName").input_value() == "WebHMI ST"
    assert page.locator("#canvas .widget").count() == 0
    assert not page.locator("#recipeEnabled").is_checked()
    assert page.locator("#recipeSettings").is_hidden()
    assert page.locator("#addRecipe").is_disabled()
    # The demo still includes recipes, but only when selected explicitly.
    page.locator("#demoBtn").click()
    assert page.locator("#recipeEnabled").is_checked()
    assert page.locator("#addRecipe").is_enabled()
    checks.append("first_open_recipes_disabled_demo_explicitly_enables_recipes")
    # The removed NX102 banner is replaced by a live summary inside the Project tab.
    assert page.locator(".notice").count() == 0
    summary = page.locator("#projectResourceSummary")
    assert page.locator("#globalResourceSummary").count() == 0
    assert page.locator("#sidebar-panel-project #projectResourceSummary").count() == 1
    text = summary.text_content()
    assert "HTML: " in text and " / 512 KB" in text
    assert "imágenes: 0.0 / 256 KB" in text
    assert "1 pantallas · 1 alarmas · 1 recetas." in text
    checks.append("project_summary_visible_only_in_project_tab")

    def select_sidebar(tab):
        button = page.locator(f"#sidebar-tab-{tab}")
        button.click()
        assert page.locator("#globalResourceSummary").count() == 0
        assert button.get_attribute("aria-selected") == "true"
        assert page.locator(f"#sidebar-panel-{tab}").is_visible()
        assert summary.is_visible() == (tab == "project"), "Resource metrics belong only to Project"
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
    assert "1 pantallas · 0 alarmas · 0 recetas." in summary.text_content()
    checks.append("new_button_creates_empty_project")

    # Export becomes a diagnostic trigger when the project is invalid.
    assert page.locator("#exportWarningIcon").is_hidden()
    select_sidebar("elements")
    page.locator(".tool-grid [data-kind='input']").click()  # No binding: invalid.
    assert page.locator("#exportWarningIcon").is_visible()
    page.locator("#exportBtn").click()
    assert page.locator("#diagnosticsDialog").is_visible()
    assert "selecciona variable" in page.locator("#diagnostics").inner_text()
    assert page.locator("#exportBtn").get_attribute("aria-expanded") == "true"
    page.locator("#closeDiagnostics").click()
    assert page.locator("#exportBtn").get_attribute("aria-expanded") == "false"
    page.locator("#undoBtn").click()
    assert page.locator("#exportWarningIcon").is_hidden()
    select_sidebar("project")
    checks.append("export_sysmac_shows_diagnostics_only_when_invalid")

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
    assert "2 pantallas · 0 alarmas · 0 recetas." in summary.text_content()
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
    assert page.locator('#internalVarList [data-iv="1"][data-key="value"]').input_value() == "0"
    page.locator('#internalVarList [data-iv="1"][data-key="type"]').select_option("REAL")
    assert page.locator('#internalVarList [data-iv="1"][data-key="value"]').input_value() == "0"
    page.locator('#internalVarList [data-iv="1"][data-key="type"]').select_option("STRING")
    assert page.locator('#internalVarList [data-iv="1"][data-key="value"]').input_value() == ""
    page.locator('#internalVarList [data-iv="1"][data-key="type"]').select_option("BOOL")
    assert page.locator('#internalVarList [data-iv="1"][data-key="value"]').input_value() == "false"
    page.locator('#internalVarList [data-iv="1"][data-key="type"]').select_option("INT")
    page.locator('#internalVarList [data-iv="1"][data-key="value"]').fill("1")
    page.locator('#internalVarList [data-iv="1"][data-key="value"]').press("Tab")
    checks.append("internal_variable_type_change_resets_typed_default")
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
    assert status.locator("circle").get_attribute("fill") == "#86efac"
    assert status.locator("path").count() == 0
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
    assert page.locator("#properties [data-p='autoWidth']").is_checked()
    initial_text_width = text_widget.evaluate("(el) => parseFloat(el.style.width)")
    assert initial_text_width < 220
    page.locator("#properties [data-p='text']").fill("Texto más largo con ajuste automático")
    page.locator("#properties [data-p='text']").press("Tab")
    assert text_widget.evaluate("(el) => parseFloat(el.style.width)") > initial_text_width
    page.locator("#undoBtn").click()  # Restore original text while keeping auto sizing
    assert page.locator("#properties [data-p='autoWidth']").is_checked()
    page.locator("#properties [data-p='w']").fill("318")
    page.locator("#properties [data-p='w']").press("Tab")
    page.locator("#properties [data-p='h']").fill("82")
    page.locator("#properties [data-p='h']").press("Tab")
    assert text_widget.evaluate("(el) => parseFloat(el.style.width)") == 318
    assert not page.locator("#properties [data-p='autoWidth']").is_checked()
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
    checks.append("text_widget_autofits_and_manual_width_override_is_preserved")

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
    assert "1 alarmas" in summary.text_content()
    page.locator("#undoBtn").click()
    assert page.locator("#alarmEditor .editor-card").count() == alarm_count
    assert "0 alarmas" in summary.text_content()
    select_sidebar("recipes")
    assert page.locator("#addRecipe").is_disabled()
    page.locator("#recipeEnabled").check()
    recipe_count = page.locator("#recipeEditor .editor-card").count()
    assert "0 recetas." in summary.text_content()
    page.locator("#addRecipe").click()
    assert page.locator("#recipeEditor .editor-card").count() == recipe_count + 1
    assert "1 recetas." in summary.text_content()
    page.locator(f'[data-duplicate-recipe="{recipe_count}"]').click()
    assert page.locator("#recipeEditor .editor-card").count() == recipe_count + 2
    assert "2 recetas." in summary.text_content()
    assert page.locator(f'[data-recipe-name="{recipe_count + 1}"]').input_value().endswith(" (copia)")
    page.locator("#undoBtn").click()  # recipe duplication
    assert page.locator("#recipeEditor .editor-card").count() == recipe_count + 1
    assert "1 recetas." in summary.text_content()
    page.locator("#undoBtn").click()  # recipe creation
    assert page.locator("#recipeEditor .editor-card").count() == recipe_count
    assert "0 recetas." in summary.text_content()
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
    assert "1 alarmas · 1 recetas." in summary.text_content()
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
    assert "2 pantallas · 0 alarmas · 0 recetas." in summary.text_content()
    checks.append("open_button_imports_nxst_project")

    page.reload(wait_until="load")
    page.wait_for_function("document.querySelector('#saveStatus').textContent.includes('Guardado local')")
    assert page.locator("#projectName").input_value() == "Prueba de recuperación"
    assert page.locator("#canvas .widget").count() == 1
    assert "2 pantallas · 0 alarmas · 0 recetas." in page.locator("#projectResourceSummary").text_content()
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

    # Independent feedback captions follow the BOOL value (not the button action text).
    page.locator("#newBtn").click()
    select_sidebar("variables")
    page.locator("#addInternalVar").click()  # Internal_1 = false
    select_sidebar("elements")
    page.locator(".tool-grid [data-kind='button']").click()
    page.locator("#properties [data-p='binding']").select_option("Internal_1")
    page.locator("#properties [data-p='actionMode']").select_option("toggle")
    page.locator("#properties [data-p='feedbackBinding']").select_option("Internal_1")
    off_label = page.locator("#properties [data-p='feedbackTextOff']")
    off_label.fill("Arrancar")
    off_label.press("Tab")
    on_label = page.locator("#properties [data-p='feedbackTextOn']")
    on_label.fill("Parar")
    on_label.press("Tab")
    assert "Arrancar" in page.locator("#canvas .widget.button").inner_text()
    assert page.locator("#diagnostics .diagnostic.error").count() == 0
    page.locator("#previewBtn").click()
    runtime_button = page.frame_locator("#previewFrame").locator("#stage .o.button .in")
    runtime_button.wait_for()
    assert runtime_button.inner_text() == "Arrancar"
    runtime_button.click()
    page.wait_for_timeout(100)
    assert runtime_button.inner_text() == "Parar"
    runtime_button.click()
    assert runtime_button.inner_text() == "Arrancar"
    page.locator("#closePreview").click()
    checks.append("button_feedback_off_on_texts_update_from_internal_bool")

    # One "Figuras" tool; choose all five vector geometries in its properties.
    assert page.locator('.tool-grid [data-kind="shape"]').count() == 1
    assert page.locator('.tool-grid [data-kind="shape"]').inner_text() == "Figuras"
    for shape in ["rect", "ellipse", "line", "arrow", "triangle"]:
        page.locator('.tool-grid [data-kind="shape"]').click()
        widget = page.locator("#canvas .widget.shape").last
        assert page.locator("#properties [data-p='shapeType']").input_value() == "rect"
        options = page.locator("#properties [data-p='shapeType'] option")
        assert options.count() == 5
        page.locator("#properties [data-p='shapeType']").select_option(shape)
        widget = page.locator("#canvas .widget.shape").last
        assert widget.locator(".shape-visual svg").count() == 1
        assert widget.locator("img").count() == 0
        assert page.locator("#properties [data-p='shapeType']").input_value() == shape
    triangle = page.locator("#canvas .widget.shape").last
    assert triangle.locator(".shape-point").count() == 3
    points_input = page.locator("#properties [data-p='shapePoints']")
    points_input.fill("3,10 96,36 10,93")
    points_input.press("Tab")
    triangle = page.locator("#canvas .widget.shape").last
    assert "3,10 96,36 10,93" in triangle.locator("polygon").get_attribute("points")
    handle = triangle.locator('.shape-point[data-point="0"]')
    grip_box = handle.bounding_box()
    assert grip_box is not None
    px, py = grip_box["x"] + grip_box["width"]/2, grip_box["y"] + grip_box["height"]/2
    page.mouse.move(px, py)
    page.mouse.down()
    page.mouse.move(px + 18, py + 15, steps=8)
    page.mouse.up()
    changed_points = page.locator("#properties [data-p='shapePoints']").input_value()
    assert changed_points != "3,10 96,36 10,93"
    page.locator("#previewBtn").click()
    preview_shapes = page.frame_locator("#previewFrame").locator("#stage .o.shape .shape-visual svg")
    assert preview_shapes.count() == 5
    assert page.frame_locator("#previewFrame").locator("#stage .o.shape img").count() == 0
    assert page.frame_locator("#previewFrame").locator("#stage .o.shape polygon").count() >= 2
    page.locator("#closePreview").click()
    assert page.locator("#diagnostics .diagnostic.error").count() == 0
    checks.append("single_figuras_widget_selects_all_svg_shapes_and_edits_triangle_vertices")

    # Selector is temporarily absent from the toolbox. Desplegable remains usable.
    select_sidebar("elements")
    assert page.locator(".tool-grid [data-kind='selector']").count() == 0
    assert page.locator(".tool-grid [data-kind='dropdown']").count() == 1
    page.locator("#newBtn").click()
    select_sidebar("variables")
    page.locator("#addInternalVar").click()
    page.locator('#internalVarList [data-iv="0"][data-key="type"]').select_option("INT")
    page.locator('#internalVarList [data-iv="0"][data-key="value"]').fill("1")
    page.locator('#internalVarList [data-iv="0"][data-key="value"]').press("Tab")
    select_sidebar("elements")
    page.locator(".tool-grid [data-kind='dropdown']").click()
    page.locator("#properties [data-p='binding']").select_option("Internal_1")
    opts = page.locator("#properties [data-p='optionsText']")
    opts.fill("0=Parado\n1=Manual\n2=Automático")
    opts.press("Tab")
    assert page.locator("#diagnostics .diagnostic.error").count() == 0
    page.locator("#previewBtn").click()
    dropdown = page.frame_locator("#previewFrame").locator("#stage .o.dropdown select")
    dropdown.wait_for()
    assert dropdown.locator("option").count() == 3
    assert dropdown.input_value() == "1"
    dropdown.select_option("2")
    assert dropdown.input_value() == "2"
    assert page.frame_locator("#previewFrame").locator("#stage .o.selector").count() == 0
    page.locator("#closePreview").click()
    checks.append("unused_selector_hidden_and_dropdown_still_changes_internal_variable")


    # No automatic type-name captions; the switch is the one control that explicitly
    # displays its configured text above the ON/OFF control.
    # Standalone Text, command-button captions and the counter's target remain visible.
    page.locator("#newBtn").click()
    select_sidebar("variables")
    page.locator("#addInternalVar").click()  # Internal_1 BOOL
    page.locator("#addInternalVar").click()  # Internal_2 BOOL -> INT
    page.locator('#internalVarList [data-iv="1"][data-key="type"]').select_option("INT")
    page.locator('#internalVarList [data-iv="1"][data-key="value"]').fill("1")
    page.locator('#internalVarList [data-iv="1"][data-key="value"]').press("Tab")
    select_sidebar("elements")
    without_header = [
        ("status", "Internal_1", "Estado"),
        ("tank", "Internal_2", "Depósito"),
        ("value", "Internal_2", "Producción"),
        ("input", "Internal_2", "Entrada"),
        ("slider", "Internal_2", "Ajuste"),
        ("switch", "Internal_1", "Interruptor"),
        ("selector", "Internal_2", "Selector manual"),
        ("multistate", "Internal_2", "Estado de modo"),
        ("gauge", "Internal_2", "Indicador"),
        ("stepper", "Internal_2", "Ajuste +/-"),
        ("counter", "Internal_2", "Contador"),
        ("dropdown", "Internal_2", "Opciones"),
        ("bar", "Internal_2", "Barra"),
        ("text", None, "Texto visible"),
        ("button", "Internal_1", "Accionar"),
    ]
    for kind, binding, label in without_header:
        page.locator(f'.tool-grid [data-kind="{kind}"]').click()
        if binding:
            page.locator("#properties [data-p='binding']").select_option(binding)
        field = page.locator("#properties [data-p='text']")
        field.fill(label)
        field.press("Tab")
        assert page.locator("#properties [data-p='text']").input_value() == label
    assert page.locator("#diagnostics .diagnostic.error").count() == 0
    page.locator("#previewBtn").click()
    stage = page.frame_locator("#previewFrame").locator("#stage")
    assert stage.locator(".o").count() == len(without_header)
    assert stage.locator(".o > .label").count() == 0
    assert stage.locator(".o.status .caption").count() == 0
    assert stage.locator(".o.tank .caption").count() == 0
    assert stage.locator(".o:not(.counter):not(.switch) .control-panel > .caption").count() == 0
    assert stage.locator(".o.switch .switch-title").inner_text() == "Interruptor"
    assert stage.locator(".o.switch .switch-title").bounding_box()["y"] < stage.locator(".o.switch .switch-button").bounding_box()["y"]
    assert stage.locator(".o.status .status-visual svg").count() == 1
    assert stage.locator(".o.tank .symbol .level").count() == 1
    assert stage.locator(".o.value .in").inner_text() == "1"
    assert stage.locator(".o.input input").count() == 1
    assert stage.locator(".o.stepper .controls button").count() == 2
    assert "Objetivo: 100" in stage.locator(".o.counter .caption").inner_text()
    assert stage.locator(".o.text .in").inner_text() == "Texto visible"
    assert stage.locator(".o.button .in").inner_text() == "Accionar"
    assert stage.locator(".o.multistate .reading").inner_text() == "Manual"
    page.locator("#closePreview").click()
    # Clearing labels in Properties never falls back to widget names in the editor.
    for kind in ("status", "tank", "selector", "value", "input", "switch",
                 "multistate", "gauge", "stepper", "counter", "dropdown",
                 "bar", "text", "button"):
        widget = page.locator("#canvas .widget." + kind)
        page.locator("#layerSelect").select_option(widget.get_attribute("data-id"))
        field = page.locator("#properties [data-p='text']")
        field.fill("")
        field.press("Tab")
        assert field.input_value() == "", kind
        updated = page.locator("#canvas .widget." + kind)
        if kind == "status":
            assert updated.locator(".caption").inner_text() == ""
        elif kind == "tank":
            assert updated.locator(".caption").inner_text() == ""
        elif kind == "selector":
            assert updated.locator(".selector-mock-title").count() == 0
        elif kind == "switch":
            assert updated.locator(".switch-preview-label").count() == 0
            assert "OFF / ON" in updated.inner_text()
        elif kind in ("text", "value", "input"):
            assert updated.locator(".inner").inner_text() == "", kind
        elif kind == "button":
            assert updated.locator(".inner").inner_text() == ""
        else:
            assert updated.locator(".inner strong").count() == 0, kind
    assert page.locator("#diagnostics .diagnostic.error").count() == 0
    page.locator("#previewBtn").click()
    assert stage.locator(".o.switch .switch-title").count() == 0
    assert stage.locator(".o.switch .switch-button").count() == 1
    assert stage.locator(".o.text .in").inner_text() == ""
    assert stage.locator(".o.status .caption").count() == 0
    assert stage.locator(".o.tank .caption").count() == 0
    assert stage.locator(".o.selector .caption").count() == 0
    assert stage.locator(".o.button .in").inner_text() == ""
    page.locator("#closePreview").click()
    checks.append("empty_widget_text_hides_type_defaults_and_switch_caption_is_above_control")


    # Lamp stays a single SVG circle and its ON fill comes from Properties.
    # Overlapping objects are reordered in-place and can be picked when obscured.
    page.locator("#newBtn").click()
    select_sidebar("variables")
    page.locator("#addInternalVar").click()
    page.locator('#internalVarList [data-iv="0"][data-key="value"]').fill("true")
    page.locator('#internalVarList [data-iv="0"][data-key="value"]').press("Tab")
    select_sidebar("elements")
    page.locator('.tool-grid [data-kind="text"]').click()
    page.locator("#properties [data-p='text']").fill("Capa Fondo")
    page.locator("#properties [data-p='text']").press("Tab")
    page.locator('.tool-grid [data-kind="shape"]').click()
    page.locator("#properties [data-p='text']").fill("Capa Figura")
    page.locator("#properties [data-p='text']").press("Tab")
    page.locator('.tool-grid [data-kind="status"]').click()
    page.locator("#properties [data-p='binding']").select_option("Internal_1")
    assert page.locator("#properties [data-p='symbolType']").input_value() == "lamp"
    assert page.locator("#properties [data-p='lampOnColor']").count() == 1
    page.locator("#properties [data-p='lampOnColor']").evaluate("""el => {
      el.value='#ff5500';el.dispatchEvent(new Event('change',{bubbles:true}));
    }""")
    assert page.locator("#properties .state-pair > div").count() == 2
    assert page.locator("#properties .state-pair > div").last.locator("circle").get_attribute("fill") == "#ff5500"
    assert page.locator("#properties .state-pair path").count() == 0
    all_widgets=page.locator("#canvas .widget")
    initial=all_widgets.evaluate_all("(els) => els.map(e=>e.dataset.id)")
    assert all_widgets.count() == 3
    assert all_widgets.evaluate_all("(els) => els.map(e=>e.classList[1])") == ["text","shape","status"]
    # The oldest element is underneath the lamp. Select it from the Layers dropdown.
    page.locator("#layerSelect").select_option(initial[0])
    assert page.locator("#properties [data-p='text']").input_value() == "Capa Fondo"
    assert page.locator("#bringToFront").is_enabled()
    page.locator("#bringToFront").click()
    assert all_widgets.evaluate_all("(els) => els.map(e=>e.dataset.id)") == [initial[1], initial[2], initial[0]]
    assert page.locator("#bringToFront").is_disabled()
    page.locator("#sendToBack").click()
    assert all_widgets.evaluate_all("(els) => els.map(e=>e.dataset.id)") == initial
    page.locator("#undoBtn").click()
    assert all_widgets.evaluate_all("(els) => els.map(e=>e.dataset.id)") == [initial[1], initial[2], initial[0]]
    page.locator("#redoBtn").click()
    assert all_widgets.evaluate_all("(els) => els.map(e=>e.dataset.id)") == initial
    # The right-click menu offers exactly the same action on the foremost lamp.
    page.locator("#canvas .widget.status").click(button="right")
    assert page.locator("#widgetMenu").is_visible()
    assert page.locator('#widgetMenu [data-widget-action="front"]').is_disabled()
    page.locator('#widgetMenu [data-widget-action="back"]').click()
    assert all_widgets.evaluate_all("(els) => els.map(e=>e.dataset.id)") == [initial[2], initial[0], initial[1]]
    page.locator("#previewBtn").click()
    lamp=page.frame_locator("#previewFrame").locator("#stage .o.status .status-visual svg")
    lamp.wait_for()
    assert lamp.locator("circle").get_attribute("fill") == "#ff5500"
    assert lamp.locator("path").count() == 0
    assert page.frame_locator("#previewFrame").locator("#stage .o").evaluate_all("(els) => els.map(e=>e.classList[1])") == ["status","text","shape"]
    page.locator("#closePreview").click()
    # Context menu must delete the right-clicked widget through the same safeguarded
    # action as Properties > Delete, and Undo must recover it.
    current_ids = all_widgets.evaluate_all("(els) => els.map(e=>e.dataset.id)")
    page.locator("#canvas .widget.shape").click(button="right")
    assert page.locator("#widgetMenu").is_visible()
    assert page.locator('#widgetMenu [data-widget-action="delete"]').is_visible()
    page.locator('#widgetMenu [data-widget-action="delete"]').click()
    assert all_widgets.count() == 2
    assert all_widgets.evaluate_all("(els) => els.map(e=>e.dataset.id)") == [x for x in current_ids if x != initial[1]]
    assert page.locator("#widgetMenu").is_hidden()
    page.locator("#undoBtn").click()
    assert all_widgets.evaluate_all("(els) => els.map(e=>e.dataset.id)") == current_ids
    page.locator("#redoBtn").click()
    assert all_widgets.count() == 2
    page.locator("#undoBtn").click()
    assert all_widgets.count() == 3
    checks.append("context_menu_delete_uses_safeguard_and_is_undo_redo_safe")
    checks.append("lamp_custom_on_color_no_rays_and_layer_order_undo_redo_preview")


    # A local BOOL and INT alarm can trigger and be acknowledged with no PLC snapshot.
    # Acknowledge must reset after the condition clears and reappears.
    page.locator("#newBtn").click()
    select_sidebar("variables")
    page.locator("#addInternalVar").click()  # Internal_1 BOOL starts FALSE
    page.locator("#addInternalVar").click()  # Internal_2 INT starts at 12
    page.locator('#internalVarList [data-iv="1"][data-key="type"]').select_option("INT")
    page.locator('#internalVarList [data-iv="1"][data-key="value"]').fill("12")
    page.locator('#internalVarList [data-iv="1"][data-key="value"]').press("Tab")
    select_sidebar("alarms")
    page.locator("#addAlarm").click()
    assert page.locator('#alarmEditor [data-alarm="0"][data-k="binding"]').input_value() == "Internal_1"
    opts = page.locator('#alarmEditor [data-alarm="0"][data-k="binding"] option')
    assert opts.filter(has_text="Internal_1").count() == 1
    assert opts.filter(has_text="Internal_2").count() == 1
    page.locator('#alarmEditor [data-alarm="0"][data-k="name"]').fill("Aviso operador")
    page.locator('#alarmEditor [data-alarm="0"][data-k="name"]').press("Tab")
    page.locator("#addAlarm").click()
    page.locator('#alarmEditor [data-alarm="1"][data-k="binding"]').select_option("Internal_2")
    page.locator('#alarmEditor [data-alarm="1"][data-k="operator"]').select_option("ge")
    page.locator('#alarmEditor [data-alarm="1"][data-k="value"]').fill("10")
    page.locator('#alarmEditor [data-alarm="1"][data-k="value"]').press("Tab")
    page.locator('#alarmEditor [data-alarm="1"][data-k="name"]').fill("Producción elevada")
    page.locator('#alarmEditor [data-alarm="1"][data-k="name"]').press("Tab")
    select_sidebar("elements")
    page.locator('.tool-grid [data-kind="button"]').click()
    page.locator("#properties [data-p='binding']").select_option("Internal_1")
    page.locator("#properties [data-p='actionMode']").select_option("toggle")
    page.locator("#properties [data-p='text']").fill("Conmutar aviso")
    page.locator("#properties [data-p='text']").press("Tab")
    page.locator('.tool-grid [data-kind="input"]').click()
    page.locator("#properties [data-p='binding']").select_option("Internal_2")
    page.locator("#properties [data-p='x']").fill("320")
    page.locator("#properties [data-p='x']").press("Tab")
    assert page.locator("#diagnostics .diagnostic.error").count() == 0
    page.locator("#previewBtn").click()
    preview_frame = page.frame_locator("#previewFrame")
    assert preview_frame.locator("#nav").evaluate("""(el) => [
        ...el.querySelectorAll('#recipeOpen,#alarmOpen,#alarmbar')
    ].map(e=>e.id)""") == ["alarmOpen", "alarmbar"]
    alarm_button = preview_frame.locator("#alarmOpen")
    alarm_button.wait_for()
    assert page.frame_locator("#previewFrame").locator("#alarmCount").inner_text() == "1"
    alarm_button.click()
    entries = page.frame_locator("#previewFrame").locator("#alarmList .alarm-row")
    assert entries.count() == 2
    assert all("[HMI local]" in row for row in entries.locator("strong").all_inner_texts())
    ack_all = page.frame_locator("#previewFrame").locator("#ackAll")
    assert ack_all.is_enabled()  # local alarm works even when PLC is offline
    ack_all.click()
    assert page.frame_locator("#previewFrame").locator("#alarmCount").inner_text() == "0"
    page.frame_locator("#previewFrame").locator("#alarmClose").click()
    local_button = page.frame_locator("#previewFrame").locator("#stage .o.button .in")
    local_button.click()
    assert page.frame_locator("#previewFrame").locator("#alarmCount").inner_text() == "1"
    alarm_button.click()
    entry = entries.filter(has_text="Aviso operador")
    assert "ACTIVA PENDIENTE" in entry.inner_text()
    entry.locator(".ack-one").click()
    assert page.frame_locator("#previewFrame").locator("#alarmCount").inner_text() == "0"
    page.frame_locator("#previewFrame").locator("#alarmClose").click()
    local_button.click()  # clear condition: recognition resets
    alarm_button.click()
    assert "Normal" in entry.inner_text()
    page.frame_locator("#previewFrame").locator("#alarmClose").click()
    local_button.click()  # new occurrence: unacknowledged again
    assert page.frame_locator("#previewFrame").locator("#alarmCount").inner_text() == "1"
    value_input = page.frame_locator("#previewFrame").locator("#stage .o.input input")
    assert page.frame_locator("#previewFrame").locator("#stage .o.input button").count() == 0
    value_input.fill("4")
    value_input.press("Enter")
    alarm_button.click()
    assert "Normal" in entries.filter(has_text="Producción elevada").inner_text()
    page.frame_locator("#previewFrame").locator("#alarmClose").click()
    value_input.fill("14")
    value_input.press("Enter")
    assert page.frame_locator("#previewFrame").locator("#alarmCount").inner_text() == "2"
    page.locator("#closePreview").click()
    checks.append("hmi_internal_alarms_bool_int_offline_ack_all_reset_and_retrigger")


    # Recipes are optional. Without them the generated runtime has no recipe UI.
    page.locator("#newBtn").click()
    select_sidebar("recipes")
    assert not page.locator("#recipeEnabled").is_checked()
    assert page.locator("#recipeSettings").is_hidden()
    assert page.locator("#addRecipe").is_disabled()
    page.locator("#previewBtn").click()
    recipe_frame = page.frame_locator("#previewFrame")
    assert recipe_frame.locator("#recipeOpen").count() == 0
    assert recipe_frame.locator("#recipeWindow").count() == 0
    page.locator("#closePreview").click()

    # Enabling recipes creates only NX Retain recipes, even for internal HMI fields.
    page.locator("#recipeEnabled").check()
    assert page.locator("#recipeSettings").is_visible()
    page.locator("#recipeSlots").fill("3")
    page.locator("#recipeSlots").press("Tab")
    page.locator("#recipeBytes").fill("180")
    page.locator("#recipeBytes").press("Tab")
    select_sidebar("variables")
    page.locator("#addInternalVar").click()
    page.locator('#internalVarList [data-iv="0"][data-key="type"]').select_option("INT")
    page.locator("#addInternalVar").click()
    select_sidebar("recipes")
    assert page.locator("#recipeVariableEditor").count() == 0
    assert page.locator("#recipeCapacitySummary").is_visible()
    page.locator("#addRecipe").click()
    assert page.locator('[data-recipe-scope="0"]').count() == 0
    assert "Memoria Retain NX" in page.locator("#recipeEditor").inner_text()
    page.locator('[data-recipe-name="0"]').fill("Nivel inicial")
    page.locator('[data-recipe-name="0"]').press("Tab")
    page.locator('[data-recipe-toggle="0"][data-name="Internal_1"]').check()
    page.locator('[data-recipe-value="0"][data-name="Internal_1"]').fill("7")
    page.locator('[data-recipe-value="0"][data-name="Internal_1"]').press("Tab")
    assert "1 / 20 variables" in page.locator('[data-recipe-capacity="0"]').inner_text()
    assert "1 / 3" in page.locator("#recipeCapacitySummary").inner_text()
    assert "180 bytes" in page.locator("#recipeCapacitySummary").inner_text()
    assert page.locator("#diagnostics .diagnostic.error").count() == 0
    page.locator("#previewBtn").click()
    recipe_frame.locator("#recipeOpen").click()
    assert recipe_frame.locator("#recipeWindow").is_visible()
    assert recipe_frame.locator("#recipeScope").count() == 0
    assert "Nivel inicial" in recipe_frame.locator("#recipeSelect").inner_text()
    assert recipe_frame.locator('[data-recipe-included="Internal_2"]').count() == 1
    recipe_frame.locator("#recipeNew").click()
    assert "Nueva receta" in recipe_frame.locator("#recipeName").input_value()
    recipe_frame.locator('[data-recipe-included="Internal_1"]').check()
    recipe_frame.locator("#recipeSave").click()
    assert "Conecta con el NX" in recipe_frame.locator("#recipeMessage").inner_text() or "NX sin" in recipe_frame.locator("#recipeMessage").inner_text()
    page.locator("#closePreview").click()
    checks.append("optional_nx_only_recipe_bank_capacity_and_disabled_runtime")

    # Shared recipes: mock the NX's Retain bank and verify CAS save, stale
    # revisions, refresh conflict recovery, and blocking stale application.
    from urllib.parse import urlsplit, parse_qs
    shared_bank = {
        1: {"rev": 1, "data": json.dumps({
            "id": "initial", "name": "Formato compartido",
            "values": {"SpeedPLC": 60}
        }, ensure_ascii=True)}
    }
    shared_calls = []
    def mock_recipe_bank(route):
        request = route.request
        parsed = urlsplit(request.url)
        shared_calls.append((request.method, parsed.path, parsed.query))
        if parsed.path == "/api/recipes":
            rows = ["RCPV=1"] + [f"{i}={shared_bank.get(i, {'rev': 0})['rev']}" for i in range(1, 4)]
            route.fulfill(status=200, body="\n".join(rows)+"\n", content_type="text/plain")
            return
        if parsed.path == "/api/recipe":
            params = parse_qs(parsed.query)
            slot = int(params.get("slot", ["0"])[0])
            if slot < 1 or slot > 3:
                route.fulfill(status=400, body="BAD SLOT")
                return
            entry = shared_bank.get(slot, {"rev": 0, "data": ""})
            if request.method == "GET":
                route.fulfill(status=200, body=entry["data"], content_type="application/json")
                return
            expected = int(params.get("rev", ["-1"])[0])
            if expected != entry["rev"]:
                route.fulfill(status=409, body="CONFLICT REV="+str(entry["rev"]))
                return
            entry = {"rev": expected+1, "data": request.post_data or ""}
            shared_bank[slot] = entry
            route.fulfill(status=200, body="REV="+str(entry["rev"]))
            return
        route.continue_()
    page.route("**/api/recipe*", mock_recipe_bank)
    page.locator("#newBtn").click()
    select_sidebar("variables")
    page.locator("#pasteBtn").click()
    page.locator("#pasteText").fill("Name,Data Type\nSpeedPLC,INT\n")
    page.locator("#pasteImport").click()
    page.locator('#varList [data-acc="0"]').select_option("RW")
    select_sidebar("recipes")
    page.locator("#recipeEnabled").check()
    page.locator("#recipeSlots").fill("3")
    page.locator("#recipeSlots").press("Tab")
    page.locator("#recipeBytes").fill("180")
    page.locator("#recipeBytes").press("Tab")
    page.locator("#addRecipe").click()
    assert page.locator('[data-recipe-scope="0"]').count() == 0
    page.locator('[data-recipe-name="0"]').fill("Formato compartido")
    page.locator('[data-recipe-name="0"]').press("Tab")
    page.locator('[data-recipe-toggle="0"][data-name="SpeedPLC"]').check()
    page.locator('[data-recipe-value="0"][data-name="SpeedPLC"]').fill("60")
    page.locator('[data-recipe-value="0"][data-name="SpeedPLC"]').press("Tab")
    assert "1 / 20 variables" in page.locator('[data-recipe-capacity="0"]').inner_text()
    assert page.locator("#diagnostics .diagnostic.error").count() == 0
    page.locator("#previewBtn").click()
    shared_frame = page.frame_locator("#previewFrame")
    shared_frame.locator("#recipeOpen").click()
    shared_frame.locator("#recipeSelect option").first.wait_for(state="attached")
    page.wait_for_function("""() => {
      const d = document.getElementById('previewFrame').contentDocument;
      return d?.getElementById('recipeMessage')?.textContent.includes('actualizadas desde NX');
    }""")
    assert "Formato compartido" in shared_frame.locator("#recipeSelect").inner_text()
    shared_frame.locator("#recipeName").fill("Formato actualizado")
    shared_frame.locator("#recipeSave").click()
    page.wait_for_function("""() => {
      const d = document.getElementById('previewFrame').contentDocument;
      return d?.getElementById('recipeMessage')?.textContent.includes('Receta guardada');
    }""")
    assert shared_bank[1]["rev"] == 2
    assert json.loads(shared_bank[1]["data"])["name"] == "Formato actualizado"
    # Another terminal saves a newer revision while this preview still has rev=2.
    shared_bank[1]["rev"] = 3
    shared_frame.locator("#recipeName").fill("No pisar edición")
    shared_frame.locator("#recipeSave").click()
    page.wait_for_function("""() => {
      const d = document.getElementById('previewFrame').contentDocument;
      return d?.getElementById('recipeMessage')?.textContent.includes('Conflicto');
    }""")
    assert json.loads(shared_bank[1]["data"])["name"] == "Formato actualizado"
    assert shared_frame.locator("#recipeName").input_value() == "No pisar edición"
    # Discard and reload, then change the remote revision again: apply must
    # fail before writing even though PLC communication is notionally online.
    shared_frame.locator("#recipeRefresh").click()
    page.wait_for_function("""() => {
      const d = document.getElementById('previewFrame').contentDocument;
      return d?.getElementById('recipeMessage')?.textContent.includes('actualizadas desde NX');
    }""")
    assert shared_frame.locator("#recipeName").input_value() == "Formato actualizado"
    shared_bank[1]["rev"] = 4
    shared_frame.locator("#recipeApply").click()
    page.wait_for_function("""() => {
      const d = document.getElementById('previewFrame').contentDocument;
      return d?.getElementById('recipeMessage')?.textContent.includes('bloqueada');
    }""")
    assert not any("/api/write" in call[1] for call in shared_calls)
    page.locator("#closePreview").click()
    page.unroute("**/api/recipe*", mock_recipe_bank)
    checks.append("shared_recipe_bank_cas_conflict_preserved_draft_refresh_and_stale_apply_block")

    # WebHMI virtual keyboards: touchscreen use without physical keyboard,
    # no write on typing/cancel, numeric validation, and STRING alpha keyboard.
    page.locator("#newBtn").click()
    select_sidebar("project")
    assert page.locator("#keyboardMode").input_value() == "auto"
    page.locator("#keyboardMode").select_option("webhmi")
    select_sidebar("variables")
    page.locator("#addInternalVar").click()
    page.locator("#addInternalVar").click()
    page.locator('#internalVarList [data-iv="0"][data-key="type"]').select_option("INT")
    page.locator('#internalVarList [data-iv="1"][data-key="type"]').select_option("STRING")
    select_sidebar("elements")
    page.locator('.tool-grid [data-kind="input"]').click()
    page.locator("#properties [data-p='binding']").select_option("Internal_1")
    page.locator("#properties [data-p='x']").fill("60")
    page.locator("#properties [data-p='x']").press("Tab")
    page.locator('.tool-grid [data-kind="input"]').click()
    page.locator("#properties [data-p='binding']").select_option("Internal_2")
    page.locator("#properties [data-p='x']").fill("370")
    page.locator("#properties [data-p='x']").press("Tab")
    assert page.locator("#diagnostics .diagnostic.error").count() == 0
    page.locator("#previewBtn").click()
    kb_frame = page.frame_locator("#previewFrame")
    entries = kb_frame.locator("#stage .o.input input")
    assert entries.count() == 2
    assert entries.nth(0).get_attribute("readonly") is not None
    assert entries.nth(1).get_attribute("readonly") is not None
    assert kb_frame.locator("#virtualKeyboard").is_hidden()
    entries.nth(0).click()
    assert kb_frame.locator("#virtualKeyboard").is_visible()
    assert "numeric" in kb_frame.locator("#vkKeys").get_attribute("class")
    kb_frame.locator("#vkKeys button").get_by_text("7", exact=True).click()
    assert kb_frame.locator("#vkValue").input_value() == "7"
    assert entries.nth(0).input_value() == "0"  # Not committed during typing
    kb_frame.locator("#vkCancel").click()
    assert kb_frame.locator("#virtualKeyboard").is_hidden()
    assert entries.nth(0).input_value() == "0"  # Cancel discards everything
    entries.nth(0).click()
    kb_frame.locator("#vkValue").fill("not-a-number")
    kb_frame.locator("#vkAccept").click()
    assert kb_frame.locator("#virtualKeyboard").is_visible()
    assert "Formato numérico" in kb_frame.locator("#vkError").inner_text()
    kb_frame.locator("#vkValue").fill("25")
    kb_frame.locator("#vkAccept").click()
    assert kb_frame.locator("#virtualKeyboard").is_hidden()
    assert entries.nth(0).input_value() == "25"
    original_string = entries.nth(1).input_value()
    entries.nth(1).click()
    assert "numeric" not in kb_frame.locator("#vkKeys").get_attribute("class")
    kb_frame.locator("#vkKeys button").get_by_text("A", exact=True).click()
    kb_frame.locator("#vkKeys button").get_by_text("B", exact=True).click()
    assert kb_frame.locator("#vkValue").input_value() == "AB"
    assert entries.nth(1).input_value() == original_string
    kb_frame.locator("#vkAccept").click()
    assert entries.nth(1).input_value() == "AB"
    assert kb_frame.locator("#recipeOpen").count() == 0
    page.locator("#closePreview").click()
    select_sidebar("recipes")
    page.locator("#recipeEnabled").check()
    page.locator("#previewBtn").click()
    kb_frame.locator("#recipeOpen").click()
    kb_frame.locator("#recipeNew").click()
    kb_frame.locator("#recipeName").click()
    assert kb_frame.locator("#virtualKeyboard").is_visible()
    kb_frame.locator("#vkValue").fill("Lote 1")
    kb_frame.locator("#vkAccept").click()
    assert kb_frame.locator("#recipeName").input_value() == "Lote 1"
    page.locator("#closePreview").click()
    select_sidebar("project")
    assert page.locator("#keyboardMode").input_value() == "webhmi"
    checks.append("virtual_keyboards_numeric_alpha_cancel_accept_validation_recipe_and_project_config")

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
