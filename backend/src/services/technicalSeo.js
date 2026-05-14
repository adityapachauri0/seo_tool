const axios = require('axios');

// Check HTTP status of URLs (broken link detection)
async function checkLinks(urls, concurrency = 10) {
  const results = [];
  const semaphore = { active: 0 };

  const checkUrl = async (url) => {
    while (semaphore.active >= concurrency) {
      await new Promise(r => setTimeout(r, 100));
    }
    semaphore.active++;

    try {
      const res = await axios.head(url, {
        timeout: 10000,
        maxRedirects: 5,
        validateStatus: () => true,
      });
      results.push({
        url,
        status: res.status,
        ok: res.status >= 200 && res.status < 400,
        redirected: res.request?._redirectable?._redirectCount > 0,
      });
    } catch (err) {
      results.push({ url, status: 0, ok: false, error: err.code || err.message });
    } finally {
      semaphore.active--;
    }
  };

  await Promise.all(urls.map(u => checkUrl(u)));
  return results;
}

// Generate JSON-LD schema markup suggestions
function generateSchemaMarkup(pageData) {
  const schemas = [];
  const url = pageData.url || '';
  const title = pageData.meta?.title?.value || '';
  const description = pageData.meta?.description?.value || '';

  // WebPage schema (always)
  schemas.push({
    type: 'WebPage',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: title,
      description,
      url,
    },
  });

  // FAQ schema if page has question-like headings
  const allHeadings = [
    ...(pageData.headings?.h2 || []),
    ...(pageData.headings?.h3 || []),
  ];
  const questions = allHeadings.filter(
    h => /\?$/.test(h.trim()) || /^(how|what|why|when|where|can|do|does|is|are|should)\s/i.test(h)
  );

  if (questions.length >= 2) {
    schemas.push({
      type: 'FAQPage',
      schema: {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: questions.map(q => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: '[Answer text here]',
          },
        })),
      },
    });
  }

  // Article schema if content is substantial
  if ((pageData.content?.wordCount || 0) > 500) {
    schemas.push({
      type: 'Article',
      schema: {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: title,
        description,
        url,
        author: { '@type': 'Organization', name: '[Your Organization]' },
        datePublished: new Date().toISOString().split('T')[0],
        dateModified: new Date().toISOString().split('T')[0],
      },
    });
  }

  // BreadcrumbList from URL path
  const urlParts = url.replace(/^https?:\/\/[^/]+/, '').split('/').filter(Boolean);
  if (urlParts.length > 0) {
    const domain = url.match(/^https?:\/\/[^/]+/)?.[0] || '';
    schemas.push({
      type: 'BreadcrumbList',
      schema: {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: domain },
          ...urlParts.map((part, i) => ({
            '@type': 'ListItem',
            position: i + 2,
            name: part.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            item: `${domain}/${urlParts.slice(0, i + 1).join('/')}`,
          })),
        ],
      },
    });
  }

  // LocalBusiness schema suggestion if it looks like a local business page
  if (/\b(contact|location|address|directions|hours|phone)\b/i.test(title + ' ' + allHeadings.join(' '))) {
    schemas.push({
      type: 'LocalBusiness',
      schema: {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name: '[Business Name]',
        url,
        telephone: '[Phone]',
        address: {
          '@type': 'PostalAddress',
          streetAddress: '[Street]',
          addressLocality: '[City]',
          addressRegion: '[State/Region]',
          postalCode: '[Postal Code]',
          addressCountry: '[Country]',
        },
      },
    });
  }

  return schemas;
}

