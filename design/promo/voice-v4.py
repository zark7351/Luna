"""Optional authoring tool: send the v4 narration text to Edge TTS."""

import asyncio
import json
import os
import shutil
import subprocess
import tempfile
import wave
from pathlib import Path

import edge_tts


def spoken_parts(text):
    # Voice-only spellings keep the published Chinese captions intact.
    text = text.replace("我还给", "我孩给").replace("UP 主", "阿普主").replace("哦～", "哦，")
    # Keep code-switching in context: a whole sentence shares one rhythm and voice.
    return [text.strip()] if text.strip() else []


async def main():
    here = Path(__file__).resolve().parent
    out = here.parents[2] / "Claudy-Promo" / "voice-v4"
    out.mkdir(parents=True, exist_ok=True)
    ffmpeg = shutil.which("ffmpeg") or next(
        (here.parents[1] / ".build-tools").glob("ffmpeg-8.0.1/*/bin/ffmpeg.exe"), None
    )
    if not ffmpeg:
        raise SystemExit("请先准备项目 FFmpeg，或将 ffmpeg 加入 PATH。")
    scenes = json.loads((here / "narration-v4.json").read_text(encoding="utf-8"))
    segments = [spoken_parts(scene["say"]) for scene in scenes]
    unique = list(dict.fromkeys(part for line in segments for part in line))
    slots = asyncio.Semaphore(3)
    with tempfile.TemporaryDirectory(prefix="claudy-voice-") as folder:
        async def synthesize(index, part):
            async with slots:
                path = Path(folder) / f"part-{index}.mp3"
                # Synthesize each complete sentence without separately splicing English words.
                voice = edge_tts.Communicate(
                    part,
                    "en-US-AvaMultilingualNeural",
                    rate="+11%",
                    proxy=os.getenv("CLAUDIE_TTS_PROXY"),
                    connect_timeout=10,
                    receive_timeout=25,
                )
                await voice.save(str(path))
                trim = "silenceremove=start_periods=1:start_duration=0.025:start_threshold=-55dB"
                pcm = subprocess.check_output([
                    str(ffmpeg), "-v", "error", "-i", str(path),
                    "-af", f"{trim},areverse,{trim},areverse",
                    "-ar", "24000", "-ac", "1", "-f", "s16le", "-",
                ])
                if not pcm:
                    raise ValueError(f"没有生成可用旁白：{part}")
                print(f"VOICE {index + 1}/{len(unique)}", flush=True)
                return pcm

        audio = dict(zip(unique, await asyncio.gather(*(
            synthesize(index, part) for index, part in enumerate(unique)
        ))))
        for i, parts in enumerate(segments):
            with wave.open(str(out / f"line-{i}.wav"), "wb") as track:
                track.setparams((1, 2, 24000, 0, "NONE", "not compressed"))
                track.writeframes(b"".join(audio[part] for part in parts))


if __name__ == "__main__":
    asyncio.run(main())
