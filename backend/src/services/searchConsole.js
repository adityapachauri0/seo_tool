/**
 * Google Search Console data fetcher.
 * Uses a service account for authentication.
 */

const { google } = require('googleapis');
const path = require('path');

let searchConsole = null;

function getClient() {
  if (searchConsole) return searchConsole;

  const keyPath = process.env.GOOGLE_SA_KEY_PATH || path.join(process.env.HOME, '.config/gcp/sheets-sa.json');

  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: keyPath,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });

    searchConsole = google.searchconsole({ version: 'v1', auth });
    return searchConsole;
  } catch (err) {
    console.error('[GSC] Failed to initialize:', err.message);
    return null;
  }
}

async function fetchSearchAnalytics(siteUrl, options = {}) {
  const client = getClient();
  if (!client) return { rows: [], error: 'Search Console not configured' };

  const {
    startDate = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dimensions = ['query', 'page'],
    rowLimit = 1000,
  } = options;

  try {
    const res = await client.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions,
        rowLimit,
        dataState: 'final',
      },
    });

    return { rows: res.data.rows || [] };
  } catch (err) {
    console.error('[GSC] Query failed:', err.message);
    return { rows: [], error: err.message };
  }
}

async function getSiteList() {
  const client = getClient();
  if (!client) return [];

  try {
    const res = await client.sites.list();
    return (res.data.siteEntry || []).map(s => ({
      siteUrl: s.siteUrl,
      permissionLevel: s.permissionLevel,
    }));
  } catch (err) {
    console.error('[GSC] Site list failed:', err.message);
    return [];
  }
}

module.exports = { fetchSearchAnalytics, getSiteList };
