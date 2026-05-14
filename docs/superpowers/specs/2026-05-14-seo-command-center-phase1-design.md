# AI SEO Command Center — Phase 1 Design Spec

## Overview
Multi-site AI-powered SEO management platform. Phase 1 covers: project registry, on-page crawler/auditor, and dashboard.

## Architecture

### Stack
| Layer | Tech |
|-------|------|
| Frontend | React + Vite |
| API Backend | Node.js + Express |
| Crawler Service | Python + FastAPI + Crawl4AI |
| Database | MongoDB (`seo_command_center`) |
| Process Manager | PM2 (both Node + Python) |

### Services
- **seo-backend** (Node.js, port 4800) — REST API, cron scheduler, serves frontend in production
- **seo-crawler** (Python, port 4801) — FastAPI wrapper around Crawl4AI, internal only

### Project Structure
```
~/seo-command-center/
├── backend/                 # Node.js + Express API
│   ├── src/
│   │   ├── routes/          # API endpoints
│   │   ├── models/          # Mongoose schemas
│   │   ├── services/        # Business logic
│   │   ├── crons/           # Scheduled jobs
│   │   └── utils/           # Helpers
│   ├── package.json
│   └── .env
├── crawler/                 # Python + FastAPI + Crawl4AI
│   ├── app/
│   │   ├── main.py          # FastAPI server
│   │   ├── crawlers/        # Crawl strategies
│   │   ├── extractors/      # Data extraction logic
│   │   └── models.py        # Pydantic schemas
│   ├── requirements.txt
│   └── .env
├── frontend/                # React dashboard
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── api/
│   └── package.json
└── docs/
```

## Data Models

### projects
| Field | Type | Description |
|-------|------|-------------|
| name | String | Display name |
| domain | String | Domain without protocol |
| protocol | String | https (default) |
| status | Enum | active / paused / archived |
| tags | [String] | Categorization |
| crawlFrequency | Enum | daily / weekly / manual |
| lastCrawlAt | Date | Last crawl timestamp |
| lastScore | Number | 0-100 overall health |
| createdAt | Date | Auto |
| updatedAt | Date | Auto |

### audits
| Field | Type | Description |
|-------|------|-------------|
| projectId | ObjectId | Ref → projects |
| url | String | Page URL |
| score | Number | 0-100 page score |
| issues | [Object] | { type, severity, message, recommendation } |
| meta | Object | title, description, canonical, robots, ogTags |
| headings | Object | h1-h6 arrays |
| links | Object | internal, external, broken arrays |
| images | [Object] | src, alt, size, hasAlt |
| schema | Object | JSON-LD found |
| performance | Object | loadTime, pageSize, resourceCount |
| content | Object | wordCount, readabilityScore, keywordDensity |
| crawledAt | Date | When crawled |

### audit_summaries
| Field | Type | Description |
|-------|------|-------------|
| projectId | ObjectId | Ref → projects |
| totalPages | Number | Pages crawled |
| avgScore | Number | Average page score |
| issuesByType | Object | Count per issue type |
| scoreHistory | [Object] | { date, score } trend |
| crawlDuration | Number | Seconds |
| crawledAt | Date | When |

## Crawler Service API

### Endpoints
- `POST /crawl/page` — Crawl single page, return audit data
- `POST /crawl/site` — Crawl full site via sitemap/discovery
- `GET /crawl/status/:id` — Job status
- `POST /crawl/cancel/:id` — Cancel job

### Extraction Points
Meta tags, headings (H1-H6), internal/external/broken links, images (alt text, size), JSON-LD schema, word count, readability, keyword density, page size, load time, resource count, HTTPS check, viewport, lang attribute.

### Scoring
Base 100, deductions per issue:
- Missing meta description: -10
- Missing/duplicate H1: -15
- Broken link: -5 each (max -20)
- Image without alt: -3 each (max -15)
- No schema markup: -10
- Word count < 300: -5
- No canonical: -10
- Missing OG tags: -5

## Backend API

### Project Routes
- `GET /api/projects` — List all
- `POST /api/projects` — Create
- `GET /api/projects/:id` — Get one
- `PUT /api/projects/:id` — Update
- `DELETE /api/projects/:id` — Delete

### Audit Routes
- `POST /api/audits/run/:projectId` — Trigger crawl
- `GET /api/audits/:projectId` — List audits for project
- `GET /api/audits/:projectId/latest` — Latest audit summary
- `GET /api/audits/page/:auditId` — Single page audit detail

### Dashboard Routes
- `GET /api/dashboard` — All projects with latest scores
- `GET /api/dashboard/:projectId/trend` — Score trend over time

## Frontend Pages
1. **Dashboard** — All projects grid with health scores, trend sparklines
2. **Project Detail** — Single project audit results, page list, issues
3. **Page Audit Detail** — Full audit breakdown for one page
4. **Add/Edit Project** — Form to register new site

## Cron Jobs
- Daily audit for projects with `crawlFrequency: "daily"`
- Weekly audit for projects with `crawlFrequency: "weekly"`
- Cleanup: remove audits older than 90 days

## Ports
- Backend: 4800
- Crawler: 4801
- Frontend dev: 5173 (Vite default)
