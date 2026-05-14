import asyncio
import logging
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.crawlers.page_crawler import crawl_single_page
from app.crawlers.site_crawler import crawl_site
from app.models import CrawlJobStatus, CrawlPageRequest, CrawlSiteRequest, PageAuditResult

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# In-memory job tracking
jobs: dict[str, dict] = {}


async def cleanup_old_jobs():
    """Remove completed/failed jobs older than 1 hour"""
    while True:
        await asyncio.sleep(3600)  # every hour
        now = datetime.now(timezone.utc)
        to_remove = []
        for job_id, job in jobs.items():
            if job["status"] in ("completed", "failed"):
                to_remove.append(job_id)
        for job_id in to_remove:
            del jobs[job_id]
        if to_remove:
            logger.info(f"Cleaned up {len(to_remove)} old jobs")


@asynccontextmanager
async def lifespan(app):
    # Startup: launch cleanup task
    task = asyncio.create_task(cleanup_old_jobs())
    yield
    # Shutdown: cancel cleanup
    task.cancel()


app = FastAPI(
    title="SEO Command Center - Crawler Service",
    version="1.0.0",
    description="Crawl and audit web pages for SEO issues",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("CORS_ORIGIN", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BACKEND_WEBHOOK_URL = os.getenv("BACKEND_WEBHOOK_URL", "http://localhost:4800/api/audits/webhook")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "crawler"}


@app.post("/crawl/page", response_model=PageAuditResult)
async def crawl_page(request: CrawlPageRequest):
    """Crawl a single page and return audit results immediately."""
    try:
        result = await crawl_single_page(request.url)
        return result
    except Exception as e:
        logger.error(f"Page crawl failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/crawl/site")
async def crawl_site_endpoint(request: CrawlSiteRequest, background_tasks: BackgroundTasks):
    """Start a site-wide crawl as a background job. Returns jobId immediately."""
    job_id = str(uuid.uuid4())

    jobs[job_id] = {
        "jobId": job_id,
        "status": "pending",
        "progress": None,
    }

    background_tasks.add_task(
        crawl_site,
        base_url=request.url,
        project_id=request.projectId,
        job_id=job_id,
        jobs=jobs,
        webhook_url=BACKEND_WEBHOOK_URL,
    )

    return {"jobId": job_id, "status": "pending"}


@app.get("/crawl/status/{job_id}", response_model=CrawlJobStatus)
async def get_status(job_id: str):
    """Return the current status and progress of a crawl job."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs[job_id]
    return CrawlJobStatus(
        jobId=job["jobId"],
        status=job["status"],
        progress=job.get("progress"),
    )


@app.post("/crawl/cancel/{job_id}")
async def cancel_job(job_id: str):
    """Cancel a running crawl job."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs[job_id]
    if job["status"] in ("completed", "failed"):
        raise HTTPException(status_code=400, detail=f"Job already {job['status']}")

    job["status"] = "cancelled"
    return {"jobId": job_id, "status": "cancelled"}
