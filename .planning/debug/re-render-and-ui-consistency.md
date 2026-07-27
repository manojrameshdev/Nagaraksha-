# Debug Session: Re-render Issue & UI Consistency
**Slug:** re-render-and-ui-consistency  
**Date:** 2026-07-27  
**Status:** RESOLVED

---

## Evidence of Verification
- Vitest: 16 / 16 frontend unit tests passed
- Pytest: 33 / 33 backend unit tests passed
- TypeScript: 0 errors (`npx tsc --noEmit`)
- ESLint: 0 errors, 0 warnings (`npx eslint . --max-warnings 0`)
- Bandit: 0 security vulnerabilities (`bandit -r . -c ../.bandit.yaml`)

---

## Additional Re-render Hardening (Step 2)
1. **`useActiveSection` scroll bailout**: Added `setActive(prev => prev === current ? prev : current)` to prevent state updates on scroll when section ID hasn't changed.
2. **`useScrollProgress` velocity bailout**: Added `setVelocity(prev => prev === v ? prev : v)` to prevent state updates on scroll when velocity hasn't changed.
3. **`AuditTrailPanel` polling bailout**: Added JSON deep equality check before `setData` in 8s interval loop to prevent re-renders when backend trail events remain identical.
4. **`OutboxPanel` polling bailout**: Added JSON deep equality check before `setData` in 6s interval loop to prevent re-renders when outbox metrics remain unchanged.

---

## Symptoms
- Frontend re-renders continuously in a loop (~60-120 renders/sec), causing CPU load & UI lag
- Icons render as raw string text (`my_location`, `warning`, `search`, `arrow_forward`, `healing`, `emergency`, `menu`) instead of Material Symbols glyphs
- Layout & styling differ from user's provided Midnight Dark Responder Dashboard and SOS Home design templates

---

## ROOT CAUSES FOUND

### Bug 1: Continuous RAF State Updates in `SlitherSprite`
**File:** `frontend/src/components/slither-sprite.tsx`  
**Root Cause:** `setSpeed(s)` was called on every single `requestAnimationFrame` tick (60-120 times/sec) regardless of whether speed changed, causing infinite frame re-renders of `SlitherSprite`.

### Bug 2: Continuous RAF State Updates in `useScrollProgress`
**File:** `frontend/src/hooks/use-scroll.ts`  
**Root Cause:** `setProgress(eased.current)` was executed on every animation frame, forcing any component listening to `useScrollProgress` to re-render 60-120 times per second.

### Bug 3: Missing Material Symbols Outlined Font Loading & CSS Class
**Files:** `frontend/src/app/layout.tsx`, `frontend/src/app/globals.css`  
**Root Cause:** Google Fonts stylesheet for `Material Symbols Outlined` was missing from `layout.tsx` `<head>` and `.material-symbols-outlined` lacked strict CSS font declarations, so icon names rendered as plain text strings.

### Bug 4: Layout & UI Design Inconsistency
**Files:** `frontend/src/app/page.tsx`, `frontend/src/components/sections.tsx`, `frontend/src/components/interactive.tsx`, `frontend/src/components/shader-background.tsx`  
**Root Cause:** UI layout did not match user's provided Midnight Dark specification (Responder Dashboard, SOS Hold-to-Trigger pulse button, WebGL snake shader canvas, Bento cards, clean dark tokens).

---

## RESOLUTION PLAN
1. Refactor `SlitherSprite` and `useScrollProgress` to eliminate state updates on unchanged frames inside RAF.
2. Inject Google Fonts stylesheet for `Material Symbols Outlined` into `layout.tsx` and define `.material-symbols-outlined` CSS rule in `globals.css`.
3. Update WebGL fragment shader in `shader-background.tsx` to match user's `shader-canvas-ANIMATION_14` (organic forest green slithering wave + scale texture).
4. Update `page.tsx`, `sections.tsx`, `interactive.tsx` to match user's clean Midnight Dark Responder Dashboard & SOS Home design templates with full interactive role switching, 2-second hold-to-trigger SOS button, bento cards, and responsive drawer & bottom navigation.
