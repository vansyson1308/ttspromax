#!/usr/bin/env python3
"""Authorized voice-clone synthesis with deterministic video-ready output."""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
from datetime import datetime, timezone
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from typing import Mapping, Sequence


class VoiceOverError(RuntimeError):
    """A user-actionable voice-over failure."""


def command_exists(name: str) -> bool:
    return shutil.which(name) is not None


def voxcpm_available() -> bool:
    return importlib.util.find_spec("voxcpm") is not None or command_exists("voxcpm")


def nvidia_available() -> bool:
    if not command_exists("nvidia-smi"):
        return False
    result = subprocess.run(
        ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader"],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0 or not result.stdout.strip():
        return False
    for line in result.stdout.splitlines():
        fields = [part.strip() for part in line.split(",")]
        if len(fields) < 2:
            continue
        memory_digits = "".join(character for character in fields[1] if character.isdigit())
        if memory_digits and int(memory_digits) >= 7500:
            return True
    return False


def resolve_engine(requested: str, env: Mapping[str, str] | None = None) -> str:
    environment = os.environ if env is None else env
    if requested == "fish":
        if not environment.get("FISH_API_KEY"):
            raise VoiceOverError("Fish Audio requires FISH_API_KEY in the local environment.")
        return "fish"
    if requested == "voxcpm":
        if not voxcpm_available():
            raise VoiceOverError("VoxCPM is not installed. Run setup-windows.ps1 -WithLocal.")
        if not nvidia_available():
            raise VoiceOverError("VoxCPM local mode requires a working NVIDIA CUDA runtime.")
        return "voxcpm"
    if environment.get("FISH_API_KEY"):
        return "fish"
    if voxcpm_available() and nvidia_available():
        return "voxcpm"
    raise VoiceOverError(
        "No synthesis engine is ready. Set FISH_API_KEY or install VoxCPM with "
        "setup-windows.ps1 -WithLocal."
    )


def read_required_text(value: str | None, file_value: str | None, label: str) -> str:
    if value and file_value:
        raise VoiceOverError(f"Use either --{label} or --{label}-file, not both.")
    if file_value:
        path = Path(file_value).expanduser().resolve()
        if not path.is_file():
            raise VoiceOverError(f"{label} file does not exist: {path}")
        value = path.read_text(encoding="utf-8")
    text = (value or "").strip()
    if not text:
        raise VoiceOverError(f"{label} is required and cannot be empty.")
    return text


def run_checked(command: Sequence[str], label: str) -> None:
    result = subprocess.run(command, text=True, check=False)
    if result.returncode != 0:
        raise VoiceOverError(f"{label} failed with exit code {result.returncode}.")


def synthesize_fish(text: str, transcript: str, reference: Path, output: Path) -> None:
    try:
        from fishaudio import FishAudio
        from fishaudio.types import ReferenceAudio
    except ImportError as exc:
        raise VoiceOverError("Fish SDK is missing. Run setup-windows.ps1.") from exc

    client = FishAudio()
    audio = client.tts.convert(
        text=text,
        references=[ReferenceAudio(audio=reference.read_bytes(), text=transcript)],
        format="wav",
        latency="normal",
        model="s2-pro",
    )
    output.write_bytes(audio)


def synthesize_voxcpm(
    text: str, transcript: str, reference: Path, output: Path, control: str | None
) -> None:
    executable = shutil.which("voxcpm")
    command = [executable] if executable else [sys.executable, "-m", "voxcpm.cli"]
    command.extend(
        [
            "clone",
            "--text",
            text,
            "--prompt-audio",
            str(reference),
            "--prompt-text",
            transcript,
            "--reference-audio",
            str(reference),
            "--output",
            str(output),
        ]
    )
    if control:
        print(
            "Warning: --control is ignored in transcript-guided VoxCPM cloning.",
            file=sys.stderr,
        )
    run_checked(command, "VoxCPM synthesis")


def normalize_audio(source: Path, destination: Path) -> None:
    if not command_exists("ffmpeg"):
        raise VoiceOverError("FFmpeg is required for 48 kHz loudness normalization.")
    destination.parent.mkdir(parents=True, exist_ok=True)
    run_checked(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(source),
            "-af",
            "loudnorm=I=-16:TP=-1.5:LRA=11",
            "-ar",
            "48000",
            "-ac",
            "1",
            "-c:a",
            "pcm_s24le",
            str(destination),
        ],
        "Audio normalization",
    )


