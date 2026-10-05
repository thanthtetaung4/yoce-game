# Happy 21st, Yoce 🎂

A little 3D walk through Yoce's year as a princess in an enchanted pastel forest. Each month of the path has
its own enchanted season (amber glow, frost and crystals, blossoms, a firefly glade). Find the glowing memories
along the way, then follow the path to the cake in the fairy-ring clearing at the end.

Built with Vite, plain JavaScript and Three.js. It has no 3D model files: everything is made from simple shapes.

```bash
npm install
npm run dev      # local preview; it also prints a Network URL you can open on your phone
npm run build    # production build → dist/
npm run preview  # serve the built dist/ locally
```

## Edit the memories
Each memory on the path is defined in **`src/data/memories.js`**, with these fields:

| field      | what it does |
|------------|--------------|
| `id`       | unique name, used to remember which memories have been opened |
| `title`, `date`, `story` | the text in the memory card |
| `photos`   | 1–3 photo file names. The first one appears on the floating polaroid |
| `captions` | one short caption per photo |
| `zone`     | which month it sits in (0 = Oct 2025 … 11 = Sep 2026; the table is in the file) |
| `at`       | where inside that month it sits: 0 = start, 1 = end |
| `side`     | optional `'left'` / `'right'` (otherwise memories alternate sides) |

To add a memory, add an entry. To remove one, delete its entry. The "x of N memories found" counter updates automatically.

## Edit the trials (mini-games)
The six months with no memories each hold a little **trial** that reflects part of the tough year. Each one starts
at a glowing rune stone ✦. The text, month, game type and target count are all in **`src/data/trials.js`**.
Game types: `clouds` (click the rain clouds), `lanterns` (walk up to light them), `bugs` (squash the runaway bugs),
`shards` (gather heart pieces), `fireflies` (catch them), `stones` (step on the glowing stones in order).
Trials are optional: the birthday gate only needs the memories. Finishing one brightens its month for good.

## Idle animations
If she stands still for a few seconds, she starts one of three little scenes at random (`src/player/idle.js`):
- **Mirror:** takes out a hand mirror, fixes her hair, puts on lipstick and winks
- **Car:** a pastel car pops up, she hops in and drives a lap of the area (beep beep!)
- **Coding:** a chair, desk and laptop pop up and she codes until the build passes, then cheers

The camera swings round to frame each one. Walking cancels it and everything pops away.
Timing is set by `IDLE_AFTER` / `REST_AFTER` at the top of the file, and the laptop's code is in `LINES`.

## Change the words / the name
**`src/data/story.js`** holds the name, the age (which also sets the number candles on the cake),
the title-screen text and the closing birthday message. Also update the `<title>` and `og:` tags at
the top of `index.html`, which are what link previews show.

## Swap or add photos
1. Put the original photos (JPG/PNG/HEIC) in `photos/`. This folder is git-ignored because the originals contain GPS data.
2. Run `npm run photos`. This creates small WebP versions in `public/images/` and updates
   `src/data/photos.js`.
3. Use the photo's **original file name** in `memories.js` or `story.js` (e.g. `'IMG_6561.JPEG'`).

If a file name isn't found, a pastel placeholder is shown instead and the browser console prints a warning.

## Settings — `src/config.js`
- `requireAllMemories`: the birthday gate stays closed until every memory has been opened. Set it to `false` to remove the gate.
- `startMonth`: the first month of the path. The 12 month signposts are generated from it.
- `walkSpeed`, `zoneLength`, `pathHalfWidth`, `interactDistance`: controls for how the walk feels.

Progress is saved in the browser, so a reload keeps the memories already found. "Walk the year again" at the end clears it.

## Music & sounds
The background music is a gentle magical-forest track generated live in the browser (`src/ui/music.js`):
dreamy pads, a music-box melody and wind chimes. There's no audio file to download.
To use your own track instead, put it in `public/audio/` and set `music: 'audio/music.mp3'` in `src/config.js`
(`chime` does the same for the memory-open sound). The 🔊 button in the top-right corner mutes everything.

## Controls
- **Desktop:** WASD or the arrow keys to walk, hold **Shift** to hurry. Drag to look around. Click a glowing photo (or press **E**) to open it. Press **Esc** to close.
- **Phone:** hold anywhere on the left half of the screen for a joystick (push it to the edge to hurry). Drag on the right half to look. Tap a photo to open it.

## Deploy
- **Netlify:** connect the repo. `netlify.toml` already runs `npm run build` and publishes `dist/`.
  Or run `npm run build` and drag the `dist/` folder onto app.netlify.com/drop.
- **Vercel:** import the repo (or run `npx vercel`). `vercel.json` already sets the build command and the `dist/` output.

## Code map
```
src/main.js              boot, game states, the single animation loop
src/config.js            settings + palette
src/data/                story.js, memories.js, photos.js (generated)
src/scene/setup.js       renderer, camera, lights, fog, gradient sky, adaptive resolution
src/world/               path.js (the winding path), zones.js (months/seasons), world.js (ground,
                         path, signposts, gate, plaza), props.js (instanced trees/flowers/hearts/…),
                         ambient.js (seasonal particles + sky tint), points.js (sprite shader)
src/player/              character.js (princess + animations + sparkle trail), idle.js (idle scenes), player.js (movement, path edges), controls.js
src/camera/follow.js     third-person follow camera
src/memories/markers.js  floating polaroids, glow, raycast picking
src/ending/ending.js     cake, number candles, confetti, balloons, cinematic camera
src/minigames/           trials.js (rune stones + progress), games.js (the six mini-games), burst.js (sparkles)
src/ui/                  hud.js, modal.js, trialCard.js, screens.js, audio.js, music.js (generated forest music)
```
