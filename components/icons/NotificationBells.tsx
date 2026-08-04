import { Bell, BellOff, BellRing } from '@/components/icons/Icons';

/* ─────────────────────────────────────────────────────────────
 * NONE · SINGLE · DOUBLE — the notification selector's three marks.
 *
 * ⚠ THESE ARE THE ICON SET'S OWN BELLS, and that is deliberate. A
 * custom trio was drawn here once — one cast bell whose only variable
 * was the number of arcs coming off it, on the reasoning that the
 * setting is about HOW MANY. The reasoning was sound and the result
 * was not: Pavle rejected it on sight, and the set's `BellOff`,
 * `Bell` and `BellRing` went back in.
 *
 * The lesson is worth keeping. These marks sit at 20–21pt inside a
 * button, which is ICON size, not emblem size — and at that size the
 * thing that reads is a silhouette the eye already knows. A more
 * accurate bell, with a canon and a reversing profile and a clapper,
 * is a better DRAWING and a worse ICON: the extra truth lands as
 * noise. The emblem method belongs on the card marks, which are blown
 * up to nearly half a plate. It does not belong in a 21pt seat.
 *
 * ⚠ THIS FILE IS A NAMING LAYER ONLY. Both callers —
 * `NotificationSettings` and `NotificationsSheet` — import
 * BellNone/BellSingle/BellDouble, and those names say what the SETTING
 * is rather than what the picture shows. Re-pointing them here swaps
 * the illustration everywhere without touching a single call site, so
 * the selector's animation, its cross-fade and its selection spring
 * are untouched. Keep it that way: change the drawing here, never at
 * the call sites.
 * ───────────────────────────────────────────────────────────── */

export const BellNone = BellOff;
export const BellSingle = Bell;
export const BellDouble = BellRing;
