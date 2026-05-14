const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Keyword = require('../models/Keyword');
const RankHistory = require('../models/RankHistory');
const KeywordCluster = require('../models/KeywordCluster');
const Project = require('../models/Project');
const { generateKeywordSuggestions, clusterKeywords } = require('../services/keywordResearch');
const { classifyIntent, calculateOpportunity, estimateDifficulty } = require('../services/keywordAnalyzer');
const { fetchSearchAnalytics, getSiteList } = require('../services/searchConsole');

// ---------- helpers ----------

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// ---------- GET /api/keywords/gsc/sites ----------
// List available GSC sites (must be before /:projectId routes)
router.get('/gsc/sites', async (req, res, next) => {
  try {
    const sites = await getSiteList();
    res.json(sites);
  } catch (err) { next(err); }
});

// ---------- GET /api/keywords/:projectId ----------
// List keywords for a project (paginated, sortable, filterable)
router.get('/:projectId', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    if (!isValidObjectId(projectId)) return res.status(400).json({ error: 'Invalid project ID' });

    const {
      page = 1,
      limit = 25,
      sort = 'volume',
      order = 'desc',
      search = '',
      intent,
      cluster,
    } = req.query;

    const filter = { projectId };
    if (search) filter.keyword = { $regex: search, $options: 'i' };
    if (intent) filter.intent = intent;
    if (cluster) filter.$or = [{ clusterName: cluster }, { cluster: cluster }];

    const sortObj = {};
    const allowedSorts = ['volume', 'cpc', 'difficulty', 'currentRank', 'competitionIndex', 'clicks', 'impressions', 'opportunityScore', 'avgPosition', 'ctr'];
    const sortField = allowedSorts.includes(sort) ? sort : 'volume';
    sortObj[sortField] = order === 'asc' ? 1 : -1;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const [keywords, total] = await Promise.all([
      Keyword.find(filter).sort(sortObj).skip(skip).limit(limitNum).lean(),
      Keyword.countDocuments(filter),
    ]);

    res.json({
      keywords,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---------- POST /api/keywords/:projectId ----------
// Add keyword(s) manually
router.post('/:projectId', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    if (!isValidObjectId(projectId)) return res.status(400).json({ error: 'Invalid project ID' });

    let keywordsToAdd = [];
    if (req.body.keywords && Array.isArray(req.body.keywords)) {
      keywordsToAdd = req.body.keywords;
    } else if (req.body.keyword) {
      keywordsToAdd = [req.body.keyword];
    } else {
      return res.status(400).json({ error: 'Provide "keyword" or "keywords" array' });
    }

    const docs = keywordsToAdd.map((kw) => {
      const isString = typeof kw === 'string';
      const keyword = isString ? kw : kw.keyword;
      const volume = isString ? null : kw.volume;
      const cpc = isString ? null : kw.cpc;
      const competition = isString ? null : kw.competition;
      const intent = isString ? classifyIntent(keyword) : (kw.intent || classifyIntent(keyword));
      const difficulty = isString ? null : (kw.difficulty || estimateDifficulty(volume || 0, competition || 'medium', cpc || 0));

      const doc = {
        projectId,
        keyword: keyword.toLowerCase().trim(),
        volume,
        cpc,
        competition,
        competitionIndex: isString ? null : kw.competitionIndex,
        intent,
        difficulty,
        trend: isString ? [] : (kw.trend || []),
        currentRank: isString ? null : kw.currentRank,
        url: isString ? null : kw.url,
        clicks: isString ? 0 : (kw.clicks || 0),
        impressions: isString ? 0 : (kw.impressions || 0),
        ctr: isString ? 0 : (kw.ctr || 0),
        avgPosition: isString ? null : kw.avgPosition,
        tags: isString ? [] : (kw.tags || []),
        source: 'manual',
      };

      doc.opportunityScore = calculateOpportunity(doc);
      return doc;
    });

    const ops = docs.map((doc) => ({
      updateOne: {
        filter: { projectId: doc.projectId, keyword: doc.keyword },
        update: { $setOnInsert: doc },
        upsert: true,
      },
    }));

    const result = await Keyword.bulkWrite(ops, { ordered: false });

    res.status(201).json({
      message: 'Keywords added',
      inserted: result.upsertedCount,
      existing: docs.length - result.upsertedCount,
    });
  } catch (err) {
    next(err);
  }
});

// ---------- PUT /api/keywords/:id ----------
// Update a single keyword
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ error: 'Invalid keyword ID' });

    const updated = await Keyword.findByIdAndUpdate(id, { $set: req.body, lastUpdated: new Date() }, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ error: 'Keyword not found' });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ---------- DELETE /api/keywords/:projectId/:keywordId ----------
