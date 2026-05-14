const Anthropic = require('@anthropic-ai/sdk');

let client = null;

function getClient() {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  client = new Anthropic({ apiKey });
  return client;
}

async function generateContentBrief(keyword, projectContext = {}) {
  const ai = getClient();

  if (ai) {
    try {
      const message = await ai.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: `Generate an SEO content brief for the keyword: "${keyword}"

${projectContext.domain ? `Website: ${projectContext.domain}` : ''}
${projectContext.industry ? `Industry: ${projectContext.industry}` : ''}

Return a JSON object with:
- title: suggested page title (50-60 chars)
- outline: array of { heading, level (2 or 3), notes }
- requiredTopics: array of subtopics that must be covered
- suggestedWordCount: recommended word count
- targetIntent: informational/commercial/transactional
- metaSuggestions: { titles: [3 options], descriptions: [3 options, 120-155 chars each] }

Return ONLY valid JSON, no markdown.`
        }],
      });

      const text = message.content[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (err) {
      console.error('[AI] Content brief generation failed:', err.message);
    }
  }

  // Fallback: rule-based brief
  return generateRuleBasedBrief(keyword);
}

function generateRuleBasedBrief(keyword) {
  const isQuestion = /^(how|what|why|when|where|can|do|does|is|are|should)/i.test(keyword);
  const isComparison = /\b(vs|versus|alternative|compared)\b/i.test(keyword);

  let targetIntent = 'informational';
  let suggestedWordCount = 1500;

  if (/\b(buy|price|cost|hire|book|claim|apply)\b/i.test(keyword)) {
    targetIntent = 'transactional';
    suggestedWordCount = 800;
  } else if (/\b(best|top|review|comparison)\b/i.test(keyword)) {
    targetIntent = 'commercial';
    suggestedWordCount = 2000;
  }

  const outline = [
    { heading: `What is ${keyword}?`, level: 2, notes: 'Define the topic clearly' },
    { heading: isQuestion ? 'Quick Answer' : 'Overview', level: 2, notes: 'Provide immediate value' },
    { heading: 'Key Details', level: 2, notes: 'Cover the main aspects' },
  ];

  if (isComparison) {
    outline.push({ heading: 'Side-by-Side Comparison', level: 2, notes: 'Use a comparison table' });
    outline.push({ heading: 'Which Should You Choose?', level: 2, notes: 'Give a recommendation' });
  }

  outline.push(
    { heading: 'Common Questions', level: 2, notes: 'FAQ section for featured snippets' },
    { heading: 'Conclusion', level: 2, notes: 'Summarize and provide next steps' }
  );

  const words = keyword.split(/\s+/);

  return {
    title: `${keyword.charAt(0).toUpperCase() + keyword.slice(1)} - Complete Guide`,
    outline,
    requiredTopics: words.filter(w => w.length > 3),
    suggestedWordCount,
    targetIntent,
    metaSuggestions: {
      titles: [
        `${keyword.charAt(0).toUpperCase() + keyword.slice(1)} | Complete Guide ${new Date().getFullYear()}`,
        `Everything You Need to Know About ${keyword}`,
        `${keyword.charAt(0).toUpperCase() + keyword.slice(1)}: Expert Guide & Tips`,
      ],
      descriptions: [
        `Learn everything about ${keyword}. Expert guide covering key details, tips, and FAQs. Updated ${new Date().getFullYear()}.`,
        `Complete guide to ${keyword}. Find answers, expert insights, and actionable tips all in one place.`,
        `Discover the essentials of ${keyword}. Comprehensive resource with expert analysis and practical advice.`,
      ],
    },
  };
}

async function generateMetaTags(url, pageTitle, pageContent, keyword) {
  const ai = getClient();

  if (ai) {
    try {
      const message = await ai.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: `Generate SEO meta tags for this page:
URL: ${url}
Current Title: ${pageTitle}
Target Keyword: ${keyword}
Content Preview: ${pageContent?.substring(0, 500) || 'N/A'}

Return JSON:
{
  "titles": [3 title tag options, 50-60 chars each, include keyword],
  "descriptions": [3 meta description options, 120-155 chars each, include keyword, with CTA],
  "ogTitle": "optimized OG title",
  "ogDescription": "optimized OG description"
}

Return ONLY valid JSON.`
        }],
      });

      const text = message.content[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch (err) {
      console.error('[AI] Meta tag generation failed:', err.message);
    }
  }

  // Fallback
  const kw = keyword || pageTitle;
  return {
    titles: [
      `${kw} | ${pageTitle}`.substring(0, 60),
      `${pageTitle} - ${kw}`.substring(0, 60),
      `${kw}: Complete Guide & Tips`.substring(0, 60),
    ],
    descriptions: [
      `Learn about ${kw}. Expert guide with key insights and practical tips. Find out more today.`,
      `Discover everything about ${kw}. Comprehensive resource updated for ${new Date().getFullYear()}.`,
      `${kw} explained. Get expert analysis, tips, and answers to common questions.`,
    ],
    ogTitle: pageTitle,
    ogDescription: `Learn about ${kw}. Expert guide with key insights.`,
  };
}

async function scoreContent(auditData) {
  const scores = {
    overall: 0,
    titleScore: auditData.meta?.title?.score || 0,
    descriptionScore: auditData.meta?.description?.score || 0,
    headingStructure: 0,
    contentDepth: 0,
    readability: auditData.content?.readabilityScore || 0,
    internalLinking: 0,
    mediaUsage: 0,
  };

  // Heading structure score
  const h1s = auditData.headings?.h1?.length || 0;
  const h2s = auditData.headings?.h2?.length || 0;
  const h3s = auditData.headings?.h3?.length || 0;
  if (h1s === 1) scores.headingStructure += 40;
  if (h2s >= 3) scores.headingStructure += 30;
  else if (h2s >= 1) scores.headingStructure += 15;
  if (h3s >= 2) scores.headingStructure += 30;
  else if (h3s >= 1) scores.headingStructure += 15;

  // Content depth
  const wc = auditData.content?.wordCount || 0;
  if (wc >= 2000) scores.contentDepth = 100;
  else if (wc >= 1500) scores.contentDepth = 80;
  else if (wc >= 1000) scores.contentDepth = 60;
  else if (wc >= 500) scores.contentDepth = 40;
  else if (wc >= 300) scores.contentDepth = 20;

  // Internal linking
  const internalLinks = auditData.links?.internal?.length || auditData.links?.internalCount || 0;
  if (internalLinks >= 10) scores.internalLinking = 100;
  else if (internalLinks >= 5) scores.internalLinking = 70;
  else if (internalLinks >= 2) scores.internalLinking = 40;

  // Media usage
  const images = auditData.images?.length || 0;
  const imagesWithAlt = auditData.images?.filter(i => i.hasAlt)?.length || 0;
  if (images >= 3 && imagesWithAlt === images) scores.mediaUsage = 100;
  else if (images >= 1 && imagesWithAlt > 0) scores.mediaUsage = 60;
  else if (images >= 1) scores.mediaUsage = 30;

  // Overall = weighted average
  scores.overall = Math.round(
    scores.titleScore * 0.15 +
    scores.descriptionScore * 0.10 +
    scores.headingStructure * 0.20 +
    scores.contentDepth * 0.25 +
    scores.readability * 0.15 +
    scores.internalLinking * 0.10 +
    scores.mediaUsage * 0.05
  );

  return scores;
}

module.exports = { generateContentBrief, generateMetaTags, scoreContent };
