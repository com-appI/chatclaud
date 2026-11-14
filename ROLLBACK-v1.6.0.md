# Rollback — ChatClaud 1.6.0

This release introduces no database migration and adds no runtime npm dependency.

1. Keep the original `ChatClaud-v1.5.2-deploy-ready(1).zip` as the rollback artifact.
2. If deploying v1.6.0 fails staged smoke tests, restore the complete v1.5.2 backend and frontend together; do not mix `server.js` from one version with `index.html` from another.
3. Restore the prior service-worker asset/cache version by restoring the v1.5.2 `sw.js` together with its matching frontend assets.
4. Preserve host-managed environment variables and secrets; no secrets need to be copied or migrated for rollback.
5. Restart the existing Node service and verify `/api/health` and a basic `/api/chat` request.

No production deployment or remote configuration change was performed while preparing this archive.
