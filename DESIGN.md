---
name: Linguistic Twin
description: A correction ledger for focused French practice.
colors:
  ink-navy: "#172333"
  warm-paper: "#f8f7e9"
  raised-paper: "#fffef4"
  sunken-paper: "#eeecdc"
  correction-red: "#c83f38"
  progress-green: "#34725a"
  action-blue: "#3159a5"
  muted-ink: "#52606f"
  structural-rule: "#aeb3ad"
typography:
  display:
    fontFamily: "Archivo Black, Arial, sans-serif"
    fontSize: "clamp(48px, 8vw, 112px)"
    fontWeight: 400
    lineHeight: 0.82
    letterSpacing: "-0.065em"
  body:
    fontFamily: "Work Sans, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Space Mono, monospace"
    fontSize: "10px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.13em"
rounded:
  none: "0px"
spacing:
  xs: "8px"
  sm: "16px"
  md: "24px"
  lg: "40px"
  xl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.ink-navy}"
    textColor: "{colors.raised-paper}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "13px 20px"
  input-default:
    backgroundColor: "{colors.raised-paper}"
    textColor: "{colors.ink-navy}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "10px 12px"
---

# Design System: Linguistic Twin

## Overview

**Creative North Star: "Correction Ledger"**

Linguistic Twin feels like a workbook that has been actively marked, indexed, and improved over time. RawBlock supplies the structural confidence: square geometry, emphatic rules, large typography, and direct controls. Warm paper and ink navy make that system suitable for daily study instead of an art-site imitation.

The visual hierarchy follows the learning hierarchy. The current action is dominant, progress is measurable, and corrections carry meaning. Decorative UI is deliberately sparse.

**Key Characteristics:**

- Type-led hierarchy with a single oversized headline per primary surface.
- Warm paper surfaces separated by structural navy rules.
- Correction red and progress green used only for learning semantics.
- Square controls, flat layers, and concise monospaced labels.

## Colors

The palette combines workbook warmth with dark editorial structure.

### Primary

- **Ink Navy:** Primary text, navigation, and structural borders.
- **Warm Paper:** Default application background.
- **Correction Red:** Current learning action and incorrect language.

### Secondary

- **Progress Green:** Completed work, correct answers, and improvement.
- **Action Blue:** Focus rings, links, and the current step background.

### Neutral

- **Raised Paper:** Forms and primary working surfaces.
- **Sunken Paper:** Disabled or inactive surfaces.
- **Muted Ink:** Supporting copy and metadata.
- **Structural Rule:** Quiet dividers where a heavy navy rule would dominate.

**The Semantic Pen Rule.** Red and green describe correction state; they are never general decoration.

## Typography

**Display Font:** Archivo Black (Arial fallback)<br>
**Body Font:** Work Sans (Arial fallback)<br>
**Label/Mono Font:** Space Mono (monospace fallback)

Archivo Black makes the current lesson unmistakable. Work Sans keeps dense feedback readable, while Space Mono makes steps, counts, and system state feel recorded.

### Hierarchy

- **Display** (400, fluid 48–112px, 0.82): Homepage lesson theme only.
- **Headline** (400, fluid 38–68px, 0.92): Primary route headings.
- **Title** (400, fluid 24–38px): Section names.
- **Body** (400, 16px, 1.5): Instructions, feedback, and learner content.
- **Label** (700, 10–12px, tracked uppercase): Counts, states, buttons, and navigation indexes.

**The One Loud Voice Rule.** Each screen gets one large display statement; supporting text stays restrained.

## Layout

Desktop uses a fixed 244px navy sidebar and a flexible content workspace. The homepage uses bordered editorial regions; task pages use a readable centered work area up to 1080px. At 900px the sidebar becomes a fixed mobile header. Two-column boards collapse to one column, and forms stack below 560px.

Spacing follows an 8px base but allows large asymmetric gaps around the primary lesson title. Every route must remain free of horizontal overflow at 390px.

## Elevation & Depth

The system uses no shadows, glass, blur, or gradients. Border weight, paper tone, and full color inversion create all depth and state changes.

**The Flat Ledger Rule.** A surface earns attention through structure and scale, never simulated elevation.

## Shapes

All interface geometry is square with a zero-pixel radius. Structural boundaries use 2–5px rules; quiet internal dividers use 1px. Small status marks may use compact rectangular stamps.

## Components

### Buttons

- **Shape:** Square with a 3px ink border.
- **Primary:** Ink or correction-red fill with raised-paper text and uppercase mono label.
- **Hover / Focus:** Full fill inversion; keyboard focus uses a 4px action-blue outline.
- **Disabled:** Sunken paper, muted text, and a structural-rule border.

### Cards / Containers

- **Corner Style:** Square.
- **Background:** Warm or raised paper.
- **Shadow Strategy:** None.
- **Border:** 2–3px ink for important regions; 1px structural rule for secondary rows.
- **Internal Padding:** 16–44px according to hierarchy.

### Inputs / Fields

- **Style:** Raised paper with a 2px ink stroke.
- **Focus:** The stroke increases to 4px; the global focus outline remains visible.
- **Error / Disabled:** Correction-red for errors; sunken paper and muted ink when disabled.

### Navigation

Desktop navigation is an indexed vertical ledger on ink navy. Active and hover states invert to warm paper. Mobile uses a native details menu in the fixed header, retaining keyboard behavior without extra state code.

### Session Board

The current session combines one dominant action with a numbered step matrix. The current cell uses action-blue paper, completed cells use progress-green paper, and all remaining cells stay neutral.

## Do's and Don'ts

### Do:

- **Do** reserve the largest type for the learner's current topic or task.
- **Do** use border weight to organize related content.
- **Do** keep error, success, hover, focus, disabled, loading, and empty states distinct.
- **Do** verify every new screen at desktop and 390px mobile widths.

### Don't:

- **Don't** add rounded cards, pill-shaped buttons, shadows, gradients, or glass effects.
- **Don't** use emoji as interface icons or decoration.
- **Don't** create a repeated grid of interchangeable marketing cards.
- **Don't** use correction colors outside their learning meaning.
