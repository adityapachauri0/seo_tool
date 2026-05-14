/**
 * Keyword analysis utilities — intent classification, opportunity scoring,
 * clustering, and difficulty estimation.
 */

// Classify keyword intent based on modifier patterns
function classifyIntent(keyword) {
  const kw = keyword.toLowerCase();

  // Transactional signals
  if (/\b(buy|purchase|order|price|cost|cheap|deal|discount|coupon|hire|book|subscribe|get|claim|apply|sign up|register|download)\b/.test(kw)) {
    return 'transactional';
  }

  // Commercial investigation
  if (/\b(best|top|review|comparison|vs|versus|alternative|recommended|rated)\b/.test(kw)) {
    return 'commercial';
  }

  // Navigational
  if (/\b(login|sign in|website|official|contact|support|app|dashboard)\b/.test(kw)) {
    return 'navigational';
  }

  // Default to informational
  return 'informational';
}

// Calculate opportunity score (0-100)
function calculateOpportunity(keyword) {
  const volume = keyword.volume || 0;
  const difficulty = keyword.difficulty || 50;
  const cpc = keyword.cpc || 0;
  const currentRank = keyword.currentRank || 100;

  // Position-based bonus — striking distance (rank 11-20) is the biggest opportunity
  let positionBonus = 0;
  if (currentRank >= 4 && currentRank <= 10) positionBonus = 20;
  else if (currentRank >= 11 && currentRank <= 20) positionBonus = 40;
  else if (currentRank >= 21 && currentRank <= 50) positionBonus = 10;

  const volumeScore = Math.min(volume / 1000, 30);       // max 30 pts
  const difficultyScore = Math.max(0, 30 - (difficulty * 0.3)); // max 30 pts
  const cpcScore = Math.min(cpc * 3, 20);                // max 20 pts (high CPC = valuable)

  return Math.round(Math.min(100, volumeScore + difficultyScore + positionBonus + cpcScore));
}

// Cluster keywords by shared bigrams / significant terms
function clusterKeywords(keywords) {
  const stopWords = new Set([
    'how', 'to', 'what', 'is', 'the', 'a', 'an', 'for', 'in', 'of',
    'and', 'or', 'can', 'i', 'do', 'should', 'it', 'my', 'with',
    'from', 'that', 'this', 'have', 'been', 'will', 'your', 'they',
    'about', 'when', 'where', 'why', 'does',
  ]);

  const clusters = {};

  for (const kw of keywords) {
    const words = kw.keyword.toLowerCase().split(/\s+/);
    let clusterName = null;

    // Try bigrams first (skip leading stop words)
    for (let i = 0; i < words.length - 1; i++) {
      if (stopWords.has(words[i])) continue;
      const bigram = `${words[i]} ${words[i + 1]}`;
      if (!clusterName) clusterName = bigram;
    }

    // Fall back to first significant word
    if (!clusterName && words.length > 0) {
      clusterName = words.filter(w => w.length > 3 && !stopWords.has(w))[0] || words[0];
    }

    if (!clusters[clusterName]) clusters[clusterName] = [];
    clusters[clusterName].push(kw);
  }

  return clusters;
}

// Estimate keyword difficulty from volume + competition + CPC signals
function estimateDifficulty(volume, competition, cpc) {
  let score = 50;

  if (competition === 'high') score += 20;
  else if (competition === 'medium') score += 10;
  else if (competition === 'low') score -= 10;

  if (volume > 10000) score += 15;
  else if (volume > 5000) score += 10;
  else if (volume > 1000) score += 5;
  else if (volume < 100) score -= 15;

  if (cpc > 5) score += 10;
  else if (cpc > 2) score += 5;

  return Math.max(0, Math.min(100, score));
}

module.exports = { classifyIntent, calculateOpportunity, clusterKeywords, estimateDifficulty };