def audio_duration(path: Path) -> float:
    if not command_exists("ffprobe"):
        raise VoiceOverError("FFprobe is required to calculate Remotion duration.")
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise VoiceOverError("FFprobe could not read the generated audio.")
    return float(result.stdout.strip())


def resolve_output(args: argparse.Namespace) -> tuple[Path, Path | None]:
    project = Path(args.remotion_project).expanduser().resolve() if args.remotion_project else None
    if project and not (project / "package.json").is_file():
        raise VoiceOverError(f"Remotion project has no package.json: {project}")
    if args.output:
        output = Path(args.output).expanduser().resolve()
    elif project:
        output = project / "public" / "audio" / "voiceover.wav"
    else:
        output = Path.cwd() / "voice-outputs" / "voiceover.wav"
    if output.suffix.lower() != ".wav":
        raise VoiceOverError("Output must use the .wav extension.")
    if output.exists() and not args.force:
        raise VoiceOverError(f"Output already exists: {output}. Pass --force to replace it.")
    return output, project


def synthesize(args: argparse.Namespace) -> int:
    if not args.confirm_authorized_voice:
        raise VoiceOverError(
            "Voice authorization was not confirmed. Re-run with --confirm-authorized-voice "
            "only after the speaker has consented."
        )
    reference = Path(args.reference_audio).expanduser().resolve()
    if not reference.is_file():
        raise VoiceOverError(f"Reference audio does not exist: {reference}")
    text = read_required_text(args.text, args.text_file, "text")
    transcript = read_required_text(
        args.reference_text, args.reference_text_file, "reference-text"
    )
    output, project = resolve_output(args)
    engine = resolve_engine(args.engine)

    with tempfile.TemporaryDirectory(prefix="voiceover-") as temp_dir:
        raw = Path(temp_dir) / "raw.wav"
        if engine == "fish":
            synthesize_fish(text, transcript, reference, raw)
        else:
            synthesize_voxcpm(text, transcript, reference, raw, args.control)
        normalize_audio(raw, output)

    duration = audio_duration(output)
    audio_path = (
        output.relative_to(project).as_posix()
        if project and output.is_relative_to(project)
        else str(output)
    )
    metadata = {
        "schemaVersion": 1,
        "aiGenerated": True,
        "authorizedVoiceConfirmed": True,
        "engine": engine,
        "audioPath": audio_path,
        "durationInSeconds": round(duration, 6),
        "sampleRate": 48000,
        "channels": 1,
        "compositionId": args.composition,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    metadata_path = output.with_suffix(".json")
    metadata_path.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(metadata, ensure_ascii=False, indent=2))
    print(f"Metadata: {metadata_path}", file=sys.stderr)
    return 0


def doctor() -> int:
    checks = {
        "python": sys.version.split()[0],
        "ffmpeg": command_exists("ffmpeg"),
        "ffprobe": command_exists("ffprobe"),
        "fishKeyConfigured": bool(os.environ.get("FISH_API_KEY")),
        "fishSdkInstalled": importlib.util.find_spec("fishaudio") is not None,
        "voxcpmInstalled": voxcpm_available(),
        "nvidiaWith8GbVram": nvidia_available(),
    }
    checks["autoEngine"] = None
    try:
        checks["autoEngine"] = resolve_engine("auto")
    except VoiceOverError:
        pass
    print(json.dumps(checks, indent=2))
    return 0 if checks["ffmpeg"] and checks["ffprobe"] else 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="voiceover")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("doctor", help="Check cloud, local GPU, and media tools")

    synth = subparsers.add_parser("synthesize", help="Create an authorized cloned voice-over")
    synth.add_argument("--reference-audio", required=True)
    synth.add_argument("--reference-text")
    synth.add_argument("--reference-text-file")
    synth.add_argument("--text")
    synth.add_argument("--text-file")
    synth.add_argument("--engine", choices=["auto", "fish", "voxcpm"], default="auto")
    synth.add_argument("--control", help="Optional local style instruction")
    synth.add_argument("--output")
    synth.add_argument("--remotion-project")
    synth.add_argument("--composition")
    synth.add_argument("--force", action="store_true")
    synth.add_argument("--confirm-authorized-voice", action="store_true")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        return doctor() if args.command == "doctor" else synthesize(args)
    except VoiceOverError as exc:
        print(f"voiceover: {exc}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        print("voiceover: cancelled", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
