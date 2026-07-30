#!/usr/bin/env python3
"""Create reviewable recipe enrichment candidates from Veggie Deer videos.

This script deliberately writes outside the production recipe data.  A person (or a
separate merge script) must review the generated JSON before putting it in
src/data/synced/veggiedeer-recipes.json.
"""

from __future__ import annotations

import argparse
import base64
import importlib.util
import json
import platform
import re
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[2]
RECIPES_PATH = ROOT / "src/data/synced/veggiedeer-recipes.json"
DEFAULT_OUTPUT = Path(__file__).resolve().parent / "output"
YTDLP_AUTH_ARGS: list[str] = []
YTDLP_PLAYER_CLIENT = "android_vr"
YTDLP_FORMAT = "18"


def fail(message: str) -> None:
    raise RuntimeError(message)


def run(command: list[str], *, capture: bool = False) -> str:
    print("+", " ".join(command), file=sys.stderr)
    result = subprocess.run(
        command,
        check=False,
        text=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None,
    )
    if result.returncode:
        detail = (result.stderr or "").strip()
        fail(f"Command failed ({result.returncode}): {' '.join(command)}\n{detail}")
    return (result.stdout or "").strip()


def yt_dlp_prefix() -> list[str]:
    common = [
        "--extractor-args",
        f"youtube:player_client={YTDLP_PLAYER_CLIENT}",
        *YTDLP_AUTH_ARGS,
    ]
    if shutil.which("yt-dlp"):
        return ["yt-dlp", *common]
    if shutil.which("uvx"):
        return ["uvx", "yt-dlp", *common]
    fail("yt-dlp is required. Install it or install uv so `uvx yt-dlp` works.")


def video_url(video_id: str) -> str:
    return f"https://www.youtube.com/watch?v={video_id}"


def load_recipes() -> list[dict[str, Any]]:
    return json.loads(RECIPES_PATH.read_text(encoding="utf-8"))


def select_recipes(args: argparse.Namespace) -> list[dict[str, Any]]:
    recipes = load_recipes()
    by_source = {recipe.get("sync", {}).get("sourceId"): recipe for recipe in recipes}
    if args.all:
        selected = recipes
    else:
        ids = args.video_id or ["bWacVFFyigk"]
        missing = [video_id for video_id in ids if video_id not in by_source]
        if missing:
            fail(f"No Veggie Deer recipe for sourceId: {', '.join(missing)}")
        selected = [by_source[video_id] for video_id in ids]
    return selected[: args.limit] if args.limit else selected


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def fetch_source(
    video_id: str,
    work_dir: Path,
    refresh: bool,
    source_video: Path | None,
    need_audio: bool = True,
) -> tuple[str, Path, Path | None]:
    """Download source metadata and a mono WAV audio file for transcription."""
    info_path = work_dir / f"{video_id}.info.json"
    audio_path = work_dir / f"{video_id}.wav"
    prefix = yt_dlp_prefix()
    local_video = source_video.resolve() if source_video else work_dir / f"{video_id}.mp4"

    if refresh or not info_path.exists():
        run(
            prefix
            + [
                "--no-playlist",
                "--skip-download",
                "--write-info-json",
                "--output",
                str(work_dir / "%(id)s.%(ext)s"),
                video_url(video_id),
            ]
        )
    if source_video and not local_video.exists():
        fail(f"Local source video does not exist: {local_video}")
    if need_audio and not source_video and (refresh or not local_video.exists()):
        run(
            prefix
            + [
                "--no-playlist",
                "--format",
                YTDLP_FORMAT,
                "--output",
                str(local_video),
                video_url(video_id),
            ]
        )
    if need_audio and (refresh or not audio_path.exists()):
        run(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-i",
                str(local_video),
                "-vn",
                "-ac",
                "1",
                "-ar",
                "16000",
                str(audio_path),
            ]
        )
    if not info_path.exists() or (need_audio and not audio_path.exists()):
        fail(f"yt-dlp did not create required source files for {video_id}")
    description = str(read_json(info_path).get("description") or "")
    return description, audio_path, local_video


def normalize_whisper_transcript(
    raw: dict[str, Any], source: str, model: str
) -> dict[str, Any]:
    segments: list[dict[str, Any]] = []
    for segment in raw.get("segments", []):
        normalized = {
            "startSeconds": round(float(segment["start"]), 2),
            "endSeconds": round(float(segment["end"]), 2),
            "text": str(segment["text"]).strip(),
        }
        # Whisper sometimes hallucinates the same short phrase for every silent
        # second. Keep its first occurrence but do not flood the extraction prompt.
        if (
            segments
            and normalized["text"]
            and normalized["text"] == segments[-1]["text"]
        ):
            continue
        if normalized["text"]:
            segments.append(normalized)
    return {
        "source": source,
        "model": model,
        "language": "zh",
        "text": raw.get("text", "").strip(),
        "segments": segments,
    }


