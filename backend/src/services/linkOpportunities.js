/**
 * Off-page link opportunities, swept weekly via Firecrawl search:
 *
 * - unlinked_mention: pages that mention the brand but don't link to the site
 *   (verified by fetching the page and checking hrefs) — warm reclamation targets.
 * - press_target: fresh articles on the project's topics — journalists actively
 *   covering the space this week, i.e. warm outreach targets.
 */

const axios = require('axios');
const LinkOpportunity = require('../models/LinkOpportunity');

const FIRECRAWL_URL = 'https://api.firecrawl.dev/v1/search';
const SKIP_HOSTS = /facebook\.com|twitter\.com|x\.com|linkedin\.com|instagram\.com|youtube\.com|pinterest\./i;

function brandOf(project) {
  // Older projects stored a URL as the name — fall back to the bare domain name
  if (/^https?:\/\//i.test(project.name)) {
    return project.domain.replace(/\/+$/, '').split('.')[0];
  }
  return project.name;
}

async function firecrawlSearch(query, limit) {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return { results: [], error: 'FIRECRAWL_API_KEY not set' };
  try {
    const res = await axios.post(
      FIRECRAWL_URL,
      { query, limit },
      { headers: { Authorization: `Bearer ${key}` }, timeout: 30000 }
    );
    return { results: res.data?.data || [] };
  } catch (err) {
    return { results: [], error: err.response?.data?.error || err.message };
  }
}

// Does this page link to the domain? null = couldn't fetch (don't judge)
async function pageLinksTo(url, domain) {
  try {
    const res = await axios.get(url, {
      timeout: 15000,
      maxContentLength: 3 * 1024 * 1024,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEOCommandCenter/1.0)' },
      validateStatus: s => s < 400,
    });
    const html = String(res.data);
    const bare = domain.replace(/^www\./, '').replace(/\/+$/, '');
    return new RegExp(`href=["'][^"']*${bare.replace(/\./g, '\\.')}`, 'i').test(html);
  } catch {
    return null;
  }
}

async function saveOpportunity(projectId, doc) {
  try {
    const res = await LinkOpportunity.updateOne(
      { projectId, url: doc.url },
      { $setOnInsert: { ...doc, projectId } },
      { upsert: true }
    );
    return res.upsertedCount > 0;
  } catch {
    return false; // duplicate race — fine
  }
}

async function sweepProject(project) {
  const domain = project.domain.replace(/\/+$/, '');
  const brand = brandOf(project);
  let found = { mentions: 0, press: 0, errors: [] };

  // 1. Unlinked brand mentions
  const { results: mentionResults, error: mErr } = await firecrawlSearch(
    `"${brand}" -site:${domain}`, 10
  );
  if (mErr) found.errors.push(`mentions: ${mErr}`);
  for (const r of mentionResults) {
    if (!r.url || r.url.includes(domain) || SKIP_HOSTS.test(r.url)) continue;
    const links = await pageLinksTo(r.url, domain);
    if (links !== false) continue; // already links, or unreachable
    const isNew = await saveOpportunity(project._id, {
      type: 'unlinked_mention',
      url: r.url,
      title: r.title,
      snippet: r.description,
      query: brand,
    });
    if (isNew) found.mentions++;
  }

  // 2. Fresh press on the project's topics (journalists active this week)
  for (const topic of (project.topics || []).slice(0, 2)) {
    const { results, error } = await firecrawlSearch(`${topic} news`, 5);
    if (error) { found.errors.push(`press "${topic}": ${error}`); continue; }
    for (const r of results) {
      if (!r.url || r.url.includes(domain) || SKIP_HOSTS.test(r.url)) continue;
      const isNew = await saveOpportunity(project._id, {
        type: 'press_target',
        url: r.url,
        title: r.title,
        snippet: r.description,
        query: topic,
      });
      if (isNew) found.press++;
    }
  }

  console.log(`[LINKS] ${domain}: +${found.mentions} unlinked mentions, +${found.press} press targets` +
    (found.errors.length ? ` (errors: ${found.errors.join('; ')})` : ''));
  return found;
}

// Plain-text digest section: new opportunities from the last `days` days
async function formatLinkOppsText(projectId, projectName, days = 8) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const opps = await LinkOpportunity.find({
    projectId, status: 'new', foundAt: { $gte: cutoff },
  }).sort({ foundAt: -1 }).limit(10);
  if (opps.length === 0) return '';

  let text = `LINK OPPORTUNITIES — ${projectName}\n`;
  for (const o of opps) {
    const label = o.type === 'unlinked_mention' ? 'Unlinked mention' : 'Journalist activity';
    text += `  [${label}] ${o.title || o.url}\n    ${o.url}\n`;
  }
  return text;
}

module.exports = { sweepProject, formatLinkOppsText };
