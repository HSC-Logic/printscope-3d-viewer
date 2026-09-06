# PrintScope – 3D Model Viewer & Print Cost Estimator

PrintScope is a private, frontend-only workspace for inspecting STL/3MF models, checking printer fit, estimating production costs, and downloading PDF quotations. The deployed base URL is `https://hsc-logic.github.io/printscope-3d-viewer/`.

## Features

- Local STL (ASCII/binary) and 3MF parsing, drag-and-drop, validation, disposal, and a 100 MB limit
- Orbit/pan/zoom viewer, perspective/orthographic cameras, grid, axes, build volume, render modes, fullscreen, and PNG capture
- Dimensions, triangle/mesh counts, surface area, signed-tetrahedron volume, scaling, and per-axis printer-fit checks
- Creality Ender S1 and correctly named Bambu Lab A1 Mini profiles; editable PLA, PETG, ABS, TPU, and ASA assumptions
- Recommended manual slicer-input mode and a clearly separated preliminary quick estimate
- Transparent material, labour, electricity, maintenance, parts, buffer, profit-markup, tax, quantity, and currency calculations
- Versioned local settings with JSON export/import/reset, responsive drawers, accessible controls, first-use help, and local PDF quotations

## Privacy and estimation disclaimer

Uploaded geometry, customer details, settings, screenshots, and quotations stay inside the browser. PrintScope has no API, analytics, trackers, or remote storage. Original models are never persisted. Quick estimates are **not slicing results**; use values from a real slicer for production quotations.

## Supported formats

STL (ASCII and binary) and 3MF model data supported by Three.js. Complex 3MF extensions, encrypted packages, G-code, model repair, supports, and toolpaths are outside this phase.

## Technology and dependencies

React 19, strict TypeScript, Vite, Three.js, React Three Fiber, Drei, Tailwind CSS, Lucide React, jsPDF, jsPDF-AutoTable, Vitest, Testing Library, ESLint, and Prettier. Drei provides camera/control helpers; Lucide provides SVG icons; jsPDF libraries enable offline quotation generation; Prettier is development-only. No runtime package intentionally communicates with a remote service.

## Development and deployment

Requires Node.js 22 LTS and npm.

```bash
npm ci
npm run dev
npm run lint
npm test
npm run build
```

The Vite base is `/printscope-3d-viewer/`. The Pages workflow runs lint, tests, and build before deploying `dist` on pushes to `main` or manual dispatch. Enable GitHub Pages with **GitHub Actions** as the source.

## Calculation formulas

Material is `(grams / 1000) × cost/kg`; labour is `(minutes / 60) × hourly rate`; electricity is `(watts / 1000) × hours × cost/kWh`; maintenance is `(annual maintenance / annual print hours) × print hours`. Parts form the remaining base cost, then buffer is applied to base cost, profit **markup** to buffered cost, optional tax to selling price, and quantity to final unit price. Currency labels user input units; no exchange-rate conversion occurs.

Quick material estimation uses mesh volume × density × infill × shell factor × support allowance × waste allowance. Duration divides estimated grams by editable calibrated flow in grams/hour.

## Geometry analysis

Bounds include all supported meshes. Area uses half the triangle edge-cross-product magnitude. Enclosed volume sums each oriented triangle's signed tetrahedron volume `a · (b × c) / 6`, takes the magnitude, and converts mm³ to cm³. Indexed/non-indexed geometry, transforms, invalid coordinates, and degenerate faces are handled. Open or inconsistently wound meshes may be unreliable and are marked as uncertain.

## Project structure

`components/viewer` contains rendering; `loaders` owns parsing/disposal; `geometry` holds pure analysis and fit checks; `pricing` holds pure costs/estimates; `profiles` contains defaults; `storage` owns browser state; `utils` contains lazy PDF export; colocated tests cover domain behavior.

## Browser limitations, known limitations, and roadmap

Large meshes remain constrained by device memory/GPU limits. STL units are interpreted as millimetres because STL has no standard unit metadata. Volume cannot be guaranteed for open/non-manifold meshes. Future work can add worker-based progressive analysis, richer custom-profile editors, topology diagnostics, all camera presets, and opt-in slicer integration without changing the pricing boundary.

## Screenshots

Add current desktop and mobile captures to `docs/screenshots/` after deployment.

## License and acknowledgements

Project licensing is to be selected by the repository owner. Dependencies retain their respective licenses. Pricing concepts were adapted from the requested HSC-Logic finance-calculator design and use the documented formulas above.
