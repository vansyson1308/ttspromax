import importlib.util
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch


MODULE_PATH = Path(__file__).with_name("voiceover.py")
SPEC = importlib.util.spec_from_file_location("voiceover", MODULE_PATH)
voiceover = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(voiceover)


class VoiceOverTests(unittest.TestCase):
    def test_auto_prefers_fish_key(self):
        self.assertEqual(voiceover.resolve_engine("auto", {"FISH_API_KEY": "test"}), "fish")

    def test_explicit_fish_requires_key(self):
        with self.assertRaises(voiceover.VoiceOverError):
            voiceover.resolve_engine("fish", {})

    @patch.object(voiceover, "voxcpm_available", return_value=True)
    @patch.object(voiceover, "nvidia_available", return_value=True)
    def test_auto_uses_local_when_ready(self, _gpu, _package):
        self.assertEqual(voiceover.resolve_engine("auto", {}), "voxcpm")

    def test_reads_utf8_text_file(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "narration.txt"
            path.write_text("Xin chào Việt Nam.", encoding="utf-8")
            self.assertEqual(
                voiceover.read_required_text(None, str(path), "text"),
                "Xin chào Việt Nam.",
            )

    def test_rejects_two_text_sources(self):
        with self.assertRaises(voiceover.VoiceOverError):
            voiceover.read_required_text("a", "b.txt", "text")

    @unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "FFmpeg required")
    def test_normalizes_audio_and_reads_duration(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "source.wav"
            output = Path(directory) / "output.wav"
            subprocess.run(
                [
                    "ffmpeg",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-f",
                    "lavfi",
                    "-i",
                    "sine=frequency=440:duration=0.2",
                    str(source),
                ],
                check=True,
            )
            voiceover.normalize_audio(source, output)
            self.assertTrue(output.is_file())
            self.assertGreater(voiceover.audio_duration(output), 0.1)


if __name__ == "__main__":
    unittest.main()
