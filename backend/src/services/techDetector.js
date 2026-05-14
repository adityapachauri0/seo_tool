/**
 * Detects technology stack from HTML content and HTTP headers.
 * @param {string} html - The raw HTML of the page
 * @param {object} headers - HTTP response headers (lowercase keys)
 * @returns {object} Detected technologies keyed by category
 */
async function detectTechStack(html, headers = {}) {
  const tech = {};
  const lowerHtml = html.toLowerCase();

  // CMS detection
  if (lowerHtml.includes('wp-content') || lowerHtml.includes('wp-includes') || lowerHtml.includes('wordpress')) {
    tech.cms = 'WordPress';
  } else if (lowerHtml.includes('__next') || lowerHtml.includes('_next/static')) {
    tech.cms = 'Next.js';
  } else if (lowerHtml.includes('shopify') || lowerHtml.includes('cdn.shopify.com')) {
    tech.cms = 'Shopify';
  } else if (lowerHtml.includes('squarespace')) {
    tech.cms = 'Squarespace';
  } else if (lowerHtml.includes('wix.com') || lowerHtml.includes('wixstatic.com')) {
    tech.cms = 'Wix';
  }

  // JS Frameworks
  if (lowerHtml.includes('__next_data__') || lowerHtml.includes('_next/')) {
    tech.framework = 'React';
  } else if (lowerHtml.includes('react') && (lowerHtml.includes('react-dom') || lowerHtml.includes('react.production'))) {
    tech.framework = 'React';
  } else if (lowerHtml.includes('__vue__') || lowerHtml.includes('vue.js') || lowerHtml.includes('vue.min.js')) {
    tech.framework = 'Vue';
  } else if (lowerHtml.includes('ng-version') || lowerHtml.includes('angular')) {
    tech.framework = 'Angular';
  }

  // CSS Frameworks
  if (lowerHtml.includes('tailwindcss') || lowerHtml.includes('tailwind') || lowerHtml.includes('tw-')) {
    tech.css = 'Tailwind';
  } else if (lowerHtml.includes('bootstrap') || lowerHtml.includes('bootstrap.min')) {
    tech.css = 'Bootstrap';
  }

  // Analytics
  if (lowerHtml.includes('gtag') || lowerHtml.includes('google-analytics') || lowerHtml.includes('ga4') || lowerHtml.includes('googletagmanager.com/gtag')) {
    tech.analytics = 'Google Analytics';
  }

  // Tag Manager
  if (lowerHtml.includes('gtm.js') || lowerHtml.includes('googletagmanager.com/gtm')) {
    tech.tagManager = 'GTM';
  }

  // Heatmaps
  if (lowerHtml.includes('hotjar')) {
    tech.heatmap = 'Hotjar';
  } else if (lowerHtml.includes('clarity.ms')) {
    tech.heatmap = 'Microsoft Clarity';
  }

  // Schema markup
  if (lowerHtml.includes('application/ld+json')) {
    tech.schema = true;
  }

  // CDN detection
  const serverHeader = (headers['server'] || '').toLowerCase();
  if (lowerHtml.includes('cloudflare') || serverHeader.includes('cloudflare')) {
    tech.cdn = 'Cloudflare';
  } else if (lowerHtml.includes('fastly') || serverHeader.includes('fastly')) {
    tech.cdn = 'Fastly';
  } else if (lowerHtml.includes('akamai') || serverHeader.includes('akamai')) {
    tech.cdn = 'Akamai';
  }

  // jQuery
  if (lowerHtml.includes('jquery') || lowerHtml.includes('jquery.min.js')) {
    tech.jquery = true;
  }

  return tech;
}

module.exports = { detectTechStack };
