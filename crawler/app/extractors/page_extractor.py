import json
import re
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup


def _score_length(length: int, low: int, high: int, penalty_per_step: int, step_size: int) -> int:
    """Score a value based on ideal range. Returns 0-100."""
    if low <= length <= high:
        return 100
    if length < low:
        diff = low - length
    else:
        diff = length - high
    penalty = (diff // step_size + 1) * penalty_per_step
    return max(0, 100 - penalty)


def extract_meta(soup: BeautifulSoup, url: str) -> dict:
    """Extract meta tags from HTML."""
    # Title
    title_tag = soup.find("title")
    title_value = title_tag.get_text(strip=True) if title_tag else ""
    title_length = len(title_value)
    title_score = _score_length(title_length, 30, 60, 20, 10) if title_value else 0

    # Meta description
    desc_tag = soup.find("meta", attrs={"name": re.compile(r"^description$", re.I)})
    desc_value = desc_tag.get("content", "").strip() if desc_tag else ""
    desc_length = len(desc_value)
    desc_score = _score_length(desc_length, 120, 160, 20, 20) if desc_value else 0

    # Canonical
    canonical_tag = soup.find("link", attrs={"rel": "canonical"})
    canonical = canonical_tag.get("href", "").strip() if canonical_tag else ""

    # Robots
    robots_tag = soup.find("meta", attrs={"name": re.compile(r"^robots$", re.I)})
    robots = robots_tag.get("content", "").strip() if robots_tag else ""

    # OG tags
    og_title_tag = soup.find("meta", attrs={"property": "og:title"})
    og_desc_tag = soup.find("meta", attrs={"property": "og:description"})
    og_image_tag = soup.find("meta", attrs={"property": "og:image"})

    og_tags = {
        "title": og_title_tag.get("content", "").strip() if og_title_tag else "",
        "description": og_desc_tag.get("content", "").strip() if og_desc_tag else "",
        "image": og_image_tag.get("content", "").strip() if og_image_tag else "",
    }

    return {
        "title": {"value": title_value, "length": title_length, "score": title_score},
        "description": {"value": desc_value, "length": desc_length, "score": desc_score},
        "canonical": canonical,
        "robots": robots,
        "ogTags": og_tags,
    }


def extract_headings(soup: BeautifulSoup) -> dict:
    """Extract all h1-h6 headings."""
    headings = {}
    for level in range(1, 7):
        tag_name = f"h{level}"
        tags = soup.find_all(tag_name)
        headings[tag_name] = [tag.get_text(strip=True) for tag in tags]
    return headings


def extract_links(soup: BeautifulSoup, url: str) -> dict:
    """Extract and classify all links."""
    parsed_base = urlparse(url)
    base_domain = parsed_base.netloc.lower()

    internal = []
    external = []

    for a_tag in soup.find_all("a", href=True):
        href = a_tag.get("href", "").strip()
        if not href or href.startswith("#") or href.startswith("javascript:") or href.startswith("mailto:"):
            continue

        absolute_url = urljoin(url, href)
        parsed_href = urlparse(absolute_url)
        link_domain = parsed_href.netloc.lower()

        text = a_tag.get_text(strip=True)
        link_entry = {"url": absolute_url, "text": text}

        if link_domain == base_domain:
            internal.append(link_entry)
        else:
            external.append(link_entry)

    return {
        "internal": internal,
        "external": external,
        "internalCount": len(internal),
        "externalCount": len(external),
        "broken": [],  # populated later by status checking
    }


def extract_images(soup: BeautifulSoup, url: str) -> list[dict]:
    """Extract all images with alt text info."""
    images = []
    for img in soup.find_all("img"):
        src = img.get("src", "").strip()
        if src:
            src = urljoin(url, src)
        alt = img.get("alt", "").strip()
        images.append({
            "src": src,
            "alt": alt,
            "hasAlt": bool(alt),
        })
    return images


def extract_schema(soup: BeautifulSoup) -> dict | None:
    """Extract JSON-LD structured data."""
    scripts = soup.find_all("script", attrs={"type": "application/ld+json"})
    if not scripts:
        return None

    schemas = []
    for script in scripts:
        try:
            data = json.loads(script.string or "")
            schemas.append(data)
        except (json.JSONDecodeError, TypeError):
            continue

    if not schemas:
        return None

    return {"items": schemas, "count": len(schemas)}


def extract_content(soup: BeautifulSoup) -> dict:
    """Extract content metrics: word count and readability."""
    # Remove script and style elements
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()

    text = soup.get_text(separator=" ", strip=True)
    words = text.split()
    word_count = len(words)

    # Basic readability: average sentence length
    sentences = re.split(r"[.!?]+", text)
    sentences = [s.strip() for s in sentences if s.strip()]
    sentence_count = len(sentences) if sentences else 1

    avg_sentence_length = round(word_count / sentence_count, 1) if sentence_count > 0 else 0

    # Score readability: ideal avg sentence length is 15-20 words
    if 10 <= avg_sentence_length <= 20:
        readability_score = 100
    elif avg_sentence_length < 10:
        readability_score = max(0, 100 - int((10 - avg_sentence_length) * 10))
    else:
        readability_score = max(0, 100 - int((avg_sentence_length - 20) * 5))

    return {
        "wordCount": word_count,
        "sentenceCount": sentence_count,
        "avgSentenceLength": avg_sentence_length,
        "readabilityScore": readability_score,
    }


def extract_performance(html: str, soup: BeautifulSoup) -> dict:
    """Extract performance-related metrics."""
    page_size = len(html.encode("utf-8"))
    script_count = len(soup.find_all("script", src=True))
    stylesheet_count = len(soup.find_all("link", rel="stylesheet"))
    image_count = len(soup.find_all("img"))
    inline_script_count = len([s for s in soup.find_all("script") if not s.get("src")])

    return {
        "pageSizeBytes": page_size,
        "pageSizeKB": round(page_size / 1024, 1),
        "scriptCount": script_count,
        "stylesheetCount": stylesheet_count,
        "imageCount": image_count,
        "inlineScriptCount": inline_script_count,
        "totalResources": script_count + stylesheet_count + image_count,
    }


def extract_page_data(html: str, url: str) -> dict:
    """Main extraction function. Given raw HTML and URL, extract all SEO data."""
    soup = BeautifulSoup(html, "html.parser")

    # Extract performance before we mutate the soup (content extraction decomposes tags)
    performance = extract_performance(html, soup)

    # Use a fresh soup for content since extract_content decomposes tags
    content_soup = BeautifulSoup(html, "html.parser")
    content = extract_content(content_soup)

    meta = extract_meta(soup, url)
    headings = extract_headings(soup)
    links = extract_links(soup, url)
    images = extract_images(soup, url)
    schema_data = extract_schema(soup)

    return {
        "url": url,
        "meta": meta,
        "headings": headings,
        "links": links,
        "images": images,
        "schema_data": schema_data,
        "performance": performance,
        "content": content,
    }
