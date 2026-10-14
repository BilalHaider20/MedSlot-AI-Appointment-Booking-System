# Design System — Bookwell

## Product Context
- **What this is:** a booking app for small service businesses. Customers book by chatting with an assistant or by filling a short form.
- **Who it's for:** clients of a physio / massage clinic. Not technical, often on a phone, usually booking between other things.
- **Project type:** web app (signed-in, two-panel workspace)
- **The one thing to remember:** booking took less than a minute and nothing felt confusing.

## Aesthetic Direction
- **Direction:** Industrial/Utilitarian, softened. A calm tool, not a marketing page.
- **Decoration level:** minimal. Typography, spacing and 1px borders do the work. No gradients, no illustrations, no glass, no shadows heavier than `--shadow-sm`.
- **Mood:** quiet and trustworthy, like a good clinic front desk.

## Typography
- **UI / Body:** Instrument Sans (400, 500, 600). Friendly but precise, less common than Inter.
- **Numbers (times, dates, prices):** Instrument Sans with `font-variant-numeric: tabular-nums`.
- **Mono (rare: ids, debug):** JetBrains Mono 400.
- **Loading:** Google Fonts `<link>` in `index.html`, `display=swap`.
- **Scale (rem, base 16px):** 12 `0.75` caption · 13 `0.8125` small/labels · 15 `0.9375` body · 17 `1.0625` section title · 20 `1.25` page title · 24 `1.5` auth heading.
- Line height 1.5 for body, 1.25 for headings. Headings weight 600, never 700+.
- Sentence case everywhere. No ALL CAPS except tiny overline labels (12px, letter-spacing 0.04em).

## Color
- **Approach:** restrained. One accent (pine green) plus warm neutrals. Color only means something: action, status, or selection.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--bg` | `#F7F6F3` | `#111312` | page background |
| `--surface` | `#FFFFFF` | `#181B1A` | panels, cards, inputs |
| `--surface-2` | `#F0EFEB` | `#1F2321` | hover rows, assistant bubbles, chips |
| `--border` | `#E3E1DB` | `#2A2F2D` | 1px dividers, inputs |
| `--border-strong` | `#CFCCC4` | `#3A403D` | focused/hovered borders |
| `--text` | `#1C1F1E` | `#E8EAE8` | primary text |
| `--text-muted` | `#6A6F6C` | `#9AA19D` | secondary text, timestamps |
| `--accent` | `#1F6F5C` | `#5CB89C` | primary buttons, links, user bubble, focus ring |
| `--accent-hover` | `#185A4A` | `#74C7AD` | |
| `--accent-soft` | `#E3F0EB` | `#1C2E28` | selected chip, info background |
| `--on-accent` | `#FFFFFF` | `#0E1A16` | text on accent |
| `--danger` | `#B3412E` | `#E07A65` | errors, cancel |
| `--danger-soft` | `#F8E6E2` | `#2E1C18` | |
| `--warning` | `#9A6B12` | `#D9AE5A` | |
| `--success` | `#2F7A3E` | `#6CC27E` | booked status |

- **Dark mode:** follows `prefers-color-scheme` by default; a toggle in the header stores `light | dark | system` in localStorage and sets `data-theme` on `<html>`. Surfaces are redesigned (not inverted). Accent is lighter and less saturated in dark.
- Focus ring: `0 0 0 3px color-mix(in srgb, var(--accent) 35%, transparent)`.

## Spacing
- **Base unit:** 4px. **Density:** comfortable.
- **Scale:** `--space-1` 4 · `--space-2` 8 · `--space-3` 12 · `--space-4` 16 · `--space-5` 24 · `--space-6` 32 · `--space-7` 48.

## Layout
- **App shell:** top bar (56px): product name left, business name + theme toggle + user menu right.
- **Workspace (>= 960px):** two columns, `minmax(0, 1fr) 360px`, gap 24, max width 1200, centered. Left: chat panel (full height minus header). Right: "Your appointments" panel with upcoming/past tabs and a "Book with the form" button.
- **< 960px:** single column, tabs at the top switch between Chat and Appointments.
- **Auth pages:** single 400px card, left-aligned text, product name above. No hero, no illustration.
- **Radius:** sm 6px (inputs, chips, buttons) · md 10px (cards, panels) · bubbles 14px with the corner nearest the speaker at 4px. Never fully rounded pills except the small status badges.
- **Shadow:** `--shadow-sm: 0 1px 2px rgb(0 0 0 / 0.05)` on panels in light mode only. Dark mode uses borders only.

## Components
- **Buttons:** primary (accent fill), secondary (surface + border), ghost (text only), danger-ghost. Height 36px, padding 0 14px, 14px/500. Loading state keeps width and shows a small spinner + verb ("Booking…").
- **Inputs:** 38px tall, 1px border, label above (13px/500), hint/error below (12px). Errors in `--danger` with the message text, not just a red border.
- **Chat bubbles:** assistant left on `--surface-2`, user right on `--accent` with `--on-accent`. Max width 78%. Timestamp on hover / below last message in a group, 12px muted.
- **Under-bubble UI (from `meta.ui`):** slot chips (time buttons in a wrap row), service chips, a confirm card (service, day, time, duration, price + "Confirm booking" / "Change something"), and an inline booking form card for fallback.
- **Typing indicator:** three 6px dots in an assistant bubble, gentle opacity pulse.
- **Composer:** textarea that grows to 4 lines, Enter sends, Shift+Enter newline, send button disabled while empty or sending. Suggestion chips above an empty conversation ("Book a sports massage tomorrow afternoon", "What's free on Friday?", "Show my appointments").
- **Appointment row:** date block (weekday short + day number) on the left, service name + time range + status badge, "Cancel" ghost button for upcoming. Cancel asks inline ("Cancel this appointment? Yes / Keep it"), no modal.
- **Empty states:** one sentence plus an action. "No upcoming appointments. Ask the assistant or use the form."
- **Toasts:** bottom-center, short, auto-dismiss 4s. Used for "Appointment booked" and network errors.

## Motion
- **Approach:** minimal-functional. New messages fade + rise 4px over 150ms ease-out. Panel/tab switches have no animation. Respect `prefers-reduced-motion`.

## Writing
- Plain, short, human. Second person. No exclamation marks. No emoji.
- Good: "You're booked for a sports massage on Thu 16 Oct at 14:30." / "That time's taken. These are free on Friday:"
- Bad: "Great choice! 🎉 I've successfully processed your booking request."
- Errors say what happened and what to do: "We couldn't reach the server. Check your connection and try again."
