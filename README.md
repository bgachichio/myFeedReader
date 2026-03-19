# myFeedReader

> A clean, fast, privacy-first personal RSS reader — built for serious readers.

**Live at:** [myfeedreader.com](https://myfeedreader.com)

myFeedReader is a full-stack web application that aggregates RSS and Atom feeds into a single, distraction-free reading experience. It fetches full article text, works offline, supports X (Twitter) posts and Substack articles, and is installable as a Progressive Web App on mobile and desktop.

---

## Features

### Reading
- **RSS & Atom feed aggregation** — Add any RSS or Atom feed source
- **Full-text fetching** — Server-side fetch of complete article content via Supabase Edge Function (no CORS proxies)
- **X (Twitter) post saving** — Saves full tweet text via Twitter oEmbed API (no auth required)
- **Substack support** — Extracts full article body from `__NEXT_DATA__` JSON (no JS rendering needed)
- **Unread / Read / All filter** — Clean reading queue by default; mark read on open
- **Daily Digest** — Articles grouped by category, filtered by today or last 7 days
- **Full-text search** — Search across all cached articles instantly

### Organisation
- **Reading List** — Save articles from your feed or via mobile share sheet; appears within 500ms
- **Bookmarks** — Permanent library separate from the transient reading queue
- **Folders** — Organise feed sources into named folders
- **OPML import / export** — Migrate your feeds in or out at any time
- **Feed health monitoring** — Per-source error tracking and last-fetch timestamps

### Experience
- **Progressive Web App** — Installable on iOS, Android, and desktop; works offline
- **Mobile share sheet** — Share any URL from any app directly to your Reading List
- **Dark mode** — System-aware, manually overridable
- **Keyboard shortcuts** — Power-user navigation (`/` to search, `?` for help)
- **Onboarding wizard** — Font, timezone, and date format preferences on first login
- **Reading time estimates** — Per-article word-count based estimates
- **Stats dashboard** — Reading activity charts over time

### Infrastructure
- **Auto-refresh on return** — Feed refreshes on app open, tab focus, and PWA resume (5-minute cooldown)
- **Automatic storage pruning** — Read articles older than 30 days are silently deleted after every refresh; bookmarks and saved-for-later articles are never pruned
- **Storage dashboard** — Settings → Diagnostics shows article counts, estimated usage vs free tier limit, and a manual prune button
- **Server-side RSS fetching** — All feed fetching runs in a Supabase Edge Function; no client-side CORS issues
- **Row Level Security** — Every query is scoped to the authenticated user at the database level
- **Freemium model** — Free tier with feed limits; Pro tier via Paystack

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Browser / PWA                        │
│                                                          │
│   React 19 · Vite 7 · Tailwind CSS · React Router v7   │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ FeedView │ │  Digest  │ │ Reading  │ │ Sources  │  │
│  │  My Feed │ │   View   │ │   List   │ │   View   │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│                                                          │
│  Contexts: Auth · Theme · Settings · Unread · Plan      │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS
┌────────────────────────▼────────────────────────────────┐
│                   Supabase Platform                      │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │             Edge Functions (Deno)                │   │
│  │                                                  │   │
│  │  fetch-feeds      server-side RSS/Atom fetch     │   │
│  │  save-article     enrich + store saved URLs      │   │
│  │  get-manage-link  Paystack subscription mgmt     │   │
│  │  paystack-webhook payment event handler          │   │
│  └─────────────────────┬────────────────────────────┘   │
│                        │                                 │
│  ┌─────────────────────▼────────────────────────────┐   │
│  │          PostgreSQL (via PostgREST)               │   │
│  │                                                  │   │
│  │  feeds · articles · saved_articles               │   │
│  │  profiles · folders   (RLS on every table)       │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  Auth: Supabase Auth (email + password)                 │
└─────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│           Firebase Hosting (Google Cloud CDN)            │
│           SSL · custom domain · global edge             │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend framework | React | 19 |
| Build tool | Vite | 7 |
| Styling | Tailwind CSS | 3 |
| Routing | React Router | 7 |
| Icons | Lucide React | 0.575 |
| Date handling | date-fns + date-fns-tz | 4 / 3 |
| Database + Auth | Supabase (PostgreSQL) | JS SDK 2.97 |
| Edge functions | Deno (Supabase Edge Runtime) | — |
| Hosting / CDN | Firebase Hosting | — |
| Payments | Paystack | — |
| PWA | Web App Manifest + Service Worker | — |

---

## Database Schema

```sql
-- Feed sources
feeds (
  id, user_id, url, title, category, feed_type, folder_id,
  last_fetched_at, last_error, error_count, article_count, created_at
)

-- Cached feed items
articles (
  id, user_id, feed_id, guid, title, link, description,
  author, pub_date, category, full_content,
  is_read, is_bookmarked, is_read_later, created_at
)

-- Articles saved via mobile share sheet
saved_articles (
  id, user_id, url, title, excerpt, author,
  full_text, reading_time_min, is_read, is_archived,
  fetched_at, created_at
)

-- User reading preferences
profiles (
  id, display_name, font_id, date_format, time_format,
  timezone, compact_mode, show_reading_time, show_author,
  onboarding_complete, updated_at
)

-- Feed organisation
folders (id, user_id, name, position, created_at)
```

Row Level Security is enabled on every table. All queries are scoped to `auth.uid() = user_id`.

---

## Edge Functions

### `fetch-feeds`
Fetches all user feed sources server-side on every app load. Accepts a batch of `{id, url}` objects, fetches and parses RSS/Atom concurrently in Deno, returns structured items. Deployed with `--no-verify-jwt` since it reads only external public URLs and touches no user data.

### `save-article`
Called from the mobile PWA share sheet. Resolves shortlinks (t.co, bit.ly), saves the URL immediately, then enriches asynchronously:
- **X / Twitter** — Twitter oEmbed API (free, no API key)
- **Substack** — `__NEXT_DATA__` JSON blob extraction from raw HTML
- **Everything else** — Microlink → AllOrigins → corsproxy.io race (first to respond wins)

### `get-manage-link` / `paystack-webhook`
Paystack subscription management — generate customer portal links and handle payment webhooks to update user plan tier.

---

## Project Structure

```
myFeedReader/
├── src/
│   ├── components/
│   │   ├── ArticleCard.jsx         # Feed item: read/bookmark/save-to-list actions
│   │   ├── AddFeedModal.jsx        # Add RSS source with URL validation
│   │   ├── FeedDiscoveryModal.jsx  # Discover feeds from a website URL
│   │   ├── ImportOPMLModal.jsx     # Bulk feed import from OPML file
│   │   ├── SearchModal.jsx         # Full-text search across all articles
│   │   ├── PaywallModal.jsx        # Pro upgrade prompt
│   │   ├── Sidebar.jsx             # Navigation + live unread counts
│   │   └── ...
│   │
│   ├── contexts/
│   │   ├── AuthContext.jsx         # User session, sign in/out
│   │   ├── ThemeContext.jsx        # Dark / light mode
│   │   ├── SettingsContext.jsx     # Font, date format, reading preferences
│   │   ├── UnreadContext.jsx       # Global unread article count
│   │   └── PlanContext.jsx         # Free vs Pro plan state
│   │
│   ├── pages/
│   │   ├── LandingPage.jsx         # Marketing + auth entry point
│   │   ├── OnboardingWizard.jsx    # 3-step new user setup (name, prefs, timezone)
│   │   ├── DashboardLayout.jsx     # App shell: sidebar, auto-refresh, outlet
│   │   ├── FeedView.jsx            # Main reading queue (My Feed)
│   │   ├── DigestView.jsx          # Daily/weekly digest grouped by category
│   │   ├── ReadingListView.jsx     # Saved-for-later + share-sheet articles
│   │   ├── BookmarksView.jsx       # Permanent bookmarks library
│   │   ├── SourcesView.jsx         # Feed management, health, OPML
│   │   ├── StatsView.jsx           # Reading activity charts
│   │   ├── SettingsView.jsx        # User preferences
│   │   ├── ArticleReader.jsx       # Full-page reader (feed articles)
│   │   ├── SavedArticleReader.jsx  # Full-page reader (saved articles)
│   │   └── SavePage.jsx            # PWA Web Share Target handler
│   │
│   └── lib/
│       ├── feedsService.js         # All Supabase DB queries
│       ├── rssParser.js            # Client-side RSS/Atom parser (add-feed validation)
│       ├── fullText.js             # Full-text fetch fallback (client-side)
│       ├── supabase.js             # Supabase client
│       ├── dateFormat.js           # Locale-aware date formatting
│       ├── opml.js                 # OPML import/export
│       └── readingTime.js          # Word-count reading time estimates
│
├── supabase/
│   └── functions/
│       ├── fetch-feeds/            # Server-side RSS fetcher (Deno)
│       ├── save-article/           # Article enrichment + save (Deno)
│       ├── get-manage-link/        # Paystack portal link (Deno)
│       └── paystack-webhook/       # Payment events (Deno)
│
├── supabase_migration.sql          # v1: core schema
├── supabase_migration_v2.sql       # is_read_later, full_content
├── supabase_migration_v3.sql       # folders
├── supabase_migration_v4.sql       # saved_articles
├── supabase_migration_v5.sql       # feed health columns
├── supabase_migration_v6.sql       # profiles
├── supabase_migration_v7.sql       # fix RLS per-operation policies
├── supabase_migration_v8.sql       # profile preference columns
├── supabase_migration_v9.sql       # onboarding flag
└── supabase_migration_v10.sql      # latest
```

---

## Local Development

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project
- Supabase CLI (`npm install -g supabase`)

### 1. Clone

```bash
git clone https://github.com/bgachichio/myFeedReader.git
cd myFeedReader
```

### 2. Install

```bash
npm install
```

### 3. Environment

```bash
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

### 4. Database

Run migration files in order via **Supabase Dashboard → SQL Editor**:

```
supabase_migration.sql → v2 → v3 → v4 → v5 → v6 → v7 → v8 → v9 → v10
```

### 5. Edge functions

```bash
supabase functions deploy fetch-feeds --project-ref YOUR_REF --no-verify-jwt
supabase functions deploy save-article --project-ref YOUR_REF
supabase functions deploy get-manage-link --project-ref YOUR_REF
supabase functions deploy paystack-webhook --project-ref YOUR_REF
```

### 6. Run

```bash
npm run dev
# → http://localhost:5173
```

---

## Deployment

### Frontend

```bash
npm run build
firebase deploy --only hosting --project YOUR_FIREBASE_PROJECT
```

### Edge Functions

```bash
supabase functions deploy fetch-feeds --project-ref YOUR_REF --no-verify-jwt
supabase functions deploy save-article --project-ref YOUR_REF
```

### Stale service worker

If the app shows a blank screen after deploy:
1. DevTools → Application → Service Workers → Unregister
2. Hard reload: `Ctrl+Shift+R` / `Cmd+Shift+R`

---

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key (safe for client-side use) |

The anon key is intentionally public-facing — all data access is gated by Row Level Security at the database level. Never commit `.env`.

---

## PWA — Mobile Install

- **iOS:** Safari → Share → Add to Home Screen
- **Android:** Chrome → menu → Add to Home Screen
- **Desktop:** Chrome address bar → install icon

Once installed, use the system share sheet from any app to save articles directly to your Reading List.

---

## Roadmap

- [ ] Push notifications for new articles
- [ ] AI-powered article summarisation
- [ ] Newsletter-to-feed ingestion
- [ ] Collaborative reading lists
- [ ] Browser extension

---

## License

MIT

---

Built by [Brian Gachichio](https://gachichio.substack.com) &nbsp;·&nbsp; [X / Twitter](https://x.com/@b_gachichio) &nbsp;·&nbsp; [LinkedIn](https://www.linkedin.com/in/briangachichio/)
