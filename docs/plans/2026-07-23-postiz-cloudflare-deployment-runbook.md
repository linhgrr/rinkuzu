# Runbook triển khai Postiz và `social.rinkuzu.app`

Ngày cập nhật: 2026-07-23

## 1. Trạng thái hiện tại

Hạ tầng vận hành marketing đã sẵn sàng để bắt đầu giai đoạn thử nghiệm:

- Website chính `rinkuzu.app` và `www.rinkuzu.app` vẫn được deploy trên Vercel.
- Name.com vẫn là registrar, tức nơi sở hữu và gia hạn domain.
- Cloudflare hiện quản lý DNS của `rinkuzu.app`.
- Postiz `v2.21.10` chạy bằng Docker Compose trên VPS Ubuntu 22.04.
- Postiz chỉ bind vào `127.0.0.1:4007`, không mở trực tiếp ra Internet.
- Cloudflare Tunnel `rinkuzu-postiz` chuyển tiếp:

  ```text
  https://social.rinkuzu.app
          ↓
  Cloudflare Tunnel
          ↓
  http://localhost:4007 trên VPS
          ↓
  Postiz
  ```

- `https://social.rinkuzu.app` trả về giao diện Postiz và đăng nhập hoạt động.
- MCP endpoint `https://social.rinkuzu.app/api/mcp` đã được kiểm tra với API key hợp lệ và trả HTTP 200.
- Telegram đã được kết nối và đã đăng bài thử thành công.
- Ngrok và Nginx cookie proxy dùng trong giai đoạn demo đã được dừng.

Hạ tầng sẵn sàng không có nghĩa là toàn bộ chiến dịch marketing đã tự động hóa. Hiện mới có Telegram là integration đã kiểm thử. Trước khi phát nội dung ra công chúng cần kết nối các kênh discovery chính, chuẩn bị nội dung và chạy shadow mode.

## 2. Kiến trúc domain

### Trước khi dùng Cloudflare

```text
Name.com
   ↓ nameserver
Vercel DNS
   ↓
Website trên Vercel
```

### Sau khi dùng Cloudflare

```text
Name.com
   ↓ nameserver
Cloudflare DNS
   ├── rinkuzu.app / www → Website trên Vercel
   ├── send / DKIM / DMARC → Dịch vụ email
   └── social.rinkuzu.app → Cloudflare Tunnel → Postiz trên VPS
```

Việc đổi nameserver không chuyển website khỏi Vercel. Nó chỉ chuyển nơi lưu “bảng chỉ đường” DNS từ Vercel sang Cloudflare. Miễn là các bản ghi Vercel được sao chép chính xác, các lần deploy Vercel sau vẫn hoạt động bình thường.

## 3. Thông số VPS đã dùng

- Ubuntu 22.04.5 LTS, không cần GUI.
- 4 vCPU.
- 4 GB RAM.
- 40 GB NVMe.
- 4 GB swap.
- VPS NAT, SSH qua port do nhà cung cấp cấp.
- Docker Engine và Docker Compose cài từ repository chính thức.
- Docker log rotation: `10m`, giữ 3 file.
- Không public PostgreSQL, Redis, Temporal hoặc Elasticsearch.

VPS NAT vẫn dùng được với Cloudflare Tunnel vì `cloudflared` chủ động tạo kết nối outbound tới Cloudflare. Không cần public IPv4 riêng và không cần forward port 80/443 vào Postiz.

## 4. Cài Postiz

Thư mục triển khai trên VPS:

```text
/opt/rinkuzu-postiz/postiz-docker-compose
```

Phiên bản đã pin:

```text
Postiz image: ghcr.io/gitroomhq/postiz-app:v2.21.10
Compose commit: d833d9bfa1ad5174cc37b66de809a62ca70bfc5f
```

Các service chính:

- `postiz`
- `postiz-postgres`
- `postiz-redis`
- `temporal`
- `temporal-postgresql`
- `temporal-elasticsearch`

