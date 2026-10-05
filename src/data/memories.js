/* ============================================================
   ✏️  EDIT ME — the memories floating along the path.

   Fields
   - id       unique, used to remember which ones were visited
   - title    heading in the story card
   - date     shown above the title (any text)
   - photos   1–3 original file names from /photos (run `npm run photos` after adding new ones).
              The first photo is the one shown on the floating polaroid.
   - captions one short caption per photo (optional)
   - story    the paragraph in the story card
   - zone     which month of the path it sits in:
                0 Oct 2025   1 Nov 2025   2 Dec 2025   3 Jan 2026
                4 Feb 2026   5 Mar 2026   6 Apr 2026   7 May 2026
                8 Jun 2026   9 Jul 2026  10 Aug 2026  11 Sep 2026
              (the months themselves are set by `startMonth` in src/config.js)
   - at       where inside that month, 0 = start … 1 = end
   - side     optional 'left' or 'right' (otherwise they alternate)

   A photo name that isn't in src/data/photos.js shows a pastel placeholder instead.
   ============================================================ */
export const MEMORIES = [
  {
    id: 'where-it-started',
    title: 'Twenty, and figuring it out',
    date: 'Where it all started',
    photos: ['4322fa0619f0455925af5f4c996e2a7b.jpeg', '72397179-465a-40b7-b8ea-23bfa12c5f89.jpg'],
    captions: ['thumbs up, always', 'peace ✌️'],
    story: 'At the start of the year you didn’t have it all figured out, and nobody expected you to. You had a thumbs up for everyone and a peace sign for every photo, even when you weren’t sure where things were heading.',
    zone: 0, at: 0.3,
  },
  {
    id: 'good-days',
    title: 'Holding on to the good days',
    date: 'October 2025',
    photos: ['IMG_8810.JPEG'],
    captions: ['pink looks good on you'],
    story: 'Not every day this year was easy. Some were heavier than you let anyone see. But you kept turning up for the sunny afternoons and the people who love you, and you still managed to smile.',
    zone: 0, at: 0.75,
  },
  {
    id: 'hardworking-holidays',
    title: 'The hardworking holidays',
    date: 'December 2025',
    photos: ['IMG_4524.JPEG'],
    captions: ['ho ho ho 🎅'],
    story: 'While everyone else was on holiday, you were in an apron and a Santa hat, working the long shifts. Tired feet, busy crowds, and you still looked this happy. That’s when I saw how hard you’re willing to work for what you want.',
    zone: 2, at: 0.5,
  },
  {
    id: 'fresh-start',
    title: 'A fresh start',
    date: 'April 2026',
    photos: ['IMG_5687.JPEG'],
    captions: ['main character energy'],
    story: 'New hair, new energy, new you. After a heavy few months you chose to start over, and it suited you. Sometimes growing up starts with deciding you deserve a fresh start.',
    zone: 6, at: 0.5,
  },
  {
    id: 'having-fun',
    title: 'Remembering to have fun',
    date: 'May 2026',
    photos: ['IMG_5725.JPEG'],
    captions: ['park day ✌️'],
    story: 'Park walks, sunny weekends and peace signs for the camera. In the middle of growing up, you didn’t forget how to be silly. I hope you never do.',
    zone: 7, at: 0.2,
  },
  {
    id: 'day-one',
    title: 'Day one',
    date: '4 May 2026',
    photos: ['IMG_5749.JPEG'],
    captions: ['intern, day one 💼'],
    story: 'Your first day as an intern. Backpack on, lanyard on, nervous but excited, and still stopping for a photo with a celebrity poster like you’d met him in person. It was your first real step into the working world, and you took it with a smile.',
    zone: 7, at: 0.5,
  },
  {
    id: 'little-joys',
    title: 'Little joys',
    date: 'May 2026',
    photos: ['IMG_5840.JPEG'],
    captions: ['post-work fuel'],
    story: 'Long days of learning came with small rewards: a good bowl of something, no plans, nothing to rush for. You learned that looking after yourself counts too.',
    zone: 7, at: 0.8,
  },
  {
    id: 'finding-your-feet',
    title: 'Finding your feet',
    date: 'August 2026',
    photos: ['IMG_6340.JPEG', 'IMG_6341.JPEG'],
    captions: ['meeting-ready', 'very professional'],
    story: 'A few months in, the first-day nerves had turned into confidence. Blazer on, glasses on, you took on things you’d never done before, asked the right questions, learned fast and quietly proved you belonged there.',
    zone: 10, at: 0.3,
  },
  {
    id: 'glow-up',
    title: 'Your glow-up',
    date: 'August 2026',
    photos: ['IMG_6555.JPEG', 'IMG_6558.JPEG', 'IMG_6561.JPEG'],
    captions: ['glow', 'glowier', 'glowiest'],
    story: 'By now it showed. You were steadier, more confident and more yourself. The tough months didn’t dim you. They helped make you who you are now.',
    zone: 10, at: 0.75,
  },
  {
    id: 'corporate-girl',
    title: 'Corporate girl',
    date: 'Aug – Sep 2026',
    photos: ['IMG_6544.JPEG', 'IMG_6632.JPEG'],
    captions: ['office fit check', 'Monday mode 💼'],
    story: 'Office lifts, work outfits and your first real taste of corporate life. A year ago this all felt far away, and now it’s your normal. You’re doing it, and you’re doing it in style.',
    zone: 11, at: 0.45,
  },
  {
    id: 'graduation',
    title: 'You did it, graduate',
    date: '21 September 2026',
    // Placeholder: put your photo in /photos as graduation.jpg and run `npm run photos` (or change the name here)
    photos: ['graduation.jpg'],
    captions: ['graduate 🎓'],
    story: 'You started with no programming background at all. No head start and no shortcuts, just long nights, endless error messages, and a stubborn refusal to give up. Every bug you fixed and every concept that finally clicked, you earned on your own. On 21 September you graduated, and I couldn’t be prouder of how hard you worked to get here. 🎓',
    zone: 11, at: 0.7,
  },
];
