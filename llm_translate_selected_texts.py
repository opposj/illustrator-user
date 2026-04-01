#!/usr/bin/env python3
"""LLM-oriented selected-text translation workflow for Illustrator.

This workflow exports the current Illustrator selection as a JSON job payload,
expects an external LLM step to produce a translation table, validates the
result, and then applies it through the existing headless translation script.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parent
DEFAULT_PYTHON = r"C:\Users\User\.conda\envs\adobe-ai-mcp\python.exe"
DEFAULT_EXPORT_SCRIPT = REPO_ROOT / "illustrator_scripts" / "translate_selected_texts_export_job.jsx"
DEFAULT_HEADLESS_SCRIPT = REPO_ROOT / "illustrator_scripts" / "translate_selected_texts_headless.jsx"
DEFAULT_MCP_SERVER = REPO_ROOT / "run_mcp_server.py"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export an Illustrator translation job, validate an LLM translation table, and apply it headlessly."
    )
    parser.add_argument(
        "--python",
        default=DEFAULT_PYTHON,
        help="Python executable used to launch the Illustrator MCP debug harness.",
    )
    parser.add_argument(
        "--run-mcp-server",
        default=str(DEFAULT_MCP_SERVER),
        help="Path to run_mcp_server.py.",
    )
    parser.add_argument(
        "--export-script",
        default=str(DEFAULT_EXPORT_SCRIPT),
        help="Path to the JSX script that exports the selected-text job payload.",
    )
    parser.add_argument(
        "--headless-script",
        default=str(DEFAULT_HEADLESS_SCRIPT),
        help="Path to the JSX script that applies a translation table headlessly.",
    )
    parser.add_argument(
        "--job-output-file",
        help="Optional path where the exporter should write the job JSON payload.",
    )
    parser.add_argument(
        "--translation-table-file",
        help="Path to a JSON file containing the LLM-generated translation table.",
    )
    parser.add_argument(
        "--translation-table-json",
        help="Inline JSON object containing the LLM-generated translation table.",
    )
    parser.add_argument(
        "--replace-mode",
        default="whole",
        help="Grouped translation mode to use for both export and apply steps (whole or individual).",
    )
    parser.add_argument(
        "--empty-entry-action",
        choices=["leave", "delete"],
        help="Optional policy for blank translations during the apply step.",
    )
    parser.add_argument(
        "--keep-job-file",
        action="store_true",
        help="Keep the temporary exported job file instead of deleting it after use.",
    )
    return parser.parse_args()


def load_json_file(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def dump_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def ensure_object(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be a JSON object.")
    return value


def collect_expected_keys(job: dict[str, Any]) -> list[str]:
    entries = job.get("entries")
    if not isinstance(entries, list):
        raise ValueError("Job payload must include an entries array.")

    keys: list[str] = []
    for entry in entries:
        if not isinstance(entry, dict):
            raise ValueError("Each job entry must be a JSON object.")
        key = entry.get("translationKey")
        if not isinstance(key, str) or not key:
            raise ValueError("Each job entry must include a non-empty translationKey string.")
        keys.append(key)
    return keys


def build_translation_table_for_apply(job: dict[str, Any], raw_table: dict[str, Any]) -> dict[str, str]:
    expected_keys = collect_expected_keys(job)
    expected_key_set = set(expected_keys)
    raw_keys = list(raw_table.keys())
    raw_key_set = set(raw_keys)

    if raw_key_set == expected_key_set:
        return {str(key): str(raw_table[key]) for key in expected_keys}

    entries = job.get("entries", [])
    original_to_key: dict[str, str] = {}
    duplicates: set[str] = set()

    for entry in entries:
        original_text = entry.get("originalText")
        translation_key = entry.get("translationKey")
        if not isinstance(original_text, str) or not isinstance(translation_key, str):
            continue
        if original_text in original_to_key:
            duplicates.add(original_text)
        else:
            original_to_key[original_text] = translation_key

    if duplicates:
        duplicate_list = ", ".join(sorted(duplicates))
        raise ValueError(
            "The translation table must be keyed by translationKey because the job contains duplicate source strings: "
            + duplicate_list
        )

    if raw_key_set == set(original_to_key.keys()):
        converted: dict[str, str] = {}
        for original_text, translation_key in original_to_key.items():
            converted[translation_key] = str(raw_table[original_text])
        return converted

    missing = sorted(expected_key_set - raw_key_set)
    unexpected = sorted(raw_key_set - expected_key_set)
    message_parts: list[str] = []
    if missing:
        message_parts.append("missing keys: " + ", ".join(missing))
    if unexpected:
        message_parts.append("unexpected keys: " + ", ".join(unexpected))
    raise ValueError(
        "Translation table keys do not match the exported job. " + "; ".join(message_parts)
    )


def run_mcp_script(python_executable: str, run_mcp_server: str, script_path: str, runtime_globals: dict[str, Any]) -> None:
    command = [
        python_executable,
        run_mcp_server,
        "--code-file",
        script_path,
    ]

    if runtime_globals:
        command.extend(["--runtime-globals-json", dump_json(runtime_globals)])

    completed = subprocess.run(command, check=False, capture_output=True, text=True)
    if completed.returncode != 0:
        raise RuntimeError(
            "Illustrator MCP command failed.\nSTDOUT:\n"
            + completed.stdout
            + "\nSTDERR:\n"
            + completed.stderr
        )


def export_job(args: argparse.Namespace, job_file: Path) -> dict[str, Any]:
    runtime_globals = {
        "TRANSLATE_SELECTED_TEXTS_GROUP_REPLACE_MODE": args.replace_mode,
        "TRANSLATE_SELECTED_TEXTS_JOB_OUTPUT_PATH": str(job_file),
    }

    run_mcp_script(args.python, args.run_mcp_server, args.export_script, runtime_globals)
    return load_json_file(job_file)


def apply_translation(args: argparse.Namespace, translation_table: dict[str, str]) -> None:
    runtime_globals: dict[str, Any] = {}
    if args.empty_entry_action:
        runtime_globals["TRANSLATE_SELECTED_TEXTS_EMPTY_ENTRY_ACTION"] = args.empty_entry_action

    command = [
        args.python,
        args.run_mcp_server,
        "--code-file",
        args.headless_script,
        "--translation-table-json",
        dump_json(translation_table),
        "--translate-selected-texts-group-replace-mode",
        args.replace_mode,
    ]

    if runtime_globals:
        command.extend(["--runtime-globals-json", dump_json(runtime_globals)])

    completed = subprocess.run(command, check=False, capture_output=True, text=True)
    if completed.returncode != 0:
        raise RuntimeError(
            "Illustrator translation apply step failed.\nSTDOUT:\n"
            + completed.stdout
            + "\nSTDERR:\n"
            + completed.stderr
        )


def main() -> int:
    args = parse_args()

    job_path = Path(args.job_output_file) if args.job_output_file else Path(tempfile.gettempdir()) / "translate_selected_texts_job.json"
    job = export_job(args, job_path)

    if args.translation_table_file:
        raw_table = ensure_object(load_json_file(Path(args.translation_table_file)), "Translation table")
    elif args.translation_table_json:
        raw_table = ensure_object(json.loads(args.translation_table_json), "Translation table")
    else:
        print(dump_json(job))
        if not args.keep_job_file and args.job_output_file is None:
            try:
                job_path.unlink(missing_ok=True)  # type: ignore[attr-defined]
            except AttributeError:
                if job_path.exists():
                    job_path.unlink()
        return 0

    translation_table = build_translation_table_for_apply(job, raw_table)
    apply_translation(args, translation_table)

    if not args.keep_job_file and args.job_output_file is None:
        try:
            job_path.unlink(missing_ok=True)  # type: ignore[attr-defined]
        except AttributeError:
            if job_path.exists():
                job_path.unlink()

    print("LLM translation workflow completed successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
