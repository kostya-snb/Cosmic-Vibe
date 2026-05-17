# Cosmic Vibe

A standalone HTML5 Canvas web game featuring a sleek vector fighter dodging and shooting procedurally generated jagged asteroids.

## Git Branching & Naming Policy

To maintain a clean and organized architecture, we strictly adhere to a semantic naming convention for our releases and branches. Every major update MUST have an official "Theme Name".

### Branch Naming format:
`feat/v[X.X]-[theme-name]`

*Example:* `feat/v4.0-progression-update`

### Release Tag format:
`v[X.X] - The [Theme Name] Update`

*Example:* `v4.0 - The Progression Update`

---

## Architecture
The application runs entirely on the HTML5 Canvas API without external image dependencies or libraries. The source code is strictly separated into:
* `index.html` (DOM structure & HUD containers)
* `styles.css` (UI styling & CSS keyframe animations)
* `main.js` (Core game loop, input handling, physics, Web Audio API procedural sounds, and particle systems)
