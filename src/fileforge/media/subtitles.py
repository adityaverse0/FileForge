"""Subtitles module for discovering neighboring subtitle files and converting SRT to WebVTT."""

import re
from pathlib import Path
from typing import List, Dict, Any, Optional
from fileforge.media import SUBTITLE_EXTENSIONS
from fileforge.security import validate_path_safety

LANGUAGE_MAP = {
    "en": "English", "eng": "English", "english": "English",
    "hi": "हिन्दी", "hin": "हिन्दी", "hindi": "हिन्दी",
    "es": "Español", "spa": "Español", "spanish": "Español",
    "fr": "Français", "fra": "Français", "french": "Français",
    "de": "Deutsch", "ger": "Deutsch", "german": "Deutsch",
    "ja": "日本語", "jpn": "日本語", "japanese": "日本語",
    "zh": "中文", "chi": "中文", "zho": "中文", "chinese": "中文",
    "ru": "Русский", "rus": "Русский", "russian": "Русский",
    "it": "Italiano", "ita": "Italiano", "italian": "Italiano",
    "pt": "Português", "por": "Português", "portuguese": "Português",
    "ar": "العربية", "ara": "العربية", "arabic": "العربية",
}


def discover_subtitles(base_dir: Path, video_rel_path: str) -> List[Dict[str, Any]]:
    """Discover local subtitle files sitting beside the video file."""
    try:
        video_path = validate_path_safety(base_dir, video_rel_path)
    except Exception:
        return []

    if not video_path.is_file():
        return []

    parent_dir = video_path.parent
    video_stem = video_path.stem.lower()

    subtitles = []
    
    try:
        for entry in parent_dir.iterdir():
            if entry.is_file() and entry.suffix.lower() in SUBTITLE_EXTENSIONS:
                entry_name = entry.name.lower()
                # Check if subtitle filename starts with or matches video stem
                if entry_name.startswith(video_stem):
                    try:
                        rel_sub = str(entry.relative_to(base_dir)).replace('\\', '/')
                    except ValueError:
                        continue

                    suffix_part = entry_name[len(video_stem):]
                    lang_label = "Subtitles"
                    lang_code = "en"

                    # Parse language tag e.g. .en.srt, .hi.vtt, .english.srt
                    parts = [p for p in suffix_part.replace('.srt', '').replace('.vtt', '').split('.') if p]
                    if parts:
                        candidate_lang = parts[-1].lower()
                        if candidate_lang in LANGUAGE_MAP:
                            lang_label = LANGUAGE_MAP[candidate_lang]
                            lang_code = candidate_lang
                        else:
                            lang_label = candidate_lang.capitalize()

                    subtitles.append({
                        "name": entry.name,
                        "label": lang_label,
                        "lang": lang_code,
                        "path": rel_sub,
                        "type": entry.suffix.lower().replace('.', '')
                    })
    except Exception:
        pass

    return subtitles


def convert_srt_to_vtt(srt_content: str) -> str:
    """Convert raw SRT formatted text to WebVTT format."""
    lines = srt_content.replace('\r\n', '\n').replace('\r', '\n').split('\n')
    vtt_lines = ["WEBVTT\n"]
    
    # Regexp for timestamp replacement: 00:01:20,000 -> 00:01:20.000
    timestamp_pattern = re.compile(r'(\d{2}:\d{2}:\d{2}),(\d{3})')

    for line in lines:
        if timestamp_pattern.search(line):
            vtt_line = timestamp_pattern.sub(r'\1.\2', line)
            vtt_lines.append(vtt_line)
        else:
            vtt_lines.append(line)

    return "\n".join(vtt_lines)


def get_subtitle_content(base_dir: Path, sub_rel_path: str) -> Optional[str]:
    """Read subtitle file and return as WebVTT string."""
    try:
        file_path = validate_path_safety(base_dir, sub_rel_path)
        if not file_path.is_file():
            return None

        raw_bytes = file_path.read_bytes()
        # Decode with utf-8, fallback to latin-1
        try:
            content = raw_bytes.decode('utf-8')
        except UnicodeDecodeError:
            content = raw_bytes.decode('latin-1', errors='replace')

        if file_path.suffix.lower() == '.srt':
            return convert_srt_to_vtt(content)
        
        if not content.startswith('WEBVTT'):
            content = f"WEBVTT\n\n{content}"
        return content
    except Exception:
        return None
