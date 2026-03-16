# SensorGnome Pi Zero 2W — System Reference & Visualization Guide

## Overview

This repository documents the SensorGnome running on a Raspberry Pi Zero 2W, used as an automated VHF radio receiver for the [MOTUS Wildlife Tracking System](https://motus.org). The station detects Lotek NanoTag transmitters attached to migratory birds, bats, and insects, logging pulse-level radio data and uploading tag detection records to the MOTUS network.

---

## Hardware

| Component | Detail |
|-----------|--------|
| **Board** | Raspberry Pi Zero 2W (armv7l) |
| **OS** | Raspbian GNU/Linux 11 (Bullseye) |
| **Hostname** | `SG-189DRPZ20169` |
| **Machine ID** | `A552RPZ22D36` |
| **Network IP** | `10.142.61.149` (local network) |
| **Radio receivers** | RTL-SDR USB dongle(s); FUNcube Dongle Pro+ also supported |
| **Target frequency** | 166.380 MHz (Western Hemisphere Lotek standard) |
| **Sample rate** | 48 kHz stereo per dongle |
| **GPS** | Adafruit Ultimate GPS HAT (`/dev/ttyGPS` serial + `/dev/pps0` PPS on GPIO 4), managed by `gpsd` (port 2947) |
| **Data storage** | SD card mounted at `/data` |
| **Boot count** | 233 (as of 2026-03-15) |

The Pi Zero 2W accepts one or more SDR dongles via a USB hub. Each hub port gets a unique **port number** (1–10) that appears in all detection records as the "antenna port" — enabling directional antennas to be identified.

---

## Software Stack

```
Browser (FlexDash UI)
    │  WebSocket / Socket.IO
    ▼
Node.js sg-control (localhost:8080)   ← main.js
    │
    ├── FlexDash (Socket.IO server)     ← flexdash.js
    ├── Dashboard (event→UI bridge)     ← dashboard.js
    ├── GPS reader (gpsd client)        ← gps.js
    ├── VAH manager                     ← vah.js
    │       │  Unix domain socket
    │       ▼
    │   vamp-alsa-host  (/usr/bin/vamp-alsa-host)
    │       │  ALSA audio stream from RTL-SDR
    │       ▼
    │   lotek-plugins.so:findpulsefdbatch   ← VAMP plugin
    │
    ├── TagFinder manager               ← tagfinder.js
    │       │  stdin/stdout pipe
    │       ▼
    │   find_tags_unifile  (/usr/bin/find_tags_unifile)
    │
    ├── DataSaver / SafeStream          ← datasaver.js / safestream.js
    │       └── /data/SGdata/YYYY-MM-DD/*.txt.gz
    │
    └── MotusUploader                   ← motus_up.js

Caddy (reverse proxy, ports 80/88/443)
    ├── → localhost:8080  (sg-control / FlexDash)
    └── → localhost:8081  (init/config wizard)

Telegraf  (metrics agent, ships to external server)
gpsd      (GPS daemon, port 2947)
```

Key systemd services: `sg-control.service`, `sg-web-portal.service`, `gpsd.service`, `caddy.service`, `telegraf.service`, `sg-hub-agent.service`

---

## Data Pipeline

### 1 — RF → Pulses (`vamp-alsa-host` + VAMP plugin)

The RTL-SDR dongle presents as an ALSA audio device. `vamp-alsa-host` runs the `findpulsefdbatch` VAMP plugin on the real-time audio stream. Plugin parameters (`acquisition.json`):

| Parameter | Value | Meaning |
|-----------|-------|---------|
| `plen` | 2.5 ms | Expected pulse length |
| `minfreq` / `maxfreq` | 2–8 kHz | Frequency offset search range |
| `fftsize` | 24 | FFT size for spectrum analysis |
| `minsnr` | 6 dB | Minimum SNR threshold for a valid pulse |
| `noisesize` | 5 | Noise estimation window (bins) |
| `pulsesep` | 1 ms | Minimum separation between pulses |

Each detected pulse is emitted as a `vahData` event and written to the data file as:
```
p<port>,<timestamp_s>,<freq_offset_kHz>,<signal_dB>,<noise_dB>,<snr_dB>
```

Example: `p6,1681004979.0929,3.785,-29.66,-54.81,25.6`

- **`sig`** — signal power of the pulse (dB, device units from SDR)
- **`noise`** — background noise floor at detection time (dB, same units)
- **`snr`** — pre-computed SNR (`sig − noise`) provided directly by the VAMP plugin
- **`dfreq`** — frequency offset from 166.380 MHz (kHz); indicates the tag's actual transmit frequency

### 2 — Pulses → Tag Detections (`find_tags_unifile`)

`tagfinder.js` pipes the live pulse stream to `find_tags_unifile`, a DFA-based decoder. It reads the tag database (`/etc/sensorgnome/SG_tag_database.sqlite`) and matches pulse bursts against registered Lotek NanoTag patterns.

**How Lotek tags work:**
- Each tag transmits a burst of **4 pulses** with specific inter-pulse gaps (Pulse Position Modulation)
- The gap pattern encodes the **tag ID**; the interval between bursts encodes the **burst interval**
- Together, tag ID + burst interval = unique MOTUS tag identity
- `find_tags_unifile` parameters: `--default-freq 0 --pulse-slop 1.5` (±1.5 ms total gap slop)

A tag detection (`gotTag` event) carries:
```
<ts>,<runID>,<tagID>#<projectID>@<freq>,<signal>,<noise>,<freq_offset>,<slop>,<burstSlop>,...
```

**Run length** is critical for confidence:
- Run ≥ 5 consecutive bursts → high confidence
- Run ≤ 3 → likely false positive (especially at noisy sites)

### 3 — GPS (`gpsd` → `gps.js`)

`gps.js` polls `gpsd` every 60 seconds via TCP (port 2947) using the `?POLL` command. It parses TPV (time-position-velocity) and SKY (satellite) objects and emits a `gotGPSFix` event:
```json
{ "lat": 45.123, "lon": -74.456, "alt": 85.2, "time": 1742000000, "state": "3D-fix" }
```

GPS serves two purposes:
1. **Geolocation** — fixes the station's coordinates, written as `G` records to data files
2. **Time sync** — GPS PPS signal (GPIO 4) feeds `chrony` with two sources: NMEA (`SHM 0 refid NMEA offset 0.5`) and PPS (`refclock PPS /dev/pps0 refid PPS trust`). The `chrony.js` module monitors tracking accuracy and encodes precision into the data filename suffix (T=best → P=GPS → Z=NTP → lower letters = degraded/unsynchronized).

### 4 — Data Files

Compressed archives are written to `/data/SGdata/YYYY-MM-DD/` with naming:
```
sgv2-<machineID>-<bootcount>-<timestamp>.<clockPrec>-all.txt.gz
sgv2-<machineID>-<bootcount>-<timestamp>.<clockPrec>-ctt.txt.gz
```

Time-series JSON files per port are also kept in `/data/ts/` (e.g. `lotek-snr-<port>.json`, `lotek-noise-<port>.json`, `lotek-pulses-<port>.json`) for dashboard sparklines — persisted across reboots.

Record types in the `.txt` files:

| Prefix | Format | Meaning |
|--------|--------|---------|
| `p` | `p<port>,<ts>,<dfreq>,<sig>,<noise>` | Raw Lotek pulse |
| `G` | `G,<ts>,<lat>,<lon>,<alt>` | GPS fix |
| `C` | `C,<ts>,<prec>,<elapsed>` | Clock sync event |
| `S` | `S,<ts>,<port>,<param>,<val>,<err>,...` | SDR parameter setting |

### 5 — Dashboard Data (FlexDash / Socket.IO)

`dashboard.js` listens to Matron events and calls `FlexDash.set(key, value)` to push real-time data to any connected browser. The frontend is **FlexDash** — a Vue.js dashboard using Socket.IO. Widget layout is stored in `/opt/sensorgnome/control/fd-config.json`.

**Live data keys pushed to the dashboard:**

| Key | Type | Content |
|-----|------|---------|
| `gps` | object | `{lat, lon, alt, time, state, ...}` |
| `chrony` | object | `{rms_error, time_source}` |
| `detections_5min` | object | `{lotek: [30 bins×10s], ctt: [30 bins]}` — sparkline data |
| `detection_log` | string | Scrolling log of pulses & tag hits |
| `detections_daily` | array | 100-day detection count array (uPlot format) |
| `detections_hourly` | array | 100-hour detection count array |
| `detection_series` | array | Series names: `['lotek', 'ctt']` |
| `devices/<port>` | object | SDR device info per USB port |
| `radios` | number | Count of active radio devices |
| `lotek_freq` | number | Active detection frequency (166.380) |
| `tagdb` | object | Tag database info (counts per project) |
| `net_inet_status` | string | Internet connectivity state |
| `net_motus_status` | string | MOTUS server reachability |
| `motus_upload` | object | Last upload result |
| `sdcard_use` | number | SD card usage % |
| `data_file_summary` | object | Stats on local data files |
| `samples/<port>/frames` | number | VAH frame count per antenna port |
| `radio_state` | object | Radio health summary `{color, enabled, errors}` |
| `machineinfo` | object | Machine ID, boot count, SD card size |

**Pulse display format** (when `lotek_show_pulses` = "on"):
```
PLS p1 14:23:05: 3.2kHz snr:12.4dB (−45.2/−57.6dB) 1234.5ms
     └─port  └─time  └─freq offset   └─SNR   └─sig/noise    └─gap since last
```

---

## Current Station Status

- **No SDR dongle currently plugged in** — `vamp-alsa-host` and `find_tags_unifile` are running but idle
- **MOTUS upload: 401 Unauthorized** — station not yet registered with `motus.org`; data files exist locally but cannot be uploaded until registered
- **Tag database is a placeholder** — `/etc/sensorgnome/SG_tag_database.sqlite` (2 KB, example tags only); real tags need to be downloaded from MOTUS after registration
- **Telegraf metrics** ship to `https://www.sensorgnome.net/agent/telegraf` every 10 min (system health, not detection data)

---

## Web UI Access

| Interface | URL | Use |
|-----------|-----|-----|
| Main dashboard | `https://10.142.61.149` | FlexDash (requires valid cert or browser exception) |
| HTTP fallback | `http://10.142.61.149:88` | Hotspot interface (192.168.7.x subnet) |
| mDNS | `https://sensorgnome.local` | If on same LAN with mDNS support |

The Caddy server handles HTTPS with a wildcard cert from `local-ip.co`. The backend Node.js app serves FlexDash on `localhost:8080`.

---

## MOTUS Context

[MOTUS](https://motus.org) is a hemispheric radio-telemetry network operated by Birds Canada. SensorGnome stations register with MOTUS and upload compressed data archives. Server-side `find_tags` then decodes detections against the full global tag registry.

**Data hierarchy:**
- **Pulse** → single 20 ms radio emission
- **Burst** → 4 pulses encoding one tag ID
- **Hit** → one confirmed decoded burst (columns: `ts`, `sig`, `noise`, `freq`, `slop`, `burstSlop`, `runLen`)
- **Run** → sequence of consecutive hits for one tag on one antenna
- **Batch** → all data from one boot session, uploaded as a unit

Tag deployments require pre-registration (species, attach date, location) for detections to appear in researcher data views. This station's current tag database is a placeholder with 2 example tags.

---

## Interesting Metrics & Creative Visualization Ideas

### Core Metrics Available in Real-Time

| Metric | Source | Notes |
|--------|--------|-------|
| **Noise floor** | `noise` in pulse records | dB; varies with local RF environment |
| **Signal strength** | `sig` in pulse records | dB; proxy for animal distance/aspect |
| **SNR** | `sig − noise` | Key quality indicator; threshold 6 dB |
| **Pulse rate** | `detections_5min.lotek` | Pulses per 10-second bin |
| **Tag detection rate** | `detections_5min.ctt` + Lotek gotTag | Confirmed bursts per bin |
| **Frequency offset** | `dfreq` kHz | Each tag has a characteristic freq drift |
| **GPS fix quality** | `gps.state` | `"3D-fix"` / `"2D-fix"` / `"no-sat"` |
| **Clock precision** | `chrony.rms_error` | Sub-ms when GPS-synced |
| **Antenna activity** | `samples/<port>/frames` | Frames per port for health monitoring |
| **Run length** | embedded in tag detection string | Confidence proxy (≥5 = reliable) |

---

### Visualization Ideas

#### 1. **Live RF Environment Gauge**
A dual-needle radial gauge showing current signal floor and rolling noise floor simultaneously. Color bands: green (quiet, <−55 dB noise), yellow (moderate), red (noisy, >−40 dB). Helps diagnose interference sources (nearby electronics, weather radar, etc.).

#### 2. **Pulse Waterfall / Spectrogram Proxy**
A rolling heatmap: X = time (scrolling), Y = frequency offset (kHz, −5 to +15), cell brightness = pulse count. This approximates a spectrum waterfall using detected pulses. Tag bursts appear as characteristic vertical stripes at their tag frequency.

#### 3. **SNR Distribution Histogram**
Live histogram of pulse SNR values in the last N minutes. A healthy station shows a peak around 8–15 dB with a tail. A bimodal distribution suggests two interference sources. Baseline shifts indicate antenna alignment or habitat changes.

#### 4. **Tag Detection Event Timeline**
A swimlane chart with one lane per antenna port. Each confirmed tag burst is a dot; dot size = SNR; dot color = tag species (if registered). Hovering shows tag ID, run length, burst interval. Reveals which antennas are active and when animals are in range.

#### 5. **SNR vs. Time-of-Day Heat Map**
A 24×7 matrix (hours × days of week) colored by mean SNR or detection count. Reveals daily noise patterns (human activity cycles) vs. biological activity patterns (crepuscular migration peaks at dawn/dusk).

#### 6. **Run Length Confidence Meter**
For each current detection run: a segmented progress bar filling as more bursts arrive (1→2→3→4→5+). Color shifts from red (unreliable, <4) through orange to green (≥5 bursts = high confidence). Resets between runs.

#### 7. **Noise Floor Trend + Anomaly Flags**
A time-series chart of 1-minute median noise floor per port with threshold lines. Automated anomaly detection: flag when noise floor rises >5 dB above the rolling 24-hour baseline. Log flagged windows for interference investigation.

#### 8. **Station Health Dashboard Panel**
A compact status grid:
- GPS lock status (satellite count + fix type + clock sync precision)
- Radio ports: each port as a colored square (green=active, grey=no device, red=stalled)
- SD card fill ring: donut chart showing used/free
- MOTUS connectivity: last upload timestamp + status
- Uptime + boot count trend

#### 9. **Frequency Offset Fingerprinting**
A scatter plot of `dfreq` (frequency offset) for each tag's pulses over time. Each Lotek tag drifts predictably with temperature — plotting offset vs. time of day creates a unique "fingerprint." Could distinguish individual tags with the same ID in edge cases.

#### 10. **Burst Quality Decomposition (per detection)**
For each confirmed tag detection, display a micro-visualization of the 4 pulses:
- Four vertical bars representing signal strength of each pulse
- Lines connecting them showing inter-pulse gaps vs. expected gaps (gap deviation = slop)
- Color = within tolerance (green) or near-miss (orange)
Makes abstract burst/slop metrics tangible for field biologists.

#### 11. **Migration Activity Clock**
A polar/radial chart where angle = hour of day (24h), radius = detection count, filled over multiple days. Migration events (intense activity at night/dawn) produce dramatic visual spikes distinguishable from noise-only days.

#### 12. **Live Map with Signal Cone**
Station GPS position on a Leaflet.js map with a cone overlay showing antenna bearing(s) and approximate detection range (scaled by current median SNR). When a tag is detected, animate a "ping" radiating from the station.

#### 13. **Signal Decay Curve**
When a tag run ends, plot the per-burst signal strength over the run duration. A smooth decay curve suggests an animal flying away; an abrupt drop suggests obstruction. A U-curve (weak → strong → weak) suggests a flyover.

#### 14. **Noise vs. Wind Correlation Panel**
If weather data is available (local sensor or API): overlay noise floor with wind speed. High-correlation events indicate physical antenna movement. Low-correlation spikes indicate RF interference. Useful for site quality assessment.

---

## Config Files

| Path | Purpose |
|------|---------|
| `/etc/sensorgnome/acquisition.json` | Receiver plans, plugin params, GPS poll rate, Lotek freq |
| `/etc/sensorgnome/id` | `SG-189DRPZ20169` |
| `/etc/sensorgnome/remote.json` | `{"commands":true,"webui":true,"support":0}` — remote access policy |
| `/etc/default/telegraf` | `SGID`, `SGKEY`, `INTERVAL=10m` for metrics shipping |
| `/etc/sensorgnome/SG_tag_database.sqlite` | Local tag registry (currently placeholder) |
| `/etc/sensorgnome/usb-port-map.txt` | Maps USB hub ports to human-readable antenna labels |
| `/etc/caddy/Caddyfile` | (symlinked) → `/opt/sensorgnome/web-portal/Caddyfile` |
| `/opt/sensorgnome/control/fd-config.json` | FlexDash widget layout (59 KB) |
| `/opt/sensorgnome/control/main.js` | Main process entry point |
| `/etc/telegraf/telegraf.conf` | Metrics agent config (ships to external TSDB) |

---

## Key GitHub Repos

| Repo | Purpose |
|------|---------|
| [`sensorgnome-org/sensorgnome-pi`](https://github.com/sensorgnome-org/sensorgnome-pi) | Pi SG software (this codebase) |
| [`sensorgnome-org/vamp-plugins`](https://github.com/sensorgnome-org/vamp-plugins) | VAMP pulse detection plugin |
| [`sensorgnome-org/vamp-alsa-host`](https://github.com/sensorgnome-org/vamp-alsa-host) | ALSA audio host for VAMP plugins |
| [`sensorgnome-org/find_tags`](https://github.com/sensorgnome-org/find_tags) | DFA tag detection algorithm |
| [`MotusWTS/find_tags`](https://github.com/MotusWTS/find_tags) | Server-side tag finder |
| [`flexdash/flexdash`](https://github.com/flexdash/flexdash) | Dashboard framework |
