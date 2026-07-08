---
name: youtube-download
description: Download a video from a URL (YouTube etc.) to the local computer in the best available quality. Use whenever the user shares a video link and asks to download/save it — e.g. "скачай это видео", "download this video", "сохрани этот ролик", "save this clip". Handles the YouTube DRM/403 quirks and installs yt-dlp/ffmpeg if missing.
---

# YouTube Download

Downloads a video (YouTube or any yt-dlp-supported site) to the local disk in the best
available quality. Trigger phrase: **"скачай это видео"** (or "download this video") together
with a URL. Do the whole thing end to end without asking — only ask if the URL is missing.

Default output directory: **`~/Downloads`**. The URL may include a `&t=123s` timestamp or a
playlist id — always pass `--no-playlist` so only the single linked video is fetched; the
timestamp is ignored (the full video is downloaded).

## Steps

### 1. Make sure the tools exist

```
which yt-dlp ffmpeg
```

If either is missing, install via Homebrew (this machine has `/usr/local/bin/brew`):

```
brew install yt-dlp ffmpeg
```

`ffmpeg` is required to merge separate video+audio streams and to mux HLS. Confirm with
`yt-dlp --version` / `ffmpeg -version`.

### 2. Read the video's info first (title / duration / resolution)

```
yt-dlp --no-playlist --print "%(title)s | %(duration>%H:%M:%S)s | %(resolution)s" "<URL>"
```

Report it so the user sees what's being downloaded.

### 3. Download — YouTube needs the `web_safari` client

Plain `yt-dlp <URL>` frequently **fails on YouTube** right now:
- the default/android client → `HTTP Error 403: Forbidden` on the media,
- the `tv` client → DRM-protected ("only images are available for download").

The reliable path is the **`web_safari`** player client, which exposes normal HLS formats up
to 1080p. Download the best of those and merge to mp4:

```
cd ~/Downloads && yt-dlp --no-playlist \
  --extractor-args "youtube:player_client=web_safari" \
  -f "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b/96/95" \
  --merge-output-format mp4 \
  -o "%(title)s [%(id)s].%(ext)s" \
  "<URL>"
```

Notes / gotchas learned the hard way:
- The response is **flaky between calls** — sometimes yt-dlp reports "only images available"
  even with `web_safari`. Just **retry 2–3 times**; it succeeds on a subsequent attempt. A
  simple retry loop is fine:
  ```
  for i in 1 2 3; do yt-dlp ... "<URL>" && break; sleep 3; done
  ```
- If the exact format ids fail, **list what's actually available** and pick by hand:
  ```
  yt-dlp --no-playlist --extractor-args "youtube:player_client=web_safari" -F "<URL>"
  ```
  With `web_safari` you'll typically see HLS itags `91`–`96` (144p→1080p) and progressive
  `18` (360p). `96` = 1080p, `95` = 720p — `-f 96` (or `-f 96/95`) grabs 1080p/720p directly.
- yt-dlp may solve JS challenges with `deno` — that's normal, let it run.
- For a **non-YouTube** URL, skip `--extractor-args` and just use
  `-f "bv*+ba/b" --merge-output-format mp4`.

### 4. Verify the file

```
ffprobe -v error -show_entries format=duration \
  -show_entries stream=width,height,codec_type -of default=nw=1 \
  ~/Downloads/*"<id>"*.mp4
```

Confirm it has both a video and an audio stream, the expected resolution, and a sane duration.

### 5. Report

Tell the user the final **path**, **resolution**, **duration** and **size**. Downloads can be
slow — if a foreground call times out, run the download in the background and report when done.

## After downloading

This project turns movie/show clips into vocabulary social videos. If the user next wants to
cut the download into scenes and make subtitled videos with phrase mockups, that's the
**`social-video`** skill (its "From a long video → scenes" flow: `transcribe-full` →
`cut-scene` per scene → per-scene pipeline). Don't do it as part of "скачай это видео" unless
they ask — but if the user gave a link **and** asked for the videos in one go, chain straight
into `social-video` after the download.
