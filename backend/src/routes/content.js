const express = require('express');
const router = express.Router();
const ContentBrief = require('../models/ContentBrief');
const Audit = require('../models/Audit');
const Project = require('../models/Project');
const { generateContentBrief, generateMetaTags, scoreContent } = require('../services/aiContentEngine');

// POST /api/content/brief/:projectId — generate content brief for a keyword
router.post('/brief/:projectId', async (req, res, next) => {
  try {
    const { keyword } = req.body;
    if (!keyword) return res.status(400).json({ error: 'keyword required' });

    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const brief = await generateContentBrief(keyword, {
      domain: project.domain,
      industry: project.tags?.join(', '),
    });

    const doc = await ContentBrief.create({
      projectId: req.params.projectId,
      targetKeyword: keyword,
      ...brief,
    });

    res.json(doc);
  } catch (err) { next(err); }
});

// GET /api/content/briefs/:projectId — list all content briefs
router.get('/briefs/:projectId', async (req, res, next) => {
  try {
    const briefs = await ContentBrief.find({ projectId: req.params.projectId })
      .sort({ createdAt: -1 });
    res.json(briefs);
  } catch (err) { next(err); }
});

// GET /api/content/brief/detail/:briefId — get single brief
router.get('/brief/detail/:briefId', async (req, res, next) => {
  try {
    const brief = await ContentBrief.findById(req.params.briefId);
    if (!brief) return res.status(404).json({ error: 'Brief not found' });
    res.json(brief);
  } catch (err) { next(err); }
});

// PUT /api/content/brief/:briefId — update brief
router.put('/brief/:briefId', async (req, res, next) => {
  try {
    const brief = await ContentBrief.findByIdAndUpdate(
      req.params.briefId,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!brief) return res.status(404).json({ error: 'Brief not found' });
    res.json(brief);
  } catch (err) { next(err); }
});

// DELETE /api/content/brief/:briefId — delete brief
router.delete('/brief/:briefId', async (req, res, next) => {
  try {
    await ContentBrief.findByIdAndDelete(req.params.briefId);
    res.json({ message: 'Brief deleted' });
  } catch (err) { next(err); }
});

// POST /api/content/meta-tags — generate meta tag suggestions
router.post('/meta-tags', async (req, res, next) => {
  try {
    const { url, title, content, keyword } = req.body;
    if (!keyword) return res.status(400).json({ error: 'keyword required' });

    const suggestions = await generateMetaTags(url, title, content, keyword);
    res.json(suggestions);
  } catch (err) { next(err); }
});

// POST /api/content/meta-tags/bulk/:projectId — bulk generate meta tags for all pages
router.post('/meta-tags/bulk/:projectId', async (req, res, next) => {
  try {
    const audits = await Audit.find({ projectId: req.params.projectId })
      .sort({ crawledAt: -1 })
      .limit(50);

    const results = [];
    for (const audit of audits) {
      const title = audit.meta?.title?.value || '';
      const keyword = audit.headings?.h1?.[0] || title.split('|')[0]?.trim() || '';

      // Only generate for pages with weak meta tags
      if ((audit.meta?.title?.score || 0) < 80 || (audit.meta?.description?.score || 0) < 80) {
        const suggestions = await generateMetaTags(
          audit.url,
          title,
          null,
          keyword
        );
        results.push({ url: audit.url, current: audit.meta, suggestions });
      }
    }

    res.json({ pagesAnalyzed: audits.length, suggestionsGenerated: results.length, results });
  } catch (err) { next(err); }
});

// GET /api/content/scores/:projectId — content scores for all audited pages
router.get('/scores/:projectId', async (req, res, next) => {
  try {
    const audits = await Audit.find({ projectId: req.params.projectId })
      .sort({ crawledAt: -1 })
      .limit(50);

    const scores = await Promise.all(
      audits.map(async (audit) => {
        const contentScore = await scoreContent(audit);
        return {
          url: audit.url,
          seoScore: audit.score,
          contentScore: contentScore.overall,
          breakdown: contentScore,
          wordCount: audit.content?.wordCount || 0,
          title: audit.meta?.title?.value || '',
        };
      })
    );

    // Sort by content score ascending (worst first)
    scores.sort((a, b) => a.contentScore - b.contentScore);

    res.json(scores);
  } catch (err) { next(err); }
});

// GET /api/content/decay/:projectId — detect content decay (pages with declining scores)
router.get('/decay/:projectId', async (req, res, next) => {
  try {
    const summaries = await Audit.aggregate([
      { $match: { projectId: require('mongoose').Types.ObjectId.createFromHexString(req.params.projectId) } },
      { $sort: { crawledAt: -1 } },
      { $group: {
        _id: '$url',
        latestScore: { $first: '$score' },
        latestCrawl: { $first: '$crawledAt' },
        scores: { $push: { score: '$score', date: '$crawledAt' } },
        wordCount: { $first: '$content.wordCount' },
        title: { $first: '$meta.title.value' },
      }},
    ]);

    const decaying = summaries
      .filter(s => {
        if (s.scores.length < 2) return false;
        const latest = s.scores[0].score;
        const previous = s.scores[1].score;
        return latest < previous;
      })
      .map(s => ({
        url: s._id,
        title: s.title,
        currentScore: s.scores[0].score,
        previousScore: s.scores[1].score,
        scoreDrop: s.scores[1].score - s.scores[0].score,
        wordCount: s.wordCount,
        lastCrawled: s.latestCrawl,
      }))
      .sort((a, b) => b.scoreDrop - a.scoreDrop);

    res.json({ totalPages: summaries.length, decayingPages: decaying.length, pages: decaying });
  } catch (err) { next(err); }
});

module.exports = router;