def transcript_with_mlx_whisper(
    audio_path: Path, transcript_path: Path, model: str
) -> dict[str, Any]:
    if platform.system() != "Darwin" or platform.machine() != "arm64":
        fail("MLX Whisper requires an Apple Silicon Mac.")
    if not shutil.which("uvx"):
        fail("MLX Whisper requires uv/uvx.")
    run(
        [
            "uvx",
            "--from",
            "mlx-whisper",
            "mlx_whisper",
            str(audio_path),
            "--model",
            model,
            "--language",
            "zh",
            "--output-format",
            "json",
            "--output-dir",
            str(transcript_path.parent),
            "--verbose",
            "False",
        ]
    )
    produced = transcript_path.parent / f"{audio_path.stem}.json"
    if not produced.exists():
        fail(f"MLX Whisper did not write {produced}")
    raw = read_json(produced)
    transcript = normalize_whisper_transcript(raw, "mlx-whisper-audio", model)
    write_json(transcript_path, transcript)
    if produced != transcript_path:
        produced.unlink()
    return transcript


def transcript_with_whisper(audio_path: Path, transcript_path: Path, model: str) -> dict[str, Any]:
    whisper = shutil.which("whisper")
    if whisper:
        whisper_command = [whisper]
    elif importlib.util.find_spec("whisper"):
        python = shutil.which("python3") or sys.executable
        whisper_command = [python, "-m", "whisper"]
    else:
        fail(
            "Whisper is not installed. Run `python3 -m pip install -U openai-whisper` "
            "or use --transcriber captions only for a clearly-labelled fallback."
        )
    run(
        whisper_command
        + [
            str(audio_path),
            "--model",
            model,
            "--language",
            "zh",
            "--task",
            "transcribe",
            "--output_format",
            "json",
            "--output_dir",
            str(transcript_path.parent),
        ]
    )
    produced = transcript_path.parent / f"{audio_path.stem}.json"
    if not produced.exists():
        fail(f"Whisper did not write {produced}")
    if produced != transcript_path:
        produced.replace(transcript_path)
    raw = read_json(transcript_path)
    return normalize_whisper_transcript(raw, "openai-whisper-audio", model)


def transcript_with_captions(video_id: str, transcript_path: Path) -> dict[str, Any]:
    """Fallback only: captures the platform's auto captions, not audio transcription."""
    captions_dir = transcript_path.parent / "captions"
    captions_dir.mkdir(parents=True, exist_ok=True)
    run(
        yt_dlp_prefix()
        + [
            "--no-playlist",
            "--skip-download",
            "--write-auto-subs",
            "--sub-langs",
            "zh-Hant,zh-TW,zh-Hans,zh",
            "--sub-format",
            "json3",
            "--output",
            str(captions_dir / "%(id)s.%(ext)s"),
            video_url(video_id),
        ]
    )
    files = sorted(captions_dir.glob(f"{video_id}*.json3"))
    if not files:
        fail(f"No Chinese automatic captions were available for {video_id}")
    payload = read_json(files[0])
    segments = []
    for event in payload.get("events", []):
        text = "".join(
            piece.get("utf8", "") for piece in event.get("segs", [])
        ).replace("\n", " ").strip()
        if not text or "\\n" in text:
            continue
        start = float(event.get("tStartMs", 0)) / 1000
        end = start + float(event.get("dDurationMs", 0)) / 1000
        segments.append({"startSeconds": round(start, 2), "endSeconds": round(end, 2), "text": text})
    transcript = {
        "source": "youtube-auto-captions-fallback",
        "language": "zh",
        "captionFile": files[0].name,
        "text": " ".join(segment["text"] for segment in segments),
        "segments": segments,
    }
    write_json(transcript_path, transcript)
    return transcript


def obtain_transcript(
    video_id: str, audio_path: Path, transcript_path: Path, args: argparse.Namespace
) -> dict[str, Any]:
    if transcript_path.exists() and not args.refresh:
        return read_json(transcript_path)
    if args.transcriber in {"mlx", "auto"}:
        try:
            return transcript_with_mlx_whisper(
                audio_path, transcript_path, args.mlx_whisper_model
            )
        except RuntimeError as error:
            if args.transcriber == "mlx":
                raise
            print(f"MLX Whisper unavailable ({error}); trying OpenAI Whisper.", file=sys.stderr)
    if args.transcriber in {"whisper", "auto"}:
        try:
            transcript = transcript_with_whisper(audio_path, transcript_path, args.whisper_model)
            write_json(transcript_path, transcript)
            return transcript
        except RuntimeError:
            if args.transcriber == "whisper":
                raise
            print("Whisper unavailable; attempting explicitly-labelled caption fallback.", file=sys.stderr)
    return transcript_with_captions(video_id, transcript_path)


