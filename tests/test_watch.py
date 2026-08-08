"""Tests for FileForge Watch Media Mode."""

import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from fileforge.app import create_app
from fileforge.config import settings
from fileforge.database import db
from fileforge.media.scanner import scanner
from fileforge.media.subtitles import convert_srt_to_vtt, discover_subtitles


@pytest.fixture
def temp_storage(tmp_path):
    orig_root = settings.root_dir
    settings.set_root_dir(str(tmp_path))

    # Create test video files and folders
    movies_dir = tmp_path / "Movies"
    movies_dir.mkdir()

    sample_mp4 = movies_dir / "sample.mp4"
    sample_mp4.write_bytes(b"0" * 1024 * 50)  # 50 KB dummy video file

    sample_mkv = movies_dir / "clip.mkv"
    sample_mkv.write_bytes(b"1" * 1024 * 20)

    sample_txt = movies_dir / "readme.txt"
    sample_txt.write_text("not a video")

    # Subtitles
    srt_file = movies_dir / "sample.en.srt"
    srt_file.write_text(
        "1\n00:00:01,000 --> 00:00:04,000\nHello World\n\n"
        "2\n00:00:05,000 --> 00:00:08,000\nTesting Subtitles\n"
    )

    scanner.clear_cache()
    yield tmp_path

    settings.set_root_dir(str(orig_root))
    scanner.clear_cache()


@pytest.fixture
def client(temp_storage):
    app = create_app()
    return TestClient(app)


def test_scanner_video_discovery(temp_storage):
    res = scanner.scan_videos(temp_storage)
    videos = res["videos"]
    folders = res["folders"]

    assert len(videos) == 2
    video_names = {v["name"] for v in videos}
    assert "sample.mp4" in video_names
    assert "clip.mkv" in video_names
    assert "readme.txt" not in video_names
    assert "Movies" in folders


def test_subtitle_conversion():
    srt_text = "1\n00:01:20,000 --> 00:01:23,500\nSub Line 1"
    vtt = convert_srt_to_vtt(srt_text)
    assert "WEBVTT" in vtt
    assert "00:01:20.000 --> 00:01:23.500" in vtt


def test_subtitle_discovery(temp_storage):
    subs = discover_subtitles(temp_storage, "Movies/sample.mp4")
    assert len(subs) == 1
    assert subs[0]["lang"] == "en"
    assert subs[0]["label"] == "English"


def test_api_list_videos(client):
    response = client.get("/api/watch/videos")
    assert response.status_code == 200
    data = response.json()
    assert "videos" in data
    assert data["total"] == 2


def test_api_video_details(client):
    response = client.get("/api/watch/video?path=Movies/sample.mp4")
    assert response.status_code == 200
    data = response.json()
    assert data["filename"] == "sample.mp4"
    assert len(data["subtitles"]) == 1


def test_api_video_streaming_full_and_head(client):
    # GET full
    resp_get = client.get("/api/watch/stream?path=Movies/sample.mp4")
    assert resp_get.status_code == 200
    assert resp_get.headers["Accept-Ranges"] == "bytes"

    # HEAD
    resp_head = client.head("/api/watch/stream?path=Movies/sample.mp4")
    assert resp_head.status_code == 200
    assert resp_head.headers["Accept-Ranges"] == "bytes"
    assert int(resp_head.headers["Content-Length"]) == 50 * 1024


def test_api_video_streaming_range_request(client):
    headers = {"Range": "bytes=0-1023"}
    resp = client.get("/api/watch/stream?path=Movies/sample.mp4", headers=headers)
    assert resp.status_code == 206
    assert resp.headers["Content-Range"] == "bytes 0-1023/51200"
    assert resp.headers["Content-Length"] == "1024"
    assert len(resp.content) == 1024

    # Ranged open-ended request
    headers2 = {"Range": "bytes=5000-"}
    resp2 = client.get("/api/watch/stream?path=Movies/sample.mp4", headers=headers2)
    assert resp2.status_code == 206
    assert resp2.headers["Content-Range"] == "bytes 5000-51199/51200"


def test_api_video_streaming_invalid_range(client):
    headers = {"Range": "bytes=9999999-"}
    resp = client.get("/api/watch/stream?path=Movies/sample.mp4", headers=headers)
    assert resp.status_code == 416


def test_api_security_path_traversal(client):
    resp = client.get("/api/watch/stream?path=../../etc/passwd")
    assert resp.status_code in [400, 403, 404]

    resp2 = client.get("/api/watch/video?path=../database.py")
    assert resp2.status_code in [400, 403, 404]


def test_api_progress_tracking(client):
    # Save progress
    payload = {
        "path": "Movies/sample.mp4",
        "position_seconds": 120.5,
        "duration_seconds": 300.0
    }
    resp = client.post("/api/watch/progress", json=payload)
    assert resp.status_code == 200

    # Retrieve progress
    resp_list = client.get("/api/watch/progress")
    assert resp_list.status_code == 200
    items = resp_list.json()["progress"]
    assert len(items) == 1
    assert items[0]["path"] == "Movies/sample.mp4"
    assert items[0]["percent"] == 40.2


def test_api_favorites(client):
    payload = {"path": "Movies/sample.mp4"}

    # Add favorite
    resp_add = client.post("/api/watch/favorites", json=payload)
    assert resp_add.status_code == 200

    # List favorites
    resp_list = client.get("/api/watch/favorites")
    assert resp_list.status_code == 200
    favs = resp_list.json()["favorites"]
    assert len(favs) == 1
    assert favs[0]["path"] == "Movies/sample.mp4"

    # Remove favorite
    resp_del = client.request("DELETE", "/api/watch/favorites", json=payload)
    assert resp_del.status_code == 200

    resp_list2 = client.get("/api/watch/favorites")
    assert len(resp_list2.json()["favorites"]) == 0
