/**
 * Daily GSC rank tracking — pulls per-query position data into RankHistory.
 * A project is matched to a GSC property by domain (sc-domain: or URL-prefix).
 */

const RankHistory = require('../models/RankHistory');
const { fetchSearchAnalytics, getSiteList } = require('./searchConsole');

function normalize(domain) {
  return domain.replace(/^www\./, '').replace(/\/+$/, '').toLowerCase();
}

// Find the GSC property that covers this project's domain
function matchProperty(sites, domain) {
  const d = normalize(domain);
  return sites.find(s => {
    const url = s.siteUrl;
    if (url.startsWith('sc-domain:')) return normalize(url.slice(10)) === d;
    try {
      return normalize(new URL(url).host) === d;
    } catch {
      return false;
    }
  })?.siteUrl || null;
}

// Sync one project's query positions for a single day (GSC data lags ~2 days)
async function syncProjectRanks(project, sites) {
  const property = matchProperty(sites, project.domain);
  if (!property) return { project: project.domain, error: 'no GSC property access' };

  const day = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const { rows, error } = await fetchSearchAnalytics(property, {
    startDate: day,
    endDate: day,
    dimensions: ['query'],
    rowLimit: 500,
  });
  if (error) return { project: project.domain, error };

  const date = new Date(day);
  for (const row of rows) {
    await RankHistory.updateOne(
      { projectId: project._id, keyword: row.keys[0], date },
      {
        $set: {
          position: Math.round(row.position * 10) / 10,
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: Math.round(row.ctr * 10000) / 10000,
        },
      },
      { upsert: true }
    );
  }
  return { project: project.domain, property, date: day, queries: rows.length };
}

// Sync all active projects; returns per-project results
async function syncAllRanks(projects) {
  const sites = await getSiteList();
  if (sites.length === 0) {
    console.warn('[RANKS] Service account has no GSC properties — add it as a user in Search Console');
  }
  const results = [];
  for (const project of projects) {
    const r = await syncProjectRanks(project, sites);
    results.push(r);
    console.log(`[RANKS] ${r.project}: ${r.error ? r.error : r.queries + ' queries stored'}`);
  }
  return results;
}

module.exports = { syncAllRanks, syncProjectRanks, matchProperty };