EXTRACTION_SCHEMA = {
    "type": "object",
    "required": ["ingredients", "steps", "uncertainties"],
    "properties": {
        "ingredients": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["name", "amount", "unit", "optional", "evidence"],
                "properties": {
                    "name": {
                        "type": "object",
                        "required": ["zh", "en", "id"],
                        "properties": {
                            "zh": {"type": "string"},
                            "en": {"type": "string"},
                            "id": {"type": "string"},
                        },
                    },
                    "amount": {"type": "string"},
                    "unit": {
                        "type": "object",
                        "required": ["zh", "en", "id"],
                        "properties": {
                            "zh": {"type": "string"},
                            "en": {"type": "string"},
                            "id": {"type": "string"},
                        },
                    },
                    "optional": {"type": "boolean"},
                    "evidence": {"type": "string"},
                },
            },
        },
        "steps": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["title", "instruction", "startSeconds", "endSeconds", "evidence"],
                "properties": {
                    "title": {
                        "type": "object",
                        "required": ["zh", "en", "id"],
                        "properties": {
                            "zh": {"type": "string"},
                            "en": {"type": "string"},
                            "id": {"type": "string"},
                        },
                    },
                    "instruction": {
                        "type": "object",
                        "required": ["zh", "en", "id"],
                        "properties": {
                            "zh": {"type": "string"},
                            "en": {"type": "string"},
                            "id": {"type": "string"},
                        },
                    },
                    "startSeconds": {"type": "number"},
                    "endSeconds": {"type": "number"},
                    "evidence": {"type": "string"},
                },
            },
        },
        "uncertainties": {"type": "array", "items": {"type": "string"}},
    },
}

INGREDIENT_CARD_SCHEMA = {
    "type": "object",
    "required": ["visibleIngredientCard", "rawText", "ingredients"],
    "properties": {
        "visibleIngredientCard": {"type": "boolean"},
        "rawText": {"type": "string"},
        "ingredients": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["nameZh", "amountText", "unitZh"],
                "properties": {
                    "nameZh": {"type": "string"},
                    "amountText": {"type": "string"},
                    "unitZh": {"type": "string"},
                },
            },
        },
    },
}


def extraction_prompt(
    recipe: dict[str, Any],
    description: str,
    transcript: dict[str, Any],
    ingredient_cards: list[dict[str, Any]],
) -> str:
    compact_segments = json.dumps(transcript.get("segments", []), ensure_ascii=False)
    compact_cards = json.dumps(ingredient_cards, ensure_ascii=False)
    return f"""你是食譜編輯。只可根據以下影片說明和帶時間碼中文逐字稿整理食譜，絕不可補造未提及的份量、溫度或材料。
材料 name/unit、步驟 title/instruction 必須各自輸出 zh（繁體中文）、en（自然英文）、id（自然 Bahasa Indonesia）三語，三個版本意思和細節必須一致。英文和印尼文要用自然、標準的烹飪詞彙。evidence 和 uncertainties 使用繁體中文。
食材卡 OCR 是材料及份量的最高優先證據；逐字稿只用於補充食材卡沒有列出的明確內容。材料要完整列出有證據的材料和調味料。amount 只可放數字、數值範圍或分數，例如 10-15、100、1/2、1/4；「半」轉為 1/2，「四分之一」轉為 1/4。unit 只放單位三語翻譯。少許／適量沒有明確數值，amount 留空，不可臆造。沒有數量時 amount 留空，unit 的三個語言都留空。
步驟要按實作次序，寫清動作和已知時間／火力。每一步 startSeconds/endSeconds 必須落在該動作出現的影片時間範圍；字幕不清楚時用最接近的範圍並放入 uncertainties。不要把語氣詞、歡呼聲、煎炒聲或 Whisper 重複／誤認句當成操作或熟度指標。evidence 簡短引用或概述來源。

現有標題：{recipe.get('title', {}).get('zh', '')}
影片說明：{description}
食材卡逐張 OCR JSON：{compact_cards}
逐字稿 JSON：{compact_segments}
"""


def parse_model_json(text: str) -> dict[str, Any]:
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()
    fenced = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, flags=re.DOTALL)
    candidate = fenced.group(1) if fenced else text[text.find("{") : text.rfind("}") + 1]
    try:
        return json.loads(candidate)
    except json.JSONDecodeError as error:
        fail(f"Model output was not valid JSON: {error}")


