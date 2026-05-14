import logging

from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig

from app.extractors.page_extractor import extract_page_data
from app.extractors.scorer import calculate_score
from app.models import PageAuditResult

logger = logging.getLogger(__name__)


async def crawl_single_page(url: str) -> PageAuditResult:
    """Crawl a single URL and return a full SEO audit result."""
    logger.info(f"Crawling page: {url}")

    browser_config = BrowserConfig(headless=True)
    run_config = CrawlerRunConfig()

    async with AsyncWebCrawler(config=browser_config) as crawler:
        result = await crawler.arun(url=url, config=run_config)

        if not result.success:
            raise RuntimeError(f"Crawl failed for {url}: {result.error_message}")

        html = result.html

    # Extract all page data
    audit_data = extract_page_data(html, url)

    # Score it
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
