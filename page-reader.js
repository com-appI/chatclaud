'use strict';
/**
 * Bounded page reader: fetch URL → extract readable text.
 * No login bypass, no CAPTCHA solving, no infinite redirects.
 */
const { URL } = require('url');

function isSafeHttpUrl(raw) {
  try {
    const u = new URL(String(raw || '').trim());
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    const host = u.hostname.toLowerCase();
    if (!host || host === 'localhost' || host.endsWith('.local')) return false;
    if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.|::1)/.test(host)) return false;
    return true;
  } catch (e) {
    return false;
  }
}

function stripHtml(html) {
  let s = String(html || '');
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  // prefer main/article if present
  const main = s.match(/<main[\s\S]*?<\/main>/i) || s.match(/<article[\s\S]*?<\/article>/i);
  if (main) s = main[0];
  s = s.replace(/<[^>]+>/g, ' ');
  s = s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function extractTitle(html) {
  const m = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, ' ').trim().slice(0, 220) : '';
}

async function fetchPage(url, options) {
  const opts = options || {};
  const maxLength = Math.max(1000, Math.min(24000, Number(opts.maxLength) || 12000));
  const timeoutMs = Math.max(3000, Math.min(25000, Number(opts.timeoutMs) || 12000));
  if (!isSafeHttpUrl(url)) {
    return { ok: false, error: 'unsafe_url', url: String(url || '') };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'error', // no automatic redirect chain
      signal: controller.signal,
      headers: {
        'User-Agent': 'ChatClaudReader/3.36 (+https://github.com/com-appi/chatclaud; research; respectful)',
        'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
      },
    });
    if (!res.ok) {
      return { ok: false, error: 'http_' + res.status, url, status: res.status };
    }
    const ctype = String(res.headers.get('content-type') || '');
    if (!/text\/html|text\/plain|application\/xhtml/i.test(ctype) && ctype) {
      return { ok: false, error: 'unsupported_content_type', url, contentType: ctype };
    }
    const raw = await res.text();
    const title = extractTitle(raw);
    const text = stripHtml(raw).slice(0, maxLength);
    return {
      ok: true,
      type: 'page',
      url,
      title,
      text,
      fullLength: text.length,
      truncated: stripHtml(raw).length > maxLength,
      source: 'PAGE_READER',
      retrievedAt: new Date().toISOString(),
    };
  } catch (e) {
    const msg = e && e.name === 'AbortError' ? 'timeout' : String(e && e.message || e);
    return { ok: false, error: msg, url };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchPage, isSafeHttpUrl, stripHtml, extractTitle };
