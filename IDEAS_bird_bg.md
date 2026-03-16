# Bird Imagery Background — Ideation

Theme constraints: dark green palette (`#0b120b`), monochrome + amber accents, serious scientific instrument UI. Background layer should sit at ~15% opacity (85% transparent) — peaceful, not distracting, providing just enough biological warmth to contextualize the data.

---

## Idea 1 · Boids Flock (Procedural)

**What:** A boids-algorithm particle system where ~20–40 birds fly in loose emergent flocks behind all panels using a low-opacity canvas layer fixed behind `.layout`.

**How it looks:** Small chevron or teardrop glyphs (3–6 px) drift and cohere, splitting and rejoining naturally. Flocks drift slowly left-to-right or arc downward like a migration crossing. No loops — birds exit one edge and re-enter from the opposite after a delay.

**Why distinct:** Purely procedural, never repeats exactly, very alive-feeling. Matches the "tracking animal movement" subject matter perfectly.

**Opacity / blend:** `rgba(154,200,138, 0.12)` glyphs, `mix-blend-mode: screen`.

---

## Idea 2 · SVG Silhouette Treeline + Departing Birds

**What:** A static SVG treeline silhouette across the bottom ~15% of the viewport (Ontario forest edge — mixed deciduous/conifer) with birds perched invisibly on branches. Every 8–25 seconds a bird lifts off, arcs upward in a slow Bézier curve, and fades out near the top.

**How it looks:** Like watching a forest at dusk from a blind. Most of the time calm and static; occasional departures give punctuation. Trees are `#0f180f` on the `#0b120b` background — barely visible, felt more than seen.

**Why distinct:** The departure events are discrete "moments" rather than continuous motion — like the station itself registering discrete tag events. Good narrative parallel.

**Opacity / blend:** Tree fill at 60% opacity; bird arcs start at 18% and fade to 0 by exit.

---

## Idea 3 · Migration Ribbon (V-Formation Flyover)

**What:** Periodic V-formations of birds cross the screen diagonally (NE → SW or reverse, matching Atlantic / Mississippi flyway angles). Each formation is 7–15 birds in a realistic asymmetric V. Formations appear every 30–90 seconds, transit over 12–20 seconds.

**How it looks:** Like a time-lapse of migration from above. Between formations the screen is fully still. When one appears it moves at a constant slow speed, wing positions cycling through a 4-frame sprite-style update.

**Why distinct:** The long pause + slow crossing creates a meditative rhythm. The V-formation is the most iconic bird-migration silhouette and directly evokes the MOTUS mission.

**Opacity / blend:** `rgba(154,200,138, 0.10)` base, slight brighten on lead bird.

---

## Idea 4 · Pixel-Sprite Flapping Birds (Varied Depth)

**What:** Classic pixel-art approach: a small sprite sheet (8×8 or 12×12 px) with a 4–6 frame wing-beat cycle. 5–12 birds cross independently at different y-positions, speeds, and sizes to give a depth illusion (parallax — larger/faster = closer).

**How it looks:** Retro and textural, fitting the monospace aesthetic of the dashboard. A small bird near the top moves slowly; a larger one near the mid-panel crosses faster. Feels like looking through a wire-mesh window at a field station.

**Why distinct:** The sprite aesthetic matches the monospace / terminal feel of the UI. Most other ideas use smooth vector; this one is pixelated and has character.

**Opacity:** Drawn at 12–18%, larger/closer birds slightly brighter.

---

## Idea 5 · Parallax Layered Forest (CSS + Canvas)

**What:** Three stacked background layers (far, mid, near) each a simplified tree-canopy silhouette. On mouse move or a slow auto-pan, layers shift at different rates (parallax). No birds — motion comes from the depth effect alone, plus very slow `background-position` drift.

**How it looks:** Like looking out through layered forest at slightly different focal distances. Subtle perpetual left-right drift (~1–2 px/sec) creates the impression of a slow walk along a trail.

**Why distinct:** No bird glyphs at all — the implied presence of habitat is itself evocative. Cleanest, lowest visual noise of all ideas. Works well if the UI needs maximum readability.

**Implementation:** Pure CSS `background-image: svg(...)` with `@keyframes` shifting `background-position`.

---

## Idea 6 · Perching Birds on Panel Edges

