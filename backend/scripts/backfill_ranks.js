/**
 * One-off backfill: pull up to 16 months of per-query, per-day GSC data
 * into RankHistory for every active project the service account can see.
 * Safe to re-run — everything is upserted.
 *
 * Usage: node scripts/backfill_ranks.js [months]
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Project = require('../src/models/Project');
const RankHistory = require('../src/models/RankHistory');
const { fetchSearchAnalytics, getSiteList } = require('../src/services/searchConsole');
const { matchProperty } = require('../src/services/rankTracker');

const MONTHS = parseInt(process.argv[2] || '16', 10);
const ROW_LIMIT = 25000;

function fmt(d) {
  return d.toISOString().split('T')[0];
}

// [start, end] pairs, one per month, oldest first, ending 2 days ago
function monthChunks(months) {
  const chunks = [];
  const end = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  for (let i = months - 1; i >= 0; i--) {
    const s = new Date(end.getFullYear(), end.getMonth() - i, 1);
    const e = i === 0 ? end : new Date(end.getFullYear(), end.getMonth() - i + 1, 0);
    if (e >= s) chunks.push([fmt(s), fmt(e)]);
  }
  return chunks;
}

async function backfillProject(project, sites) {
  const property = matchProperty(sites, project.domain);
  if (!property) {
    console.log(`SKIP ${project.domain}: no GSC property access`);
    return 0;
  }

  let total = 0;
  for (const [startDate, endDate] of monthChunks(MONTHS)) {
    let startRow = 0;
    for (;;) {
      const { rows, error } = await fetchSearchAnalytics(property, {
        startDate,
        endDate,
        dimensions: ['query', 'date'],
        rowLimit: ROW_LIMIT,
        startRow,
      });
      if (error) {
        console.log(`  ${project.domain} ${startDate}: ${error}`);
        break;
      }
      if (rows.length === 0) break;

      const ops = rows.map(r => ({
        updateOne: {
          filter: { projectId: project._id, keyword: r.keys[0], date: new Date(r.keys[1]) },
          update: {
            $set: {
              position: Math.round(r.position * 10) / 10,
              clicks: r.clicks,
              impressions: r.impressions,
              ctr: Math.round(r.ctr * 10000) / 10000,
            },
          },
          upsert: true,
        },
      }));
      await RankHistory.bulkWrite(ops, { ordered: false });
      total += rows.length;
      if (rows.length < ROW_LIMIT) break;
      startRow += ROW_LIMIT;
    }
  }
  console.log(`DONE ${project.domain}: ${total} query-day rows`);
  return total;
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const sites = await getSiteList();
  console.log(`GSC properties visible: ${sites.length}`);
  const projects = await Project.find({ status: 'active' });
  let grand = 0;
  for (const p of projects) grand += await backfillProject(p, sites);
  console.log(`TOTAL: ${grand} rows across ${projects.length} projects`);
  process.exit(0);
})().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
