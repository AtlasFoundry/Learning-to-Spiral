# Learning to Spiral · Lesson Studio

A quiet, local-first lesson editor with a cumulative Research & Visual Library. This repository was initially empty; this is the first studio implementation.

## Open directly

For the simplest download, [download the Studio ZIP](https://github.com/AtlasFoundry/Learning-to-Spiral/raw/refs/heads/main/Learning-to-Spiral-Studio.zip). Double-click the ZIP to extract it, then double-click **Learning-to-Spiral.html** in Chrome. The ZIP contains only the studio HTML, so there is no development file to select by mistake.

You can also download [Learning-to-Spiral.html](Learning-to-Spiral.html) directly. On GitHub, open that exact file and choose **Download raw file**. The full studio is about **309 KB**. The much smaller `index.html` is the development entry and will not run when double-clicked. GitHub's code viewer displays the code; the downloaded standalone HTML opens the app in your browser.

This is the standalone app: it embeds the application and styles and runs offline without installation or a server. Use a current browser with IndexedDB support. The source `index.html` and the multi-file production `dist/index.html` require a server; they are not the standalone file.

`npm run build` regenerates both the hosted production build and the standalone HTML. `npm test` first rebuilds, then validates the hosted workflow and the exact embedded HTML with network access disabled, including lesson/image persistence and a portable backup. Direct file opening is checked when the browser permits file URLs; the managed cloud browser blocks them by policy, so that check is reported as skipped here. External research/image links still need Internet access.

The regenerated standalone HTML is at **dist/Learning-to-Spiral.html**. The file in the repository's top-level directory is the ready-to-download version; refresh it from the generated file and update the ZIP with that same HTML when deliberately preparing a new version for GitHub. Routine setup and builds leave the checked-in downloads unchanged.

Browser storage can differ between a hosted app and an opened file, and between filenames or locations depending on the browser. Keep the standalone file in the same location and use portable backups when moving it, updating it, or switching between the hosted and standalone versions.

## Develop

Use Node.js 22.12+ (Node 24 was validated) and npm:

```sh
cd /workspace/Learning-to-Spiral
npm --cache /workspace/.npm-cache ci --no-audit --no-fund
npm run dev -- --port 5173 --strictPort
```

Run `npm run build` for TypeScript validation and a production build. No backend, credentials, or external services are required. Package installation uses `registry.npmjs.org`. The app has no remote fonts or analytics.

## Functional tests

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm test
```

The cloud image includes Chromium. On another machine, install Playwright Chromium with `npx playwright install chromium` and run `npm test` without the executable-path override. Tests start Vite automatically when it is not already running and use isolated browser contexts. They verify shared master records, lesson scoping, attribution, filtering, all three supported image formats, IndexedDB persistence, portable backups and attachment bytes, exports, invalid inputs, and mobile keyboard access.

## Using the studio

Create a lesson and assign one of nine editable pillars, in this order: Self-image; Attention & mind; Goals & discernment; Intention; Imagination & feeling; Autosuggestion & conditioning; Faith & prayer; Order, action & movement; Integration & embodiment. Rename them using the gear next to **The nine pillars**, or **Workspace tools** on mobile. Existing browser libraries and older backups receive the supplied names for unchanged Pillar 1–9 placeholders once; custom names, lessons, and their links are preserved.

Every lesson contains **Research**, **Quotes & Extracts**, and **Diagrams & Visuals** tabs. Add an entry, or use **Link existing** to connect a master entry to the lesson. Editing an entry updates it everywhere it is linked. The central **Research & Visuals** view browses the same entries, filtered by pillar, lesson, and quote use. Quotes require an original research entry; its author and title supply attribution. Sources used by linked quotes remain visible in their lessons even if their direct lesson link is removed. Deleting a source is blocked while any quote still references it.

Research supports bibliographic details, reading status, findings, personal notes, and file attachments. Diagrams support PNG, JPG, SVG, external links, descriptions, concepts, placement, progress status, and revision notes. Images render in image elements; SVG is never inserted into the DOM as markup. External pages may not offer previewable images; their links are still retained. External assets remain links unless you upload the file.

**Export for ChatGPT** offers Markdown containing the lesson, its linked sources and exact quotes, visual descriptions, and all notes. It marks missing attribution as not recorded. **Download with attachments** creates a portable lesson JSON with uploaded files embedded; the text plus relevant images/documents can be supplied to ChatGPT separately. Source attachments and diagram images can be downloaded from their edit dialogs.

**Copy for ChatGPT** copies a structured Markdown brief, including the permanent lesson ID and outstanding questions. **Import from ChatGPT** accepts a pasted or uploaded lesson-update JSON, previews each revision/addition, and saves only the changes you accept. It updates one lesson without replacing the workspace or deleting library records and attachments. New research starts as **Awaiting verification**. See [the exact response format and examples](CHATGPT-EXCHANGE.md).

## Storage and portable backups

Metadata and actual uploaded file blobs are saved together in IndexedDB. Wait for **Saved locally** before closing the page. If a write fails, the studio shows the failure and the current in-memory workspace can still be downloaded. Files are limited to 10 MB each. There is no account or server sync: browser storage is specific to the site's origin and can be cleared by the browser. Use one editing tab at a time.

**Download backup** exports the entire workspace as versioned JSON, embedding each uploaded file as base64. **Restore backup** validates the schema, record identities, links, statuses, and embedded files before presenting a replacement confirmation. Restore replaces the current workspace; export it first if you want to keep it. Backups up to 150 MB can be imported. A portable lesson JSON can also be restored as a standalone workspace, with the same replacement behavior. Browser quota limits still apply, and exported files should be kept outside the browser.

## Cloud startup

Use this existing checkout; cloud tasks are already isolated, so no Git worktree is needed. Installed dependencies and build outputs can survive environment publication, but the Vite process must be restarted for a new task. Saved environment startup instructions describe that process and the functional readiness check. Source changes are intentionally left for user review; this setup does not push to GitHub or publish the environment.