def ollama_generate(
    model: str,
    prompt: str,
    schema: dict[str, Any],
    debug_path: Path,
    image_paths: list[Path] | None = None,
    num_ctx: int = 32768,
) -> dict[str, Any]:
    if not shutil.which("ollama"):
        fail(
            "Ollama is required for extraction. Install it and pull an "
            "instruction/vision model, e.g. `ollama pull qwen3-vl:8b`."
        )
    request: dict[str, Any] = {
        "model": model,
        "prompt": prompt,
        "format": schema,
        "stream": False,
        "think": False,
        "options": {
            "temperature": 0.1,
            "num_ctx": num_ctx,
            "num_predict": 4096,
        },
    }
    if image_paths:
        request["images"] = [
            base64.b64encode(path.read_bytes()).decode("ascii") for path in image_paths
        ]
    request_body = json.dumps(request).encode("utf-8")
    try:
        with urlopen(
            Request(
                "http://127.0.0.1:11434/api/generate",
                data=request_body,
                headers={"Content-Type": "application/json"},
                method="POST",
            ),
            timeout=600,
        ) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (URLError, OSError, json.JSONDecodeError) as error:
        fail(f"Ollama HTTP generation failed: {error}")
    model_text = str(payload.get("response") or payload.get("thinking") or "")
    debug_path.parent.mkdir(parents=True, exist_ok=True)
    debug_path.write_text(model_text, encoding="utf-8")
    if payload.get("error"):
        fail(f"Ollama generation failed: {payload['error']}")
    return parse_model_json(model_text)


def ingredient_card_timestamps(
    transcript: dict[str, Any], duration: float
) -> list[float]:
    segments = transcript.get("segments", [])
    for keywords in (("食材", "材料"), ("準備的食", "要準備", "準備的材")):
        for segment in segments:
            text = str(segment.get("text") or "")
            if any(keyword in text for keyword in keywords):
                end = float(
                    segment.get("endSeconds") or segment.get("startSeconds") or 0
                )
                return [
                    round(min(duration - 0.5, end + offset), 2)
                    for offset in (0.5, 1.75, 3.0)
                ]
    return [round(duration * ratio, 2) for ratio in (0.2, 0.3, 0.4)]


def capture_frame(source: str, timestamp: float, target: Path) -> tuple[int, int]:
    target.parent.mkdir(parents=True, exist_ok=True)
    run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-ss",
            str(timestamp),
            "-i",
            source,
            "-frames:v",
            "1",
            "-q:v",
            "2",
            str(target),
        ]
    )
    if not target.exists() or target.stat().st_size < 12_000:
        fail(f"Invalid captured frame: {target}")
    dimensions = run(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height",
            "-of",
            "csv=s=x:p=0",
            str(target),
        ],
        capture=True,
    )
    width, height = [int(value) for value in dimensions.split("x")]
    if width < 640 or height < 360:
        fail(f"Captured frame is below 640x360: {target} ({width}x{height})")
    return width, height


def scan_ingredient_cards(
    video_id: str,
    duration: float,
    transcript: dict[str, Any],
    source_video: Path | None,
    output: Path,
    model: str,
) -> list[dict[str, Any]]:
    source = str(source_video) if source_video else stream_url(video_id)
    results: list[dict[str, Any]] = []
    prompt = """讀取這張烹飪影片畫面。若畫面有食材／材料清單卡，逐字抄錄所有可見中文，並把每項拆成 nameZh、amountText、unitZh。amountText 保留畫面原文（例如「半」、「10-15」、「100」），unitZh 只放單位。不可根據菜名或常識補材料。若不是食材卡，visibleIngredientCard=false、rawText 留空、ingredients 空陣列。"""

    def scan(timestamps: list[float]) -> bool:
        for timestamp in timestamps:
            index = len(results) + 1
            target = (
                output / "ingredient-cards" / video_id / f"card-{index:02d}.jpg"
            )
            width, height = capture_frame(source, timestamp, target)
            ocr = ollama_generate(
                model,
                prompt,
                INGREDIENT_CARD_SCHEMA,
                output
                / "work"
                / video_id
                / f"ingredient-card-{index:02d}-ocr.txt",
                [target],
                num_ctx=32768,
            )
            sanitize_card_ocr(ocr)
            results.append(
                {
                    "timestampSeconds": timestamp,
                    "candidatePath": str(target.relative_to(ROOT)),
                    "width": width,
                    "height": height,
                    "ocr": ocr,
                }
            )
            if ocr.get("visibleIngredientCard") and len(
                ocr.get("ingredients", [])
            ) >= 2:
                return True
        return False

    found = scan(ingredient_card_timestamps(transcript, duration))
    if not found:
        fallback = [round(duration * ratio, 2) for ratio in (0.15, 0.25, 0.35)]
        scan(fallback)
    return results


def vision_ocr(image_path: Path) -> str:
    """Read a captured ingredient card with Apple's local Vision framework."""
    script = Path(__file__).resolve().parent / "vision-ocr.swift"
    if not script.exists():
        fail(f"Vision OCR helper is missing: {script}")
    return run(["swift", str(script), str(image_path)], capture=True)


