#!/usr/bin/env python3
"""Debug harness for the Illustrator MCP server.

This script starts the local MCP server over stdio, initializes a session,
lists the available tools, and optionally calls the `run` tool with ExtendScript
code so you can reproduce hangs or failures without going through the IDE MCP
bridge.
"""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path
from textwrap import dedent
from typing import Any

from mcp import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client


DEFAULT_TEST_CODE = dedent(
    r'''
    (function () {
        return "success";
    })()
    '''
).strip()


def parse_args() -> argparse.Namespace:
    repo_root = Path(__file__).resolve().parent.parent
    default_python = r"C:\Users\User\.conda\envs\adobe-ai-mcp\python.exe"
    default_server = repo_root / "illustrator-mcp" / "illustrator" / "server.py"

    parser = argparse.ArgumentParser(
        description="Debug the Illustrator MCP server over stdio"
    )
    parser.add_argument(
        "--python",
        default=default_python,
        help="Python executable used to launch the MCP server",
    )
    parser.add_argument(
        "--server",
        default=str(default_server),
        help="Path to illustrator/server.py",
    )
    parser.add_argument(
        "--tool",
        default="run",
        help="Tool name to call after initialization (default: run)",
    )
    parser.add_argument(
        "--code-file",
        type=Path,
        help="Read ExtendScript code from a file instead of using the built-in test snippet",
    )
    parser.add_argument(
        "--code",
        help="Inline ExtendScript code to send to the `run` tool",
    )
    parser.add_argument(
        "--translation-table-json",
        help="JSON object mapping English source text to Chinese translations; injected for headless translation runs",
    )
    parser.add_argument(
        "--runtime-globals-json",
        help="JSON object mapping global variable names to values for custom ExtendScript workflows",
    )
    parser.add_argument(
        "--translate-selected-texts-group-replace-mode",
        help="Replacement mode for grouped translation entries: whole or individual",
    )
    parser.add_argument(
        "--auto-group-scale-factor",
        type=float,
        help="Bounding-box scale factor used by auto-grouping runs (default: 1.0)",
    )
    parser.add_argument(
        "--auto-group-text-regex-pattern",
        help="Regex pattern string used to filter auto-grouped text frames before clustering",
    )
    parser.add_argument(
        "--auto-group-path-width-scale-factor",
        type=float,
        help="Horizontal bounding-box scale factor used by path auto-grouping runs (default: 1.0)",
    )
    parser.add_argument(
        "--auto-group-path-height-scale-factor",
        type=float,
        help="Vertical bounding-box scale factor used by path auto-grouping runs (default: 1.0)",
    )
    parser.add_argument(
        "--auto-group-path-fill-color-limit",
        default="#000000",
        help="Fill-color limit used by path auto-grouping runs (default: #000000)",
    )
    parser.add_argument(
        "--auto-group-path-scale-factor",
        type=float,
        help="Legacy uniform bounding-box scale factor used by path auto-grouping runs (default: 1.0)",
    )
    parser.add_argument(
        "--auto-group-path-area-range-min",
        type=float,
        help="Minimum area used to pre-filter path items before clustering",
    )
    parser.add_argument(
        "--auto-group-path-area-range-max",
        type=float,
        help="Maximum area used to pre-filter path items before clustering",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=3000.0,
        help="Timeout in seconds for the tool call (default: 3000)",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose logging",
    )
    return parser.parse_args()


def load_code(args: argparse.Namespace) -> str:
    if args.code is not None:
        return args.code
    if args.code_file is not None:
        return args.code_file.read_text(encoding="utf-8")
    return DEFAULT_TEST_CODE


def inject_runtime_globals(code: str, injections: list[tuple[str, Any]]) -> str:
    if not injections:
        return code

    injection = ""
    for name, value in injections:
        injected_value = json.dumps(value)
        injection += (
            f"var {name} = {injected_value};\n"
            f"$.global.{name} = {name};\n"
        )

    lines = code.splitlines(True)
    if lines and lines[0].lstrip().startswith("#target"):
        return lines[0] + injection + "".join(lines[1:])

    return injection + code


def inject_translation_table(code: str, translation_table_json: str | None) -> str:
    if not translation_table_json:
        return code

    return inject_runtime_globals(code, [("TRANSLATION_TABLE_JSON", translation_table_json)])


def inject_runtime_globals_json(code: str, runtime_globals_json: str | None) -> str:
    if not runtime_globals_json:
        return code

    try:
        runtime_globals = json.loads(runtime_globals_json)
    except json.JSONDecodeError as error:
        raise ValueError(f"Invalid --runtime-globals-json value: {error}") from error

    if not isinstance(runtime_globals, dict):
        raise ValueError("--runtime-globals-json must decode to a JSON object.")

    injections: list[tuple[str, Any]] = []
    for name, value in runtime_globals.items():
        injections.append((str(name), value))

    return inject_runtime_globals(code, injections)


