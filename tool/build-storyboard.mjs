// Builds docs/storyboard/index.html from the film's storyboard.
//   node tool/build-storyboard.mjs [path-to-film-frames-folder]
// Copy (and resize) the stills into docs/storyboard/frames first.
import fs from 'node:fs';
import path from 'node:path';

const src = process.argv[2] || 'D:/flutter/video/nicotine-film/frames';
const html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');

// Scene names, from SCENES in the film's src/Film.tsx.
const SCENES = {
  '01': 'Four questions', '02': 'One app', '03': 'My story', '04': 'Nicotine', '05': 'Worth sharing',
  '06': 'One tap', '07': 'Packs', '08': 'Price changes', '09': 'The money', '10': 'Money in the app',
  '11': 'Brands and hours', '12': 'The change', '13': 'Daily limit', '14': 'Budget and quit',
  '15': 'No scolding', '16': 'Health', '17': 'Lungs', '18': 'Estimates', '19': 'Breathe',
  '20': 'Privacy', '21': 'Free', '22': 'Close',
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const shots = [...html.matchAll(/<img src="([^"]+)"[^>]*><figcaption><b>(\d+) · ([\d:]+)<\/b> ([^<]*)<span>([^<]*)<\/span>/g)].map(
  ([, file, scene, tc, note, line]) => ({ file, scene, tc, note: note.trim(), line: line.trim() }),
);
if (!shots.length) throw new Error('No frames found in ' + src);

const groups = Object.entries(
  shots.reduce((acc, s) => ((acc[s.scene] ||= []).push(s), acc), {}),
).sort(([a], [b]) => a.localeCompare(b));

const sections = groups
  .map(
    ([scene, list]) => `
    <section class="scene" id="s${scene}">
      <header><span class="n">${scene}</span><h2>${esc(SCENES[scene] || '')}</h2><span class="t">${list[0].tc}</span></header>
      <div class="frames">
        ${list
          .map(
            (s) => `<figure>
          <a href="frames/${s.file}" target="_blank" rel="noopener"><img src="frames/${s.file}" alt="Scene ${scene} at ${s.tc}: ${esc(s.note)}" loading="lazy" width="1280" height="720"></a>
          <figcaption><b>${s.tc}</b> ${esc(s.note)}${s.line ? `<span lang="bn">${esc(s.line)}</span>` : ''}</figcaption>
        </figure>`,
          )
          .join('\n        ')}
      </div>
    </section>`,
  )
  .join('\n');