def scan_ingredient_cards_with_vision(
    video_id: str,
    duration: float,
    transcript: dict[str, Any],
    source_video: Path,
    output: Path,
) -> list[dict[str, Any]]:
    """Capture likely ingredient cards and preserve raw local OCR evidence.

    This intentionally does not attempt semantic extraction.  It gives a
    reviewer (or a separate source-grounded model pass) the transcript, exact
    timestamps, screenshots and OCR text without requiring Ollama.
    """
    timestamps = ingredient_card_timestamps(transcript, duration)
    fallback = [round(duration * ratio, 2) for ratio in (0.15, 0.25, 0.35)]
    ordered_timestamps: list[float] = []
    for timestamp in [*timestamps, *fallback]:
        if (
            1 <= timestamp < duration
            and all(abs(timestamp - existing) >= 0.75 for existing in ordered_timestamps)
        ):
            ordered_timestamps.append(timestamp)

    results: list[dict[str, Any]] = []
    for index, timestamp in enumerate(ordered_timestamps, start=1):
        target = (
            output
            / "ingredient-cards"
            / video_id
            / f"vision-card-{index:02d}.jpg"
        )
        width, height = capture_frame(str(source_video), timestamp, target)
        raw_text = vision_ocr(target)
        results.append(
            {
                "timestampSeconds": timestamp,
                "candidatePath": str(target.relative_to(ROOT)),
                "width": width,
                "height": height,
                "ocrEngine": "apple-vision",
                "rawText": raw_text,
            }
        )
    return results


def sanitize_card_ocr(ocr: dict[str, Any]) -> dict[str, Any]:
    amount_pattern = re.compile(
        r"^(半|一半|二分之一|四分之一|四分之三|三分之一|三分之二|"
        r"\d+(?:\.\d+)?(?:[-–至]\d+(?:\.\d+)?)?)(.*)$"
    )
    for ingredient in ocr.get("ingredients", []):
        amount = str(ingredient.get("amountText") or "").strip()
        unit = str(ingredient.get("unitZh") or "").strip()
        if unit and amount.endswith(unit):
            amount = amount[: -len(unit)].strip()
        elif not unit:
            match = amount_pattern.fullmatch(amount)
            if match and match.group(2).strip():
                amount, unit = match.group(1), match.group(2).strip()
        ingredient["amountText"] = amount
        ingredient["unitZh"] = unit
    return ocr


def normalize_amount(value: Any) -> str:
    text = str(value or "").strip().replace("–", "-").replace("至", "-")
    fractions = {
        "半": "1/2",
        "一半": "1/2",
        "二分之一": "1/2",
        "四分之一": "1/4",
        "四分之三": "3/4",
        "三分之一": "1/3",
        "三分之二": "2/3",
    }
    text = fractions.get(text, text)
    if not text or text in {"少許", "適量", "一點", "一點點"}:
        return ""
    if re.fullmatch(r"(?:\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?|\d+/\d+)", text):
        return text
    return ""


UNIT_TRANSLATIONS = {
    "個": {"zh": "個", "en": "pieces", "id": "buah"},
    "罐": {"zh": "罐", "en": "can", "id": "kaleng"},
    "把": {"zh": "把", "en": "bunch", "id": "ikat"},
    "大匙": {"zh": "大匙", "en": "tbsp", "id": "sdm"},
    "湯匙": {"zh": "湯匙", "en": "tbsp", "id": "sdm"},
    "小匙": {"zh": "小匙", "en": "tsp", "id": "sdt"},
    "茶匙": {"zh": "茶匙", "en": "tsp", "id": "sdt"},
    "ml": {"zh": "ml", "en": "ml", "id": "ml"},
    "毫升": {"zh": "毫升", "en": "ml", "id": "ml"},
    "g": {"zh": "g", "en": "g", "id": "g"},
    "克": {"zh": "克", "en": "g", "id": "g"},
    "杯": {"zh": "杯", "en": "cup", "id": "cangkir"},
}

INGREDIENT_TRANSLATIONS = {
    "凍豆腐": {"zh": "凍豆腐", "en": "frozen tofu", "id": "tahu beku"},
    "玉米罐頭": {"zh": "玉米罐頭", "en": "canned corn", "id": "jagung kaleng"},
    "水蓮": {
        "zh": "水蓮",
        "en": "white water snowflake stems",
        "id": "batang sayur water snowflake",
    },
    "醬油": {"zh": "醬油", "en": "soy sauce", "id": "kecap asin"},
    "咖哩粉": {"zh": "咖哩粉", "en": "curry powder", "id": "bubuk kari"},
    "胡椒鹽": {
        "zh": "胡椒鹽",
        "en": "seasoned pepper salt",
        "id": "garam lada berbumbu",
    },
    "香油": {"zh": "香油", "en": "sesame oil", "id": "minyak wijen"},
    "水": {"zh": "水", "en": "water", "id": "air"},
    "食用油": {"zh": "食用油", "en": "cooking oil", "id": "minyak goreng"},
}


def trilingual_unit(unit_zh: str) -> dict[str, str]:
    return UNIT_TRANSLATIONS.get(
        unit_zh, {"zh": unit_zh, "en": unit_zh, "id": unit_zh}
    )


