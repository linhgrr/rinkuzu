# RIN-22 evidence-to-Postiz handoff

Run date: 2026-08-11 (Asia/Saigon)

Disposition: draft-ready media; Postiz creation blocked closed.

## Voice-policy correction (2026-08-12)

- The Product & Growth Lead superseded the original v2 requirement: commercial content must use `pnnbao-ump/VieNeu-TTS-v3-Turbo` through CPU ONNX. The v2 preset pack is excluded because its local `voices.json` is CC BY-NC 4.0.
- The RIN-22 job was updated to the default approved voice, `Trúc Ly`, at temperature `0.85`, then regenerated with `npm run video -- --input examples/rin-22-next-practice-step.json`.
- Generated voice evidence: model `pnnbao-ump/VieNeu-TTS-v3-Turbo`, backend `v3turbo-cpu-onnx`, preset `Trúc Ly`, 48 kHz, 11.6 seconds.
- Regenerated video QA: `ok: true`, 1080×1920, H.264, 30 fps, no failures. MP4 SHA-256: `8a4bd1f8a787be4728b2b52c429732d003bf55cd8d5cc43071dcbcb189870f15`.
- The regenerated `postiz-manifest.json` remains `draft_ready` with `publicMediaUrl: null`. No publication or Postiz ID is claimed.

## Evidence and claim gate

- Active hypothesis inspected: Vietnamese university learners preparing from lecture PDFs remains `experimental`, restricted to internal/private-beta research, and is not used as a public claim.
- Public claim used: `product_concept_graph_next_step` — verified, permits `organic_social`, expires 2026-11-09.
- Repository evidence: `src/features/adaptive/components/KnowledgeGraph.tsx` and the claim registry's pinned repository link.
- PostHog dashboard `1985240`, refreshed 2026-08-11: 17 funnel entrants, 1 completed login, 0 completed PDF uploads, and 0 completed quizzes for 2026-07-12 through 2026-08-11 UTC. These aggregates informed the choice to explain the workflow; none appear in public copy.
- Sixty-day ledger checked through the 2026-08-11 reconciliation. The concept/prerequisite “next step” hook is distinct from the recent bilingual/PWA, public-sharing, PDF checklist, and three-bucket PDF drafts. Run the live Postiz list and exact normalization/hash check again before creation because the current MCP inventory was unavailable.
- PII/secret gate: copy and generated media contain no user names, emails, PDFs, answers, credentials, testimonials, or private analytics.

## Content atom

Angle: when a learner is unsure what to practice next, show the relationship between concepts and prerequisite context. This does not promise accuracy, speed, retention, grades, or other learning outcomes.

### TikTok

Caption: Khi chưa biết nên luyện phần nào tiếp theo, hãy nhìn lại mối liên hệ giữa khái niệm và phần kiến thức tiên quyết. Rinkuzu giúp bạn chọn bước luyện tập kế tiếp. #rinkuzu #hoctap #kienthuc #studywithme

URL: `https://rinkuzu.app/vi?utm_source=tiktok&utm_medium=organic_social&utm_campaign=pmf_2026q3_next_practice_step&utm_content=rin_22_next_practice_step_v1_tiktok`

### YouTube Shorts

Title: Chọn bước luyện tập tiếp theo từ bản đồ khái niệm

Description: Các khái niệm liên quan và phần kiến thức tiên quyết có thể giúp bạn quyết định nên luyện phần nào tiếp theo với Rinkuzu.

URL: `https://rinkuzu.app/vi?utm_source=youtube&utm_medium=organic_social&utm_campaign=pmf_2026q3_next_practice_step&utm_content=rin_22_next_practice_step_v1_youtube_shorts`

### Threads

Copy: Đang phân vân nên luyện phần nào tiếp theo? Rinkuzu kết nối các khái niệm với ngữ cảnh tiên quyết để bạn xem mối liên hệ rồi chọn bước luyện tập kế tiếp. Khám phá trên web: https://rinkuzu.app/vi?utm_source=threads&utm_medium=organic_social&utm_campaign=pmf_2026q3_next_practice_step&utm_content=rin_22_next_practice_step_v1_threads

### Telegram

Copy: Một cách chọn phần luyện tập kế tiếp:

