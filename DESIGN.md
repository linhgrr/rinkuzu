# RinKuzu Design System — App-Wide Design System Standard (Home Redesign Baseline)

## 0. Product Context

RinKuzu is an AI-powered adaptive learning platform that transforms PDFs into personalized quiz journeys using knowledge graphs, Bloom's Taxonomy, and an AI tutor experience. The design system must support three product promises:

1. **Fast creation** — PDF to quiz feels instant and effortless.
2. **Deep mastery** — knowledge graph, Bloom levels, progress, and analytics feel credible.
3. **Friendly guidance** — Rin-chan and adaptive learning make the product approachable.

The system uses a professional warm SaaS foundation with an approachable AI learning identity:

- **Warm Orange = primary action momentum, key CTAs, active states, conversion**
- **Soft Warm Neutrals = calm, high-legibility surfaces and structured depth**
- **Green = learning progress, mastery badges, correct answers, success feedback**
- **Cool Secondary Blue = subtle borders, supporting metrics, badge accents**

---

### 0.1 Protected Designer Frames & Anti-AI-Slop Guidelines

#### 1. Designer Reference Screens (VISUAL BASELINE REQUIRED)

The following 3 screens were designed by the UI designer and remain the visual references:

1. **Home (`/dashboard`)**: Entry `DashboardPageShell.tsx` & `HomeDashboard.tsx` (Figma frame `2102:4700`)
2. **Quizzes (`/quizzes`)**: Entry `quizzes/page.tsx` & `QuizCard.tsx`
3. **Personal Learning Home (`/adaptive`)**: Entry `AdaptiveLearningDashboard.tsx`, `HeroSection.tsx`, `Library.tsx`

They may be changed when consistency, accessibility, or responsive behavior improves. Any intentional
visual change requires desktop and mobile review; token-only refactors should preserve computed style.
Artwork crop, aspect ratio, rotation, overlap, and fractional SVG/image bounds are optical geometry and
must not be rounded mechanically.

#### 3. 4-Point / 8-Point Grid System (Quy tắc Bội số 4px/8px)

All layout containers, cards, padding, margins, gaps, button heights, and icon bounds must strictly align with the **4px / 8px Grid System**:

- **Spacing Scale Steps**:
  - `4px` (`space-1`): Micro gaps between icons & inline badges
  - `8px` (`space-2`): Inner element spacing, badge padding
  - `12px` (`space-3`): Compact stack gaps, button inner padding
  - `16px` (`space-4` / `p-4`): Standard mobile card padding, default form gaps
  - `20px` (`space-5` / `p-5`): Desktop card padding (Figma Home baseline)
  - `24px` (`space-6` / `p-6`): Major container padding, column grid gap (`gap-6`)
  - `32px` (`space-8` / `p-8`): Section spacing
  - `48px` (`space-12`): Page section divider spacing
- **Button & Input Height Steps**:
  - Small: `36px` (`h-9`)
  - Medium / Standard: `44px` (`h-11`)
  - Large / Hero CTA: `52px` or `56px` (`h-14`)
- **Prohibited Patterns**:
  - Do not introduce arbitrary layout spacing when a named grid token exists.
  - `18px` horizontal button padding and `14px` horizontal input padding are named optical control
    tokens. Panel radius `20px` is the named `radius-panel` token.
  - Fractional or non-grid artwork geometry is allowed when it preserves crop, aspect ratio, transform,
    or optical alignment. Register recurring exceptions in `quality/design-system-policy.json`.

#### App-Wide Design System Primitive Tokens:

```css
:root {
  --home-bg-page: #f8f8f8;
  --home-bg-surface: #fefefe;
  --home-bg-surface-blue: #f8fbff;
  --home-bg-surface-warm: #fffbf8;
  --home-bg-hero: rgba(255, 214, 187, 0.6);
  --home-ink: #3d1300;
  --home-ink-strong: #441f05;
  --home-ink-muted: rgba(61, 19, 0, 0.5);
  --home-accent: #ef4a00;
  --home-accent-hover: #fa621d;
  --home-accent-soft: #fce4d3;
  --home-accent-warm: #ffd6bb;
  --home-accent-pale: #ffe5d3;
  --home-accent-text: #fff4ee;
  --home-border: #e8eeff;
  --home-border-blue: #7185bd;
  --home-progress-track: #ebd4c5;
  --home-progress-blue-track: #c2d6e4;
  --home-progress-blue: #718ebd;
  --home-divider-warm: rgba(255, 214, 187, 0.5);
  --home-card-shadow-accent: 2px 2px 0 #ff9768;
}
```

#### Typography roles:

- Core application UI uses **Montserrat (`var(--font-montserrat)` / `font-home`)**.
- **Unbounded** and **Vina Sans** are landing display roles only; they are not substitutes for app body
  text or controls.
- Main Page Title: `36px` / `32px` / `28px`, `700` (Bold), `line-height: 1.25`, `text-ink`
- Section Title: `18px`, `600` (Semibold), `line-height: 1.4`, `text-ink`
- Body Text: `16px`, `400` (Regular) / `600` (Semibold), `line-height: 1.4`, `text-ink`
- Subtext / Meta: `14px`, `400`, `line-height: 1.4`, `text-ink-muted`
- Metric Values: `22px`, `600`, `line-height: 1.35`

---

## 1. Brand Atmosphere & Visual Hierarchy

### 1.1 Desired Feel

RinKuzu across all screens should feel:

- **Smart & Guided** — clear visual priority, readable hierarchy, approachable AI tutor
- **Energetic & Focused** — vibrant orange CTAs guide action without overwhelming
- **Warm & Academic** — warm SaaS surfaces replace cold technical gray/slate UIs
- **Production-Grade & Consistent** — uniform margins, rounded corners, typography, and card components