def apply_ingredient_card_amounts(
    extraction: dict[str, Any], ingredient_cards: list[dict[str, Any]]
) -> None:
    card_ingredients: dict[str, dict[str, str]] = {}
    for card in ingredient_cards:
        ocr = sanitize_card_ocr(card.get("ocr", {}))
        if not ocr.get("visibleIngredientCard"):
            continue
        for item in ocr.get("ingredients", []):
            name = str(item.get("nameZh") or "").strip()
            amount = normalize_amount(item.get("amountText"))
            unit = str(item.get("unitZh") or "").strip()
            if name and amount and name not in card_ingredients:
                card_ingredients[name] = {
                    "amount": amount,
                    "unit": unit,
                    "timestamp": str(card.get("timestampSeconds", "")),
                }

    extraction_by_name = {
        str(item.get("name", {}).get("zh") or "").strip(): item
        for item in extraction.get("ingredients", [])
    }
    for name, card_value in card_ingredients.items():
        ingredient = extraction_by_name.get(name)
        if ingredient is None:
            ingredient = {
                "name": INGREDIENT_TRANSLATIONS.get(
                    name, {"zh": name, "en": name, "id": name}
                ),
                "optional": False,
            }
            extraction.setdefault("ingredients", []).append(ingredient)
        ingredient["amount"] = card_value["amount"]
        ingredient["unit"] = trilingual_unit(card_value["unit"])
        ingredient["evidence"] = (
            f"食材卡 OCR {card_value['timestamp']}s："
            f"{name} {card_value['amount']}{card_value['unit']}"
        )


def apply_translation_glossary(extraction: dict[str, Any]) -> None:
    replacements = {
        "en": {
            "water lily": "white water snowflake stems",
            "corn can": "canned corn",
        },
        "id": {
            "bunga teratai": "batang sayur water snowflake",
            "saus tiram": "kecap asin",
            "tofu beku": "tahu beku",
            "tofu keras": "tahu keras",
        },
    }
    for ingredient in extraction.get("ingredients", []):
        zh = str(ingredient.get("name", {}).get("zh") or "")
        if zh in INGREDIENT_TRANSLATIONS:
            ingredient["name"] = dict(INGREDIENT_TRANSLATIONS[zh])
    for step in extraction.get("steps", []):
        for field in ("title", "instruction"):
            value = step.get(field, {})
            for language, language_replacements in replacements.items():
                text = str(value.get(language) or "")
                for old, new in language_replacements.items():
                    text = re.sub(old, new, text, flags=re.IGNORECASE)
                value[language] = text


def postvalidate_steps(extraction: dict[str, Any]) -> None:
    has_water_snowflake = any(
        item.get("name", {}).get("zh") == "水蓮"
        for item in extraction.get("ingredients", [])
    )
    for step in extraction.get("steps", []):
        instructions = step.get("instruction", {})
        if (
            "凍豆腐" in str(step.get("title", {}).get("zh") or "")
            and "哇" in str(instructions.get("zh") or "")
        ):
            step["instruction"] = {
                "zh": "鍋中倒入少許油，將凍豆腐煸至金黃酥脆。",
                "en": "Add a little oil to the pan and fry the frozen tofu until golden and crisp.",
                "id": "Tuangkan sedikit minyak ke wajan lalu tumis tahu beku hingga keemasan dan renyah.",
            }
            instructions = step["instruction"]
        instructions["zh"] = re.sub(
            r"聽到[「『]?(?:哇)+[」』]?聲時表示(?:完成|已熟|熟了)[。.]?",
            "",
            instructions.get("zh", ""),
        ).strip()
        instructions["en"] = re.sub(
            r"(?:The )?['\"]?wawa['\"]? sound indicates (?:completion|it['’]?s ready|it is ready)[.]?",
            "",
            instructions.get("en", ""),
            flags=re.IGNORECASE,
        ).strip()
        instructions["id"] = re.sub(
            r"Suara ['\"]?wawa['\"]? menunjukkan (?:selesai|siap)[.]?",
            "",
            instructions.get("id", ""),
            flags=re.IGNORECASE,
        ).strip()
        if has_water_snowflake and any(
            phrase in instructions.get("zh", "")
            for phrase in ("再將水淋入", "再把水淋進去", "加入更多水")
        ):
            step["title"] = {
                "zh": "加入水蓮並收汁",
                "en": "Add the white water snowflake stems and reduce",
                "id": "Tambahkan batang water snowflake dan susutkan saus",
            }
            step["instruction"] = {
                "zh": "倒入少量水，讓凍豆腐吸收醬汁；剩少量水分時加入切碎水蓮，快速翻炒至熟。",
                "en": "Add a small amount of water and let the frozen tofu absorb the sauce. When little liquid remains, add the chopped white water snowflake stems and stir-fry briefly.",
                "id": "Tambahkan sedikit air agar tahu beku menyerap saus. Saat cairan tinggal sedikit, masukkan batang sayur water snowflake yang sudah dicincang lalu tumis sebentar.",
            }