// Generate XML sitemap
function generateSitemap(audits, domain, protocol = 'https') {
  const urls = audits.map(a => ({
    loc: a.url,
    lastmod: a.crawledAt
      ? new Date(a.crawledAt).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    changefreq:
      a.url === `${protocol}://${domain}` || a.url === `${protocol}://${domain}/`
        ? 'daily'
        : 'weekly',
    priority:
      a.url === `${protocol}://${domain}` || a.url === `${protocol}://${domain}/`
        ? '1.0'
        : '0.8',
  }));

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  for (const url of urls) {
    xml += '  <url>\n';
    xml += `    <loc>${url.loc}</loc>\n`;
    xml += `    <lastmod>${url.lastmod}</lastmod>\n`;
    xml += `    <changefreq>${url.changefreq}</changefreq>\n`;
    xml += `    <priority>${url.priority}</priority>\n`;
    xml += '  </url>\n';
  }
  xml += '</urlset>';
  return xml;
}

// Detect redirect chains
async function checkRedirects(urls) {
  const results = [];

  for (const url of urls) {
    try {
      const chain = [];
      let currentUrl = url;
      let maxHops = 10;

      while (maxHops-- > 0) {
        const res = await axios
          .get(currentUrl, {
            maxRedirects: 0,
            validateStatus: s => s >= 200 && s < 400,
            timeout: 10000,
          })
          .catch(err => {
            if (err.response && [301, 302, 303, 307, 308].includes(err.response.status)) {
              return err.response;
            }
            throw err;
          });

        chain.push({ url: currentUrl, status: res.status });

        if ([301, 302, 303, 307, 308].includes(res.status) && res.headers.location) {
          currentUrl = new URL(res.headers.location, currentUrl).href;
        } else {
          break;
        }
      }

      if (chain.length > 2) {
        results.push({ originalUrl: url, chain, hops: chain.length - 1, issue: 'redirect_chain' });
      } else if (chain.length === 2) {
        results.push({ originalUrl: url, chain, hops: 1, issue: 'redirect' });
      }
    } catch (err) {
      results.push({ originalUrl: url, error: err.message, issue: 'error' });
    }
  }

  return results;
}

// Find orphan pages (pages with no internal links pointing to them)
function findOrphanPages(audits) {
  const linkedTo = new Set();
  const allUrls = new Set();

  for (const audit of audits) {
    allUrls.add(audit.url);
    const internalLinks = audit.links?.internal || [];
    for (const link of internalLinks) {
      linkedTo.add(link.url || link.href);
    }
  }

  const orphans = [];
  for (const url of allUrls) {
    if (!linkedTo.has(url) && !linkedTo.has(url + '/') && !linkedTo.has(url.replace(/\/$/, ''))) {
      try {
        const path = new URL(url).pathname;
        if (path !== '/' && path !== '') {
          orphans.push(url);
        }
      } catch {
        continue;
      }
    }
  }

  return orphans;
}

// Find duplicate/near-duplicate title tags
function findDuplicateTitles(audits) {
  const titleMap = {};
  for (const audit of audits) {
    const title = audit.meta?.title?.value?.toLowerCase()?.trim();
    if (!title) continue;
    if (!titleMap[title]) titleMap[title] = [];
    titleMap[title].push(audit.url);
  }

  return Object.entries(titleMap)
    .filter(([_, urls]) => urls.length > 1)
    .map(([title, urls]) => ({ title, urls, count: urls.length }));
}

// Find duplicate meta descriptions
function findDuplicateDescriptions(audits) {
  const descMap = {};
  for (const audit of audits) {
    const desc = audit.meta?.description?.value?.toLowerCase()?.trim();
    if (!desc) continue;
    if (!descMap[desc]) descMap[desc] = [];
    descMap[desc].push(audit.url);
  }

  return Object.entries(descMap)
    .filter(([_, urls]) => urls.length > 1)
    .map(([description, urls]) => ({
      description: description.substring(0, 100) + '...',
      urls,
      count: urls.length,
    }));
}

module.exports = {
  checkLinks,
  generateSchemaMarkup,
  generateSitemap,
  checkRedirects,
  findOrphanPages,
  findDuplicateTitles,
  findDuplicateDescriptions,
};