### 1.2 Core Visual Principles

**1. Semantic role decides color**
Use the app action token for authenticated actions and active navigation, landing CTA tokens for the
marketing header, progress/success tokens for learning outcomes, and error tokens for destructive or
failed states. Similar orange values do not need to collapse into one hex when their semantic roles differ.
Solid orange action surfaces use white text and retain the approved bright-orange brand treatment. This
is a documented branding exception to the normal button-text contrast rule; orange tints used by badges
and notices keep their darker semantic foreground instead of being treated as solid actions.

**2. Warm surfaces anchor legibility**
Page backgrounds default to `#f8f8f8` (`--surface-page`), while content cards use `#fefefe` (`--surface`) with subtle soft borders `#e8eeff`. Avoid harsh dark gray boxes or unstyled pure white containers.

**3. Green represents mastery and progress**
Green is strictly reserved for learning progress bars, correct option highlights, mastery badges, streak counters, and success notifications.

**4. Core app typography is Montserrat**
Montserrat is the standard for titles, body text, buttons, inputs, pills, and card metadata across
authenticated app surfaces. Unbounded and Vina Sans remain approved landing display roles.

**3. Orange motivates action**
Use orange for the next meaningful CTA: generate quiz, start learning, upload PDF, upgrade plan.

**4. Graph visuals should feel structured**
Knowledge graph UI should use nodes, edges, and clusters carefully. Avoid chaotic network visuals.

**5. Rin-chan should soften the product**
Mascot or tutor moments should make difficult learning feel guided, not gamified to the point of losing seriousness.

---

## 2. Color System

## 2.1 Color Philosophy

The color system is split into **primitive tokens**, **semantic tokens**, and **component tokens**.

- Primitive tokens are raw colors.
- Semantic tokens describe meaning.
- Component tokens describe actual UI usage.

This makes the system scalable for dark mode, rebranding, A/B testing, and future product surfaces.

### Brand Color Hierarchy

Green is the primary brand color for RinKuzu. It represents learning growth, trust, mastery, correctness, and long-term progress. Green should be the color users associate with the product’s identity and learning outcomes.

Orange is the action accent. It should be reserved for high-intent moments where the product asks the learner to move forward: upload a PDF, generate a quiz, start learning, continue a recommended path, or upgrade.

Neutrals carry the majority of the interface. Green provides the product identity and learning confidence. Orange creates focused CTA contrast.

Recommended visual balance:

- Neutrals: 70-80%
- Green: 15-20%
- Orange: 5-10%

This prevents orange from overpowering the product while keeping CTA moments highly visible.

---

## 2.2 Primitive Tokens

```css
:root {
  /* Orange scale — focused action accent, energy, conversion */
  --orange-50: #fff7ed;
  --orange-100: #ffedd5;
  --orange-200: #fed7aa;
  --orange-300: #fdba74;
  --orange-400: #fb923c;
  --orange-500: #ff7a1a;
  --orange-600: #e86500;
  --orange-700: #c65300;
  --orange-800: #9f4200;
  --orange-900: #7c3200;

  /* Green scale — primary brand, trust, success, learning progress */
  --green-50: #ecfdf5;
  --green-100: #d1fae5;
  --green-200: #a7f3d0;
  --green-300: #6ee7b7;
  --green-400: #34d399;
  --green-500: #009d8c;
  --green-600: #00897a;
  --green-700: #007568;
  --green-800: #005f55;
  --green-900: #004940;

  /* Neutral scale — calm SaaS foundation */
  --neutral-0: #ffffff;
  --neutral-50: #fafaf8;
  --neutral-100: #f5f5f2;
  --neutral-200: #ececea;
  --neutral-300: #d9d9d6;
  --neutral-400: #b8b8b2;
  --neutral-500: #74746f;
  --neutral-600: #5f5f59;
  --neutral-700: #3f3f3a;
  --neutral-800: #2b2b27;
  --neutral-900: #181815;

  /* Supporting accents */
  --blue-500: #3b82f6;
  --purple-500: #8b5cf6;
  --red-500: #e5484d;
  --yellow-500: #f5b700;
}
```

---

## 2.3 Semantic Tokens

Authoritative light-mode color source: Figma file `NAj8r48fIqdjpK6SbLzYl0`. The approved
variable groups are Primary (`224:339`), Neutral (`224:471`), Alpha (`2147:5371`), Linear
(`230:585`), Secondary (`2155:5677`) and Status (`2239:1685`); Home (`2102:4700`) defines
their semantic use in the authenticated product. Figma variable roles take precedence over
similarly colored generic scales: `CTA` (`#fa621d`) is the solid action fill, while
`Primary / Main` (`#ff7c23`) is the primary accent. These nodes define the light-mode
standard; dark-mode colors remain a product extension until an approved dark token frame is
provided.

