/**
 * Ranking opportunities computed from GSC rank history.
 *
 * Striking distance: queries ranking 4-15 with real impressions — small pushes
 * reach page 1 / top 3. Scored by extra clicks/period if ranked #3.
 *
 * CTR fix: queries already visible (pos <= 10) whose CTR is far below what
 * that position normally earns — a title/meta rewrite recovers clicks without
 * any ranking change.
 */

const mongoose = require('mongoose');
const RankHistory = require('../models/RankHistory');

// Rough industry-average CTR by organic position
const EXPECTED_CTR = {
  1: 0.28, 2: 0.15, 3: 0.11, 4: 0.08, 5: 0.07,
  6: 0.05, 7: 0.04, 8: 0.035, 9: 0.03, 10: 0.025,
};

function expectedCtr(position) {
  const p = Math.min(10, Math.max(1, Math.round(position)));
  return EXPECTED_CTR[p];
}

async function getOpportunities(projectId, { days = 90, minImpressions = 30 } = {}) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const stats = await RankHistory.aggregate([
    { $match: { projectId: new mongoose.Types.ObjectId(projectId), date: { $gte: cutoff } } },
    {
      $group: {
        _id: '$keyword',
        clicks: { $sum: '$clicks' },
        impressions: { $sum: '$impressions' },
        position: { $avg: '$position' },
      },
    },
  ]);

  const strikingDistance = stats
    .filter(s => s.position >= 4 && s.position <= 15 && s.impressions >= minImpressions)
    .map(s => ({
      keyword: s._id,
      clicks: s.clicks,
      impressions: s.impressions,
      position: Math.round(s.position * 10) / 10,
      // clicks gained per period if pushed to position 3
      potentialClicks: Math.max(0, Math.round(s.impressions * EXPECTED_CTR[3] - s.clicks)),
    }))
    .sort((a, b) => b.potentialClicks - a.potentialClicks);

  const ctrFixes = stats
    .filter(s => {
      if (s.position > 10 || s.impressions < Math.max(minImpressions, 50)) return false;
      const actual = s.impressions ? s.clicks / s.impressions : 0;
      return actual < expectedCtr(s.position) * 0.4;
    })
    .map(s => {
      const expected = expectedCtr(s.position);
      return {
        keyword: s._id,
        clicks: s.clicks,
        impressions: s.impressions,
        position: Math.round(s.position * 10) / 10,
        ctr: s.impressions ? Math.round((s.clicks / s.impressions) * 10000) / 100 : 0,
        expectedCtr: Math.round(expected * 10000) / 100,
        missedClicks: Math.max(0, Math.round(s.impressions * expected - s.clicks)),
      };
    })
    .sort((a, b) => b.missedClicks - a.missedClicks);

  return { days, strikingDistance, ctrFixes };
}

// Plain-text section for the weekly email digest
function formatOpportunitiesText(opps, projectName) {
  const sd = opps.strikingDistance.slice(0, 3);
  const cf = opps.ctrFixes.slice(0, 3);
  if (sd.length === 0 && cf.length === 0) return '';

  let text = `OPPORTUNITIES THIS WEEK — ${projectName} (last ${opps.days} days)\n`;
  if (sd.length > 0) {
    text += `  Striking distance (push to page 1):\n`;
    for (const o of sd) {
      text += `    "${o.keyword}" — position ${o.position}, ${o.impressions} impressions, ~${o.potentialClicks} extra clicks if top 3\n`;
    }
  }
  if (cf.length > 0) {
    text += `  Title/meta rewrites (low CTR for position):\n`;
    for (const o of cf) {
      text += `    "${o.keyword}" — position ${o.position}, CTR ${o.ctr}% vs ~${o.expectedCtr}% expected, ~${o.missedClicks} clicks missed\n`;
    }
  }
  return text;
}

module.exports = { getOpportunities, formatOpportunitiesText };
