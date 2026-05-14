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

  // Weekly report generation — every Monday at 4 AM
  cron.schedule('0 4 * * 1', async () => {
    console.log('[CRON] Generating weekly reports...');
    try {
      const { generateReport } = require('../services/reportGenerator');
      const projects = await Project.find({ status: 'active' });
      await Promise.allSettled(
        projects.map(project =>
          generateReport(project._id, 'weekly')
            .then(() => console.log(`[CRON] Report generated for ${project.domain}`))
            .catch(err => console.log(`[CRON] Report failed for ${project.domain}:`, err.message))
        )
      );
    } catch (err) {
      console.error('[CRON] Weekly report generation failed:', err.message);
    }
  });

  console.log('[CRON] Scheduler started — daily at 2:00 AM, weekly on Monday at 3:00 AM, reports on Monday at 4:00 AM');
}

module.exports = { startScheduler };