```css
:root {
  /* Figma primitives */
  --primary-0: #fffbf8;
  --primary-1: #fff2e9;
  --primary-2: #ffe5d4;
  --primary-3: #ffd6bb;
  --primary: #ff7c23;
  --primary-5: #ea660c;
  --primary-6: #d05908;
  --primary-7: #733810;
  --primary-8: #441f05;
  --cta: #fa621d;
  --neutral-white: #ffffff;
  --neutral-warm-2: #fffcf9;
  --neutral-warm-3: #fffaf5;
  --neutral-warm-31: #f6e2d5;
  --neutral-warm-4: #d9d5d0;
  --neutral-warm-5: #bab7b3;
  --neutral-warm-6: #595856;
  --neutral-warm-7: #403f3d;
  --neutral-warm-8: #2a0b00;
  --secondary-1: #f8fbff;
  --secondary-2: #e2ecfc;
  --secondary-3: #c2d6e4;
  --secondary-4: #718ebd;
  --alpha-00: rgba(217, 213, 208, 0.4);
  --alpha-1: rgba(68, 31, 5, 0.2);
  --alpha-2: rgba(68, 31, 5, 0.4);
  --alpha-3: rgba(68, 31, 5, 0.7);
  --alpha-04: rgba(217, 213, 208, 0.25);
  --linear-1: linear-gradient(90deg, #f25d1b 0%, #ff7c23 100%);
  --status-1: #eaeff3;
  --status-2: #076cee;
  --status-3: #eaf6e4;
  --status-4: #14c145;
  --status-5: #828282;

  /* Background */
  --surface-page: #f8f8f8;
  --surface: #fefefe;
  --surface-warm: var(--primary-0);
  --surface-blue: var(--secondary-1);
  --hero: var(--primary-2);
  --bg-page: var(--surface-page);
  --bg-surface: var(--surface);
  --bg-surface-warm: var(--surface-warm);

  /* Text */
  --ink: var(--primary-8);
  --ink-muted: var(--alpha-3);
  --text-primary: var(--ink);
  --text-secondary: var(--ink-muted);
  --text-inverse: #ffffff;

  /* Border */
  --line: #e8eeff;
  --line-blue: var(--secondary-4);
  --border-default: var(--line);

  /* Brand meaning */
  --brand-primary: var(--primary);
  --brand-primary-hover: var(--cta);
  --brand-action: var(--cta);
  --brand-action-hover: var(--primary-5);
  --brand-action-active: var(--primary-7);
  --brand-action-text: #ffffff;

  /* Status and component roles */
  --success: var(--status-4);
  --success-surface: var(--status-3);
  --info: var(--status-2);
  --info-surface: var(--status-1);
  --progress-gradient: var(--linear-1);
  --control-surface: var(--alpha-04);
  --control-border: var(--alpha-00);

  /* Learning states */
  --state-correct: var(--green-500);
  --state-incorrect: var(--red-500);
  --state-skipped: var(--status-5);
  --state-review: var(--orange-500);
  --state-new: var(--blue-500);
  --state-mastered: var(--green-600);

  /* Focus */
  --focus-ring: var(--accent);
  --focus-ring-soft: rgba(239, 74, 0, 0.22);
}
```

---

## 2.4 Dark Mode Tokens

```css
[data-theme='dark'] {
  --bg-page: #10110f;
  --bg-section: #151713;
  --bg-surface: #1b1d19;
  --bg-surface-muted: #242720;
  --bg-surface-warm: #211a13;

  --text-primary: #f7f7f2;
  --text-secondary: #c8c8c1;
  --text-muted: #94948d;
  --text-inverse: #10110f;

  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-default: rgba(255, 255, 255, 0.12);
  --border-strong: rgba(255, 255, 255, 0.2);

  --brand-primary: #34d399;
  --brand-primary-hover: #6ee7b7;
  --brand-primary-active: #a7f3d0;

  --brand-action: #fb923c;
  --brand-action-hover: #fdba74;
  --brand-action-active: #fed7aa;
  --brand-action-text: #1c1917;

  --brand-trust: #34d399;
  --brand-trust-hover: #6ee7b7;
  --brand-trust-active: #a7f3d0;

  --focus-ring: #34d399;
  --focus-ring-soft: rgba(52, 211, 153, 0.24);
}
```

---

## 2.5 Color Usage Rules

### Orange Usage

Use orange for:

- Primary CTA buttons
- Upload PDF action
- Generate quiz action
- Start learning action
- Pricing upgrade buttons
- Attention badges such as “AI Generated”, “New”, “Recommended”
- Review-needed state

Do not use orange for:

- Correct answers
- Success confirmations
- Passive card decoration
- Long body text
- Background-heavy sections unless very pale tint
- Navigation links or active tab indicators
- Streak badges, XP displays, or mastery scores (use green)
- Card hover borders/shadows (use green)
- Exercise indicators (use green for non-review contexts)
- Score metrics or completion statistics (use green)
- Decorative blobs, gradients, or background glows

### Green Usage

Use green for:

- Primary brand moments and product identity
- Correct answers
- Completed quiz state
- Mastery progress
- Learning streaks
- Success toasts
- Verified / trusted indicators
- Focus rings
- Progress bars where the meaning is improvement
- Active tab indicators and navigation links
- Card hover borders and shadows
- Score metrics, XP displays, and completion statistics
- Exercise/lesson indicator dots and status markers
- Decorative background blobs, glows, and section gradients

Do not use green for:

- Generic conversion CTA
- Pricing upgrade CTA unless the action is confirmation
- Warning or review-needed states

### Neutral Usage

Use neutrals for:

- Page background
- Content cards
- Text hierarchy
- Borders
- Tables
- Dashboard panels

Neutrals should carry most of the UI weight. Accents should appear as intentional signals.

---

## 3. Typography System

## 3.1 Font Stack

Use a modern sans-serif optimized for SaaS readability.

```css
:root {
  --font-sans:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace;
}
```

If using Next.js, load Inter through `next/font/google`.

---

## 3.2 Type Scale

| Token      | Size | Line Height | Weight | Usage                         |
| ---------- | ---: | ----------: | -----: | ----------------------------- |
| Display XL | 72px |        1.00 |    800 | Landing hero only             |
| Display    | 64px |        1.05 |    800 | Primary marketing headline    |
| H1         | 48px |        1.08 |    750 | Page titles                   |
| H2         | 40px |        1.12 |    700 | Section headers               |
| H3         | 32px |        1.18 |    700 | Feature headers               |
| H4         | 24px |        1.25 |    650 | Card titles, dashboard panels |
| Body XL    | 20px |        1.55 |    500 | Hero subtitle                 |
| Body LG    | 18px |        1.55 |    400 | Feature description           |
| Body       | 16px |         1.6 |    400 | Standard text                 |
| Body SM    | 14px |         1.5 |    400 | Secondary UI text             |
| Caption    | 12px |        1.35 |    500 | Labels, tags, metadata        |
| Micro      | 11px |        1.25 |    600 | Tiny labels, chart labels     |