def inject_auto_group_path_fill_color_limit(code: str, fill_color_limit: str | None) -> str:
    if fill_color_limit is None:
        return code

    fill_color_limit = str(fill_color_limit).strip()
    if not fill_color_limit:
        fill_color_limit = "#000000"

    return inject_runtime_globals(code, [("AUTO_GROUP_PATH_FILL_COLOR_LIMIT", fill_color_limit)])


def inject_selected_texts_group_replace_mode(code: str, replace_mode: str | None) -> str:
    return inject_runtime_globals(
        code,
        [("TRANSLATE_SELECTED_TEXTS_GROUP_REPLACE_MODE", replace_mode)],
    )


def inject_auto_group_scale_factor(code: str, scale_factor: float | None) -> str:
    if scale_factor is None:
        return code

    return inject_runtime_globals(
        code,
        [
            ("AUTO_GROUP_NEARNESS_SCALE_FACTOR", scale_factor),
            ("AUTO_GROUP_SCALE_FACTOR", scale_factor),
        ],
    )


def inject_auto_group_text_regex_pattern(code: str, regex_pattern: str | None) -> str:
    if not regex_pattern:
        return code

    return inject_runtime_globals(
        code,
        [("AUTO_GROUP_TEXT_REGEX_PATTERN", regex_pattern)],
    )


def inject_auto_group_path_scale_factors(
    code: str,
    width_scale_factor: float | None,
    height_scale_factor: float | None,
    legacy_scale_factor: float | None,
) -> str:
    injections: list[tuple[str, Any]] = []

    if width_scale_factor is not None:
        injections.append(("AUTO_GROUP_PATH_WIDTH_SCALE_FACTOR", width_scale_factor))

    if height_scale_factor is not None:
        injections.append(("AUTO_GROUP_PATH_HEIGHT_SCALE_FACTOR", height_scale_factor))

    if not injections and legacy_scale_factor is not None:
        injections.extend(
            [
                ("AUTO_GROUP_PATH_NEARNESS_SCALE_FACTOR", legacy_scale_factor),
                ("AUTO_GROUP_PATH_SCALE_FACTOR", legacy_scale_factor),
            ]
        )

    return inject_runtime_globals(code, injections)


def inject_auto_group_path_area_range(
    code: str,
    area_range_min: float | None,
    area_range_max: float | None,
) -> str:
    injections: list[tuple[str, Any]] = []

    if area_range_min is not None:
        injections.append(("AUTO_GROUP_PATH_AREA_RANGE_MIN", area_range_min))

    if area_range_max is not None:
        injections.append(("AUTO_GROUP_PATH_AREA_RANGE_MAX", area_range_max))

    return inject_runtime_globals(code, injections)


def format_tool(tool: Any) -> str:
    name = getattr(tool, "name", "?")
    description = getattr(tool, "description", "")
    schema = getattr(tool, "inputSchema", None)
    return f"- {name}: {description}\n  schema={schema}"


async def main() -> int:
    args = parse_args()
    verbose = args.verbose
    code = inject_runtime_globals_json(load_code(args), args.runtime_globals_json)
    code = inject_translation_table(code, args.translation_table_json)
    code = inject_selected_texts_group_replace_mode(code, args.translate_selected_texts_group_replace_mode)
    code = inject_auto_group_scale_factor(code, args.auto_group_scale_factor)
    code = inject_auto_group_text_regex_pattern(code, args.auto_group_text_regex_pattern)
    code = inject_auto_group_path_fill_color_limit(code, args.auto_group_path_fill_color_limit)
    code = inject_auto_group_path_scale_factors(
        code,
        args.auto_group_path_width_scale_factor,
        args.auto_group_path_height_scale_factor,
        args.auto_group_path_scale_factor,
    )
    code = inject_auto_group_path_area_range(
        code,
        args.auto_group_path_area_range_min,
        args.auto_group_path_area_range_max,
    )

    server_params = StdioServerParameters(
        command=args.python,
        args=[args.server],
    )

    if verbose:
        print("[debug] launching MCP server")
        print(f"[debug] python={args.python}")
        print(f"[debug] server={args.server}")

    async with stdio_client(server_params) as (read_stream, write_stream):
        async with ClientSession(read_stream, write_stream) as session:
            if verbose:
                print("[debug] initializing session")
            init_result = await session.initialize()
            if verbose:
                print(f"[debug] initialize result: {init_result}")

            if verbose:
                print("[debug] listing tools")
            tools_result = await session.list_tools()
            tools = getattr(tools_result, "tools", tools_result)
            if verbose:
                print("[debug] tools:")
                for tool in tools:
                    print(format_tool(tool))

            if verbose:
                print(f"[debug] calling tool: {args.tool}")
            if args.tool == "run":
                result = await asyncio.wait_for(
                    session.call_tool(args.tool, {"code": code}),
                    timeout=args.timeout,
                )
            else:
                result = await asyncio.wait_for(
                    session.call_tool(args.tool, {}),
                    timeout=args.timeout,
                )

            if verbose:
                print("[debug] tool call completed")
                print(result)
            else:
                try:
                    print(result.content[0].text)
                except Exception:
                    print(result)

    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
