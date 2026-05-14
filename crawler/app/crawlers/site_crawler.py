import asyncio
import logging
import os
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse

import httpx
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig

from app.extractors.page_extractor import extract_page_data
from app.extractors.scorer import calculate_score
from app.models import PageAuditResult

logger = logging.getLogger(__name__)

MAX_PAGES = 50
CONCURRENCY = 5  # max parallel page crawls


async def _fetch_sitemap_urls(base_url: str) -> list[str]:
    """Try to fetch and parse /sitemap.xml. Returns list of URLs or empty list."""
    parsed = urlparse(base_url)
    sitemap_url = f"{parsed.scheme}://{parsed.netloc}/sitemap.xml"

    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(sitemap_url)
            if resp.status_code != 200:
                return []

            content_type = resp.headers.get("content-type", "")
            body = resp.text

            # Basic XML sitemap parsing
            root = ET.fromstring(body)
            # Handle namespace
            ns = ""
            match = re.match(r"\{(.+?)\}", root.tag)
            if match:
                ns = match.group(1)

            urls = []

            # Check if it's a sitemap index
            sitemap_tag = f"{{{ns}}}sitemap" if ns else "sitemap"
            sitemaps = list(root.iter(sitemap_tag))
            if sitemaps:
                # It's a sitemap index - get URLs from first child sitemaps
                for sitemap in sitemaps[:3]:  # check first 3 child sitemaps
                    loc = sitemap.find(f"{{{ns}}}loc" if ns else "loc")
                    if loc is not None and loc.text:
                        try:
                            child_resp = await client.get(loc.text.strip())
                            if child_resp.status_code == 200:
                                child_root = ET.fromstring(child_resp.text)
                                for child_loc in child_root.iter(f"{{{ns}}}loc" if ns else "loc"):
                                    if child_loc.text:
                                        urls.append(child_loc.text.strip())
                                    if len(urls) >= MAX_PAGES:
                                        break
                        except Exception:
                            continue
                    if len(urls) >= MAX_PAGES:
                        break
                if urls:
                    return urls[:MAX_PAGES]

            if ns:
                for loc in root.iter(f"{{{ns}}}loc"):
                    if loc.text:
                        urls.append(loc.text.strip())
            else:
                for loc in root.iter("loc"):
                    if loc.text:
                        urls.append(loc.text.strip())

            logger.info(f"Found {len(urls)} URLs in sitemap")
            return urls[:MAX_PAGES]

    except Exception as e:
        logger.warning(f"Failed to fetch sitemap: {e}")
        return []


async def _discover_links_from_homepage(base_url: str) -> list[str]:
    """Crawl homepage and discover internal links."""
    parsed_base = urlparse(base_url)
    base_domain = parsed_base.netloc.lower()

    browser_config = BrowserConfig(headless=True)
    run_config = CrawlerRunConfig()

    discovered = set()
    discovered.add(base_url)

    try:
        async with AsyncWebCrawler(config=browser_config) as crawler:
            result = await crawler.arun(url=base_url, config=run_config)
            if not result.success:
                return [base_url]

            from bs4 import BeautifulSoup
            soup = BeautifulSoup(result.html, "html.parser")

            for a_tag in soup.find_all("a", href=True):
                href = a_tag["href"].strip()
                if not href or href.startswith("#") or href.startswith("javascript:") or href.startswith("mailto:"):
                    continue

                absolute = urljoin(base_url, href)
                parsed = urlparse(absolute)

                # Only same domain, http(s), strip fragments
                if parsed.netloc.lower() != base_domain:
                    continue
                if parsed.scheme not in ("http", "https"):
                    continue

                clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
                if parsed.query:
                    clean_url += f"?{parsed.query}"

                discovered.add(clean_url)

                if len(discovered) >= MAX_PAGES:
                    break

    except Exception as e:
        logger.error(f"Link discovery failed: {e}")

    logger.info(f"Discovered {len(discovered)} internal URLs from homepage")
    return list(discovered)[:MAX_PAGES]


