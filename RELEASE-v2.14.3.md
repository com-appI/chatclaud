# ChatClaud 2.14.3 — Release notes

## Interface and onboarding
- Refined the existing landing and sign-in screens without replacing the single-page HTML app.
- Removed visible ClaudForge branding from the UI and updated the product description.
- Added display-name and age-group onboarding (no exact birth date is collected).
- Added a workspace-preparation animation with particles that orbit and converge.
- Added editable chat titles in the sidebar.
- Added a profile display-name field in Settings and persisted it to the user profile.

## Live agent experience
- Added a white orb with state-specific icons for Thinking, Planning, Searching, Reading, Analyzing, Coding, Testing, Verifying and Completed.
- Removed the old animated underline beneath the typing/status indicator.
- Added real server-sent status events for `/api/chat` requests that opt into streaming.
- Connected the frontend to Groq token streaming for direct-answer requests; cognitive-agent requests stream live phase/tool statuses and send the reviewed answer when complete. JSON fallback compatibility is retained.
- Changed source controls to a globe icon and the English label `Sources`.

## Search
- Added staged Nova query expansion: 4 initial queries, then up to 10, then up to 20 only when evidence remains weak. Search batches and fetch work have bounded timeouts.
- Added search and page-reading status events for both direct-search and cognitive-agent tool paths.
- Kept fetch count and tool execution bounded.

## Deployment notes
- No new npm dependencies or new environment variables are required.
- Keep the existing Groq model and Nova configuration unchanged.
- Deploy `server.js` to the existing Render backend, then deploy the updated static files to GitHub Pages.
- The PWA cache name is bumped to `chatclaud-static-v20`.
