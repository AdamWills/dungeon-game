// On-screen policy notices. The Auditor never explains mechanics plainly;
// it issues policy. Full Auditor line pools arrive in M4.

export const NOTICES = {
  movement:
    'POLICY NOTICE 1-A: Ambulation is permitted via ARROW KEYS or WASD. Walls are load-bearing and non-negotiable.',
  stairs:
    'POLICY NOTICE 1-B: Descent is filed by standing on the stairwell and pressing E or SPACE. Hesitation is logged.',
  pause: 'POLICY NOTICE 1-C: ESC suspends the passage of time. This is a privilege, not a right.',
  dash: 'POLICY NOTICE 1-D: SHIFT authorizes a brief sprint, during which you may slip past residents. Sprinting is loud. Recharge is mandatory.',
  sneak: 'POLICY NOTICE 1-E: Residents see in cones and hear footsteps. Approaching from behind is frowned upon and rewarded.',
  paused: 'TIME SUSPENDED. Your continued existence has been placed on hold. Press ESC to resume.',
  onStairs: 'You are on the stairs. Press E to take them and finish the run.',

  died: {
    title: 'YOU DIED',
    subtitle: 'Incident report (preliminary)',
    lines: [
      'Subject: one (1) abductee, {class} classification.',
      'Cause of death: {move}, administered by {enemy}.',
      'Filing code: PENDING. The full report is being drafted with enthusiasm.',
      'The Auditor regrets the inconvenience to the {enemy}.',
    ],
    prompt: 'Press ENTER to start a new run.',
  },
  escaped: {
    title: 'YOU ESCAPED',
    subtitle: 'Descent filed.',
    lines: [
      'Subject has located the stairwell and left the Intake Sewers.',
      'This was not anticipated. A review of floor difficulty is under way.',
      'Your survival has been noted, provisionally.',
    ],
    prompt: 'Press ENTER to start a new run.',
  },
};
