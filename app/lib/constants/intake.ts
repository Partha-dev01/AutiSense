/**
 * Shared intake flow constants.
 *
 * The main intake navigation chain visits 10 pages in order:
 *   profile → child-profile → device-check → communication →
 *   behavioral-observation → preparation → motor → video-capture →
 *   summary → report
 *
 * NOTE: visual-engagement and audio pages exist but are NOT wired into
 * the main navigation chain. They use STEP_INDEX entries for display
 * purposes only.
 */

export const INTAKE_STEPS = [
  "Welcome",
  "Profile",
  "Device",
  "Communicate",
  "Behavior",
  "Prepare",
  "Motor",
  "Video",
  "Summary",
  "Report",
] as const;

export const STEP_INDEX = {
  profile: 0,
  "child-profile": 1,
  "device-check": 2,
  communication: 3,
  "visual-engagement": 3, // orphaned page — not in main flow
  "behavioral-observation": 4,
  preparation: 5,
  motor: 6,
  audio: 6, // orphaned page — not in main flow
  "video-capture": 7,
  summary: 8,
  report: 9,
} as const;
