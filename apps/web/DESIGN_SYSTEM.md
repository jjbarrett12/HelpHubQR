# HelpHubQR design system

Premium SaaS operations UI: clarity first, intentional color, generous spacing. Aligns web (Tailwind + CSS variables) with iOS (SwiftUI + `HelpHubDesign`).

---

## 1. Color roles

### Light mode

| Role | Token / usage |
|------|----------------|
| App background | `--background` · very light cool gray `hsl(220 14% 97%)` |
| Card background | `--card` · white |
| Card border | `--border` · soft `hsl(220 13% 91%)` |
| Primary text | `--foreground` |
| Secondary text | Muted labels, section kicker |
| Muted text | `--muted-foreground` |
| Accent / primary action | `--primary` (brand red) |
| Success | Semantic greens (`--semantic-success` pair) |
| Warning | Amber pair |
| Danger | Destructive pair |
| Info | Sky/blue pair |

### Dark mode

| Role | Notes |
|------|--------|
| App background | Deep blue-gray `~222 47% 8%` — not pure black |
| Cards | Slightly elevated `~222 40% 11%` |
| Borders | Soft `~217 19% 18%` |
| Text | High contrast foreground |
| Accents | Slightly brighter than light for legibility |

### Status colors (operations)

Used for left accents on command cards, badges, and iOS `HelpHubDesign.StatusColor`.

| Status | Meaning |
|--------|---------|
| Active | In progress / on shift |
| Late | Behind schedule |
| Problem | Blocked / incident |
| Completed | Done |
| Pending approval | Awaiting manager |
| Open shift | Unfilled slot |
| Overdue | Past due |
| Missing proof | Photo required |

---

## 2. Typography scale

| Level | Web class | Use |
|-------|-----------|-----|
| Page title | `.ds-page-title` | H1 on hub pages |
| Section title | `.ds-section-title` | Column / module labels |
| Card title | `.ds-card-title` | Inside cards |
| Body | default `text-sm` / `text-base` | Lists, forms |
| Small / meta | `.ds-meta` | Timestamps, counts, mono time |

Font: **Plus Jakarta Sans** (`--font-sans`).

---

## 3. Spacing scale

Tailwind defaults (4px base). Prefer **4, 6, 8, 10, 12** between sections; command center columns use `gap-6`; card innards `p-4`–`p-6`.

---

## 4. Border radius

- **Cards / modals**: `rounded-xl` (12px) — `var(--radius)` aligned
- **Buttons / inputs**: `rounded-lg` (10px)
- **Pills / badges**: `rounded-full`

---

## 5. Shadows

- **Card**: `--shadow-card` — very soft, single layer
- **Sticky headers**: `backdrop-blur` + semi-transparent surface, not heavy drop shadow

---

## 6. Badge styles

Variants in `@/components/ui/badge`: `pending`, `approved`, `executed`, `denied`, `late`, `problem`, `completed`, `open`, `active`, `info`, plus existing `default`, `secondary`, `outline`, `success`, `warning`, `muted`, `destructive`.

Pattern: soft background + darker same-hue text, no harsh borders.

---

## 7. Buttons

- Primary: brand fill, `rounded-lg`, clear hover
- Outline: `border-input`, hover surface
- Sizes: default `h-10`, `sm` for dense toolbars

---

## 8. Cards

- **shadcn Card**: `rounded-xl`, `shadow-card`, comfortable padding
- **CommandCard** (Today): header row + optional **left accent** by severity/status

---

## 9. Web guidelines by area

### Today (command center)

- Three columns: Staffing · Execution · Actions — use `.ds-section-title`
- Cards = tools: strong header, meta eyebrow, accent bar
- Roster timeline: muted track, clear blocks, readable labels
- Approvals / Issues / Open shifts: use `pending` / `problem` / `open` badges; primary buttons for approve/review

### Schedule

- Keep existing layout; use page chrome consistent with QR hub (kicker + `.ds-page-title` where a shared shell exists)

### Checklists hub

- Use `content-well`, card surfaces from design tokens

### Requests

- Manager inbox: status badges from system; table rows with hover

### QR hub

- Sticky table header, zebra rows, filter toolbar with pill toggles + search
- Empty state: icon + one line instruction

### Admin onboarding

- Same typography + cards as app; no neon-only reliance; muted backgrounds

---

## 10. iOS guidelines by screen

### Today

- Large “Today” navigation title (already)
- Shift card: grouped rounded rectangle, subtle border, `HelpHubDesign.cardBackground`
- Progress: rounded bar, accent tint
- Next task: elevated card (slightly brighter than grouped background)
- Quick actions: `QuickActionButton` with 44pt min targets

### Checklist

- Section headers: uppercase secondary, increased spacing
- Task rows: 16pt corner radius, left status via border / overlay (aligned with web accent idea)

### Task detail

- Title + `RequestStatusBadge`-style semantics for task state
- Primary action full-width `rounded-16` button
- Timeline for history with vertical rule

### Requests / Messages

- List cards with soft fills; status badges use `HelpHubDesign` tints

### Dark mode

- Background vs card: **card one step lighter** than grouped background
- Avoid pure white text on pure black; use system semantic colors tuned with `HelpHubDesign`

---

## 11. Component checklist

| Component | Behavior |
|-----------|----------|
| Cards | xl radius, shadow-card, optional left accent |
| Tables | sticky header, odd row subtle bg, row hover |
| Filters | pills for discrete filters; consistent search height |
| Badges | semantic variants only for real states |
| Buttons | lg radius, no shrinking below 44px touch on mobile web |
| Empty states | `EmptyState` / `ContentUnavailableView` + short copy |
| Loading | Prefer skeleton or inline `ProgressView` / subtle pulse |

---

## 12. Dark mode rules

1. Never pure `#000` page background — use `--background` token.
2. Cards elevated one step above background.
3. Borders visible but low contrast (`border-border/80`).
4. Status colors: increase saturation slightly vs light for readability.
5. Primary actions: same hue family as light, brighter in dark.

---

## Files

- Tokens & utilities: `app/globals.css`
- Tailwind extensions: `tailwind.config.ts`
- UI primitives: `components/ui/badge.tsx`, `card.tsx`, `button.tsx`, `input.tsx`
- Shared: `components/ui/empty-state.tsx`
- Today: `components/today-command-center/*`
- QR: `components/qr-hub/QRFilters.tsx`, `QRDirectoryTable.tsx`
- iOS: `HelpHubQR/Design/HelpHubDesign.swift`