Override production bind Postiz vào localhost:

```yaml
services:
  postiz:
    image: ghcr.io/gitroomhq/postiz-app:v2.21.10
    environment:
      MAIN_URL: https://social.rinkuzu.app
      FRONTEND_URL: https://social.rinkuzu.app
      NEXT_PUBLIC_BACKEND_URL: https://social.rinkuzu.app/api
      DISABLE_REGISTRATION: 'true'
      RUN_CRON: 'true'
      IS_GENERAL: 'true'
      API_LIMIT: 90
    ports: !override
      - '127.0.0.1:4007:5000'
```

Các secret như database password, JWT secret, Telegram token và API key nằm trong `.env` mode `0600`. Không ghi secret thật vào Git, tài liệu, log hoặc command history.

Khởi động hoặc áp dụng lại cấu hình:

```bash
cd /opt/rinkuzu-postiz/postiz-docker-compose
docker compose \
  -f docker-compose.yaml \
  -f compose.prod.yaml \
  up -d
```

Kiểm tra:

```bash
docker compose \
  -f docker-compose.yaml \
  -f compose.prod.yaml \
  ps

docker inspect --format='{{.State.Health.Status}}' postiz
curl -I http://127.0.0.1:4007
```

## 5. Chuyển DNS từ Vercel sang Cloudflare

### 5.1 Thêm zone

Trong Cloudflare:

1. Chọn **Connect a domain**.
2. Nhập `rinkuzu.app`.
3. Chọn plan Free.
4. Để Cloudflare scan DNS.
5. So sánh kết quả scan với DNS authoritative hiện tại trước khi kích hoạt.

Không nên tin tuyệt đối kết quả scan. Cloudflare từng nhập sai một số IP Vercel, vì vậy đã phải đối chiếu lại với DNS authoritative.

### 5.2 Các bản ghi website đã dùng

```text
*              A     64.29.17.65
*              A     216.198.79.1
rinkuzu.app    A     64.29.17.1
rinkuzu.app    A     216.198.79.1
www            A     64.29.17.1
www            A     216.198.79.65
```

Trong thời gian chuyển nameserver, các bản ghi trên được để **DNS only** nhằm giảm thay đổi đồng thời. Không tự ý thay các IP này trong lần triển khai khác; phải truy vấn lại DNS Vercel hiện hành vì địa chỉ có thể thay đổi.

### 5.3 Bảo toàn email

Phải giữ nguyên:

- MX của `send`.
- SPF TXT của `send`.
- DKIM TXT `resend._domainkey`.
- DMARC TXT `_dmarc`.
- Các CAA record cần thiết.

MX, TXT, CAA và `_domainconnect` để **DNS only**.

### 5.4 Đổi nameserver tại Name.com

Cloudflare đã cấp:

```text
alfred.ns.cloudflare.com
keira.ns.cloudflare.com
```

Tại Name.com:

1. Mở **My Domains**.
2. Chọn `rinkuzu.app`.
3. Chọn **Manage Nameservers**.
4. Thay `ns1.vercel-dns.com` và `ns2.vercel-dns.com`.
5. Nhập hai nameserver Cloudflare.
6. Chọn **Save Changes**.

DNSSEC phải tắt trước khi chuyển. Sau khi Cloudflare Active có thể cấu hình lại DNSSEC từ Cloudflare nếu cần.

Lệnh kiểm tra:

```powershell
Resolve-DnsName rinkuzu.app -Type NS
Resolve-DnsName rinkuzu.app -Type A
Resolve-DnsName www.rinkuzu.app -Type A
```

Kiểm tra website vẫn ở Vercel:

```powershell
curl.exe -I https://rinkuzu.app
curl.exe -I https://www.rinkuzu.app
```

Kết quả nghiệm thu ngày 2026-07-23:

- Nameserver trả về Cloudflare.
- `rinkuzu.app` và `www.rinkuzu.app` trả HTTP 200.
- Header server vẫn xác nhận website được phục vụ bởi Vercel.