1. Xem khái niệm đang ôn.
2. Kiểm tra các khái niệm và phần kiến thức tiên quyết liên quan.
3. Chọn bước luyện tập kế tiếp trong Rinkuzu.

Mở Rinkuzu: https://rinkuzu.app/vi?utm_source=telegram&utm_medium=organic_social&utm_campaign=pmf_2026q3_next_practice_step&utm_content=rin_22_next_practice_step_v1_telegram

## Video factory evidence

- Job: `rinkuzu-video-factory/examples/rin-22-next-practice-step.json`
- Command: `npm run video -- --input examples/rin-22-next-practice-step.json`
- Voice: superseded; see the 2026-08-12 voice-policy correction above. The current artifact uses `pnnbao-ump/VieNeu-TTS-v3-Turbo` via CPU ONNX with `Trúc Ly` at `0.85`.
- Output: 1080×1920, H.264, 30 fps, 20 seconds.
- QA: `ok: true`, no failures.
- MP4 SHA-256: `8a4bd1f8a787be4728b2b52c429732d003bf55cd8d5cc43071dcbcb189870f15`.
- Output directory: `rinkuzu-video-factory/out/rin-22-next-practice-step-v1/` contains `prepared.json`, MP4, `qa.json`, `voice.json`, and `postiz-manifest.json`.

## Exact blockers

- The configured Postiz MCP server exposes no callable `integrationList`, `integrationSchema`, or scheduling tool in this Codex runtime. Therefore the integration inventory and platform schema could not be refreshed, and no Postiz draft was created.
- No approved public HTTPS asset-host credentials or upload tool are available in the runtime. `postiz-manifest.json` correctly retains `publicMediaUrl: null`.
- TikTok and YouTube integrations cannot be assumed from the prior Threads/Telegram snapshot. No publication or Postiz ID is claimed.

Unblock owner/action: Product & Growth Lead or infrastructure owner must restore the configured Postiz MCP tools and provide the approved public media upload path. On wake, re-list integrations, fetch each target schema, reconcile the 60-day ledger, upload the QA-passed MP4, create `type=draft`, and record the real Postiz ID.

Next experiment after unblock: compare qualified visits and activation from the “next practice step” video against the recent PDF-workflow atom; kill the format if it produces attention without attributable activation or useful feedback.

## Continuation check (2026-08-12, Asia/Saigon)

- PostHog project `525510`, dashboard `1985240`, was force-refreshed for the rolling 30-day window ending 2026-08-11 UTC. Aggregate results: 17 visitors, 2 people completing login, 0 people completing PDF upload, and 0 people completing quiz. Threads accounted for 7 visitors by `utm_source`; these are directional acquisition signals, not activation or outcome evidence, and are not used in public copy.
- The QA artifact was reverified in place: `qa.json` remains `ok: true`, the MP4 is 1080×1920 H.264 at 30 fps, and its SHA-256 remains `8a4bd1f8a787be4728b2b52c429732d003bf55cd8d5cc43071dcbcb189870f15`.
- `voice.json` still records `pnnbao-ump/VieNeu-TTS-v3-Turbo`, backend `v3turbo-cpu-onnx`, and preset `Trúc Ly`. This reflects the Product & Growth Lead's recorded commercial-license correction, which supersedes the issue description's older v2 pin.
- `postiz-manifest.json` still has `publicMediaUrl: null`. The runtime exposes no approved public HTTPS media-host integration or credentials.
- The current tool inventory again exposes no Postiz MCP calls, including the required `integrationList`, `integrationSchema`, and `integrationSchedulePostTool`. A `POSTIZ_API_KEY` environment variable exists, but direct undocumented API use was deliberately not substituted for the required configured MCP workflow.
- Result: zero drafts or schedules created in this continuation; zero Postiz IDs; no publication claimed. The rollout clock remains at zero clean days because provider-state reconciliation is unavailable and the quarantined no-UTM legacy draft remains unresolved.

Named unblock owner/action: Product & Growth Lead or infrastructure owner must restore the Postiz MCP server and an approved public HTTPS asset-upload path, and correct or remove the quarantined no-UTM Postiz draft. After that, re-run integration inventory and per-platform schemas, reconcile the 60-day ledger, upload the unchanged QA-passed MP4, create `type=draft`, and record the returned Postiz ID.
