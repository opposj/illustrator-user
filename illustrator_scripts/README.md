# Illustrator Text Translation Scripts

This folder contains ExtendScript entrypoints for translating selected English text in Illustrator while preserving styling and position as much as possible.

## Auto-group nearby texts

Run the auto-grouping script through the MCP debug harness to cluster nearby text objects into text-only groups. The script operates on the current selection when one exists; otherwise, it scans the entire document. The default nearness scale factor is `1.0`. By default, only texts containing at least one ASCII letter are considered for clustering.

```powershell
& 'C:\Users\User\.conda\envs\adobe-ai-mcp\python.exe' 'D:\Lab\final_thesis\illustrator-user\run_mcp_server.py' --code-file 'D:\Lab\final_thesis\illustrator-user\illustrator_scripts\auto_group_texts_headless.jsx' --auto-group-scale-factor 1.0 --auto-group-text-regex-pattern '[a-zA-Z]+'
```

Auto-grouping now clears the previous selection at the end of the run and selects only the newly formed text groups, so you no longer need a separate selection pass.

## Auto-group nearby paths and compound paths

Run the path auto-grouping script through the MCP debug harness to cluster nearby `PathItem` and `CompoundPathItem` objects into path-aware groups. The script operates on the current selection when one exists; otherwise, it scans the entire document. Compound paths are treated atomically during grouping.

```powershell
& 'C:\Users\User\.conda\envs\adobe-ai-mcp\python.exe' 'D:\Lab\final_thesis\illustrator-user\run_mcp_server.py' --code-file 'D:\Lab\final_thesis\illustrator-user\illustrator_scripts\auto_group_paths_headless.jsx' --auto-group-path-width-scale-factor 1.0 --auto-group-path-height-scale-factor 1.0 --auto-group-path-fill-color-limit '#000000'
```

Use `--auto-group-path-width-scale-factor` and `--auto-group-path-height-scale-factor` to control horizontal and vertical dilation independently before clustering.

If you only provide `--auto-group-path-scale-factor`, the legacy uniform factor is still accepted and applied to both axes.

Use `--auto-group-path-fill-color-limit` to change the fill-color prefilter; its default is `#000000`.

Use `--auto-group-path-area-range-min` and `--auto-group-path-area-range-max` to pre-filter candidate paths by bounding-box area before clustering.

Path auto-grouping only considers items whose fill color matches the configured limit and have no stroke.

## All-in-one launcher

Run `自动分组并翻译.jsx` directly from Illustrator's Scripts menu to execute a fixed pipeline without leaving Illustrator. It opens one preflight dialog for:

- Auto-group scale factor
- Auto-group text regex
- Group replacement mode

After you confirm the dialog, the script auto-groups nearby texts and then opens the selected-text translation workflow on the resulting selection.

Blank translation fields in the unified launcher default to leaving the grouped texts unchanged, so the pipeline stays consistent with the standalone replacement-style behavior.

## Interactive mode

Run the interactive GUI script through the MCP debug harness:

```powershell
& 'C:\Users\User\.conda\envs\adobe-ai-mcp\python.exe' 'D:\Lab\final_thesis\illustrator-user\run_mcp_server.py' --code-file 'D:\Lab\final_thesis\illustrator-user\illustrator_scripts\translate_selected_texts_interactive.jsx'
```

## Replace selected path groups with multiline text

Run the grouped-path replacement script through the MCP debug harness to replace each selected path-only group with a centered multiline text frame:

```powershell
& 'C:\Users\User\.conda\envs\adobe-ai-mcp\python.exe' 'D:\Lab\final_thesis\illustrator-user\run_mcp_server.py' --code-file 'D:\Lab\final_thesis\illustrator-user\illustrator_scripts\replace_selected_path_groups_interactive.jsx'
```

Each dialog row shows a compact preview, the group label, the path count, and a per-group rotation field that defaults to `0` degrees.

The dialog also includes a fit factor between `0` and `1` that limits the replacement text to `group_size * fit_factor`; it defaults to `1.0` so the text can fill the group box as much as possible.

The replacement workflow only considers selected groups whose contents resolve to path or compound-path leaves, then creates a new area-text object using the first path's appearance as the styling source.

## Find same-size items