## 6. Tạo Cloudflare Tunnel

Trong Cloudflare:

1. Vào **Networking → Tunnels**.
2. Chọn **Create Tunnel**.
3. Đặt tên `rinkuzu-postiz`.
4. Chọn Debian, 64-bit.
5. Cài `cloudflared` trên VPS từ repository chính thức.
6. Chạy lệnh `cloudflared service install ...` do Cloudflare sinh.
7. Chờ trạng thái **Healthy**.

Không sao chép tunnel token vào tài liệu. Token cho phép một máy khác tham gia tunnel và phải được bảo vệ như password.

Kiểm tra service:

```bash
systemctl is-enabled cloudflared
systemctl is-active cloudflared
systemctl status cloudflared --no-pager
journalctl -u cloudflared --since "10 minutes ago" --no-pager
```

Route đã tạo:

```text
Type: Published application
Hostname: social.rinkuzu.app
Service URL: http://localhost:4007
```

Cloudflare tự tạo:

```text
social.rinkuzu.app CNAME <tunnel-id>.cfargotunnel.com
```

Không cần tạo thêm A record cho `social`.

## 7. Chuyển Postiz từ ngrok sang domain chính thức

Ba biến public URL phải đồng nhất:

```yaml
MAIN_URL: https://social.rinkuzu.app
FRONTEND_URL: https://social.rinkuzu.app
NEXT_PUBLIC_BACKEND_URL: https://social.rinkuzu.app/api
```

Sau khi sửa, recreate riêng Postiz:

```bash
cd /opt/rinkuzu-postiz/postiz-docker-compose
docker compose \
  -f docker-compose.yaml \
  -f compose.prod.yaml \
  up -d postiz
```

Nghiệm thu:

```bash
docker inspect --format='{{.State.Health.Status}}' postiz
curl -I http://127.0.0.1:4007
curl -I https://social.rinkuzu.app
```

Kết quả mong đợi:

- Container `postiz` là `healthy`.
- `/` redirect `307` tới `/auth` khi chưa đăng nhập.
- `/auth` trả HTTP 200.
- Sau đăng nhập có thể mở `/launches`.
- Integration Telegram vẫn xuất hiện.

## 8. Kết nối Postiz MCP với Codex

Cấu hình trên máy operator:

```toml
[mcp_servers.postiz]
url = "https://social.rinkuzu.app/api/mcp"
bearer_token_env_var = "POSTIZ_API_KEY"
enabled_tools = [
  "integrationList",
  "integrationSchema",
  "triggerTool",
  "integrationSchedulePostTool",
]
default_tools_approval_mode = "auto"
tool_timeout_sec = 60
```

`POSTIZ_API_KEY` nằm trong biến môi trường user, không ghi trực tiếp vào TOML.

Sau khi đổi URL MCP phải restart Codex để task mới nạp lại cấu hình.

Kiểm tra endpoint không kèm key:

```powershell
curl.exe -I https://social.rinkuzu.app/api/mcp
```

HTTP 401 khi không có API key là đúng. Khi gửi MCP `initialize` với API key hợp lệ, endpoint phải trả HTTP 200.

## 9. Ngrok và cookie proxy cũ

Trong giai đoạn demo, ngrok free domain gây lỗi cookie đăng nhập. Một Nginx proxy tạm được dùng để rewrite cookie domain.

Sau khi custom domain hoạt động:

- `rinkuzu-ngrok.service` đã được stop và disable.
- Container `postiz-cookie-proxy` đã được stop.
- Cấu hình cũ chưa bị xóa để có thể rollback ngắn hạn.

Khôi phục tạm nếu Cloudflare gặp sự cố:

```bash
sudo systemctl enable --now rinkuzu-ngrok.service
docker start postiz-cookie-proxy
```

Sau đó phải đổi ba biến public URL của Postiz về URL ngrok tương ứng và recreate Postiz. Đây chỉ là phương án khẩn cấp, không dùng lâu dài.