// Delete a keyword
router.delete('/:projectId/:keywordId', async (req, res, next) => {
  try {
    const { keywordId } = req.params;
    if (!isValidObjectId(keywordId)) return res.status(400).json({ error: 'Invalid keyword ID' });

    const deleted = await Keyword.findByIdAndDelete(keywordId);
    if (!deleted) return res.status(404).json({ error: 'Keyword not found' });

    res.json({ message: 'Keyword deleted' });
  } catch (err) {
    next(err);
  }
});

// ---------- POST /api/keywords/:projectId/research ----------
// AI-powered keyword research (simulated)
router.post('/:projectId/research', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    if (!isValidObjectId(projectId)) return res.status(400).json({ error: 'Invalid project ID' });

    const { seed, count = 50 } = req.body;
    if (!seed || typeof seed !== 'string') {
      return res.status(400).json({ error: 'Provide a "seed" keyword string' });
    }

    const suggestions = generateKeywordSuggestions(seed.trim(), Math.min(200, Math.max(1, parseInt(count, 10) || 50)));

    res.json({ seed, count: suggestions.length, suggestions });
  } catch (err) {
    next(err);
  }
});

// ---------- POST /api/keywords/:projectId/cluster ----------
// Auto-cluster keywords by intent/topic
router.post('/:projectId/cluster', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    if (!isValidObjectId(projectId)) return res.status(400).json({ error: 'Invalid project ID' });

    const keywords = await Keyword.find({ projectId }).lean();
    if (keywords.length === 0) {
      return res.status(400).json({ error: 'No keywords found for this project' });
    }

    const clusters = clusterKeywords(keywords);

    // Persist clusters and update keywords with cluster info
    const bulkClusterOps = [];
    const bulkKeywordOps = [];

    for (const cluster of clusters) {
      const clusterId = new mongoose.Types.ObjectId().toString();

      bulkClusterOps.push({
        updateOne: {
          filter: { projectId, name: cluster.name },
          update: {
            $set: {
              projectId,
              name: cluster.name,
              intent: cluster.intent,
              keywords: cluster.keywords,
              totalVolume: cluster.totalVolume,
              avgDifficulty: cluster.avgDifficulty,
              status: cluster.status,
            },
          },
          upsert: true,
        },
      });

      for (const kwStr of cluster.keywords) {
        bulkKeywordOps.push({
          updateOne: {
            filter: { projectId, keyword: kwStr },
            update: { $set: { clusterId, clusterName: cluster.name, cluster: cluster.name } },
          },
        });
      }
    }

    if (bulkClusterOps.length) await KeywordCluster.bulkWrite(bulkClusterOps, { ordered: false });
    if (bulkKeywordOps.length) await Keyword.bulkWrite(bulkKeywordOps, { ordered: false });

    res.json({ message: 'Keywords clustered', clusterCount: clusters.length, clusters });
  } catch (err) {
    next(err);
  }
});

// ---------- GET /api/keywords/:projectId/clusters ----------
// List all clusters with their keywords
router.get('/:projectId/clusters', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    if (!isValidObjectId(projectId)) return res.status(400).json({ error: 'Invalid project ID' });

    const clusters = await KeywordCluster.find({ projectId }).sort({ totalVolume: -1 }).lean();
    res.json({ clusters });
  } catch (err) {
    next(err);
  }
});

