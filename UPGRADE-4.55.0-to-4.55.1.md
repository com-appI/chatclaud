# Upgrade 4.55.0 → 4.55.1

1. Deploy `server.js` + `lib/unified-memory.js` + tests
2. Keep `ALE_DATA_DIR` on Render persistent disk
3. Optional `MEM_SID_SECRET` for stable session hashing
4. Clients get `cc_mem_sid` HttpOnly cookie automatically
