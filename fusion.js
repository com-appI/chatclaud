'use strict';
const net = require('node:net');

function isPrivateIp(address) {
  const ip = String(address || '').toLowerCase().replace(/^\[|\]$/g, '');
  const family = net.isIP(ip);
  if (family === 4) {
    const octets = ip.split('.').map(Number);
    const [a, b, c] = octets;
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) || (a === 192 && b === 0 && c === 0) ||
      (a === 192 && b === 0 && c === 2) || (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113) ||
      a >= 224;
  }
  if (family === 6) {
    if (ip === '::' || ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') ||
        ip.startsWith('fe8') || ip.startsWith('fe9') || ip.startsWith('fea') || ip.startsWith('feb') ||
        ip.startsWith('ff') || ip.startsWith('2001:db8:')) return true;
    const mapped = ip.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    if (mapped) return isPrivateIp(mapped[1]);
    const mappedHex = ip.match(/::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
    if (mappedHex) {
      const value = (parseInt(mappedHex[1], 16) * 0x10000) + parseInt(mappedHex[2], 16);
      const ipv4 = [value >>> 24, (value >>> 16) & 255, (value >>> 8) & 255, value & 255].join('.');
      return isPrivateIp(ipv4);
    }
    // 6to4 and NAT64 can encode IPv4 destinations inside IPv6 addresses.
    if (ip.startsWith('2002:') || ip.startsWith('64:ff9b:')) return true;
  }
  return false;
}

function canonicalizeUrl(raw) {
  try {
    const u = new URL(String(raw || '').trim());
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) return '';
    const hostname = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') ||
        hostname.endsWith('.local') || hostname.endsWith('.internal') || isPrivateIp(hostname)) return '';
    u.hash = '';
    u.hostname = hostname;
    if ((u.protocol === 'http:' && u.port === '80') || (u.protocol === 'https:' && u.port === '443')) u.port = '';
    for (const key of [...u.searchParams.keys()]) {
      if (/^(utm_.+|fbclid|gclid|dclid|msclkid|twclid|igshid|mc_cid|mc_eid|ref_src|ref_url|ref|referrer|source|campaign|_ga|_gid|_gac|_gl|pk_campaign|pk_kwd|hsCtaTracking|hsa_.+)$/i.test(key)) u.searchParams.delete(key);
    }
    if (u.hostname.startsWith('www.')) u.hostname = u.hostname.slice(4);
    u.pathname = u.pathname.replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/';
    return u.toString();
  } catch (e) {
    return '';
  }
}

function domainOf(url) {
  try { return new URL(canonicalizeUrl(url)).hostname.toLowerCase(); }
  catch (e) { return ''; }
}

function isDomainOrSubdomain(domain, base) {
  return domain === base || domain.endsWith('.' + base);
}

function domainTrust(domain) {
  const d = String(domain || '').toLowerCase().replace(/^www\./, '');
  if (!d) return 0;
  if (/(?:^|\.)gov$|(?:^|\.)edu$/.test(d)) return 0.00005;
  const trusted = ['github.com', 'wikipedia.org', 'nodejs.org', 'python.org', 'mozilla.org'];
  if (trusted.some((base) => isDomainOrSubdomain(d, base))) return 0.00003;
  const low = ['medium.com', 'blogspot.com', 'reddit.com'];
  if (low.some((base) => isDomainOrSubdomain(d, base))) return -0.00001;
  return 0;
}

function reciprocalRankFusion(lists, options) {
  const k = Math.max(1, Math.min(200, Number(options && options.k) || 60));
  const map = new Map();
  (lists || []).forEach((list) => {
    (list || []).forEach((item, idx) => {
      if (!item || typeof item !== 'object') return;
      const url = canonicalizeUrl(item.url || item.link || item.href);
      if (!url) return;
      const rank = Math.max(1, Number(item.rank || item.position || idx + 1) || idx + 1);
      const contribution = 1 / (k + rank);
      const previous = map.get(url) || { url, title: '', snippet: '', providers: [], score: 0, domain: domainOf(url), ranks: [] };
      previous.score += contribution;
      previous.ranks.push(rank);
      if (item.provider && !previous.providers.includes(String(item.provider))) previous.providers.push(String(item.provider));
      if (!previous.title && item.title) previous.title = String(item.title).slice(0, 220);
      const snippet = String(item.snippet || item.content || item.description || '').slice(0, 1400);
      if (snippet.length > previous.snippet.length) previous.snippet = snippet;
      map.set(url, previous);
    });
  });
  return Array.from(map.values()).map((item) => {
    item.score += domainTrust(item.domain);
    item.ranks.sort((a, b) => a - b);
    return item;
  }).sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));
}

function dedupeByUrl(items) {
  const seen = new Set();
  const out = [];
  for (const item of items || []) {
    const url = canonicalizeUrl(item && item.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(Object.assign({}, item, { url }));
  }
  return out;
}

module.exports = { canonicalizeUrl, domainOf, domainTrust, reciprocalRankFusion, dedupeByUrl, isPrivateIp, isDomainOrSubdomain };
