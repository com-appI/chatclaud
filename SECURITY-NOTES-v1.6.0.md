# Security notes — ChatClaud 1.6.0

- Real Groq, Nova, Tavily, Serper, Firecrawl, admin and Plus secrets are not shipped. Configure them only in the existing hosting provider's secret manager.
- The existing Firebase Web configuration remains in `index.html` because it is the public client configuration required by Firebase Authentication/Firestore. Firebase documents that Firebase service API keys are public identifiers, not authorization secrets; their safety still depends on API restrictions, Firebase Security Rules and App Check. This package cannot inspect the project's Google Cloud/Firebase Console settings, so those restrictions and rules must be confirmed by the project owner before/after deployment.
- Do not reuse the Firebase client key for Gemini Developer API or other non-Firebase APIs. Use separate restricted server-side keys for non-Firebase services.
- Agent tool calls are allowlisted and permission-checked. They have bounded call counts, timeouts, input/output validation and cancellation signals. This is not an arbitrary shell or JavaScript execution environment.
- Assistant UI control is limited to visible, reversible interface actions and requires explicit matching user intent. It cannot inspect secrets/cookies, manipulate account/security/billing, submit forms, publish externally, delete history or activate camera/microphone/voice hardware.
- Logs contain operational metadata only; they must not include user prompts, API keys or authorization tokens.
- This release does not migrate or introduce a persistent user-memory database.
