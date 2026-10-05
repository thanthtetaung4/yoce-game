// Game settings. The words live in src/data/story.js, the memories in src/data/memories.js.
export const CONFIG = {
  // The ending only unlocks after every memory has been opened. Set to false to let anyone walk straight to the cake.
  requireAllMemories: true,

  // First month of the path (0 = January … 11 = December). The path covers 12 months from here,
  // then a final "birthday" stretch with the cake.
  startMonth: { year: 2025, month: 9 },
  birthdayLabel: 'Today ♡',

  // World size + movement
  zoneLength: 30,        // length of each month along the path
  pathHalfWidth: 2.6,    // the walkable path is twice this wide
  walkSpeed: 5.4,
  fastMultiplier: 1.8,   // hold Shift (or push the phone joystick to the edge) to hurry
  interactDistance: 4.6, // how close you need to be for the "open memory" prompt

  // Audio. Leave empty to use the built-in generated magical-forest music and chime,
  // or point to your own files in /public/audio, e.g. 'audio/music.mp3'.
  music: '',
  chime: '',
  musicVolume: 0.35,
};

// Pastel palette shared by the 3D world (matches the CSS tokens in src/styles.css)
export const PALETTE = {
  cream: '#fff6f1',
  blush: '#fadbe2',
  rose: '#f2a7bb',
  roseDeep: '#b4577a',
  lavender: '#dccdf4',
  lavenderDeep: '#b9a2e6',
  peach: '#fde0cf',
  peachDeep: '#f7b89a',
  ink: '#4b3445',
  paper: '#fffdfb',
  confetti: ['#f6b8c8', '#dccdf4', '#fde0cf', '#f2a7bb', '#b9a2e6', '#f7b89a', '#ffffff', '#cfe3f0'],
};
