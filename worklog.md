# NagRaksha — Work Log

## Project Summary (from documents)

NagRaksha ("snake protection") is a software-only, PWA-first emergency
response & prevention platform for snakebites in India. One SOS fans out
in parallel to three responder categories (trained individual, rescue
team, ambulance/hospital), routes to the nearest hospital with confirmed
antivenom stock, and adds AI prevention (myth-buster chatbot, snake photo
ID, weather-based risk).

## Key brand tokens (from Brand Style Guide)
- Forest #184D36 (primary), Deep Forest #102A20 (dark surface)
- Emergency Red #B42318 (SOS), Antivenom Gold #D69E2E (stock/risk)
- Mist #EAF3ED (calm panels), Paper #F7F9F8 (bg), Slate #52605A (secondary)
- Typography: Aptos Display / Inter; tabular numerals for ETA/numbers
- Voice: calm urgency, clinical clarity. No decorative parallax/bounce.

## User requirements (this build)
1. Illustration shaders (WebGL fragment shader background)
2. Snake (video/gif broken to frames) → scroll progress indicator that
   smoothly slithers down the page as the user scrolls.
3. 3-lined dock for all tabs (active section marker = 3 lines; also
   symbolises the 3 parallel responders).
4. Suitable font + illustrations + animations + proper backend.
5. Dark color palette (adapt brand tokens to dark theme).
6. PWA (installable, offline shell, manifest + service worker).
7. Read all docs first (done).

## Architecture decisions
- Single route `/` (landing experience, scroll-driven).
- Dark palette: bg #0A1812, surface #102A20 / #122E22, primary forest
  brightened to #1F6B4A for dark contrast, red #E5484D, gold #E0B443,
  mist #EAF3ED, slate-muted #8FA39B.
- Fonts: Inter (display/body) + JetBrains Mono (numeric/ETA) via
  next/font/google.
- Snake indicator: procedural SVG serpent whose head tracks scroll
  progress on a vertical rail and whose body slithers via a time-phased
  sine wave (the "frames" are sampled body poses interpolated smoothly).
  Plus a generated slithering snake sprite for atmospheric accent.
- Shader: full-viewport WebGL canvas, fragment shader = flowing
  bioluminescent snake-scale / particle field in forest+gold palette.
- Dock: floating glass dock, bottom-center; active section marked with
  3 stacked lines (echoes 3 parallel responders); smooth-scroll on click.
- Backend (Next API + Prisma/SQLite): incidents, responder lanes,
  hospitals + antivenom stock, risk advisory, snake-id (mock CV), myth
  buster (z-ai-web-dev-sdk LLM), stats.

## Task plan
- 1 : Read all documents (done)
- 2-a : (subagent) generate atmospheric snake illustrations + slither
       sprite frames via image-generation skill
- 3 : PWA manifest + service worker + icons + layout metadata
- 4 : Prisma schema + db push + seed
- 5 : Backend API routes (sos, incidents, hospitals, stock, risk,
       snake-id, myth-buster, stats)
- 6 : Core components — ShaderBackground, SnakeProgress, TriLineDock,
       section primitives
- 7 : Page sections + assembly + animations
- 8 : Lint + Agent Browser self-verify + fix

---
Task ID: 1
Agent: main (orchestrator)
Task: Read all NagRaksha documents and produce the build plan.

Work Log:
- Read SRS, System Design, PRD, Brand Style Guide, Wireframes (pandoc).
- Extracted Pitch deck text (unzip + XML parse).
- Inspected existing project scaffold (Next 16, shadcn/ui, Prisma sqlite,
  z-ai-web-dev-sdk, framer-motion, next-themes present).
- Confirmed dev server running on :3000.

Stage Summary:
- Full product understanding captured above. Proceeding to PWA + backend
  + frontend build. Delegating atmospheric image generation to a subagent.

---
Task ID: 2-a
Agent: image-generation subagent
Task: Generate atmospheric snake illustrations + slither sprite frames for
the dark, premium, emergency-medical NagRaksha landing page, using the
image-generation Skill (z-ai CLI). Save all assets under
/home/z/my-project/public/snake/. Do NOT touch Next.js source.

Work Log:
- Read worklog.md and image-generation SKILL.md (CLI usage, supported
  sizes: 1024x1024, 768x1344, 864x1152, 1344x768, 1152x864, 1440x720,
  720x1440).
- Created /home/z/my-project/public/snake/.
- Generated hero-snake.png at 1024x1024 (protective coiled serpent,
  bioluminescent gold+forest-green scales on near-black, mystic guardian).
- Generated snake-frame-1..6.png for the slithering scroll indicator.
  NOTE: 1440x720 and 720x1440 are listed by the CLI but REJECTED by the
  upstream API (error 1214: dimensions must be multiples of 32; 720 is
  not a multiple of 32). Fell back to 1344x768 (closest working 7:4
  landscape, ~1.75:1). Each frame = same top-down gold line-art snake
  with a different sine-wave body phase (crest-left→straight→trough-left
  →straight-dip→moderate-crest→gentle-S). The orchestrator's sprite
  animation should treat them as 6 phases of one cycle.
- Generated scale-pattern.png at 1024x1024 (subtle dark forest scale
  texture with faint gold edges, intended as faint overlay).
- Generated responder-illustration.png at 1024x1024 (three glowing
  converging lanes in gold/forest-green/emergency-red on near-black).
