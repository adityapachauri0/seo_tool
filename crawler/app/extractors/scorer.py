def calculate_score(audit_data: dict) -> tuple[int, list[dict]]:
    """Calculate SEO score and generate issues list.

    Returns:
        Tuple of (score 0-100, list of issue dicts)
    """
    score = 100
    issues = []

    # --- Meta Title ---
    title = audit_data["meta"]["title"]
    if not title["value"]:
        score -= 15
        issues.append({
            "type": "missing_title",
            "severity": "critical",
            "message": "Page has no title tag",
            "recommendation": "Add a unique title tag between 30-60 characters",
        })
    elif title["length"] > 60:
        score -= 5
        issues.append({
            "type": "title_too_long",
            "severity": "warning",
            "message": f"Title is {title['length']} chars (recommended: 30-60)",
            "recommendation": "Shorten the title to under 60 characters",
        })
    elif title["length"] < 30:
        score -= 5
        issues.append({
            "type": "title_too_short",
            "severity": "warning",
            "message": f"Title is only {title['length']} chars",
            "recommendation": "Expand the title to at least 30 characters",
        })

    # --- Meta Description ---
    desc = audit_data["meta"]["description"]
    if not desc["value"]:
        score -= 10
        issues.append({
            "type": "missing_description",
            "severity": "critical",
            "message": "Page has no meta description",
            "recommendation": "Add a meta description between 120-160 characters",
        })
    elif desc["length"] > 160:
        score -= 5
        issues.append({
            "type": "description_too_long",
            "severity": "warning",
            "message": f"Meta description is {desc['length']} chars",
            "recommendation": "Shorten to under 160 characters",
        })

    # --- H1 Checks ---
    h1s = audit_data["headings"]["h1"]
    if len(h1s) == 0:
        score -= 15
        issues.append({
            "type": "missing_h1",
            "severity": "critical",
            "message": "Page has no H1 tag",
            "recommendation": "Add exactly one H1 tag with your primary keyword",
        })
    elif len(h1s) > 1:
        score -= 10
        issues.append({
            "type": "multiple_h1",
            "severity": "warning",
            "message": f"Page has {len(h1s)} H1 tags",
            "recommendation": "Use only one H1 tag per page",
        })

    # --- Missing Canonical ---
    if not audit_data["meta"].get("canonical"):
        score -= 10
        issues.append({
            "type": "missing_canonical",
            "severity": "warning",
            "message": "No canonical tag found",
            "recommendation": "Add a canonical tag to prevent duplicate content issues",
        })

    # --- Missing OG Tags ---
    og = audit_data["meta"].get("ogTags", {})
    if not og.get("title") or not og.get("description"):
        score -= 5
        issues.append({
            "type": "missing_og_tags",
            "severity": "info",
            "message": "Missing Open Graph tags",
            "recommendation": "Add og:title and og:description for better social sharing",
        })

    # --- Images Without Alt ---
    images = audit_data["images"]
    no_alt = [img for img in images if not img["hasAlt"]]
    if no_alt:
        penalty = min(len(no_alt) * 3, 15)
        score -= penalty
        issues.append({
            "type": "images_missing_alt",
            "severity": "warning",
            "message": f"{len(no_alt)} image(s) missing alt text",
            "recommendation": "Add descriptive alt text to all images",
        })

    # --- No Schema Markup ---
    if not audit_data.get("schema_data"):
        score -= 10
        issues.append({
            "type": "no_schema",
            "severity": "info",
            "message": "No structured data (JSON-LD) found",
            "recommendation": "Add schema markup for rich search results",
        })

    # --- Low Word Count ---
    wc = audit_data["content"]["wordCount"]
    if wc < 300:
        score -= 5
        issues.append({
            "type": "thin_content",
            "severity": "warning",
            "message": f"Page has only {wc} words",
            "recommendation": "Aim for at least 300 words of quality content",
        })

    # --- Broken Links ---
    broken = audit_data["links"].get("broken", [])
    if broken:
        penalty = min(len(broken) * 5, 20)
        score -= penalty
        issues.append({
            "type": "broken_links",
            "severity": "critical",
            "message": f"{len(broken)} broken link(s) found",
            "recommendation": "Fix or remove broken links",
        })

    return max(score, 0), issues
