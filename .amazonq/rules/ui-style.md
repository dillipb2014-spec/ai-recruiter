# GeniusHire UI Design Rules (Juspay-Centric)

## Identity
- Product name: **GeniusHire AI**
- Design philosophy: Calm Tech — high-density data, zero visual noise, every pixel earns its place.

## Color Palette
| Token         | Hex       | Usage                              |
|---------------|-----------|------------------------------------|
| primary       | #0052cc   | CTA buttons, active states, links  |
| primary-dark  | #003d99   | Button hover                       |
| primary-light | #e6f0ff   | Active pill backgrounds            |
| success       | #16a34a   | Hire, score ≥ 75, screen_select    |
| success-bg    | #dcfce7   |                                    |
| warning       | #d97706   | Hold, score 50–74                  |
| warning-bg    | #fef3c7   |                                    |
| danger        | #dc2626   | Reject, score < 50, screen_reject  |
| danger-bg     | #fee2e2   |                                    |
| genius        | #7c3aed   | Genius Match toggle                |
| genius-bg     | #f3e8ff   |                                    |
| neutral-900   | #111827   | Primary text                       |
| neutral-600   | #4b5563   | Secondary text                     |
| neutral-400   | #9ca3af   | Placeholder, disabled              |
| neutral-200   | #e5e7eb   | Borders                            |
| neutral-100   | #f3f4f6   | Table header, tag backgrounds      |
| neutral-50    | #f9fafb   | Page background                    |
| white         | #ffffff   | Card backgrounds                   |

## Typography
- Font: system-ui, -apple-system, sans-serif (no external fonts)
- Page title: 22px, weight 700, neutral-900
- Section title: 11px, weight 700, neutral-400, UPPERCASE, letter-spacing 0.08em
- Body: 14px, weight 400, neutral-600
- Label: 12px, weight 500, neutral-600
- Badge/pill: 11px, weight 600

## Spacing
- Page padding: 0 (sidebar flush) — main content: 24px 32px
- Card padding: 16px 20px
- Section gap: 16px
- Row height: 48px (table rows)

## Components
- Buttons: border-radius 7px, height 34px, font-size 13px, font-weight 600
- Pills/tags: border-radius 999px, padding 3px 10px, font-size 11px
- Inputs: border-radius 7px, border 1px solid neutral-200, padding 8px 12px, font-size 13px
- Cards: border-radius 10px, border 1px solid neutral-200, background white
- Sidebar: width 240px, sticky, height 100vh, border-right 1px solid neutral-200

## Patterns
- All filtering is server-side (PostgreSQL view: recruiter_console_view)
- Filter state syncs to URL params for shareable links
- Active filters shown as dismissible pills above the table
- Bulk operations: checkbox select → action bar appears at bottom
- Status pipeline: applied → screening → screen_select/screen_reject → interview → evaluated → hired/rejected
- Score colors: ≥75 success, 50–74 warning, <50 danger

## Do NOT
- Use Tailwind classes (project uses inline styles only)
- Add external icon libraries
- Use any color outside this palette
- Add animations beyond simple opacity/background transitions