def sanitize_extraction(
    extraction: dict[str, Any], ingredient_cards: list[dict[str, Any]]
) -> dict[str, Any]:
    for ingredient in extraction.get("ingredients", []):
        ingredient["amount"] = normalize_amount(ingredient.get("amount"))
        if not ingredient["amount"]:
            ingredient["unit"] = {"zh": "", "en": "", "id": ""}
    apply_ingredient_card_amounts(extraction, ingredient_cards)
    apply_translation_glossary(extraction)
    postvalidate_steps(extraction)
    return extraction


def extract_recipe(
    recipe: dict[str, Any],
    description: str,
    transcript: dict[str, Any],
    ingredient_cards: list[dict[str, Any]],
    model: str,
    debug_path: Path,
) -> dict[str, Any]:
    prompt = extraction_prompt(recipe, description, transcript, ingredient_cards)
    extraction = ollama_generate(model, prompt, EXTRACTION_SCHEMA, debug_path)
    sanitize_extraction(extraction, ingredient_cards)
    for index, step in enumerate(extraction.get("steps", []), start=1):
        step["order"] = index
    return extraction


def stream_url(video_id: str) -> str:
    output = run(
        yt_dlp_prefix()
        + [
            "--quiet",
            "--no-warnings",
            "--no-playlist",
            "--format",
            YTDLP_FORMAT,
            "--get-url",
            video_url(video_id),
        ],
        capture=True,
    )
    url = next((line for line in output.splitlines() if line.strip()), "")
    if not url:
        fail(f"No playable video stream URL for {video_id}")
    return url


def step_timestamp(step: dict[str, Any], duration: float) -> float:
    start = max(0.0, float(step.get("startSeconds", 0)))
    end = max(start, float(step.get("endSeconds", start)))
    # One second after the beginning avoids title cards while remaining within the step.
    return round(min(max(start + 1, (start + end) / 2), max(0.1, duration - 0.5)), 2)


def capture_step_frames(
    video_id: str,
    duration: float,
    steps: list[dict[str, Any]],
    frames_dir: Path,
    source_video: Path | None = None,
) -> None:
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        fail("ffmpeg and ffprobe are required to capture step screenshots.")
    if not steps:
        fail("Extraction has no steps, so no screenshots can be captured.")
    source = str(source_video) if source_video else stream_url(video_id)
    frames_dir.mkdir(parents=True, exist_ok=True)
    for step in steps:
        filename = f"step-{int(step['order']):02d}.jpg"
        target = frames_dir / filename
        timestamp = step_timestamp(step, duration)
        width, height = capture_frame(source, timestamp, target)
        step["screenshot"] = {
            "timestampSeconds": timestamp,
            "candidatePath": str(target.relative_to(ROOT)),
            "width": width,
            "height": height,
        }


