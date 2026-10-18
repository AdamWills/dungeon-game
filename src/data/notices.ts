// On-screen policy notices. The Auditor never explains mechanics plainly;
// it issues policy. Full Auditor line pools arrive in M4.

export const NOTICES = {
  movement:
    'POLICY NOTICE 1-A: Ambulation is permitted via ARROW KEYS or WASD. Walls are load-bearing and non-negotiable.',
  stairs:
    'POLICY NOTICE 1-B: Descent is filed by standing on the stairwell and pressing E or SPACE. Hesitation is logged.',
  pause: 'POLICY NOTICE 1-C: ESC suspends the passage of time. This is a privilege, not a right.',
  dash: 'POLICY NOTICE 1-D: SHIFT authorizes a brief sprint, during which you may slip past residents. Recharge is mandatory.',
  sneak: 'POLICY NOTICE 1-E: Residents see in cones and hear footsteps. Approaching from behind is frowned upon and rewarded.',
  paused: 'TIME SUSPENDED. Your continued existence has been placed on hold. Press ESC to resume.',
  onStairs: 'You are standing on a stairwell. Press E to file your descent. The Auditor is waiting.',

  died: {
    title: 'INCIDENT REPORT (PRELIMINARY)',
    lines: [
      'Subject: one (1) abductee, {class} classification.',
      'Cause of death: {move}, administered by {enemy}.',
      'Filing code: PENDING. The full report is being drafted with enthusiasm.',
      'The Auditor regrets the inconvenience to the {enemy}.',
    ],
    prompt: 'Press ENTER to be re-abducted.',
  },
  escaped: {
    title: 'DESCENT FILED',
    lines: [
      'Subject has located the stairwell and left the Intake Sewers.',
      'This was not anticipated. A review of floor difficulty is under way.',
      'Your survival has been noted, provisionally.',
    ],
    prompt: 'Press ENTER to begin a new intake.',
  },
};
