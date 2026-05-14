/**
 * Keyword research service — generates suggestions and clusters keywords.
 * In production this would call Google Ads Keyword Planner API.
 * For now it generates realistic suggestions based on a seed keyword.
 */

function generateKeywordSuggestions(seed, count = 50) {
  const suggestions = [];

  const prefixes = ['how to', 'what is', 'best', 'top', 'free', 'cheap', 'compare', 'review'];
  const suffixes = ['guide', 'tips', 'examples', 'cost', 'near me', 'online', 'uk', 'calculator', 'checker'];
  const questions = ['how', 'what', 'why', 'when', 'where', 'can i', 'should i', 'is it', 'do i need'];

  // 1. Seed keyword itself
  suggestions.push({
    keyword: seed,
    volume: Math.floor(Math.random() * 20000) + 5000,
    cpc: +(Math.random() * 5 + 0.5).toFixed(2),
    competition: 'high',
    competitionIndex: Math.floor(Math.random() * 30) + 70,
    intent: 'transactional',
  });

  // 2. Question variations
  for (const q of questions) {
    if (suggestions.length >= count) break;
    suggestions.push({
      keyword: `${q} ${seed}`,
      volume: Math.floor(Math.random() * 5000) + 100,
      cpc: +(Math.random() * 3 + 0.3).toFixed(2),
      competition: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
      competitionIndex: Math.floor(Math.random() * 100),
      intent: 'informational',
    });
  }

  // 3. Prefix variations
  for (const p of prefixes) {
    if (suggestions.length >= count) break;
    suggestions.push({
      keyword: `${p} ${seed}`,
      volume: Math.floor(Math.random() * 8000) + 200,
      cpc: +(Math.random() * 4 + 0.5).toFixed(2),
      competition: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
      competitionIndex: Math.floor(Math.random() * 100),
      intent: p === 'how to' ? 'informational' : 'commercial',
    });
  }

  // 4. Suffix variations
  for (const s of suffixes) {
    if (suggestions.length >= count) break;
    suggestions.push({
      keyword: `${seed} ${s}`,
      volume: Math.floor(Math.random() * 6000) + 100,
      cpc: +(Math.random() * 3.5 + 0.4).toFixed(2),
      competition: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
      competitionIndex: Math.floor(Math.random() * 100),
      intent: ['cost', 'calculator', 'checker'].includes(s) ? 'transactional' : 'informational',
    });
  }

  // 5. Long-tail variations
  const longTails = [
    `${seed} for beginners`,
    `${seed} step by step`,
    `${seed} without paperwork`,
    `${seed} how long does it take`,
    `${seed} success rate`,
    `${seed} worth it`,
    `${seed} vs`,
    `${seed} alternatives`,
    `${seed} process explained`,
    `${seed} eligibility`,
  ];
  for (const lt of longTails) {
    if (suggestions.length >= count) break;
    suggestions.push({
      keyword: lt,
      volume: Math.floor(Math.random() * 2000) + 50,
      cpc: +(Math.random() * 2 + 0.2).toFixed(2),
      competition: 'low',
      competitionIndex: Math.floor(Math.random() * 40),
      intent: 'informational',
    });
  }

  // Add difficulty scores and 12-month trend data
  return suggestions.slice(0, count).map((s) => ({
    ...s,
    difficulty: Math.min(100, Math.floor(s.competitionIndex * 0.7 + (s.volume > 5000 ? 20 : 10))),
    trend: Array.from({ length: 12 }, (_, i) => ({
      month: new Date(Date.now() - (11 - i) * 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7),
      volume: Math.floor(s.volume * (0.8 + Math.random() * 0.4)),
    })),
  }));
}

function clusterKeywords(keywords) {
  const clusters = {};
  const stopWords = new Set([
    'how', 'to', 'what', 'is', 'the', 'a', 'an', 'for', 'in', 'of',
    'and', 'or', 'can', 'i', 'do', 'should', 'it', 'my', 'best', 'top',
    'free', 'vs', 'with', 'without', 'near', 'me', 'uk', 'when', 'where',
    'why', 'does',
  ]);

  for (const kw of keywords) {
    const words = kw.keyword.toLowerCase().split(/\s+/);
    const significantWords = words.filter((w) => !stopWords.has(w) && w.length > 2);
    const clusterKey = significantWords.slice(0, 2).join(' ') || words[0];

    if (!clusters[clusterKey]) {
      clusters[clusterKey] = {
        name: clusterKey,
        keywords: [],
        totalVolume: 0,
        difficulties: [],
        intents: {},
      };
    }
    clusters[clusterKey].keywords.push(kw.keyword);
    clusters[clusterKey].totalVolume += kw.volume || 0;
    clusters[clusterKey].difficulties.push(kw.difficulty || 50);
    const intent = kw.intent || 'informational';
    clusters[clusterKey].intents[intent] = (clusters[clusterKey].intents[intent] || 0) + 1;
  }

  return Object.values(clusters).map((c) => ({
    name: c.name,
    keywords: c.keywords,
    totalVolume: c.totalVolume,
    avgDifficulty: Math.round(c.difficulties.reduce((a, b) => a + b, 0) / c.difficulties.length),
    intent: Object.entries(c.intents).sort((a, b) => b[1] - a[1])[0]?.[0] || 'informational',
    status: 'unmapped',
  }));
}

module.exports = { generateKeywordSuggestions, clusterKeywords };
