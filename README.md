# ghost545a.github.io

My personal site: who I am and what I've built. Live at **https://ghost545a.github.io/**.

Plain HTML, CSS and JavaScript. No framework, no build step, no dependencies.

## What's inside

| File | What it does |
|---|---|
| `index.html` | All the content: intro, projects, games, about. Each project's detail sheet lives in a `<template>` at the bottom. |
| `styles.css` | Light and dark themes (they follow your system), typography, tiles, the sheet. |
| `app.js` | Scroll reveal, section highlighting in the nav, and the project sheet. |
| `assets/` | Screenshots of each project. |

## Design notes

The design follows Apple's interface guidelines:

- System font, with tighter letter-spacing on big headings and normal spacing on body text.
- A translucent nav bar that content scrolls under. Its bottom edge only shows once something is behind it.
- Buttons and tiles react the moment you press, not when you let go.
- Project details open in a sheet driven by a spring rather than a fixed-length animation. You can drag it, flick it away, or grab it mid-animation. When you let go, it keeps your finger's speed.
- Respects *Reduce Motion* (fades instead of slides), *Reduce Transparency* and *Increase Contrast*.

## Editing

- **Add a project:** copy one of the `<a class="tile">` blocks in `index.html`, give it a new `data-sheet="name"`, and add a matching `<template id="t-name">` at the bottom.
- **Change the intro:** edit the hero and About sections in `index.html`.
- **Preview locally:** `python -m http.server 8000`, then open http://localhost:8000.
