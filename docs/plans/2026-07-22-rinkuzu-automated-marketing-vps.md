# Kế hoạch triển khai marketing tự động cho Rinkuzu trên VPS

## 1. Kiến trúc và mục tiêu

Triển khai một hệ thống độc lập với production app:

```text
Nguồn sự thật Rinkuzu + lịch nội dung
                ↓
DeepSeek V4 Flash tạo biến thể có cấu trúc
                ↓
Claim/PII/duplicate/platform validators
                ↓
Postiz Public API
                ↓
Facebook · Instagram · Threads · X · LinkedIn
TikTok · YouTube · Pinterest · Telegram · Discord
Bluesky · Mastodon · Medium · Dev.to · Hashnode
                ↓
Postiz analytics + GA4 + dữ liệu activation của Rinkuzu
```

- Postiz chạy bằng Docker Compose chính thức trên VPS Ubuntu 24.04, 2 vCPU, 4 GB RAM, 50 GB SSD, thêm 4 GB swap. Upstream xem 2 GB là mức sàn và 8 GB là mức khuyến nghị; 4 GB phù hợp để bắt đầu nếu tắt service debug, dùng R2 và theo dõi OOM. ([Postiz requirements](https://docs.postiz.com/installation/system-requirements))
- Dùng Postiz `v2.21.10`, pin image/tag và compose commit `d833d9bfa1ad5174cc37b66de809a62ca70bfc5f`; không dùng `latest`.
- Dùng domain `social.rinkuzu.app`, HTTPS qua Caddy, Cloudflare DNS/WAF.
- Không dùng Hugging Face Space trong đường production: PRO không loại bỏ ephemeral disk hay sleep của CPU Basic.
- DeepSeek dùng `deepseek-v4-flash`, OpenAI-compatible endpoint `https://api.deepseek.com`; không dùng alias `deepseek-chat` hoặc `deepseek-reasoner` sắp bị ngừng. ([DeepSeek API](https://api-docs.deepseek.com/guides/function_calling/))
- Codex kết nối Postiz qua MCP để vận hành thủ công; GitHub Actions chịu trách nhiệm automation 24/7. Codex không phải daemon xuất bản.

## 2. Các hạng mục triển khai

### Giai đoạn A — Làm sạch nguồn sự thật trước khi auto-publish

Trong repo Rinkuzu:

- Refresh GitNexus index, chạy upstream impact analysis trước mọi thay đổi symbol; cảnh báo và dừng nếu rủi ro HIGH/CRITICAL.
- Chuẩn hóa `.agents/product-marketing-context.md` thành `.agents/product-marketing.md`.
- Xóa hoặc thay bằng diễn đạt kiểm chứng được các claim hiện chưa có bằng chứng: “#1”, 10.000/50.000 người dùng, “thousands”, unlimited, offline, teacher analytics, priority support và testimonial không có nguồn.
- Đồng bộ landing, pricing, FAQ, about, contact, terms và `llms.txt`; không để pricing/legal nói khác nhau.
- Giữ định vị chính: “Biến PDF môn học thành lộ trình ôn tập biết rõ phần nào bạn còn yếu.”
- Tạo `claims.yml` làm registry duy nhất:

```yaml
id: pdf_to_practice
statement: 'Tạo nội dung luyện tập từ tài liệu học tập'
status: verified
evidence_url: 'https://www.rinkuzu.app/...'
expires_at: '2026-10-31'
allowed_channels: ['*']
```

`status` chỉ có `verified`, `experimental`, `forbidden`. Automation chỉ được sử dụng claim `verified` chưa hết hạn.

- Pin chọn lọc [`marketingskills`](https://github.com/coreyhaines31/marketingskills) tại commit `67264763cb107d61749f418d081c56e5bcbc0209`: `product-marketing`, `customer-research`, `analytics`, `content-strategy`, `copywriting`, `social`, `video`, `marketing-loops`, `emails`, `launch`. Không cài toàn bộ 47 skill.
- Dùng marketingskills làm workflow/prompt và guardrail; Postiz vẫn là publisher thực tế.

### Giai đoạn B — Dựng Postiz trên VPS

Tạo private repo `rinkuzu-marketing-ops` với ba khu vực chính:

- `infra/postiz/compose.prod.yaml`: stack Postiz, PostgreSQL, Redis, Temporal, Temporal PostgreSQL và Elasticsearch.
- `automation/`: DeepSeek client, validators, media templates, scheduler và reconciliation.
- `.github/workflows/marketing-*.yml`: generate, reconcile, health check và restore test.

Cấu hình máy chủ:

1. Tạo user `deploy`, chỉ SSH key; tắt password login và root SSH.
2. Bật UFW: mở `22` cho IP quản trị, `80/443` công khai; không mở PostgreSQL, Redis, Elasticsearch, Temporal hoặc Docker socket.
3. Cài Docker Engine và Compose plugin từ repository chính thức.
4. Tạo 4 GB swap; đặt `vm.max_map_count=262144` cho Elasticsearch.
5. Cấu hình Docker log rotation `10m × 3`.
6. Bind Postiz vào `127.0.0.1:4007`; Caddy là entrypoint công khai duy nhất.
7. Tắt `spotlight`, `temporal-ui` và `temporal-admin-tools` trong profile production; chỉ bật tạm khi debug.
8. Giữ Elasticsearch heap ở `256 MB`; dùng Cloudflare R2 bucket riêng `rinkuzu-marketing-media` cho ảnh/video.
9. Sau khi tạo tài khoản admin đầu tiên, đặt `DISABLE_REGISTRATION=true`.
10. Để `NOT_SECURED` hoàn toàn unset; cấu hình `RUN_CRON=true`, `IS_GENERAL=true`, `API_LIMIT=90`.

Secrets bắt buộc:

```text
JWT_SECRET
POSTIZ_DATABASE_PASSWORD
TEMPORAL_DATABASE_PASSWORD
POSTIZ_API_KEY
DEEPSEEK_API_KEY
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_R2_ACCESS_KEY
CLOUDFLARE_R2_SECRET_KEY
FACEBOOK_APP_ID / FACEBOOK_APP_SECRET
... credentials riêng của từng provider
```

- Secrets nằm trong root-owned `.env` mode `0600` hoặc secret store của CI; không commit.
- Dùng khóa R2 riêng chỉ có quyền trên bucket marketing.
- Không đặt API key vào URL, log, prompt hoặc nội dung GitHub Actions.
- Sau khi VPS hoạt động, tạo Postiz API key riêng cho automation và một key khác cho Codex để có thể rotate độc lập.
- Backup mỗi 6 giờ: `pg_dump` Postiz DB và Temporal DB, mã hóa bằng `age`, upload R2; giữ 7 bản hằng ngày và 4 bản hằng tuần.
- Snapshot volume Redis/Elasticsearch/config hằng tuần trong maintenance window.
- RPO mục tiêu 6 giờ; RTO mục tiêu 90 phút.
- Mọi upgrade phải backup trước, smoke-test ở local/staging, nâng một version và giữ image cũ để rollback.

### Giai đoạn C — DeepSeek automation và Codex

DeepSeek trả về JSON theo schema bắt buộc:

```ts
type MarketingContent = {
  id: string;
  locale: 'vi-VN';
  pillar: 'study_tip' | 'product_demo' | 'learning_science' | 'community';
  format: 'short_text' | 'carousel' | 'vertical_video' | 'long_form';
  sourceUrls: string[];
  claimIds: string[];
  scheduledAt: string;
  variants: Array<{
    provider: string;
    content: string;
    media: string[];
    settings: Record<string, unknown>;
  }>;
  utm: {
    source: string;
    medium: string;
    campaign: string;
    content: string;
  };
};
```

Pipeline mỗi thứ Hai lúc 09:00 Việt Nam:

1. Fetch `.agents/product-marketing.md`, `claims.yml`, bài blog/release mới và kết quả tuần trước.
2. Tạo ba “content atom” cho bảy ngày tiếp theo bằng `deepseek-v4-flash`, non-thinking mode, JSON output.
3. Sinh biến thể riêng cho từng provider; không copy cùng một caption cho mọi nền tảng.
4. Render carousel bằng SVG/Sharp; video dọc 1080×1920 bằng template FFmpeg từ screenshot/demo fixture đã kiểm soát.
5. Chạy validators:
   - JSON schema hợp lệ.
   - Tất cả claim tồn tại và đang `verified`.
   - Không chứa PII, tài liệu/người dùng thật hoặc secret.
   - Không có banned claim.
   - Đúng length, hashtag, media ratio và settings của provider.
   - URL trả về 2xx.
   - UTM đúng chuẩn.
   - Content hash chưa xuất hiện trong 60 ngày.
6. Nếu bất kỳ validator nào lỗi, chuyển `quarantined`, gửi Telegram alert và tuyệt đối không publish.
7. Upload media lên Postiz/R2.
8. Schedule trước ít nhất 24 giờ; batch nhiều provider trong một API request để tiết kiệm rate limit.
9. Retry Postiz 5xx/429 tối đa ba lần với exponential backoff; lỗi 4xx không retry.
10. Hai lỗi liên tiếp trên cùng provider sẽ tự disable provider và cảnh báo.
11. `AUTO_PUBLISH=false` là kill switch toàn hệ thống.

Content ledger lưu các trạng thái:

```text
generated → validated → scheduled → published
                    ↘ quarantined
scheduled/published ↘ failed
```

Mỗi record giữ `content_id`, hash, source, claim IDs, provider, Postiz post ID, release URL, retry count và analytics.

Cấu hình Codex MCP:

```toml
[mcp_servers.postiz]
url = "https://social.rinkuzu.app/mcp"
bearer_token_env_var = "POSTIZ_API_KEY"
enabled_tools = [
  "integrationList",
  "integrationSchema",
  "triggerTool",
  "schedulePostTool"
]
default_tools_approval_mode = "auto"
tool_timeout_sec = 60
```

- Cài Postiz agent skill bằng `npx skills add gitroomhq/postiz-agent`.
- MCP dùng cho xem kênh, đọc schema và đăng/lên lịch. CLI/Public API dùng cho upload, list/delete posts và analytics. ([Postiz MCP](https://docs.postiz.com/mcp/introduction), [Postiz CLI](https://docs.postiz.com/cli/introduction), [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp))
- Không bật Postiz `generateImageTool`/`generateVideoTool` ở V1 vì chúng cần AI provider riêng.
- Codex chỉ là operator và công cụ phục hồi; automation vẫn chạy khi Codex hoặc máy local tắt.

### Giai đoạn D — Rollout nền tảng và marketing 90 ngày

Postiz hỗ trợ 32 provider qua API, nhưng chỉ kích hoạt kênh có tài khoản sở hữu và phù hợp với Rinkuzu. ([Provider list](https://docs.postiz.com/providers/overview))

| Thời điểm | Kênh                                              | Nội dung                                   |
| --------- | ------------------------------------------------- | ------------------------------------------ |
| Tuần 1–2  | Facebook Page, Instagram Business, Threads        | Study tip, carousel, demo PDF → practice   |
| Tuần 3    | LinkedIn Page, X, Bluesky, Mastodon               | Bản ngắn, product update, learning science |
| Tuần 4    | Telegram Channel, Discord announcement, Pinterest | Announcement và visual study cards         |
| Tuần 5–6  | TikTok, YouTube Shorts                            | Video dọc 15–30 giây từ demo fixture       |
| Tuần 6–8  | Medium, Dev.to, Hashnode                          | Bài dài có canonical URL về blog Rinkuzu   |

Không auto-post vào Facebook Group, Reddit community, personal profile, comment, reply hoặc DM. Đây là ranh giới chống spam/TOS, không phải giới hạn kỹ thuật.

Cadence:

- Ba content atom mỗi tuần; mỗi atom được biến thể cho các kênh đang active.
- 40% study tips và phương pháp ôn PDF.
- 30% product demo bằng dữ liệu mẫu thật.
- 20% learning science/knowledge graph.
- 10% survey, poll và community prompt.
- Tối đa một post/ngày/kênh, ba post/tuần cho kênh chính.
- Không chạy paid ads trước khi có baseline PMF.

UTM:

```text
utm_source={provider}
utm_medium=organic_social|owned_community|syndicated_content
utm_campaign=pmf_2026q3_{positioning_angle}
utm_content={content_id}_{variant}
```

Bổ sung analytics trong Rinkuzu:

#### Cập nhật triển khai ngày 2026-07-23

- [x] GA4 đã được cấu hình trên production để đo acquisition và UTM.
- [x] PostHog US Cloud đã được cấu hình cho product analytics; region được xác minh từ project `525510`.
- [x] Analytics chỉ khởi tạo sau khi người dùng đồng ý; banner consent hỗ trợ tiếng Việt và tiếng Anh.
- [x] Không gửi email, tên, tiêu đề PDF, nội dung PDF, mật khẩu hoặc nội dung đáp án vào analytics.
- [x] Đã instrument `$pageview`, `signup_started`, `signup_completed`, `login_completed`, `pdf_upload_started`, `pdf_upload_completed`, `pdf_upload_failed`, `adaptive_session_started`, `adaptive_answer_submitted`, `first_question_answered` và `quiz_completed`.
- [x] Production đã được smoke test sau khi nâng Next.js lên `16.2.11`, NextAuth lên `5.0.0-beta.32` và `@auth/core` lên `0.41.3`.
- [x] Đã tạo và lưu [RinKuzu Activation Funnel](https://us.posthog.com/project/525510/insights/YMZtwhZK): `$pageview` → `signup_completed` → `pdf_upload_completed` → `first_question_answered` → `quiz_completed`.
- [x] Đã đánh dấu `signup_completed`, `pdf_upload_completed`, `first_question_answered` và `quiz_completed` là Key events trong GA4.
- [x] Đã xác minh PostHog nhận `Pageview` production từ `https://www.rinkuzu.app/vi/dashboard` sau consent.
- [ ] Thu và chốt baseline acquisition/activation trong bảy ngày đầu; các event activation cần phát sinh từ người dùng thật trước khi đánh giá conversion.
- [ ] Xử lý type graph toàn repo đang vượt giới hạn RAM 8 GB khi chạy TypeScript; Vercel hiện chỉ bỏ qua typecheck trong build production, còn local/CI vẫn giữ cổng typecheck.

Danh sách dưới đây là event schema mục tiêu. Những event chưa xuất hiện trong danh sách đã instrument ở trên vẫn là backlog:

```text
landing_cta_clicked
signup_started
signup_completed
email_verified
pdf_upload_started
artifact_generated
practice_started
practice_completed
activation_completed
paywall_viewed
checkout_started
purchase_completed
survey_submitted
```

- Không gửi email, tên, tiêu đề PDF hoặc nội dung học tập vào GA4.
- Activation được định nghĩa là: người dùng đã verify email, tạo artifact đầu tiên và hoàn thành quiz/adaptive exercise đầu tiên trong 24 giờ.
- Dùng GA4 cho acquisition/UTM; dùng dữ liệu MongoDB/PayOS hiện có cho activation, retention và purchase.
- Thêm consent banner trước khi bật analytics không thiết yếu.
- Không tạo public API marketing mới; chỉ thêm typed `MarketingEvent` và job báo cáo aggregate nội bộ.

Thay phỏng vấn thủ công bằng hai micro-survey:

- Sau lần practice đầu tiên: mục tiêu học, lý do chọn Rinkuzu và trở ngại lớn nhất.
- Sau session thứ ba: câu hỏi PMF “Bạn sẽ cảm thấy thế nào nếu không thể tiếp tục dùng Rinkuzu?”.
- DeepSeek tổng hợp response hằng tuần; câu trả lời gốc không được đưa vào nội dung công khai.

Mục tiêu sau 90 ngày:

- Ít nhất 100 verified signups có UTM.
- Ít nhất 40 activated users; activation rate ≥40%.
- D7 retention của activated cohort ≥25%.
- Ít nhất 20 PMF survey responses và ≥40% chọn “rất thất vọng”.
- Ít nhất một content pillar tạo ≥10 activated users mà không dùng paid ads.
- Publish success sau retry ≥95%.
- Không có claim sai, PII leak hoặc bài trùng trong 60 ngày.

Ngân sách tối đa 5 triệu đồng/tháng:

- VPS, backup, R2 và domain ops: ≤700.000đ.
- DeepSeek API: ≤300.000đ, có hard monthly cap.
- Monitoring/transactional services: ≤200.000đ.
- Template/media và incentive khảo sát: ≤1.800.000đ.
- Dự phòng hoặc thử nghiệm phân phối: ≤2.000.000đ.
- Paid ads mặc định bằng 0 cho đến khi đạt activation và D7 gate.

## 3. Kiểm thử, nghiệm thu và vận hành

### Hạ tầng

- `docker compose config` không lỗi và toàn bộ image đã pin.
- Chỉ các cổng 22/80/443 có thể truy cập từ Internet.
- PostgreSQL, Redis, Temporal và Elasticsearch không public.
- Reboot VPS phải tự khởi động đủ stack và không mất schedule.
- Chạy soak test 72 giờ với ít nhất 60 scheduled variants; không có OOM hoặc container restart bất thường.
- Cảnh báo khi RAM >85% trong 15 phút, disk >75%, container unhealthy hoặc scheduled post trễ >10 phút.
- Nếu có hai OOM trong bảy ngày hoặc RAM >85% liên tục, nâng VPS lên 8 GB; không tiếp tục “tối ưu” để giữ 4 GB.

### Backup và disaster recovery

- Restore cả Postiz DB và Temporal DB lên volume trống.
- Xác minh admin login, integration metadata, scheduled posts và R2 media.
- Thực hiện restore drill trước khi mở Tier 2 và lặp lại hằng tháng.
- Nếu migration Postiz lỗi, rollback image cũ và snapshot trước migration.

### Automation

- Mock DeepSeek: valid JSON, malformed JSON, timeout, 402, 429 và 5xx.
- Mock Postiz: 400, 401, 403, 413, 429 và 5xx.
- Kiểm tra forbidden claim, expired claim, PII, duplicate hash, invalid UTM và media sai tỷ lệ đều phải fail closed.
- Kiểm tra kill switch ngăn mọi lệnh schedule/publish.
- Kiểm tra circuit breaker chỉ disable provider lỗi, không dừng toàn bộ pipeline.
- Reconciliation hằng ngày phải phát hiện post missing/release ID thiếu và cảnh báo.
- Đối chiếu GA4 với dữ liệu app; sai lệch event quan trọng không quá 5%.

### Rollout an toàn

1. Tuần đầu chạy `draft/shadow mode`, không publish.
2. Sau khi validator và restore drill pass, mở Facebook/Instagram/Threads với một post thử mỗi kênh.
3. Theo dõi bảy ngày; yêu cầu không có missed post, claim sai hoặc token/OAuth failure chưa phát hiện.
4. Mở lần lượt các tier còn lại, tối đa ba provider mới mỗi ngày.
5. Trước mọi commit trong Rinkuzu, chạy GitNexus `detect_changes` cho staged scope; trước handoff so sánh với `master`.
6. Chạy targeted tests, typecheck, lint và full pre-commit gate; không bypass hook.
7. Handoff phải ghi rõ version/digest, command triển khai, backup gần nhất, provider active/disabled và các kiểm tra live chưa thực hiện.

## 4. Giả định đã khóa

- VPS mới dùng Ubuntu 24.04 LTS, static IPv4, 2 vCPU, 4 GB RAM và tối thiểu 50 GB SSD.
- Có quyền quản lý `rinkuzu.app`, Cloudflare, R2 và OAuth developer app của từng nền tảng.
- Production URL là `https://social.rinkuzu.app`.
- Ngôn ngữ V1 là tiếng Việt; đối tượng chính là sinh viên đại học Việt Nam.
- Không cần bước human approval; mọi lỗi validation đều quarantine thay vì hỏi người dùng.
- DeepSeek API là AI provider duy nhất của pipeline V1.
- Chỉ tài khoản/page/channel do Rinkuzu sở hữu mới được auto-publish.
- HF Space chỉ được dùng cho demo phụ nếu cần, không chứa Postiz DB hoặc social OAuth token.
- Thông tin lịch sử về luồng Rinkuzu chỉ dùng để định hướng phạm vi analytics; trước khi sửa code phải xác minh lại trên checkout hiện tại.
