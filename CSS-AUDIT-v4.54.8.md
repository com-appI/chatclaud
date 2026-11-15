# CSS Audit Report — 4.54.8

## Findings (4.54.7)
- 25 style blocks, ~308KB CSS, ~2922 !important
- Duplicate @keyframes (ccBlink, ccLookAround, messageSpring, …)
- Late layers forced `#flashChat { background:#000 !important }` via body.cc-bg-* 
- Empty theme option (aurora removed residual)
- Light theme mapped to classic/dark in JS ("Light removed in 3.19.0")
- Hero registration still showed ChatClaud 3.19.0
- Pulse CSS appended last but lost to higher-specificity !important black backgrounds

## Fixes
1. Replaced weak pulse sheet with `cc-4.54.8-theme-system` scoped by html[data-theme]
2. Pulse selectors include body.cc-bg-wave/blue paths to beat old !important
3. Theme select rebuilt: pulse, dark, light, auto
4. Default data-theme=pulse; boot applies saved or pulse
5. Light mapping restored
6. Version labels 4.54.8 on hero/registration
7. Did not delete legacy CSS bulk (JS may depend on classes) — neutralized conflicts via ordered theme system

## Known remaining issues
- Legacy duplicate keyframes still present (harmless if names collide last-wins)
- Large historical CSS still in file (technical debt, not deleted for safety)
- Browser visual QA not run in this environment
