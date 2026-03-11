# SEO Roadmap (Non-Code Areas)

Muc tieu cua tai lieu nay la xu ly cac van de SEO khong the giai quyet chi bang code trong repository, bao gom authority, distribution, tracking, hinh anh thuong hieu, va hạ tang.

## 1) Off-Page SEO va Backlinks (Uu tien cao nhat)

### Muc tieu
- Tang referring domains tu 0 len >= 20 trong 8-10 tuan.
- Co backlink chat luong tu domain lien quan edtech/dev/ai.

### Ke hoach hanh dong
- Publish 2 bai technical/thang tren Medium + Dev.to:
  - "How to generate quiz from PDF using AI"
  - "Knowledge graph learning for adaptive education"
- Tao 1 landing review/tool page tren Product Hunt.
- Share case-study tren LinkedIn (founder + company page) 1 bai/tuan.
- Tao 3 guest posts tren blog giao duc/cong nghe.
- Submit website vao cac AI tool directories lien quan.

### KPI
- Referring domains moi: >= 5/thang.
- Backlink dofollow chat luong (DR/DA >= 30): >= 3/thang.
- Organic impressions tang >= 30% sau 2 thang.

## 2) Keyword Strategy va Content Distribution

### Muc tieu
- Rank top 20 cho long-tail keywords trong 6-10 tuan.

### Keyword focus
- generate quiz from pdf
- ai quiz generator for teachers
- knowledge graph learning platform
- adaptive learning platform

### Ke hoach
- Lich content 8 tuan:
  - 1 blog "how-to" moi tuan
  - 1 comparison/post "best tools" moi 2 tuan
  - 1 case-study moi thang
- Moi bai phai co:
  - 1 primary keyword
  - 2-3 secondary keywords
  - 1 internal link den `/adaptive-learning` va `/pricing`
  - CTA dang ky dung thu

### KPI
- 8 bai blog/8 tuan.
- >= 10 keywords vao top 50 sau 2 thang.

## 3) Search Console + Analytics Operations

### Muc tieu
- Co du lieu dung de ra quyet dinh SEO hang tuan.

### Viec can lam (ngoai code)
- Ket noi Google Search Console:
  - Xac minh domain property.
  - Submit `https://quizz-ck.vercel.app/sitemap.xml`.
  - Theo doi Coverage, Core Web Vitals, Enhancements.
- Bat Google Analytics 4 production:
  - Set env `NEXT_PUBLIC_GA_ID` tren Vercel.
  - Verify event page_view hoat dong dung.
- Tao dashboard theo doi:
  - impressions, clicks, CTR, average position
  - top landing pages
  - top queries

### KPI
- 100% indexable pages co trang thai "Indexed".
- Co bao cao SEO hang tuan (1 trang tong hop).

## 4) Technical SEO Operations (Hosting/CDN/Protocol)

### Muc tieu
- Dam bao protocol hien dai va cache policy dung o production.

### Viec can lam
- Kiem tra HTTP/2, HTTP/3 tren production bang:
  - WebPageTest
  - KeyCDN HTTP/2 test
  - Chrome DevTools (Protocol column)
- Xac minh Vercel project settings:
  - SSL/HSTS on
  - Compression on
  - Caching headers hop ly cho static assets
- Kiem tra large assets tai edge:
  - Video/background media can CDN cache + lazy loading strategy.

### KPI
- Protocol: HTTP/2 hoac HTTP/3 active 100%.
- Repeat-visit payload giam >= 25%.

## 5) Brand Signals va Social Presence

### Muc tieu
- Tang trust signal, ho tro E-E-A-T va crawl discovery.

### Ke hoach
- Chuan hoa profile:
  - LinkedIn company page
  - X/Twitter
  - YouTube (neu co demo)
  - GitHub org profile
- Dang deu:
  - 2 bai LinkedIn/tuan
  - 1 thread X/tuan
  - 1 video demo/ngan moi 2 tuan
- Cross-link ve website o bio/profile.

### KPI
- Co it nhat 4 social profiles active.
- Social referral traffic >= 10% tong referral sau 2 thang.

## 6) Local/Identity Schema Strategy (Business Decision)

### Muc tieu
- Xac dinh ro co can LocalBusiness schema hay khong.

### Huong xu ly
- Neu RinKuzu la global SaaS: khong bat buoc LocalBusiness.
- Neu can local trust (van phong/doi ngu tai VN):
  - cong bo dia chi, phone, business hours ro rang
  - bo sung LocalBusiness schema sau khi thong tin on dinh

### KPI
- Co quyet dinh chinh thuc (go/no-go) trong 2 tuan.

## 7) Governance: Quy trinh SEO hang tuan

### Ritual de van hanh
- Thu 2: check Search Console (coverage, query drop, CWV).
- Thu 4: publish hoac update 1 noi dung.
- Thu 6: outreach backlink (5-10 domains/tuan).
- Cuoi thang: SEO review 60 phut, chot 3 uu tien thang tiep.

### Bao cao mau
- Organic traffic WoW
- Top 10 queries tang/giam
- Indexing issues moi
- Backlink moi + quality score
- Action items tuan tiep theo

## 8) Timeline de xuat (8 tuan)

- Tuan 1-2:
  - Setup GSC + GA4 + baseline dashboard.
  - Publish 2 bai pillar content.
  - Bat dau outreach backlink.
- Tuan 3-4:
  - Push Product Hunt + social campaign.
  - Guest post dot 1.
  - Theo doi keyword movement.
- Tuan 5-6:
  - Guest post dot 2.
  - Cap nhat content theo query data.
  - Tang internal linking tu blog ve money pages.
- Tuan 7-8:
  - Tong ket ranking/traffic/backlinks.
  - Chot keyword winners.
  - Lap roadmap quy tiep theo.

## 9) Success Criteria sau 60 ngay

- Referring domains >= 20
- Top 50 keywords >= 20
- Top 20 keywords >= 8
- Organic clicks tang >= 40%
- CTR trang money pages tang >= 20%

