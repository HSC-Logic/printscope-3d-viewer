# PrintScope – 3D Model Viewer & Print Cost Estimator

PrintScope is a private, frontend-only workspace for inspecting STL/3MF models, checking printer fit, estimating production costs, and downloading PDF quotations. The deployed base URL is `https://hsc-logic.github.io/printscope-3d-viewer/`.

## Features

- Local STL (ASCII/binary) and 3MF parsing, drag-and-drop, validation, disposal, and a 100 MB limit
- Orbit/pan/zoom viewer, perspective/orthographic cameras, seven camera presets, grid, axes, build volume, render modes, viewer fullscreen, and PNG capture
- Normalized source coordinates plus transform-aware dimensions, area, volume, world bounds, topology diagnostics, and directional build-volume violations
- Built-in and browser-local duplicate/edit/delete printer and material profiles
- Recommended manual slicer-input mode and a clearly separated preliminary quick estimate
- Transparent material, labour, electricity, maintenance, parts, buffer, profit-markup, tax, quantity, and currency calculations
- Versioned local settings with JSON export/import/reset, responsive drawers, accessible controls, first-use help, and local PDF quotations

## Privacy and estimation disclaimer

Uploaded geometry, customer details, settings, screenshots, and quotations stay inside the browser. PrintScope has no API, analytics, trackers, or remote storage. Original models are never persisted. Quick estimates are **not slicing results**; use values from a real slicer for production quotations.

## Supported formats

STL (ASCII and binary) and 3MF model data supported by Three.js. Complex 3MF extensions, encrypted packages, G-code, model repair, supports, and toolpaths are outside this phase.

## Technology and dependencies

React 19, strict TypeScript, Vite, Three.js, React Three Fiber, Drei, Tailwind CSS, Lucide React, jsPDF, jsPDF-AutoTable, Vitest, Testing Library, Playwright, ESLint, and Prettier. Drei provides camera/control helpers; Lucide provides SVG icons; jsPDF libraries enable offline quotation generation; Playwright verifies production responsive layouts and theme states. The development-only `fflate` dependency constructs an actual ZIP-based 3MF test package in memory. No runtime package intentionally communicates with a remote service.

## Development and deployment

Requires Node.js 24 LTS and npm.

```bash
npm ci
npm run dev
npm run lint
npm test
npm run build
npm run test:e2e
```

The Vite base is `/printscope-3d-viewer/`. The Pages workflow runs lint, tests, and build before deploying `dist` on pushes to `main` or manual dispatch. Enable GitHub Pages with **GitHub Actions** as the source.

## Calculation formulas

Material is `(grams / 1000) × cost/kg`; labour is `(minutes / 60) × hourly rate`; electricity is `(watts / 1000) × hours × cost/kWh`; maintenance is `(annual maintenance / annual print hours) × print hours`. Parts form the remaining base cost, then buffer is applied to base cost, profit **markup** to buffered cost, optional tax to selling price, and quantity to final unit price. Currency labels user input units; no exchange-rate conversion occurs.

Quick material estimation uses mesh volume × density × infill × an explicitly approximate shell-contribution multiplier × support allowance × waste allowance. Duration divides estimated grams by editable calibrated flow in grams/hour. An unreliable mesh volume requires acknowledgement before quotation export.

## Geometry analysis

Source geometry is immutable. The pipeline applies the source/3MF world matrix, a separate XY-centering/minimum-Z normalization, user scale, user Euler rotation, and user translation. Displayed analysis is calculated in world space, so rotated and non-uniformly scaled bounds and surface area remain current. Area uses half the triangle edge-cross-product magnitude. Enclosed volume sums each oriented triangle's signed tetrahedron volume `a · (b × c) / 6`, takes the magnitude, and converts mm³ to cm³. Undirected edge incidence detects boundary and non-manifold edges. Large source and transformed analyses run in a cancellable Web Worker using transferable typed arrays.

## Project structure

`components/viewer` contains rendering and responsive camera controls; `components/upload`, `components/profiles`, and `components/common` hold focused UI and accessible dialogs; `loaders` owns parsing/disposal; `geometry` holds pure analysis and fit checks; `pricing` holds pure costs/estimates; `profiles` contains defaults; `storage` owns browser state; `utils` contains lazy PDF export. Colocated unit tests cover behavior and `e2e` contains production-build responsive assertions.

## Browser limitations, known limitations, and roadmap

Large meshes remain constrained by device memory/GPU limits; copying attributes for worker transfer can briefly increase memory use. STL units are interpreted as millimetres because STL has no standard unit metadata. Volume cannot be guaranteed for open, non-manifold, self-intersecting, or inconsistently oriented meshes. Three.js supports core 3MF geometry and selected material extensions, but slicer-specific project metadata and unsupported extensions are not reproduced. Browser storage can be unavailable, private, full, or cleared by the browser. Future work can add mesh repair diagnostics and an opt-in slicer integration without changing the pricing boundary.

## License and acknowledgements

Project licensing is to be selected by the repository owner. Dependencies retain their respective licenses. Pricing concepts were adapted from the requested HSC-Logic finance-calculator design and use the documented formulas above. Automated loader coverage includes an original minimal tetrahedron 3MF package assembled in-memory from 3MF Core model XML; it contains no third-party model asset.
