/* ============================================================
   ✏️  EDIT ME — little trials in the months that have no memories.
   Each one reflects a part of the tough year. They're optional: the birthday gate only needs the memories.

   - zone   which month (same numbering as memories.js: 1 = Nov 2025, 3 = Jan 2026, …)
   - type   the mini-game: clouds · lanterns · bugs · shards · fireflies · stones
   - count  how many things to clear / light / catch
   - unit   shown in the progress pill, e.g. "3 / 6 clouds cleared"
   - intro  shown at the rune stone before starting
   - how    instructions (`howTouch` is used on phones)
   - outro  shown when it's done
   ============================================================ */
export const TRIALS = [
  {
    id: 'grey-days',
    zone: 1,
    type: 'clouds',
    count: 6,
    unit: 'clouds cleared',
    title: 'The grey days',
    intro: 'Some days this year were heavier than you let anyone see. For a while, the sky just stayed grey.',
    how: 'Click the rain clouds to clear the sky.',
    howTouch: 'Tap the rain clouds to clear the sky.',
    outro: 'You didn’t clear the grey days all at once. You did it one cloud at a time, and the sun came back. ☀️',
  },
  {
    id: 'cold-nights',
    zone: 3,
    type: 'lanterns',
    count: 7,
    unit: 'lanterns lit',
    title: 'Cold, quiet nights',
    intro: 'Winter was long and the nights were dark. It would have been easy to stop trying.',
    how: 'Walk up to each dark lantern to light it.',
    outro: 'Even on the coldest nights, you kept a little light going, for yourself and for the people around you. 🏮',
  },
  {
    id: 'starting-from-zero',
    zone: 4,
    type: 'bugs',
    count: 8,
    unit: 'bugs fixed',
    title: 'Starting from zero',
    intro: 'You started with no programming background at all. Every error message was new, and every bug looked impossible.',
    how: 'Squash the bugs: click them or walk into them. They run away!',
    howTouch: 'Squash the bugs: tap them or walk into them. They run away!',
    outro: 'Bug by bug, you figured it out. Nobody handed you a head start, so everything you learned, you earned. 💻',
  },
  {
    id: 'the-pieces',
    zone: 5,
    type: 'shards',
    count: 6,
    unit: 'pieces found',
    title: 'Picking up the pieces',
    intro: 'Some months knock you down a little, and you have to put yourself back together.',
    how: 'Walk through the glowing heart pieces to gather them.',
    outro: 'Piece by piece, you put yourself back together, and you came out a little stronger. 💗',
  },
  {
    id: 'sparks-of-courage',
    zone: 8,
    type: 'fireflies',
    count: 8,
    unit: 'fireflies caught',
    title: 'Little sparks of courage',
    intro: 'Big changes take courage, and courage usually shows up as small sparks: one brave question, one new thing, one more try.',
    how: 'Catch the fireflies by clicking them.',
    howTouch: 'Catch the fireflies by tapping them.',
    outro: 'Small sparks add up. Look how bright it got. ✨',
  },
  {
    id: 'one-step',
    zone: 9,
    type: 'stones',
    count: 8,
    unit: 'steps taken',
    title: 'One step at a time',
    intro: 'You couldn’t always see the whole path ahead. You only had to take the next step.',
    how: 'Step on each glowing stone, in order.',
    outro: 'Step by step, you kept going. That’s how you got all the way here. 🌟',
  },
];
