# PDF Studio — Foundation

A browser-based PDF editor foundation built with vanilla JavaScript.

## Included in this milestone

- Open a PDF using the file picker.
- Drag and drop a PDF into the workspace.
- Render PDF pages with PDF.js.
- Generate page thumbnails.
- Navigate between pages.
- Zoom in and out.
- Fit the current page to the workspace.
- Download an untouched copy of the opened PDF.
- Responsive layout for desktop and mobile screens.

## Libraries

- PDF.js 3.11.174 — PDF rendering.
- pdf-lib 1.17.1 — loaded for upcoming PDF modification features.

The libraries are loaded from public CDNs, so an internet connection is required when opening the application.

## Run

1. Extract the ZIP file.
2. Open the `pdf-editor` folder.
3. Open `index.html` in a modern browser.

For a more reliable local development environment, serve the folder using a local HTTP server. For example, with VS Code Live Server or:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Current milestone limitations

- The Download PDF button downloads an unchanged copy of the original document.
- Editing operations have not been implemented yet.
- Password-protected PDFs may not open in this first version.
- Large PDFs can take time to render because thumbnails are generated for every page.

## Next milestone

PDF page management: merge, split, rotate, delete and reorder pages using pdf-lib.

## Internet connection

This version currently needs an internet connection to load PDF.js, its worker,
pdf-lib, and Google Fonts from their CDNs. Once loaded, PDF files are processed
locally in the browser; the application does not upload them to a server.

A later packaging step can place the JavaScript libraries and fonts inside the
project so the editor can run without an internet connection.