---

## 3.3 CSS Typography Tokens

```css
:root {
  --text-display-xl: 72px;
  --text-display: 64px;
  --text-h1: 48px;
  --text-h2: 40px;
  --text-h3: 32px;
  --text-h4: 24px;
  --text-body-xl: 20px;
  --text-body-lg: 18px;
  --text-body: 16px;
  --text-body-sm: 14px;
  --text-caption: 12px;
  --text-micro: 11px;

  --tracking-display: -0.04em;
  --tracking-heading: -0.025em;
  --tracking-tight: -0.015em;
  --tracking-normal: 0;
  --tracking-label: 0.02em;
}
```

---

## 3.4 Typography Rules

- Hero headlines may use tight tracking.
- Body text should never be tightly tracked.
- Do not use orange or green for long paragraphs.
- Use `font-weight: 650–800` for strong SaaS headlines.
- Use mono font only for technical labels, file names, question IDs, and analytics metadata.

---

## 4. Spacing, Grid & Radius

## 4.1 Spacing Tokens

```css
:root {
  --space-0: 0px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;
  --space-24: 96px;
  --space-32: 128px;
}
```

---

## 4.2 Container Tokens

```css
:root {
  --container-sm: 640px;
  --container-md: 768px;
  --container-lg: 1024px;
  --container-xl: 1200px;
  --container-2xl: 1320px;
}
```

Use:

- `1200px` for marketing pages
- `1320px` for dashboards
- `768px` for reading / quiz flows

---

## 4.3 Radius Tokens

```css
:root {
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 24px;
  --radius-full: 9999px;
}
```

Usage:

- Buttons: `8px` or `9999px` for pill CTAs
- Cards: `16px`
- Hero cards: `24px`
- Badges: `9999px`
- Inputs: `10–12px`

---

## 5. Elevation & Borders

## 5.1 Shadow Tokens

```css
:root {
  --shadow-xs: 0 1px 2px rgba(24, 24, 21, 0.04);
  --shadow-sm: 0 4px 12px rgba(24, 24, 21, 0.06);
  --shadow-md: 0 10px 30px rgba(24, 24, 21, 0.08);
  --shadow-lg: 0 24px 60px rgba(24, 24, 21, 0.12);
  --shadow-orange-glow: 0 18px 40px rgba(255, 122, 26, 0.24);
  --shadow-green-glow: 0 18px 40px rgba(0, 157, 140, 0.22);
}
```

---

## 5.2 Elevation Levels

| Level  | Token             | Usage                               |
| ------ | ----------------- | ----------------------------------- |
| 0      | none              | Page sections                       |
| 1      | border only       | Tables, static cards                |
| 2      | shadow-xs         | Inputs, nav bar                     |
| 3      | shadow-sm         | Cards, feature blocks               |
| 4      | shadow-md         | Dropdowns, popovers                 |
| 5      | shadow-lg         | Modals, onboarding panels           |
| Accent | orange/green glow | Rare hero CTA / success celebration |

---

## 6. Component System

## 6.1 Buttons

### Primary CTA Button — Orange

Use for the highest-priority action on a page. In button naming, `primary` means the primary action, not the green brand-primary color.

Examples:

- Start Learning Now
- Upload PDF
- Generate Quiz
- Get Started
- Upgrade Plan

```css
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 44px;
  padding: 0 18px;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  /* White label on the theme-stable strong step: 5.18:1 rest, 7.31:1 hover,
     about 9.4:1 active, in light and dark (RIN-1492). */
  background: var(--brand-action-strong);
  color: var(--neutral-white);
  font-size: 15px;
  font-weight: 650;
  line-height: 1;
  box-shadow: var(--shadow-xs);
  transition:
    background 160ms ease,
    transform 160ms ease,
    box-shadow 160ms ease;
}

.btn-primary:hover {
  background: var(--brand-action-strong-hover);
  box-shadow: var(--shadow-sm);
  transform: translateY(-1px);
}

.btn-primary:active {
  background: var(--brand-action-strong-active);
  transform: translateY(0);
}

.btn-primary:focus-visible {
  outline: 3px solid var(--focus-ring-soft);
  outline-offset: 2px;
}
```

### Secondary Button — Neutral

Use for lower-priority actions.

Examples:

- View Pricing
- Learn More
- See Examples
- Back to Dashboard

```css
.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  padding: 0 18px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 600;
  transition:
    border-color 160ms ease,
    background 160ms ease,
    transform 160ms ease;
}

.btn-secondary:hover {
  background: var(--bg-surface-muted);
  border-color: var(--border-strong);
}
```

### Button Size Tiers

Use these tiers consistently across the product:

| Tier   |      Height |   Padding | Usage                                                  |
| ------ | ----------: | --------: | ------------------------------------------------------ |
| `sm`   |        36px | 0 12-14px | Dense table actions, pagination, compact modal actions |
| `md`   |        44px |    0 18px | Default button size across app and admin               |
| `lg`   |        52px | 0 24-32px | Hero actions, primary flow CTAs                        |
| `icon` | 44px square |         0 | Icon-only buttons with full touch target               |

Rules:

- Do not create custom one-off button heights unless the interaction is truly special-purpose.
- Table actions should prefer `sm`.
- Modal footer buttons and toolbar actions should prefer `md`.
- Marketing hero actions may use `lg` or pill variants, but should still map back to these heights.

### Success Button — Green