async def _crawl_page_safe(url: str, crawler: AsyncWebCrawler, run_config: CrawlerRunConfig) -> PageAuditResult | None:
    """Crawl a single page, returning None on failure instead of raising."""
    try:
        result = await asyncio.wait_for(
            crawler.arun(url=url, config=run_config),
            timeout=30.0
        )
        if not result.success:
            logger.warning(f"Failed to crawl {url}: {result.error_message}")
            return None

        audit_data = extract_page_data(result.html, url)
        score, issues = calculate_score(audit_data)

        return PageAuditResult(
            url=audit_data["url"],
            score=score,
            issues=issues,
            meta=audit_data["meta"],
            headings=audit_data["headings"],
            links=audit_data["links"],
            images=audit_data["images"],
            schema_data=audit_data["schema_data"],
            performance=audit_data["performance"],
            content=audit_data["content"],
        )
    except asyncio.TimeoutError:
        logger.warning(f"Timeout crawling {url}")
        return None
    except Exception as e:
        logger.error(f"Error crawling {url}: {e}")
        return None


async def crawl_site(
    base_url: str,
    project_id: str,
    job_id: str,
    jobs: dict,
    webhook_url: str,
):
    """Full site crawl. Updates jobs dict with progress. Posts results to webhook when done."""
    jobs[job_id] = {
        "jobId": job_id,
        "status": "running",
        "progress": {
            "total": 0,
            "completed": 0,
            "failed": 0,
            "currentUrl": "",
        },
        "startedAt": datetime.now(timezone.utc).isoformat(),
    }

    try:
        # Step 1: Discover URLs
        urls = await _fetch_sitemap_urls(base_url)
        if not urls:
            urls = await _discover_links_from_homepage(base_url)

        if not urls:
            urls = [base_url]

        total = len(urls)
        jobs[job_id]["progress"]["total"] = total
        logger.info(f"Job {job_id}: crawling {total} pages for {base_url}")

        # Check cancellation
        if jobs[job_id]["status"] == "cancelled":
            return

        # Step 2: Crawl all pages with concurrency limit
        results: list[PageAuditResult] = []
        semaphore = asyncio.Semaphore(CONCURRENCY)

        browser_config = BrowserConfig(headless=True)
        run_config = CrawlerRunConfig()

        async with AsyncWebCrawler(config=browser_config) as crawler:
            async def _crawl_with_semaphore(page_url: str):
                async with semaphore:
                    # Check cancellation before each page
                    if jobs[job_id]["status"] == "cancelled":
                        return None
                    jobs[job_id]["progress"]["currentUrl"] = page_url
                    result = await _crawl_page_safe(page_url, crawler, run_config)
                    if result:
                        jobs[job_id]["progress"]["completed"] += 1
                    else:
                        jobs[job_id]["progress"]["failed"] += 1
                    return result

            tasks = [_crawl_with_semaphore(u) for u in urls]
            page_results = await asyncio.gather(*tasks)

        results = [r for r in page_results if r is not None]

        if jobs[job_id]["status"] == "cancelled":
            return

        # Step 3: Compute site-level summary
        avg_score = round(sum(r.score for r in results) / len(results)) if results else 0

        all_issues = []
        for r in results:
            for issue in r.issues:
                all_issues.append({**issue, "url": r.url})

        payload = {
            "jobId": job_id,
            "projectId": project_id,
            "baseUrl": base_url,
            "status": "completed",
            "summary": {
                "totalPages": total,
                "crawledPages": len(results),
                "failedPages": jobs[job_id]["progress"]["failed"],
                "averageScore": avg_score,
            },
            "pages": [r.model_dump() for r in results],
            "issues": all_issues,
            "completedAt": datetime.now(timezone.utc).isoformat(),
        }

        # Step 4: POST to backend webhook with retry
        webhook_secret = os.getenv("WEBHOOK_SECRET", "seo-cmd-webhook-2026")
        headers = {"x-webhook-secret": webhook_secret}
        webhook_success = False
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=30) as client:
                    resp = await client.post(webhook_url, json=payload, headers=headers)
                    if resp.status_code == 200:
                        webhook_success = True
                        logger.info(f"Webhook delivered successfully (attempt {attempt + 1})")
                        break
                    else:
                        logger.warning(f"Webhook returned {resp.status_code} (attempt {attempt + 1})")
            except Exception as e:
                logger.error(f"Webhook attempt {attempt + 1} failed: {e}")
            if attempt < 2:
                await asyncio.sleep(3)

        if webhook_success:
            jobs[job_id]["status"] = "completed"
        else:
            jobs[job_id]["status"] = "failed"
            jobs[job_id]["error"] = "Failed to deliver results to backend after 3 attempts"
        jobs[job_id]["progress"]["currentUrl"] = ""

    except Exception as e:
        logger.error(f"Site crawl failed for job {job_id}: {e}")
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(e)
