# ChatClaud 2.14.3 — Deployment

1. Keep the existing Render environment variables and secrets unchanged.
2. Deploy the updated backend (`server.js` and existing project files) to the current Render service. No additional package installation is needed.
3. Deploy the updated static project files, including `index.html` and `sw.js`, to the existing GitHub Pages repository.
4. Open the published app, sign in, and verify the new profile step, workspace-preparation animation, chat rename, agent status orb, and Sources control.
5. Test a forced Nova search and a longer research request. The search should start with 4 queries, expand to 10 when evidence is weak, and expand to 20 only if it is still weak. The cognitive-agent search path uses a bounded timeout to fit its tool execution window.

The backend must be updated before the frontend to enable live SSE status and direct-answer token streaming. Cognitive-agent requests publish live phase/tool statuses and return their reviewed answer at completion. The frontend still accepts a regular JSON response if an older backend is temporarily encountered.