// ---------- GET /api/keywords/:projectId/stats ----------
// Keyword stats summary
router.get('/:projectId/stats', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    if (!isValidObjectId(projectId)) return res.status(400).json({ error: 'Invalid project ID' });

    const objectId = new mongoose.Types.ObjectId(projectId);

    const [countResult, aggResult, intentResult, topKeywords] = await Promise.all([
      Keyword.countDocuments({ projectId }),
      Keyword.aggregate([
        { $match: { projectId: objectId } },
        {
          $group: {
            _id: null,
            avgVolume: { $avg: '$volume' },
            totalVolume: { $sum: '$volume' },
            avgDifficulty: { $avg: '$difficulty' },
            avgCpc: { $avg: '$cpc' },
            avgOpportunity: { $avg: '$opportunityScore' },
          },
        },
      ]),
      Keyword.aggregate([
        { $match: { projectId: objectId } },
        { $group: { _id: '$intent', count: { $sum: 1 } } },
      ]),
      Keyword.find({ projectId }).sort({ volume: -1 }).limit(5).lean(),
    ]);

    const agg = aggResult[0] || { avgVolume: 0, totalVolume: 0, avgDifficulty: 0, avgCpc: 0, avgOpportunity: 0 };
    const intentDistribution = {};
    for (const row of intentResult) {
      if (row._id) intentDistribution[row._id] = row.count;
    }

    res.json({
      totalKeywords: countResult,
      avgVolume: Math.round(agg.avgVolume || 0),
      totalVolume: agg.totalVolume || 0,
      avgDifficulty: Math.round(agg.avgDifficulty || 0),
      avgCpc: +(agg.avgCpc || 0).toFixed(2),
      avgOpportunity: Math.round(agg.avgOpportunity || 0),
      intentDistribution,
      topKeywords,
    });
  } catch (err) {
    next(err);
  }
});

// ---------- POST /api/keywords/:projectId/import ----------
// Import keywords from CSV/JSON payload
router.post('/:projectId/import', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    if (!isValidObjectId(projectId)) return res.status(400).json({ error: 'Invalid project ID' });

    const { keywords } = req.body;
    if (!Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({ error: 'Provide a "keywords" array' });
    }

    const docs = keywords.map((kw) => {
      const intent = kw.intent || classifyIntent(kw.keyword);
      const difficulty = kw.difficulty || estimateDifficulty(kw.volume || 0, kw.competition || 'medium', kw.cpc || 0);
      const doc = {
        projectId,
        keyword: kw.keyword.toLowerCase().trim(),
        volume: kw.volume ?? null,
        cpc: kw.cpc ?? null,
        competition: kw.competition ?? null,
        competitionIndex: kw.competitionIndex ?? null,
        intent,
        difficulty,
        trend: kw.trend || [],
        currentRank: kw.currentRank ?? null,
        url: kw.url || null,
        clicks: kw.clicks || 0,
        impressions: kw.impressions || 0,
        ctr: kw.ctr || 0,
        avgPosition: kw.avgPosition || null,
        tags: kw.tags || [],
        source: kw.source || 'manual',
      };
      doc.opportunityScore = calculateOpportunity(doc);
      return doc;
    });

    const ops = docs.map((doc) => ({
      updateOne: {
        filter: { projectId: doc.projectId, keyword: doc.keyword },
        update: { $set: doc },
        upsert: true,
      },
    }));

    const result = await Keyword.bulkWrite(ops, { ordered: false });

    res.status(201).json({
      message: 'Keywords imported',
      inserted: result.upsertedCount,
      updated: result.modifiedCount,
      total: docs.length,
    });
  } catch (err) {
    next(err);
  }
});

