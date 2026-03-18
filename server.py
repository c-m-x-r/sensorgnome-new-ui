#!/usr/bin/env python3
"""SensorGnome dashboard backend.

Usage:
  uv run server.py           # demo mode  — synthetic pulses
  uv run server.py --live    # live mode  — SSH-tail Pi data files
  uv run server.py --port 9000
"""

import argparse
import asyncio
import json
import random
import subprocess
import time
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

app = FastAPI()
app.mount("/bg",     StaticFiles(directory="static/bg", html=True), name="bg")
app.mount("/static", StaticFiles(directory="static"),               name="static")

STATION = {
    "id":   "SG-189DRPZ20169",
    "lat":  43.4643,
    "lon":  -80.5204,
    "freq": 166.380,
    "boot": 233,
}

PI_HOST = "gnome@172.20.10.2"


# ── Synthetic demo generator ───────────────────────────────────────────────────

_counter = 0

async def demo_stream():
    global _counter
    yield f"data: {json.dumps({'type': 'status', **STATION})}\n\n"

    while True:
        _counter += 1
        port  = random.choices([1, 2], weights=[3, 1])[0]
        noise = round(random.gauss(-53.5, 2.2), 2)
        sig   = round(noise + random.gauss(13.5, 5.0), 2)
        snr   = round(sig - noise, 2)
        freq  = round(max(2.0, min(8.0, random.gauss(4.1, 1.4))), 3)
        ts    = time.time()

        pulse = {
            "type": "pulse", "port": port, "ts": ts,
            "freq": freq, "sig": sig, "noise": noise, "snr": snr,
        }
        yield f"data: {json.dumps(pulse)}\n\n"

        # inject a tag detection roughly every 25 pulses
        if _counter % random.randint(18, 35) == 0:
            tag_id = random.choice(["6621", "7432", "8815", "5209", "3147"])
            run    = random.randint(4, 14)
            burst  = random.choice([5.0, 6.7, 8.1, 10.3, 12.5])
            s      = round(random.gauss(-36.0, 5.0), 1)
            n      = round(s - random.gauss(13.0, 2.5), 1)
            tag = {
                "type": "tag", "ts": time.time(), "tag_id": tag_id,
                "freq": STATION["freq"], "sig": s, "noise": n,
                "snr": round(s - n, 1), "run": run, "burst": burst,
            }
            yield f"data: {json.dumps(tag)}\n\n"

        await asyncio.sleep(random.uniform(0.05, 0.22))


# ── Live SSH stream ────────────────────────────────────────────────────────────

def _parse_line(line: str) -> dict | None:
    if line.startswith("p"):
        p = line.split(",")
        if len(p) < 5:
            return None
        try:
            port  = int(p[0][1:])
            ts    = float(p[1])
            freq  = float(p[2])
            sig   = float(p[3])
            noise = float(p[4])
            snr   = float(p[5]) if len(p) > 5 else round(sig - noise, 2)
            return {"type": "pulse", "port": port, "ts": ts,
                    "freq": freq, "sig": sig, "noise": noise, "snr": snr}
        except (ValueError, IndexError):
            return None

    if line.startswith("G,"):
        p = line.split(",")
        try:
            return {"type": "gps", "lat": float(p[2]), "lon": float(p[3])}
        except (ValueError, IndexError):
            return None

    if line.startswith("L") and "," in line:
        p = line.split(",")
        try:
            raw_id = p[2].split("#")[0]
            tag_id = raw_id.lstrip("L").lstrip("0") or raw_id
            s = float(p[4]) if len(p) > 4 else 0.0
            n = float(p[5]) if len(p) > 5 else 0.0
            return {"type": "tag", "ts": float(p[1]), "tag_id": tag_id,
                    "sig": s, "noise": n, "snr": round(s - n, 1)}
        except (ValueError, IndexError):
            return None

    return None


async def live_stream():
    yield f"data: {json.dumps({'type': 'status', **STATION})}\n\n"

    # find latest uncompressed all.txt on the Pi
    try:
        r = subprocess.run(
            ["ssh", "-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=no",
             PI_HOST,
             "find /data/SGdata -name '*-all.txt' | sort | tail -1"],
            capture_output=True, text=True, timeout=10,
        )
        latest = r.stdout.strip()
    except Exception as e:
        print(f"SSH error: {e} — falling back to demo mode")
        latest = ""

    if not latest:
        print("No live file found — falling back to demo mode")
        async for evt in demo_stream():
            yield evt
        return

    print(f"Tailing {latest} on {PI_HOST}")
    proc = await asyncio.create_subprocess_exec(
        "ssh", "-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=no",
        PI_HOST, f"tail -n 20 -F {latest}",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )
    try:
        while True:
            line = await asyncio.wait_for(proc.stdout.readline(), timeout=60.0)
            if not line:
                break
            evt = _parse_line(line.decode().strip())
            if evt:
                yield f"data: {json.dumps(evt)}\n\n"
    except asyncio.TimeoutError:
        pass
    finally:
        try:
            proc.kill()
        except Exception:
            pass


# ── FastAPI routes ─────────────────────────────────────────────────────────────

_live_mode = False


@app.get("/stream")
async def stream_endpoint(request: Request):
    gen = live_stream() if _live_mode else demo_stream()

    async def wrap():
        async for chunk in gen:
            if await request.is_disconnected():
                break
            yield chunk

    return StreamingResponse(
        wrap(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )



@app.get("/")
async def root():
    return HTMLResponse(Path("index.html").read_text())


@app.get("/light")
async def light():
    return HTMLResponse(Path("light.html").read_text())


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SensorGnome Dashboard")
    parser.add_argument("--live", action="store_true", help="SSH-tail Pi files")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    _live_mode = args.live
    mode = "LIVE (SSH)" if _live_mode else "DEMO (synthetic)"
    print(f"SensorGnome Dashboard [{mode}]")
    print(f"  http://localhost:{args.port}")
    uvicorn.run(app, host="0.0.0.0", port=args.port, log_level="warning")