Use only when the action confirms or completes something.

Examples:

- Mark as Mastered
- Complete Review
- Save Progress

```css
.btn-success {
  background: var(--brand-trust);
  color: var(--text-inverse);
}

.btn-success:hover {
  background: var(--brand-trust-hover);
}
```

---

## 6.2 Badges

Badges should remain compact but readable enough for status-heavy product surfaces.

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 12px;
  border-radius: var(--radius-full);
  font-size: 13px;
  font-weight: 650;
  letter-spacing: 0.02em;
}

.badge-ai {
  background: rgba(255, 122, 26, 0.1);
  color: var(--orange-700);
}

.badge-success {
  background: rgba(0, 157, 140, 0.1);
  color: var(--green-700);
}

.badge-info {
  background: rgba(59, 130, 246, 0.1);
  color: var(--blue-500);
}
```

Usage examples:

- Powered by Gemini AI → orange AI badge
- Mastered → green success badge
- New Course → blue info badge
- Needs Review → orange review badge

### Badge vs Tag / Pill

Use `Badge` for:

- Status labels
- Type labels
- Small metadata emphasis
- Semantic chips that map to system tone tokens

Use `Tag` / `Pill` patterns for:

- Category labels with dynamic user/content colors
- Context pills like `You`, `Private`, `Featured`
- Selectable chips and filter controls

Guidelines:

- `Badge` height defaults to `28px`.
- `Tag/Pill` should usually be `28-32px` tall.
- Use `12-13px` text for badges and tags.
- Prefer `font-weight: 600-650` for small pills to keep them readable without looking bulky.

---

## 6.3 Cards

### Standard Card

```css
.card {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xs);
  padding: var(--space-6);
}
```

### Interactive Feature Card

```css
.feature-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  transition:
    transform 180ms ease,
    box-shadow 180ms ease,
    border-color 180ms ease;
}

.feature-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-sm);
  border-color: rgba(0, 157, 140, 0.24);
}
```

Feature cards can use orange icon containers for actions and green highlights for success-oriented metrics.

---

## 6.4 Inputs & Forms

```css
.input {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: 15px;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.input::placeholder {
  color: var(--text-muted);
}

.input:focus {
  border-color: var(--brand-trust);
  box-shadow: 0 0 0 3px var(--focus-ring-soft);
  outline: none;
}
```

Textarea guidance:

- Textareas should reuse the same border, radius, color, and focus language as `.input`.
- Default textarea vertical padding should feel roomier than single-line inputs, typically `10-12px`.
- Avoid custom `focus:ring-*` patterns that bypass the tokenized focus shadow unless the surface truly needs a specialized contrast treatment.

Form validation:

- Correct / valid → green
- Error → red
- Needs attention → orange

---

## 6.5 Upload PDF Dropzone

The upload flow is one of the most important conversion moments.

```css
.upload-dropzone {
  border: 1.5px dashed rgba(255, 122, 26, 0.42);
  background: linear-gradient(180deg, rgba(255, 122, 26, 0.06), rgba(255, 255, 255, 0.9));
  border-radius: var(--radius-2xl);
  padding: 40px;
  text-align: center;
  transition:
    border-color 160ms ease,
    background 160ms ease,
    transform 160ms ease;
}

.upload-dropzone:hover,
.upload-dropzone[data-dragging='true'] {
  border-color: var(--brand-action);
  background: rgba(255, 122, 26, 0.09);
  transform: translateY(-2px);
}
```

Content rules:

- Use orange for the upload icon and primary upload CTA.
- Use green for upload success, parsing confidence, and completed progress signals.
- Show file name, file size, parsing progress, and estimated generation step clearly.

---

## 6.6 Quiz Card

Quiz cards should feel focused and calm.

```css
.quiz-card {
  max-width: 768px;
  margin: 0 auto;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-2xl);
  padding: 32px;
  box-shadow: var(--shadow-sm);
}
```

Question layout:

- Question number: small muted label
- Bloom level: badge
- Difficulty: neutral or orange badge
- Main question: strong H3/H4
- Answer options: large clickable rows
- Explanation: collapsible panel after answer

Answer states:

```css
.answer-option[data-state='default'] {
  border: 1px solid var(--border-default);
}

.answer-option[data-state='selected'] {
  border-color: var(--brand-action);
  background: rgba(255, 122, 26, 0.08);
}

.answer-option[data-state='correct'] {
  border-color: var(--state-correct);
  background: rgba(0, 157, 140, 0.1);
}

.answer-option[data-state='incorrect'] {
  border-color: var(--state-incorrect);
  background: rgba(229, 72, 77, 0.08);
}
```

---

## 6.7 Knowledge Graph

Knowledge graph visuals should be structured, not chaotic.

### Node Types

| Node Type       | Visual                         |
| --------------- | ------------------------------ |
| Current topic   | Orange filled node             |
| Mastered topic  | Green filled node              |
| Available topic | White node with neutral border |
| Locked topic    | Muted gray node                |
| Weak topic      | Orange outline / review badge  |

### Graph Rules

- Limit visible node count per view.
- Cluster related concepts.
- Use edge opacity to reduce noise.
- Use green edges for mastered relationships only when meaningful.
- Use orange only for the current path or recommendation.

```css
.graph-node-current {
  background: var(--brand-action-strong);
  color: white;
  box-shadow: var(--shadow-orange-glow);
}

.graph-node-mastered {
  background: var(--brand-trust);
  color: white;
}

.graph-edge {
  stroke: rgba(24, 24, 21, 0.16);
}
```

---

## 6.8 Progress Analytics

Analytics should look credible, not overly playful.

Use:

- Green for improvement and completed mastery.
- Orange for recommended review areas.
- Neutral for baseline gridlines and inactive data.
- Blue/purple only when multiple categories need separation.

Dashboard cards:

- Learning streak
- Mastery score
- Weak concepts
- Bloom distribution
- Quiz completion rate
- Time spent learning

Metric card pattern:

```css
.metric-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  padding: 24px;
}