// ---------- POST /api/keywords/:projectId/sync-gsc ----------
// Sync keyword data from Google Search Console
router.post('/:projectId/sync-gsc', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    if (!isValidObjectId(projectId)) return res.status(400).json({ error: 'Invalid project ID' });

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const siteUrl = `${project.protocol || 'https'}://${project.domain}/`;
    const { rows, error } = await fetchSearchAnalytics(siteUrl, {
      dimensions: ['query', 'page'],
      rowLimit: 1000,
    });

    if (error) {
      return res.status(500).json({ error: `Search Console error: ${error}` });
    }

    if (rows.length === 0) {
      return res.json({ synced: 0, message: 'No data from Search Console' });
    }

    // Aggregate by query (a query may appear for multiple pages)
    const queryMap = {};
    for (const row of rows) {
      const query = row.keys[0];
      const pageUrl = row.keys[1];

      if (!queryMap[query]) {
        queryMap[query] = { clicks: 0, impressions: 0, position: 0, url: pageUrl, count: 0, maxClicks: 0 };
      }
      queryMap[query].clicks += row.clicks || 0;
      queryMap[query].impressions += row.impressions || 0;
      queryMap[query].position += row.position || 0;
      queryMap[query].count++;
      // Keep the URL with most clicks
      if ((row.clicks || 0) > queryMap[query].maxClicks) {
        queryMap[query].maxClicks = row.clicks || 0;
        queryMap[query].url = pageUrl;
      }
    }

    let synced = 0;
    for (const [query, data] of Object.entries(queryMap)) {
      const avgPosition = Math.round((data.position / data.count) * 10) / 10;
      const ctr = data.impressions > 0 ? Math.round((data.clicks / data.impressions) * 10000) / 100 : 0;
      const intent = classifyIntent(query);

      const update = {
        clicks: data.clicks,
        impressions: data.impressions,
        ctr,
        avgPosition,
        currentRank: Math.round(avgPosition),
        url: data.url,
        intent,
        source: 'search_console',
        lastUpdated: new Date(),
      };

      const existing = await Keyword.findOne({ projectId, keyword: query.toLowerCase() });
      if (existing) {
        if (existing.currentRank && existing.currentRank !== update.currentRank) {
          update.previousRank = existing.currentRank;
          update.rankChange = existing.currentRank - update.currentRank; // positive = improved
        }
      }

      update.difficulty = estimateDifficulty(existing?.volume || 0, 'medium', existing?.cpc || 0);
      update.opportunityScore = calculateOpportunity({ ...update, volume: existing?.volume || 0 });

      await Keyword.findOneAndUpdate(
        { projectId, keyword: query.toLowerCase() },
        { $set: update },
        { upsert: true, new: true }
      );

      // Save rank history data point
      await RankHistory.create({
        projectId,
        keyword: query.toLowerCase(),
        position: update.currentRank,
        url: data.url,
        clicks: data.clicks,
        impressions: data.impressions,
        ctr,
        date: new Date(),
      });

      synced++;
    }

    res.json({ synced, totalQueries: Object.keys(queryMap).length });
  } catch (err) {
    next(err);
  }
});

// ---------- GET /api/keywords/:projectId/rank-history/:keyword ----------
// Rank history for a specific keyword
router.get('/:projectId/rank-history/:keyword', async (req, res, next) => {
  try {
    const { projectId, keyword } = req.params;
    if (!isValidObjectId(projectId)) return res.status(400).json({ error: 'Invalid project ID' });

    const history = await RankHistory.find({
      projectId,
      keyword: keyword.toLowerCase(),
    }).sort({ date: -1 }).limit(90);

    res.json(history);
  } catch (err) {
    next(err);
  }
});

// ---------- GET /api/keywords/:projectId/opportunities ----------
// Top keyword opportunities sorted by opportunity score
router.get('/:projectId/opportunities', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    if (!isValidObjectId(projectId)) return res.status(400).json({ error: 'Invalid project ID' });

    const opportunities = await Keyword.find({ projectId })
      .sort({ opportunityScore: -1 })
      .limit(20)
      .lean();

    res.json(opportunities);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