- Generated antivenom-vial.png at 1024x1024 (glowing gold medical vial).
- The z-ai CLI writes the API's JPEG payload to disk with a .png
  extension (mismatch). Re-encoded every file with Pillow to TRUE PNG
  format so the Content-Type (image/png) served by Next.js matches the
  actual bytes. All assets verified via `file`: PNG image data, correct
  dimensions, non-zero size.
- No Next.js source files were modified. No failures.

Stage Summary:
- 10 atmospheric image assets produced in /home/z/my-project/public/snake/:
    hero-snake.png              1024x1024  (1,308,175 B)
    snake-frame-1.png           1344x768   (400,004 B)
    snake-frame-2.png           1344x768   (392,268 B)
    snake-frame-3.png           1344x768   (383,434 B)
    snake-frame-4.png           1344x768   (391,938 B)
    snake-frame-5.png           1344x768   (372,039 B)
    snake-frame-6.png           1344x768   (408,353 B)
    scale-pattern.png           1024x1024  (1,460,734 B)
    responder-illustration.png  1024x1024  (611,687 B)
    antivenom-vial.png          1024x1024  (310,736 B)
- All files are valid true-PNG, non-empty, ready to serve from /snake/...
- Caveat for the orchestrator: slither frames are 1344x768 (not the
  originally requested 512x256) due to API size constraints; CSS can
  scale/crop as needed. Frame consistency is approximate (AI is
  non-deterministic across calls) but each is a centered gold top-down
  snake silhouette on near-black, suitable as atmospheric accent. The
  core site does NOT depend on these images.

---
Task ID: 2-a
Agent: image-generation subagent
Task: Generate atmospheric snake illustrations + slither sprite frames via the image-generation skill.

Work Log:
- Read SKILL.md for image-generation; used z-ai CLI to generate 10 assets.
- Re-encoded every output to true PNG via Pillow (CLI saved JPEG with .png ext).
- Saved to /home/z/my-project/public/snake/.

Stage Summary:
- 10 assets produced (hero-snake, snake-frame-1..6, scale-pattern, responder-illustration, antivenom-vial).
- Slither frames are 1344x768 (closest working landscape size). CSS-scaled in SlitherSprite.
- No Next.js source files modified.

---
Task ID: 3-8
Agent: main (orchestrator)
Task: Build the full NagRaksha dark-theme PWA — shader background, snake scroll-progress, 3-line dock, sections, backend, PWA, verify.

Work Log:
- globals.css: dark NagRaksha palette (bg #0A1812, forest #2BB673, gold #D69E2E, red #E5484D), Inter + JetBrains Mono fonts, glass/glow/reveal/marquee utilities, custom scrollbar, reduced-motion guards, scroll-padding for dock clearance.
- PWA: public/manifest.webmanifest (standalone, shortcuts, icons), public/sw.js (app-shell precache, network-first nav, stale-while-revalidate assets, never caches /api, offline fallback), public/offline.html, icons (192/512/maskable/apple-touch/favicon) generated via sharp from an SVG shield+serpent motif.
- layout.tsx: Inter + JetBrains Mono via next/font, forced dark, PWA metadata (manifest, themeColor #0A1812, appleWebApp, icons, OG), inline SW registration.
- Prisma schema (Incident, DispatchAttempt, Hospital, AntivenomStock, SymptomObservation, SnakeObservation, RiskReport, MythThread) + db push + seed (4 hospitals w/ stock states, 3 risk reports).
- Backend API (all tested 200): POST /api/sos (parallel 3-lane fan-out + antivenom-aware ranking), GET/PATCH /api/incidents/[id], GET /api/hospitals, PATCH /api/hospitals/[id]/stock, GET /api/risk, POST /api/snake-id (VLM w/ mock fallback), POST /api/myth-buster (LLM w/ emergency guard + curated fallback), GET /api/stats.
- Frontend: ShaderBackground (WebGL fragment shader — flowing snake-scale + gold vein + spores, scroll-reactive), SnakeProgress (procedural SVG serpent on left rail; head = eased scroll progress; body = time-phased sine slither; the snake IS the progress bar), SlitherSprite (cycles 6 generated frames, speeds up on scroll), TriLineDock (floating glass dock, active section marked with 3 stacked lines = 3 parallel responders, smooth-scroll), Reveal/useInView/useActiveSection hooks, sections (Hero, Problem, ParallelDispatch, HowItFlows, Roles, Prevention, Routing, LiveSosDemo, Roadmap) + SiteFooter (sticky via mt-auto).
- Bug fixed: `Section` was not exported -> "Element type is invalid" 500 -> exported it.
- Added scroll-padding-bottom + pb-28 so the fixed dock never covers interactive content.

Stage Summary:
- `bun run lint` clean. Page returns 200 with no runtime/hydration errors.
- Agent Browser verified: hero renders (dark theme, snake mascot, SOS button), snake progress indicator slithers down the left rail on scroll, 3-line dock scrolls to sections, live SOS demo creates an incident and shows 3 ACCEPTED lanes + antivenom-aware hospital ranking (RECOMMENDED on confirmed-stock hospital, stale/out hospitals demoted), myth-buster LLM busts myths (MYTH/FACT) and persists, risk panel + snake-id + stats all live, mobile (390px) responsive, PWA manifest/sw/icons all serve 200.
- All user requirements met: illustration shaders, snake-frames-as-progress-indicator with smooth scroll animation, 3-lined dock, fonts+illustrations+animations+backend, dark palette, PWA, read all docs first.