.metric-value {
  font-size: 36px;
  line-height: 1;
  font-weight: 800;
  letter-spacing: -0.03em;
}
```

---

## 6.9 Navigation

Desktop navigation:

- Logo left
- Product links center/left
- Login secondary
- Get Started primary orange

```css
.navbar {
  height: 72px;
  border-bottom: 1px solid var(--border-subtle);
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(12px);
}
```

Rules:

- Keep nav calm and neutral.
- Only the main CTA uses orange.
- Use green only for the logo, brand mark, or subtle active-state trust cues.

---

## 6.10 Pricing Cards

Pricing pages are conversion-critical.

Recommended hierarchy:

- Free plan: neutral card
- Pro / popular plan: orange border + primary CTA
- Team / teacher plan: green trust accent if positioned for institutions

```css
.pricing-card-featured {
  border: 1.5px solid rgba(255, 122, 26, 0.45);
  box-shadow: var(--shadow-md);
  position: relative;
}

.pricing-popular-badge {
  background: var(--brand-action);
  color: white;
}
```

---

## 6.11 Rin-chan Tutor UI

Rin-chan should feel helpful and warm.

Chat interface:

- User messages: neutral or pale orange
- Rin-chan messages: white cards with subtle green trust accent
- Explanation blocks: neutral card
- Suggested next actions: orange CTA chips
- Correct encouragement: green microcopy

Tone:

- Supportive
- Concise
- Encouraging
- Never overly childish

Example microcopy:

- “Nice progress — this concept is almost mastered.”
- “Let’s review one prerequisite before continuing.”
- “You answered correctly. Want to try a harder Bloom-level question?”

---

## 7. Page Templates

## 7.1 Landing Page

### Hero

Structure:

- Small AI badge: “Powered by Gemini AI”
- H1: mastery-focused value proposition
- Subtitle: PDF → quiz → knowledge graph → mastery
- Primary CTA: Start Learning Now / Upload PDF
- Secondary CTA: View Demo / Browse Quizzes
- Visual: upload + generated quiz + graph preview

Hero color usage:

- Green brand impression through logo, trust markers, and progress cues
- Orange CTA
- Pale orange background glow
- Green progress indicators in product preview

### Feature Section

Feature cards:

1. Instant Quiz Generation — orange icon
2. 24/7 Rin-chan — warm neutral + small green trust indicator
3. Adaptive Learning — green progress visual
4. Progress Analytics — neutral dashboard chart

### How It Works

Use 3 steps:

1. Sign up
2. Upload materials
3. Start learning

Use orange for step numbers and green for completion markers.

### Featured Quizzes

Quiz cards should include:

- Subject badge
- Course title
- Description
- Difficulty / number of questions
- Start Quiz CTA

### Final CTA

Use a warm orange gradient background with a green success proof element.

---

## 7.2 Dashboard

Authenticated Home Dashboard layout is the Figma `2102:4700` implementation, not the older green dashboard composition.

Desktop structure:

- Fixed left sidebar: `280px`
- Fixed topbar: `72px`
- Main content width: `1340px`
- Content grid: `900px / 416px`
- Grid gap: `24px`
- Card radius: `20px` for panels, `12px` for learning cards, `10px` for compact controls

Primary panels:

- Hero: `900x295`, `--home-bg-hero`, `--home-accent` border, Montserrat title
- Quiz Builder: `416x295`, dashed upload area, `--home-bg-surface-blue`
- Learning Progress: `416x357`, three metrics, weekly activity row
- Continue Learning: `900x501`, eight cards in two rows

Primary action on dashboard:

- Start learning → `--home-accent`
- Upload PDF / Create quiz → dashed blue border with accent hover
- View all links → `--home-ink-strong`

Success/progress areas:

- Warm AI cards use orange gradient progress bars
- Cool static quiz cards use blue progress bars
- Activity days use Figma fire asset for active days and outline circle for inactive days

---

## 7.3 Quiz Taking Page

Layout:

- Centered quiz card
- Progress bar top
- Question content
- Answer options
- Explanation after submit
- Next question CTA

Progress bar:

- Neutral track
- Green fill if progress indicates completion
- Orange segment if current review mode

---

## 7.4 Quiz Result Page

Use green as the dominant success state if the learner completed the quiz.

Sections:

- Score summary
- Correct / incorrect breakdown
- Bloom level performance
- Weak concepts
- Recommended next quiz
- CTA: Review Mistakes (orange), Mark Completed (green)

---

## 7.5 Pricing Page

Goals:

- Make plan comparison easy
- Highlight the recommended plan
- Use orange for conversion
- Use green for trust proof

Components:

- Plan cards
- Popular badge
- Feature table
- FAQ
- Security / privacy note

---

## 8. Motion System

Motion should communicate responsiveness and learning progress.

## 8.1 Duration Tokens

```css
:root {
  --duration-fast: 120ms;
  --duration-base: 180ms;
  --duration-slow: 280ms;
  --duration-page: 420ms;
}
```

## 8.2 Easing Tokens

```css
:root {
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ease-enter: cubic-bezier(0, 0, 0.2, 1);
  --ease-exit: cubic-bezier(0.4, 0, 1, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

## 8.3 Motion Rules

- Buttons: 120–180ms
- Cards hover: 180ms
- Dialogs: 280ms
- Quiz answer feedback: immediate, under 180ms
- Graph transitions: 280–420ms
- Avoid excessive mascot animation during focused quiz taking

Implementation rules:

- Avoid `transition: all`.
- Only transition the properties that actually change:
  - `background-color`, `border-color`, `color`
  - `box-shadow`
  - `transform`
  - `width` for progress bars when necessary
- Prefer token-backed durations:
  - quick feedback: `--duration-fast`
  - standard hover/selection: `--duration-base`
  - dialogs and graph motion: `--duration-slow` or `--duration-page`

---

## 9. Iconography

Icon style:

- Rounded stroke icons
- 1.75–2px stroke
- Simple geometric shapes
- Avoid overly playful emoji-style icons in core UI

Recommended icon roles:

- Upload → orange
- Check / mastery → green
- Graph → neutral with green active node
- AI / sparkle → orange or purple sparingly
- Analytics → neutral/green

Icon containers:

```css
.icon-box-orange {
  background: rgba(255, 122, 26, 0.1);
  color: var(--brand-action);
}

.icon-box-green {
  background: rgba(0, 157, 140, 0.1);
  color: var(--brand-trust);
}
```

---

## 10. Illustration Direction

Illustrations should support the product story:

- PDF transforms into quiz cards
- Concepts become graph nodes
- Student progresses through a learning path
- Rin-chan guides without dominating the UI

Style:

- Soft rounded shapes
- Minimal linework
- Warm orange highlights
- Green success details
- Neutral canvas

Avoid:

- Neon cyber AI visuals
- Overly childish school clipart
- Busy knowledge graph backgrounds
- Random decorative blobs without meaning

---

## 11. Tone of Voice & Microcopy

## 11.1 Voice Principles

RinKuzu should sound:

- Helpful
- Encouraging
- Clear
- Focused on mastery
- Slightly warm, not overly cute

## 11.2 CTA Copy

Preferred:

- Start Learning Now
- Generate Quiz
- Upload PDF
- Continue Learning
- Review Mistakes
- Master This Topic
- View Knowledge Graph

Avoid:

- Click Here
- Submit
- Go
- Try Stuff
- Magic Button

## 11.3 Feedback Copy

Correct answer:

- “Correct — you’re building mastery.”
- “Nice work. This concept is getting stronger.”

Incorrect answer:

- “Not quite. Let’s review the key idea.”
- “Close — this concept needs one more pass.”

Upload success:

- “Your PDF is ready. RinKuzu found the key concepts.”

Generation loading:

- “Extracting concepts…”
- “Building your knowledge graph…”
- “Creating Bloom-level questions…”

---

## 12. Accessibility

## 12.1 Contrast

Minimum requirements:

- Body text: WCAG AA
- Button text: WCAG AA, except the approved bright-orange action surface with white brand text
- Focus states: visible on all surfaces
- Chart colors: must not rely on color alone

## 12.2 Keyboard

All interactive elements must support:

- Tab focus
- Enter / Space activation
- Escape to close overlays
- Arrow navigation where applicable

Focus styling rules:

- Default interactive elements should use `:focus-visible`, not always-on focus decoration.
- The canonical focus treatment is green tokenized ring via `--focus-ring-soft`.
- Do not mix multiple visual systems for focus across the same product surface.
- `outline-none` and `focus:outline-none` are only acceptable when replaced by an equivalent or stronger visible focus style.

## 12.3 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
```

## 12.4 Color Independence

Do not communicate correctness only with green/red.

Use:

- Icons
- Text labels
- Borders
- Explanations

---

## 13. Tailwind Configuration

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        orange: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#ff7a1a',
          600: '#e86500',
          700: '#c65300',
          800: '#9f4200',
          900: '#7c3200',
        },
        green: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#009d8c',
          600: '#00897a',
          700: '#007568',
          800: '#005f55',
          900: '#004940',
        },
        neutral: {
          0: '#ffffff',
          50: '#fafaf8',
          100: '#f5f5f2',
          200: '#ececea',
          300: '#d9d9d6',
          400: '#b8b8b2',
          500: '#74746f',
          600: '#5f5f59',
          700: '#3f3f3a',
          800: '#2b2b27',
          900: '#181815',
        },
        brand: {
          primary: '#009d8c',
          'primary-hover': '#00897a',
          'primary-active': '#007568',
          action: '#ff7a1a',
          'action-hover': '#e86500',
          'action-active': '#c65300',
          trust: '#009d8c',
        },
      },
      borderRadius: {
        xs: '4px',
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '24px',
      },
      boxShadow: {
        xs: '0 1px 2px rgba(24,24,21,0.04)',
        sm: '0 4px 12px rgba(24,24,21,0.06)',
        md: '0 10px 30px rgba(24,24,21,0.08)',
        lg: '0 24px 60px rgba(24,24,21,0.12)',
        orange: '0 18px 40px rgba(255,122,26,0.24)',
        green: '0 18px 40px rgba(0,157,140,0.22)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
```

---

## 14. CSS Base Layer

```css
@layer base {
  html {
    font-family: var(--font-sans);
    background: var(--bg-page);
    color: var(--text-primary);
  }

  body {
    margin: 0;
    min-height: 100vh;
    background: var(--bg-page);
    color: var(--text-primary);
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
  }

  a {
    color: inherit;
    text-decoration: none;
  }

  button,
  input,
  textarea,
  select {
    font: inherit;
  }

  ::selection {
    background: rgba(255, 122, 26, 0.22);
  }
}
```

---

## 15. Design Token Architecture

Recommended token layers:

### 15.1 Primitive Tokens

Raw values:

- `--orange-500`
- `--green-500`
- `--neutral-900`

### 15.2 Semantic Tokens

Meaning:

- `--brand-action`
- `--brand-primary`
- `--brand-trust`
- `--text-primary`
- `--bg-surface`

### 15.3 Component Tokens

Component-specific usage:

- `--button-primary-bg`
- `--quiz-correct-bg`
- `--graph-current-node-bg`

Example:

```css
:root {
  --brand-primary: var(--green-500);
  --brand-primary-hover: var(--green-600);
  --brand-primary-text: var(--text-inverse);

  --button-primary-bg: var(--brand-action-strong);
  --button-primary-bg-hover: var(--brand-action-strong-hover);
  --button-primary-bg-active: var(--brand-action-strong-active);
  --button-primary-text: var(--neutral-white);

  --quiz-answer-selected-bg: rgba(255, 122, 26, 0.08);
  --quiz-answer-correct-bg: rgba(0, 157, 140, 0.1);

  --graph-node-current-bg: var(--brand-action-strong);
  --graph-node-mastered-bg: var(--brand-trust);
}
```

This structure makes future redesigns safer.

---

## 16. Figma-Ready Style Names

## 16.1 Color Styles

Primitive:

- `Primitive/Orange/50`
- `Primitive/Orange/500`
- `Primitive/Green/500`
- `Primitive/Neutral/900`

Semantic:

- `Semantic/Background/Page`
- `Semantic/Background/Surface`
- `Semantic/Text/Primary`
- `Semantic/Text/Secondary`
- `Semantic/Brand/Primary`
- `Semantic/Brand/Action`
- `Semantic/Brand/Trust`
- `Semantic/State/Correct`
- `Semantic/State/Review`

Component:

- `Component/Button/Primary/Background`
- `Component/Button/Success/Background`
- `Component/Quiz/Answer/Correct`
- `Component/Graph/Node/Current`

---

## 16.2 Text Styles

- `Display/XL`
- `Display/Default`
- `Heading/H1`
- `Heading/H2`
- `Heading/H3`
- `Heading/H4`
- `Body/XL/Medium`
- `Body/LG/Regular`
- `Body/Base/Regular`
- `Body/SM/Regular`
- `Label/Base/Semibold`
- `Label/Caption/Semibold`
- `Mono/Caption`

---

## 16.3 Component Variants

Button:

- `variant=primary | secondary | ghost | success | destructive`
- `size=sm | md | lg`
- `state=default | hover | active | disabled | loading`

Badge:

- `tone=orange | green | blue | red | neutral`
- `size=sm | md`

Quiz Answer:

- `state=default | selected | correct | incorrect | disabled`

Card:

- `variant=default | interactive | featured | muted`

Pricing Card:

- `featured=true | false`
- `plan=free | pro | team`

---

## 17. Implementation Notes for React / Next.js

## 17.1 Recommended Button API

```tsx
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}
```

Rules:

- The `brand-primary` design token maps to green.
- `primary` button maps to orange because it represents the primary CTA/action.
- `success` maps to green.
- `loading` should disable click and show spinner.
- Never use `success` as the default CTA variant.

Implementation alignment:

- Tailwind semantic colors should expose green-led `brand.primary` and orange `brand.action` tokens.
- CSS variables should not keep Apple-blue as `--primary`, `--accent`, or `--ring` if the app is adopting this system.
- The shared Button component should map `variant="primary"` to orange action styles and `variant="success"` to green trust/success styles.

---

## 17.2 Recommended Quiz Answer API

```tsx
type AnswerState = 'default' | 'selected' | 'correct' | 'incorrect' | 'disabled';

interface QuizAnswerProps {
  label: string;
  content: string;
  state?: AnswerState;
  explanation?: string;
  onSelect?: () => void;
}
```

---

## 18. Anti-Patterns

Avoid:

- Green conversion CTA on normal pages
- Orange success messages
- Red/green-only correctness without labels
- Neon AI gradients everywhere
- Dense knowledge graphs with too many nodes
- Mascot taking focus during serious study flows
- Multiple orange CTAs competing on one screen
- Pricing pages where every plan looks equally important
- Body text in saturated orange or green
- Dashboard charts with too many unrelated colors
- Orange for passive decoration, gradients, card hover states, or background blobs — orange is reserved for CTAs and review states only
- Using orange for active tabs, navigation links, streaks, scores, or general UI accents — green serves these roles

---

## 19. AI / Design Prompt Guide

Use this prompt when generating UI screens:

> Design a professional SaaS interface for RinKuzu, an AI-powered adaptive learning platform that turns PDFs into quizzes and knowledge graphs. Use green as the primary brand identity for trust, learning progress, mastery, and success; use orange only as a focused CTA/action accent for high-intent next steps. Warm neutrals should carry most surfaces. Keep the layout clean, credible, and student-friendly. Use strong SaaS spacing, rounded cards, subtle shadows, clear CTAs, and accessible focus states. Avoid overusing gradients or making the UI look childish.

Hero prompt:

> Create a landing hero for RinKuzu with a green-led brand impression, warm neutral surfaces, and a restrained orange CTA accent. Show a badge “Powered by Gemini AI”, a bold headline about mastering any subject from PDFs, a primary orange CTA “Start Learning Now”, a secondary neutral CTA “View Demo”, and a product preview showing PDF upload, generated quiz cards, and a knowledge graph with orange current nodes and green mastered nodes.

Dashboard prompt:

> Create a SaaS learning dashboard with a sidebar, mastery score, recommended next quiz, weak concepts, recent activity, and a knowledge graph preview. Use green as the dominant learning/progress signal and orange only for the next recommended action.

Quiz prompt:

> Create a focused quiz-taking screen with a centered card, progress bar, Bloom level badge, question text, answer options, and explanation panel. Use orange for selected answers and review actions, green for correct answers and completion.

---

## 20. Final Design Principle

RinKuzu should not look like a generic AI landing page.

It should look like a serious learning SaaS that makes difficult study material feel structured, approachable, and motivating.

Orange gets the learner moving.
Green defines the brand and shows they are growing.
Neutrals keep the product focused.