**What:** Birds land on the top borders of panels (treat the 1px `border-top` as a wire or branch). A bird glides in, lands with a tiny bounce keyframe, sits for 5–15 seconds, then lifts off. Max 2–3 birds visible at a time.

**How it looks:** Like swallows on a power line. The birds are small (10–14 px) and positioned absolutely relative to `.panel` elements. When a tag detection fires, a bird is triggered to land on the stream panel border.

**Why distinct:** Directly interactive with the data — tag events spawn perch events. The panels become habitat. Also the most charming / whimsical of the ideas.

**Opacity:** Bird glyphs at 20% default, 35% while "active" (tag just landed).

---

## Idea 7 · Feather Drift

**What:** Occasional feathers (stylized SVG, 8–14 px) drift slowly downward with a lazy sine-wave sway, tumbling slightly as they fall. 1–3 feathers visible at any time, appearing every 15–40 seconds. Fade in at top, fade out at bottom.

**How it looks:** Like being inside a blind where a bird recently landed overhead. Very minimal, meditative. The feathers rotate slightly as they fall using CSS `transform: rotate()`.

**Why distinct:** Indirect — suggests birds without showing them. The most ambient and least distracting idea. Good pairing with other ideas as a subtle secondary layer.

**Opacity:** 8–15%, feather shape barely resolved against the dark background.

---

## Idea 8 · Sky Tone Cycle (Dawn / Dusk Gradient)

**What:** A very slow (30–60 minute) background gradient cycle that mimics the sky at different times of day — deep navy-black at night, a barely-visible warm amber horizon blush at dawn/dusk, fading back to the dark green. Synced to wall-clock time. Birds (simple chevrons) are more active and numerous during the dawn/dusk windows.

**How it looks:** The dashboard subtly "feels" different at 6am vs noon vs midnight. At dawn a faint gradient bleeds in from the bottom; 5–8 birds cross over 20 minutes; then it fades. Most of the day it's just the normal dark green with no birds.

**Why distinct:** Clock-driven ambient — the background reflects real ecological time. Reinforces that SensorGnome detects migrating birds at dawn/dusk when they're actually moving.

**Opacity:** Sky gradient max 8%; bird chevrons 12% at peak, 0% in the middle of the night.

---

## Idea 9 · Detection-Triggered Bird Ghost

**What:** Every confirmed tag detection (the amber `▶ TAG` line) spawns a ghostly bird silhouette that briefly appears over the blurb panel, hovers for 1–2 seconds with a shimmer effect, then fades out. The silhouette is the approximate shape of a warbler or shorebird — the likely species being tracked.

**How it looks:** Data event → visual poetry. The ghost appears center-panel, about 40–60 px wingspan, drawn at low opacity with a subtle radial glow in amber. Like a spirit of the animal passing through.

**Why distinct:** 1:1 tied to real data — every ghost represents an actual animal detected at that moment. The most semantically meaningful of all ideas.

**Opacity:** Peaks at 22% mid-shimmer, fades completely over 1.5s.

---

## Idea 10 · Ontario Flyway Animated Paths (Map Layer)

**What:** On the existing Ontario map canvas, faint dotted trails animate along actual Atlantic flyway corridors running south through the map. Small chevron birds travel along these paths at slow speed, disappearing at the map edge. The station location is on a corridor.

**How it looks:** Extends the map into a living flyway diagram. Trails are amber (`rgba(200,168,64,0.08)`), birds are 3px chevrons. 2–4 birds in transit at any time on the map, taking 6–10 seconds to cross.

**Why distinct:** Geographically grounded — uses real flyway data in the map context already present in the UI. Reinforces that this station sits on a migration superhighway.

**Opacity:** Path lines at 6%, bird glyphs at 15%.

---

## Combinations Worth Exploring

| Base idea | + Accent layer | Effect |
|---|---|---|
| #5 Parallax Forest | + #7 Feather Drift | Maximum calm, minimum distraction |
| #2 Treeline | + #6 Perching Birds | Habitat + life, cohesive |
| #3 V-Formation | + #8 Sky Cycle | Time-aware, ecological narrative |
| #1 Boids | + #9 Detection Ghost | Data-reactive, scientifically apt |
| #4 Pixel Sprites | + #10 Map Flyway | Consistent aesthetic, map + bg unified |