Run the same-size finder utility through the MCP debug harness to select every Illustrator page item that matches the current selection's width and height, including the selected reference item itself:

```powershell
& 'C:\Users\User\.conda\envs\adobe-ai-mcp\python.exe' 'D:\Lab\final_thesis\illustrator-user\run_mcp_server.py' --code-file 'D:\Lab\final_thesis\illustrator-user\illustrator_scripts\find_same_size_items.jsx'
```

The script requires exactly one selected item. If nothing is selected or more than one item is selected, it raises an error.

It scans the active document, compares each other page item against the selected reference item's bounds, and then selects the items whose width and height match within a small tolerance.

## Replace selected path groups with one shared text

Run the all-in-one grouped-path replacement launcher through the MCP debug harness when you want to apply one shared replacement string and rotation to every selected path group:

```powershell
& 'C:\Users\User\.conda\envs\adobe-ai-mcp\python.exe' 'D:\Lab\final_thesis\illustrator-user\run_mcp_server.py' --code-file 'D:\Lab\final_thesis\illustrator-user\illustrator_scripts\replace_selected_path_groups_all_in_one_text.jsx'
```

This mode prompts once for the replacement text, its rotation, and a text size factor, then applies those settings to all selected path groups.

The text size factor accepts values from `0` to infinity, and it is applied after the text has been fit to the target group bounds.

## Headless mode

Run the headless script and inject a JSON translation table mapping exact English text to Chinese text:

```powershell
& 'C:\Users\User\.conda\envs\adobe-ai-mcp\python.exe' 'D:\Lab\final_thesis\illustrator-user\run_mcp_server.py' --code-file 'D:\Lab\final_thesis\illustrator-user\illustrator_scripts\translate_selected_texts_headless.jsx' --translation-table-json '{"Word1":"词1","Word2":"词2"}' --translate-selected-texts-group-replace-mode whole
```

Use `--translate-selected-texts-group-replace-mode individual` if you want grouped text to be translated item by item instead of as one multiline entry.

## LLM-assisted headless workflow

Use `translate_selected_texts_export_job.jsx` to export the current selection as a JSON job payload, hand that payload to your LLM of choice, and then apply the returned translation table with `llm_translate_selected_texts.py`.

The workflow script keeps the current Illustrator document open, validates that the returned table matches the exported job, and then calls the existing headless apply script.

Typical flow:

1. Export the job payload from Illustrator.
2. Send the exported JSON to an LLM and ask it to return only a JSON translation table.
3. Pass the generated table into `llm_translate_selected_texts.py`.

The exporter records the group replacement mode, selection order, and per-entry `translationKey` values so duplicate source strings stay distinguishable in headless mode.

## Interactive mode

The interactive translation script now asks how grouped text should be replaced before it opens the translation table. Choose between:

- `Replace grouped text as a whole`
- `Replace grouped text one by one`

## Behavior notes

- The scripts operate on the current Illustrator selection.
- Only text objects are translated.
- The scripts keep the original text attributes and attempt to restore the original frame position after replacement.
- Headless mode requires exact source-text matches in the translation table.
- The LLM-oriented workflow validates generated translation tables against exported `translationKey` values before applying them headlessly.
- Grouped translation entries can be replaced either as a whole multiline unit or one text item at a time.
- Auto-grouping uses bounding-box overlap after scaling each text object by the configured factor.
- Auto-grouping filters candidate text frames with a regex pattern before clustering; the default pattern is `[a-zA-Z]+`, which keeps texts containing at least one ASCII letter.
- Auto-grouping clears the prior selection after regrouping and selects only the newly created text groups.
- When no selection is present, auto-grouping examines all text objects in the document.
- Auto-grouped text clusters are hoisted to the nearest visible host layer when possible and then promoted to the front so they are less likely to be hidden by surrounding artwork.
- If a text object is isolated by the nearness clustering step, auto-grouping still creates a singleton text group for it and promotes it the same way as larger clusters.
- Path auto-grouping uses bounding-box overlap after scaling each atomic path item by the configured width and height factors and does not apply a secondary alignment constraint.
- Path auto-grouping can pre-filter candidate items by area when the optional area range is provided.
- Path auto-grouping only considers paths whose fill color matches the configured limit and have no stroke.
- Path auto-grouping treats `PathItem` and `CompoundPathItem` objects atomically.