## 10. Checklist sẵn sàng marketing

### Đã hoàn thành

- [x] VPS hoạt động ổn định.
- [x] SSH bằng key, không phụ thuộc GUI.
- [x] Docker/Postiz và dependency healthy.
- [x] Postiz không public trực tiếp.
- [x] Custom domain HTTPS ổn định.
- [x] Cloudflare Tunnel tự khởi động bằng systemd.
- [x] Đăng nhập Postiz qua domain mới.
- [x] Postiz MCP trả HTTP 200 với API key hợp lệ.
- [x] Telegram integration và bài đăng thử hoạt động.
- [x] Threads integration và bài đăng thử hoạt động.
- [x] Website Vercel và DNS email không bị hỏng.
- [x] Ngrok demo đã ngừng.
- [x] GA4 và PostHog US Cloud đã được tích hợp theo cơ chế consent-first.
- [x] Funnel event từ đăng ký đến tải PDF, trả lời câu đầu tiên và hoàn thành quiz đã được instrument.
- [x] Next.js, NextAuth và Auth.js core đã được nâng lên các bản vá production ngày 2026-07-23.

### Cần hoàn thành trước khi mở chiến dịch chính

- [ ] Restart Codex và kiểm tra các Postiz MCP tool trong task mới.
- [ ] Kết nối Facebook Page.
- [ ] Kết nối Instagram Business qua Meta.
- [ ] Kết nối TikTok và YouTube cho video discovery.
- [ ] Chọn 2–3 content pillar và viết batch nội dung tuần đầu.
- [ ] Chuẩn hóa claim marketing; không dùng số liệu người dùng hoặc testimonial chưa có bằng chứng.
- [ ] Thêm UTM cho mọi link marketing.
- [x] Tạo [RinKuzu Activation Funnel](https://us.posthog.com/project/525510/insights/YMZtwhZK) và đánh dấu 4 activation events là Key events trong GA4.
- [ ] Thu baseline acquisition/activation trong bảy ngày đầu; chưa dùng dữ liệu lịch sử trước ngày 2026-07-23 làm baseline.
- [ ] Chạy shadow/draft mode và duyệt nội dung trước khi public.
- [ ] Theo dõi RAM, disk, container health và lỗi đăng bài.
- [ ] Thiết lập backup PostgreSQL/Temporal.
- [ ] Rotate các secret từng xuất hiện trong chat hoặc ảnh chụp.

## 11. Cách bắt đầu phase marketing

Thứ tự đề xuất:

1. Kết nối Facebook Page và Instagram Business.
2. Chuẩn bị ba content atom đầu tiên:
   - Study tip có thể áp dụng ngay.
   - Demo PDF → quiz/knowledge graph.
   - Câu hỏi hoặc poll về khó khăn khi ôn tài liệu.
3. Tạo biến thể riêng cho Facebook, Instagram và video ngắn; không copy nguyên caption.
4. Schedule trong Postiz, chưa bật auto-publish diện rộng.
5. Đăng một bài thử cho mỗi kênh.
6. Theo dõi click có UTM, signup, activation và lỗi OAuth trong bảy ngày.
7. Chỉ tăng cadence khi pipeline ổn định và nội dung tạo được activation.

Telegram tiếp tục dùng cho test, thông báo và community nhỏ. Không coi Telegram là kênh acquisition chính khi chưa có audience.

## 12. Quy tắc bảo mật

- Không commit `.env`.
- Không ghi password, API key, Telegram bot token, OAuth secret hoặc tunnel token vào tài liệu.
- Không gửi secret trong URL.
- Không public port database/cache.
- Không dùng cùng một API key cho mọi automation.
- Rotate ngay secret đã từng được gửi trong chat.
- Chỉ auto-post vào page/channel do Rinkuzu sở hữu.
- Không auto-comment, auto-DM hoặc đăng vào cộng đồng bên thứ ba.
