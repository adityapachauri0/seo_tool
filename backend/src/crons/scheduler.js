const cron = require('node-cron');
const axios = require('axios');
const Project = require('../models/Project');

const CRAWLER_URL = process.env.CRAWLER_URL || 'http://localhost:4801';

async function triggerCrawl(project) {
  try {
    console.log(`[CRON] Triggering crawl for "${project.name}" (${project.domain})`);
    await axios.post(`${CRAWLER_URL}/crawl/site`, {
      url: `${project.protocol}://${project.domain}`,
      projectId: project._id,
    });
    console.log(`[CRON] Crawl triggered successfully for "${project.name}"`);
  } catch (err) {
    const message = err.code === 'ECONNREFUSED'
      ? 'Crawler service unavailable'
      : err.response?.data?.error || err.message;
    console.error(`[CRON] Failed to trigger crawl for "${project.name}": ${message}`);
  }
}

function startScheduler() {
  // Every day at 2:00 AM — daily crawls
  cron.schedule('0 2 * * *', async () => {
    console.log('[CRON] Running daily crawl job...');
    try {
      const projects = await Project.find({
        status: 'active',
        crawlFrequency: 'daily',
      });

      console.log(`[CRON] Found ${projects.length} project(s) for daily crawl`);

      await Promise.allSettled(
        projects.map(project =>
          axios.post(`${CRAWLER_URL}/crawl/site`, {
            url: `${project.protocol}://${project.domain}`,
            projectId: project._id,
          }).then(() => console.log(`[CRON] Crawl triggered successfully for "${project.name}"`))
            .catch(err => console.log(`[CRON] Failed to trigger crawl for ${project.domain}:`, err.message))
        )
      );
    } catch (err) {
      console.error('[CRON] Daily crawl job failed:', err.message);
    }
  });

  // Every Monday at 3:00 AM — weekly crawls
  cron.schedule('0 3 * * 1', async () => {
    console.log('[CRON] Running weekly crawl job...');
    try {
      const projects = await Project.find({
        status: 'active',
        crawlFrequency: 'weekly',
      });

      console.log(`[CRON] Found ${projects.length} project(s) for weekly crawl`);

      await Promise.allSettled(
        projects.map(project =>
          axios.post(`${CRAWLER_URL}/crawl/site`, {
            url: `${project.protocol}://${project.domain}`,
            projectId: project._id,
          }).then(() => console.log(`[CRON] Crawl triggered successfully for "${project.name}"`))
            .catch(err => console.log(`[CRON] Failed to trigger crawl for ${project.domain}:`, err.message))
        )
      );
    } catch (err) {
      console.error('[CRON] Weekly crawl job failed:', err.message);
    }
  });

  // Weekly report generation — every Monday at 4 AM, emailed as one digest
  cron.schedule('0 4 * * 1', async () => {
    console.log('[CRON] Generating weekly reports...');
    try {
      const { generateReport, formatReportText } = require('../services/reportGenerator');
      const { getOpportunities, formatOpportunitiesText } = require('../services/opportunities');
      const { sendMail } = require('../services/mailer');
      const projects = await Project.find({ status: 'active' });
      const sections = [];
      for (const project of projects) {
        try {
          const report = await generateReport(project._id, 'weekly');
          if (report) {
            let section = formatReportText(report, project.name);
            try {
              const opps = await getOpportunities(project._id);
              const oppsText = formatOpportunitiesText(opps, project.name);
              if (oppsText) section += '\n' + oppsText;
            } catch (err) {
              console.log(`[CRON] Opportunities failed for ${project.domain}:`, err.message);
            }
            try {
              const { formatLinkOppsText } = require('../services/linkOpportunities');
              const linkText = await formatLinkOppsText(project._id, project.name);
              if (linkText) section += '\n' + linkText;
            } catch (err) {
              console.log(`[CRON] Link opps digest failed for ${project.domain}:`, err.message);
            }
            sections.push(section);
          }
          console.log(`[CRON] Report generated for ${project.domain}`);
        } catch (err) {
          console.log(`[CRON] Report failed for ${project.domain}:`, err.message);
        }
      }
      if (sections.length > 0) {
        await sendMail(
          `Weekly SEO Report — ${sections.length} site(s)`,
          sections.join('\n\n' + '='.repeat(60) + '\n\n')
        );
      }
    } catch (err) {
      console.error('[CRON] Weekly report generation failed:', err.message);
    }
  });

  // Weekly off-page sweep — Monday 3:30 AM, before reports go out at 4 AM
  cron.schedule('30 3 * * 1', async () => {
    console.log('[CRON] Running off-page link sweep...');
    try {
      const { sweepProject } = require('../services/linkOpportunities');
      const projects = await Project.find({ status: 'active' });
      for (const project of projects) {
        try {
          await sweepProject(project);
        } catch (err) {
          console.log(`[CRON] Link sweep failed for ${project.domain}:`, err.message);
        }
      }
    } catch (err) {
      console.error('[CRON] Link sweep job failed:', err.message);
    }
  });

  // Daily GSC rank sync — every day at 5 AM (GSC data lags ~2 days)
  cron.schedule('0 5 * * *', async () => {
    console.log('[CRON] Syncing GSC rank history...');
    try {
      const { syncAllRanks } = require('../services/rankTracker');
      const projects = await Project.find({ status: 'active' });
      await syncAllRanks(projects);
    } catch (err) {
      console.error('[CRON] Rank sync failed:', err.message);
    }
  });

  console.log('[CRON] Scheduler started — crawls daily 2 AM / Mon 3 AM, reports Mon 4 AM, rank sync daily 5 AM');
}

module.exports = { startScheduler };