const page = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Storyboard · Nicotine</title>
  <meta name="description" content="Storyboard of the Nicotine app film: ${groups.length} scenes, ${shots.length} frames.">
  <link rel="icon" href="../assets/img/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=Space+Grotesk:wght@500;600&family=Hind+Siliguri:wght@500&display=swap">
  <style>
    :root { --bg: #0B0E10; --surface: #171B1E; --line: rgba(255,255,255,.08); --ink: #EEF1EF; --muted: #98A3A9; --ember: #FFC24D; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--ink); font: 500 16px/1.5 Manrope, system-ui, sans-serif; }
    a { color: inherit; }
    :focus-visible { outline: 3px solid var(--ember); outline-offset: 3px; border-radius: 8px; }
    .wrap { max-width: 1240px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 32px); }
    .top { position: sticky; top: 0; z-index: 5; background: rgba(11,14,16,.8); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-bottom: 1px solid var(--line); }
    .top .wrap { display: flex; align-items: center; gap: 16px; height: 64px; }
    .brand { display: flex; align-items: center; gap: 10px; text-decoration: none; font: 600 18px 'Space Grotesk', sans-serif; }
    .brand svg { width: 30px; height: 30px; border-radius: 8px; }
    .back { margin-left: auto; display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 18px; border-radius: 999px; background: var(--ember); color: #1C2124; font-weight: 800; font-size: 14px; text-decoration: none; }
    .hero { padding: 56px 0 24px; }
    .eyebrow { font-size: 12px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
    h1 { font: 500 clamp(36px, 6vw, 64px)/1.05 'Space Grotesk', sans-serif; letter-spacing: -.02em; margin: 12px 0 0; }
    h1 em { font-style: normal; color: var(--ember); }
    .lead { color: var(--muted); max-width: 62ch; margin: 16px 0 0; font-size: 17px; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 22px; }
    .chips span { padding: 8px 14px; border-radius: 999px; background: var(--surface); border: 1px solid var(--line); font-size: 14px; font-weight: 700; }
    nav.index { display: flex; flex-wrap: wrap; gap: 6px; margin: 28px 0 8px; }
    nav.index a { text-decoration: none; font-size: 13px; font-weight: 700; color: var(--muted); padding: 6px 10px; border-radius: 10px; border: 1px solid var(--line); min-height: 32px; display: inline-flex; align-items: center; }
    nav.index a:hover { color: var(--ink); border-color: rgba(255,194,77,.5); }
    .scene { padding: 36px 0 8px; border-top: 1px solid var(--line); margin-top: 28px; scroll-margin-top: 80px; }
    .scene header { display: flex; align-items: baseline; gap: 14px; }
    .scene .n { font: 600 15px 'Space Grotesk', sans-serif; color: var(--ember); letter-spacing: .08em; }
    .scene h2 { font: 500 26px 'Space Grotesk', sans-serif; margin: 0; }
    .scene .t { margin-left: auto; color: var(--muted); font: 500 15px 'Space Grotesk', sans-serif; }
    .frames { display: grid; gap: 16px; margin-top: 18px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 460px), 1fr)); }
    figure { margin: 0; background: var(--surface); border: 1px solid var(--line); border-radius: 18px; overflow: hidden; }
    figure img { display: block; width: 100%; height: auto; aspect-ratio: 16 / 9; background: #000; transition: transform .4s cubic-bezier(.33,1,.68,1); }
    figure a { display: block; overflow: hidden; }
    figure a:hover img { transform: scale(1.02); }
    figcaption { padding: 12px 16px 14px; font-size: 15px; }
    figcaption b { font-family: 'Space Grotesk', sans-serif; color: var(--ember); margin-right: 6px; }
    figcaption span { display: block; margin-top: 6px; color: var(--muted); font-family: 'Hind Siliguri', Manrope, sans-serif; font-size: 15px; }
    footer { padding: 48px 0 64px; color: var(--muted); font-size: 14px; }
  </style>
</head>
<body>
  <header class="top">
    <div class="wrap">
      <a class="brand" href="../" aria-label="Nicotine home">
        <svg viewBox="0 0 1024 1024" aria-hidden="true"><rect width="1024" height="1024" fill="#000"/><path d="M292 742V282H436L588 548V282H732V742H588L436 476V742Z" fill="#fff"/><circle cx="770" cy="262" r="42" fill="#F4B63E"/></svg>
        Nicotine
      </a>
      <a class="back" href="../">← Back to the app</a>
    </div>
  </header>
  <main class="wrap">
    <div class="hero">
      <p class="eyebrow">The app film</p>
      <h1>Storyboard, <em>frame by frame.</em></h1>
      <p class="lead">How the Nicotine overview video is put together: ${groups.length} scenes timed to a Bangla voiceover, from the money question to the lungs and privacy. Tap any frame to see it full size.</p>
      <div class="chips"><span>16:9 · 1920×1080</span><span>3:50</span><span>${groups.length} scenes</span><span>${shots.length} frames</span><span>Made with Remotion</span></div>
      <nav class="index" aria-label="Scenes">
        ${groups.map(([n]) => `<a href="#s${n}">${n} ${esc(SCENES[n] || '')}</a>`).join('\n        ')}
      </nav>
    </div>
${sections}
  </main>
  <footer class="wrap">© 2026 Rahas Istiyak. Health figures in the film are estimates, not medical advice.</footer>
</body>
</html>
`;

fs.writeFileSync('docs/storyboard/index.html', page);
console.log(`docs/storyboard/index.html · ${groups.length} scenes · ${shots.length} frames`);
