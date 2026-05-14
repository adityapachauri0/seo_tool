from pydantic import BaseModel


class CrawlPageRequest(BaseModel):
    url: str
    projectId: str | None = None


class CrawlSiteRequest(BaseModel):
    url: str
    projectId: str


class PageAuditResult(BaseModel):
    url: str
    score: int
    issues: list[dict]
    meta: dict
    headings: dict
    links: dict
    images: list[dict]
    schema_data: dict | None = None
    performance: dict
    content: dict


class CrawlJobStatus(BaseModel):
    jobId: str
    status: str  # pending, running, completed, failed
    progress: dict | None = None