def enrich(recipe: dict[str, Any], args: argparse.Namespace) -> Path:
    video_id = recipe["sync"]["sourceId"]
    work_dir = args.output / "work" / video_id
    output_path = args.output / "candidates" / f"{video_id}.json"
    transcript_path = work_dir / "transcript.json"
    work_dir.mkdir(parents=True, exist_ok=True)
    description, audio_path, source_video = fetch_source(
        video_id,
        work_dir,
        args.refresh,
        args.source_video,
        need_audio=args.transcriber != "captions",
    )
    transcript = obtain_transcript(video_id, audio_path, transcript_path, args)
    if not transcript.get("segments"):
        fail(f"Transcript has no timestamped segments for {video_id}")
    duration = float(recipe.get("sync", {}).get("durationSeconds") or 0)
    if args.evidence_only or args.transcript_only:
        # Transcript-only mode is the fast path for a large backfill: it keeps
        # source metadata and timestamped speech, but deliberately avoids
        # extracting any video frames.  Ingredient-card OCR remains available
        # only when explicitly requested with --evidence-only.
        ingredient_cards: list[dict[str, Any]] = []
        if args.evidence_only:
            if source_video is None:
                fail("Evidence-only mode requires a downloaded or supplied source video")
            ingredient_cards = scan_ingredient_cards_with_vision(
                video_id,
                duration,
                transcript,
                source_video,
                args.output,
            )
        evidence_path = args.output / "evidence" / f"{video_id}.json"
        write_json(
            evidence_path,
            {
                "schemaVersion": 1,
                "generatedAt": datetime.now(timezone.utc).isoformat(),
                "recipe": {
                    "id": recipe["id"],
                    "sourceId": video_id,
                    "title": recipe.get("title", {}),
                    "description": recipe.get("description", {}),
                    "durationSeconds": duration,
                },
                "sources": {
                    "description": description,
                    "transcript": transcript,
                    "transcriptPath": str(transcript_path.relative_to(ROOT)),
                    "ingredientCards": ingredient_cards,
                },
            },
        )
        return evidence_path
    ingredient_cards = scan_ingredient_cards(
        video_id,
        duration,
        transcript,
        source_video,
        args.output,
        args.ollama_model,
    )
    extraction = extract_recipe(
        recipe,
        description,
        transcript,
        ingredient_cards,
        args.ollama_model,
        work_dir / "ollama-output.txt",
    )
    capture_step_frames(
        video_id,
        duration,
        extraction["steps"],
        args.output / "frames" / video_id,
        source_video,
    )
    candidate = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "reviewStatus": "needs-human-review",
        "recipe": {"id": recipe["id"], "sourceId": video_id, "durationSeconds": duration},
        "sources": {
            "description": description,
            "transcript": transcript,
            "transcriptPath": str(transcript_path.relative_to(ROOT)),
            "ingredientCards": ingredient_cards,
        },
        "ingredients": extraction["ingredients"],
        "steps": extraction["steps"],
        "uncertainties": extraction["uncertainties"],
    }
    write_json(output_path, candidate)
    return output_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--video-id", action="append", help="YouTube sourceId; repeat for several recipes")
    group.add_argument("--all", action="store_true", help="Enrich every Veggie Deer recipe")
    parser.add_argument("--limit", type=int, help="Maximum selected recipes")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Candidate artifact directory")
    parser.add_argument(
        "--transcriber",
        choices=["auto", "mlx", "whisper", "captions"],
        default="auto",
        help="auto uses MLX on Apple Silicon, then OpenAI Whisper, then caption fallback.",
    )
    parser.add_argument(
        "--mlx-whisper-model",
        default="mlx-community/whisper-small-mlx",
        help="MLX Whisper model used by the Apple Silicon default.",
    )
    parser.add_argument("--whisper-model", default="small", help="Whisper model for Chinese audio transcription")
    parser.add_argument("--ollama-model", default="qwen3:8b", help="Installed Ollama instruct model")
    parser.add_argument(
        "--evidence-only",
        action="store_true",
        help=(
            "Stop after transcript plus Apple Vision ingredient-card OCR; "
            "does not require Ollama and never writes a recipe candidate"
        ),
    )
    parser.add_argument(
        "--transcript-only",
        action="store_true",
        help=(
            "Stop after source metadata plus timestamped transcription; "
            "never captures video frames or writes a recipe candidate."
        ),
    )
    parser.add_argument(
        "--source-video",
        type=Path,
        help="Use an already-downloaded MP4 for the selected single video.",
    )
    parser.add_argument(
        "--youtube-player-client",
        default="android_vr",
        help="yt-dlp YouTube player client (default: android_vr).",
    )
    parser.add_argument(
        "--cookies-from-browser",
        choices=["chrome", "chromium", "firefox", "safari"],
        help="Pass yt-dlp a local browser cookie store only when YouTube requires sign-in; cookie values are never saved.",
    )
    parser.add_argument("--refresh", action="store_true", help="Re-download/re-transcribe instead of using cache")
    return parser.parse_args()


def main() -> None:
    global YTDLP_PLAYER_CLIENT
    args = parse_args()
    YTDLP_PLAYER_CLIENT = args.youtube_player_client
    if args.source_video and (args.all or len(args.video_id or []) != 1):
        fail("--source-video requires exactly one --video-id")
    if args.cookies_from_browser:
        YTDLP_AUTH_ARGS.extend(["--cookies-from-browser", args.cookies_from_browser])
    args.output = args.output.resolve()
    selected = select_recipes(args)
    if not selected:
        fail("No recipes selected")
    failures: list[tuple[str, str]] = []
    for index, recipe in enumerate(selected, start=1):
        video_id = str(recipe.get("sync", {}).get("sourceId") or recipe.get("id"))
        existing = (
            # A pre-existing evidence packet can have been produced before the
            # local transcript cache was introduced.  For transcript-only
            # backfills, the cache itself is the resumable artifact.
            args.output / "work" / video_id / "transcript.json"
            if args.transcript_only
            else (
                args.output / "evidence" / f"{video_id}.json"
                if args.evidence_only
                else args.output / "candidates" / f"{video_id}.json"
            )
        )
        if existing.exists() and not args.refresh:
            artifact = (
                "evidence packet"
                if args.evidence_only or args.transcript_only
                else "candidate"
            )
            print(f"[{index}/{len(selected)}] skip {video_id} ({artifact} exists)")
            continue
        try:
            output = enrich(recipe, args)
            print(f"[{index}/{len(selected)}] wrote {output.relative_to(ROOT)}")
        except RuntimeError as error:
            failures.append((video_id, str(error)))
            print(f"[{index}/{len(selected)}] FAILED {video_id}: {error}", file=sys.stderr)
        # Brief gap reduces repeated stream-URL requests when processing batches.
        if index < len(selected):
            time.sleep(1)
    if failures:
        print(
            f"Completed with {len(failures)} failure(s): "
            + ", ".join(video_id for video_id, _ in failures),
            file=sys.stderr,
        )
        for video_id, detail in failures:
            print(f"- {video_id}: {detail}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        sys.exit(1)
