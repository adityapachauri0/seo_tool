const Audit = require('../models/Audit');
const { sendMail } = require('./mailer');
const AuditSummary = require('../models/AuditSummary');
const Report = require('../models/Report');
const Alert = require('../models/Alert');
const Project = require('../models/Project');

async function generateReport(projectId, type = 'weekly') {
  const project = await Project.findById(projectId);
  if (!project) throw new Error('Project not found');

  // Get latest audits
  const audits = await Audit.find({ projectId }).sort({ crawledAt: -1 }).limit(50);
  if (audits.length === 0) return null;

  // Get previous summary for comparison
  const summaries = await AuditSummary.find({ projectId }).sort({ crawledAt: -1 }).limit(2);
  const currentScore = summaries[0]?.avgScore || 0;
  const previousScore = summaries[1]?.avgScore || currentScore;
  const scoreChange = Math.round((currentScore - previousScore) * 100) / 100;

  // Count issues
  const issuesSummary = { critical: 0, warning: 0, info: 0 };
  const issueTypes = {};

  for (const audit of audits) {
    for (const issue of (audit.issues || [])) {
      const sev = issue.severity || 'info';
      issuesSummary[sev] = (issuesSummary[sev] || 0) + 1;
      const key = issue.type || 'unknown';
      if (!issueTypes[key]) issueTypes[key] = { count: 0, severity: sev };
      issueTypes[key].count++;
    }
  }

  const topIssues = Object.entries(issueTypes)
    .map(([type, data]) => ({ type, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Best and worst pages
  const sortedByScore = [...audits].sort((a, b) => (b.score || 0) - (a.score || 0));
  const bestPages = sortedByScore.slice(0, 5).map(a => ({ url: a.url, score: a.score }));
  const worstPages = sortedByScore.slice(-5).reverse().map(a => ({ url: a.url, score: a.score }));

  // Content stats
  const wordCounts = audits.map(a => a.content?.wordCount || 0);
  const avgWordCount = Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length);
  const pagesBelow300 = wordCounts.filter(w => w < 300).length;

  // Generate recommendations
  const recommendations = [];
  if (issuesSummary.critical > 0) recommendations.push(`Fix ${issuesSummary.critical} critical issue(s) — these directly impact SEO performance.`);
  if (pagesBelow300 > 0) recommendations.push(`${pagesBelow300} page(s) have thin content (under 300 words) — consider expanding or consolidating.`);
  if (topIssues.find(i => i.type === 'title_too_long')) recommendations.push('Several page titles exceed 60 characters — shorten for better display in search results.');
  if (topIssues.find(i => i.type === 'missing_description')) recommendations.push('Some pages lack meta descriptions — add unique descriptions to improve click-through rates.');
  if (topIssues.find(i => i.type === 'no_schema')) recommendations.push('Add structured data (JSON-LD) to pages for rich search result features.');
  if (topIssues.find(i => i.type === 'images_missing_alt')) recommendations.push('Add alt text to images for accessibility and image search visibility.');
  if (scoreChange < 0) recommendations.push(`Overall score dropped by ${Math.abs(scoreChange)} points since last audit — review recent changes.`);
  if (scoreChange > 0) recommendations.push(`Score improved by ${scoreChange} points — keep up the good work!`);
  if (recommendations.length === 0) recommendations.push('Site is in great shape! Consider expanding content or targeting new keywords.');

  const reportData = {
    overallScore: currentScore,
    scoreChange,
    totalPages: audits.length,
    issuesSummary,
    topIssues,
    bestPages,
    worstPages,
    contentStats: { avgWordCount, totalWords: wordCounts.reduce((a, b) => a + b, 0), pagesBelow300 },
    recommendations,
  };

  const report = await Report.create({
    projectId,
    type,
    period: { start: audits[audits.length - 1]?.crawledAt, end: audits[0]?.crawledAt },
    data: reportData,
  });

  return report;
}

// Check for alert conditions after an audit completes
async function checkAlerts(projectId) {
  const summaries = await AuditSummary.find({ projectId }).sort({ crawledAt: -1 }).limit(2);

  if (summaries.length < 2) return [];

  const alerts = [];
  const current = summaries[0];
  const previous = summaries[1];

  // Score drop alert
  const scoreDiff = (current.avgScore || 0) - (previous.avgScore || 0);
  if (scoreDiff < -5) {
    alerts.push(await Alert.create({
      projectId,
      type: 'score_drop',
      severity: scoreDiff < -15 ? 'critical' : 'warning',
      title: `SEO Score Dropped by ${Math.abs(Math.round(scoreDiff))} Points`,
      message: `Your site's average SEO score dropped from ${previous.avgScore} to ${current.avgScore}. Review recent changes for potential issues.`,
      data: { previousScore: previous.avgScore, currentScore: current.avgScore, change: scoreDiff },
    }));
  }

  // New critical issues
  const prevCritical = Object.values(previous.issuesByType || {}).reduce((sum, v) => sum + (v.critical || 0), 0);
  const currCritical = Object.values(current.issuesByType || {}).reduce((sum, v) => sum + (v.critical || 0), 0);
  if (currCritical > prevCritical) {
    alerts.push(await Alert.create({
      projectId,
      type: 'new_issue',
      severity: 'critical',
      title: `${currCritical - prevCritical} New Critical Issue(s) Detected`,
      message: `Critical issues increased from ${prevCritical} to ${currCritical}. Immediate attention recommended.`,
      data: { previousCount: prevCritical, currentCount: currCritical },
    }));
  }

  // Crawl complete notification
  alerts.push(await Alert.create({
    projectId,
    type: 'crawl_complete',
    severity: 'info',
    title: 'Site Audit Completed',
    message: `Crawled ${current.totalPages} pages. Average score: ${current.avgScore}.`,
    data: { totalPages: current.totalPages, avgScore: current.avgScore },
  }));

  // Email anything worth acting on (info-level stays in-app only)
  const urgent = alerts.filter(a => a.severity !== 'info');
  if (urgent.length > 0) {
    const project = await Project.findById(projectId);
    const body = urgent.map(a => `[${a.severity.toUpperCase()}] ${a.title}\n${a.message}`).join('\n\n');
    sendMail(`SEO Alert — ${project?.domain || projectId}: ${urgent[0].title}`, body);
  }

  return alerts;
}

// Generate plain-text report for email/display
function formatReportText(report, projectName) {
  const d = report.data;
  let text = '';

  text += `=== SEO Report: ${projectName} ===\n`;
  text += `Generated: ${new Date(report.generatedAt).toLocaleDateString()}\n`;
  text += `Period: ${new Date(report.period.start).toLocaleDateString()} - ${new Date(report.period.end).toLocaleDateString()}\n\n`;

  text += `OVERVIEW\n`;
  text += `  Overall Score: ${d.overallScore}/100`;
  if (d.scoreChange !== 0) text += ` (${d.scoreChange > 0 ? '+' : ''}${d.scoreChange})`;
  text += `\n`;
  text += `  Pages Audited: ${d.totalPages}\n\n`;

  text += `ISSUES\n`;
  text += `  Critical: ${d.issuesSummary.critical}\n`;
  text += `  Warning: ${d.issuesSummary.warning}\n`;
  text += `  Info: ${d.issuesSummary.info}\n\n`;

  if (d.topIssues.length > 0) {
    text += `TOP ISSUES\n`;
    for (const issue of d.topIssues.slice(0, 5)) {
      text += `  - ${issue.type.replace(/_/g, ' ')}: ${issue.count} occurrence(s) [${issue.severity}]\n`;
    }
    text += '\n';
  }

  text += `BEST PAGES\n`;
  for (const p of d.bestPages) {
    text += `  ${p.score}/100 — ${p.url}\n`;
  }
  text += '\n';

  text += `PAGES NEEDING ATTENTION\n`;
  for (const p of d.worstPages) {
    text += `  ${p.score}/100 — ${p.url}\n`;
  }
  text += '\n';

  text += `CONTENT\n`;
  text += `  Average Word Count: ${d.contentStats.avgWordCount}\n`;
  text += `  Thin Pages (<300 words): ${d.contentStats.pagesBelow300}\n\n`;

  text += `RECOMMENDATIONS\n`;
  for (const rec of d.recommendations) {
    text += `  * ${rec}\n`;
  }

  return text;
}

module.exports = { generateReport, checkAlerts, formatReportText };
