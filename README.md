# HTML Poster Editor

A lightweight poster editor built with React/Next.js. Drag and arrange text and images on a 720×720 canvas with element-to-element snapping, multi-select group move, zoom/pan, import/export, and localStorage persistence.

## Features
- Precise canvas: 720×720 stage with zoom and pan
- Snapping: edge/center snapping to stage and other elements + grid snapping (10px)
- Multi-select: Ctrl/Cmd+Click and group move
- Import: Paste or load sanitized HTML; offscreen measurement maps relative layouts to absolute positions
- Export: Generate a standalone poster.html
- Persistence: Save/Load/Clear via localStorage
- Undo/Redo and shortcuts (Delete, Ctrl/Cmd+Z/Y, Ctrl/Cmd+D)
- Properties panels for text (font, color, weight) and images (src, alt, size)

## Getting Started
1. Install
   - `npm install`
2. Run (port 3003)
   - `npm run dev -- --port 3003`
3. Open
   - http://localhost:3003

## Usage Tips
- Drag elements to move. Hold Shift to temporarily disable grid snapping.
- Snap guides appear when near other elements’ edges/centers or stage center.
- Ctrl/Cmd+Click to multi-select. Drag any selected element to move the group.
- Use the toolbar to Paste/Import HTML, Add Text/Image, Delete, Save/Load/Clear, Export.

## Keyboard Shortcuts
- Delete: remove selection
- Ctrl/Cmd+Z: undo
- Ctrl/Cmd+Y or Shift+Ctrl/Cmd+Z: redo
- Ctrl/Cmd+D: duplicate selection (offset by 10,10)

## Persistence
- Stored under `html-poster-editor:v1` in localStorage.
- Load restores the last saved `elements` state.

## Import/Export
- Import: HTML is sanitized via DOMPurify and measured offscreen.
- Export: Generates `poster.html` with absolutely positioned nodes and minimal CSS.

## Tech Stack
- Next.js + React + TypeScript
- TailwindCSS (utility classes)
- DOMPurify (sanitization)

## Architecture Notes (SOLID)
- Single-responsibility: UI sections (toolbar, stage, panels) and actions (import/export/persist) are separated into focused functions.
- Open/Closed: Extensible element model (`EditorEl` union) allows adding new element types without rewriting core logic.
- Liskov Substitution: Shared base props for elements (`BaseEl`) ensure consistent behavior across text/image.
- Interface Segregation: Element editing uses minimal shape/props per type.
- Dependency Inversion: Sanitization and measurement are encapsulated; callers depend on abstracted helpers.

## Known Limitations
- No marquee (drag-rectangle) selection yet.
- Basic z-order; no layer reordering UI.
- Snapping is threshold-based and unweighted; guide de-duplication is simple.
- No persistence of zoom/pan or UI state.
- Export is static HTML (no editor metadata).

## Roadmap
- Marquee selection
- Layer panel and z-index controls
- Weighted snapping and guide management
- Project file import/export (JSON)
- Text wrapping/auto-size and better typography controls

## License
MIT
