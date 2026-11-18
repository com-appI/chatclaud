'use strict';
/**
 * NVIDIA Integrate API (OpenAI-compatible) — Nemotron 3 Ultra.
 * Auth: NVIDIA_API_KEY only from env.
 */
const { getProviderConfig } = require('./config');

async function nvidiaChat(messages, system, options) {
  const cfg = getProviderConfig().nvidia;
  if (!cfg.apiKey) {
    const err = new Error('NVIDIA_API_KEY is not configured');
    err.code = 'NVIDIA_NOT_CONFIGURED';
    throw err;
  }
  const opts = options || {};
  const model = opts.model || cfg.model;
  const msgs = [];
  if (system) msgs.push({ role: 'system', content: String(system).slice(0, 12000) });
  for (const m of messages || []) {
    if (!m || !m.role) continue;
    msgs.push({ role: m.role, content: String(m.content || '').slice(0, 50000) });
  }
  const body = {
    model,
    messages: msgs,
    temperature: Number.isFinite(opts.temperature) ? opts.temperature : 0.6,
    top_p: Number.isFinite(opts.top_p) ? opts.top_p : 0.95,
    max_tokens: Math.max(256, Math.min(cfg.maxTokens, Number(opts.max_tokens) || cfg.maxTokens)),
    stream: false,
  };
  if (cfg.enableThinking && opts.enableThinking !== false) {
    body.chat_template_kwargs = { enable_thinking: true };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs || cfg.timeoutMs);
  try {
    const res = await fetch(cfg.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + cfg.apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (data.error && (data.error.message || data.error)) || ('nvidia_http_' + res.status);
      const err = new Error(String(msg).slice(0, 300));
      err.status = res.status;
      err.code = res.status === 429 ? 'RATE_LIMIT' : 'NVIDIA_HTTP';
      throw err;
    }
    const choice = data.choices && data.choices[0];
    const message = choice && choice.message;
    let text = message && message.content != null ? String(message.content) : '';
    // Only the final assistant content is user-visible. Never fall back to reasoning_content.
    if (!text || !String(text).trim()) {
      throw new Error('nvidia_empty_response');
    }
    return {
      text: String(text).trim(),
      provider: 'nvidia',
      model,
      usage: data.usage || null,
      raw: data,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function* nvidiaStream(messages, system, options) {
  const cfg = getProviderConfig().nvidia;
  if (!cfg.apiKey) {
    const err = new Error('NVIDIA_API_KEY is not configured');
    err.code = 'NVIDIA_NOT_CONFIGURED';
    throw err;
  }
  const opts = options || {};
  const model = opts.model || cfg.model;
  const msgs = [];
  if (system) msgs.push({ role: 'system', content: String(system).slice(0, 12000) });
  for (const m of messages || []) {
    if (!m || !m.role) continue;
    msgs.push({ role: m.role, content: String(m.content || '').slice(0, 50000) });
  }
  const body = {
    model,
    messages: msgs,
    temperature: Number.isFinite(opts.temperature) ? opts.temperature : 0.6,
    top_p: 0.95,
    max_tokens: Math.max(256, Math.min(cfg.maxTokens, Number(opts.max_tokens) || cfg.maxTokens)),
    stream: true,
  };
  if (cfg.enableThinking && opts.enableThinking !== false) {
    body.chat_template_kwargs = { enable_thinking: true };
  }

  const controller = new AbortController();
  const external = opts.signal;
  let parentAbort = null;
  if (external && external.addEventListener) {
    if (external.aborted) throw Object.assign(new Error('stream_cancelled'), { code: 'PROVIDER_CANCELLED' });
    parentAbort = () => controller.abort();
    external.addEventListener('abort', parentAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs || cfg.timeoutMs);
  try {
    const res = await fetch(cfg.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + cfg.apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const msg = (data.error && (data.error.message || data.error)) || ('nvidia_http_' + res.status);
      const err = new Error(String(msg).slice(0, 300));
      err.status = res.status;
      throw err;
    }
    if (!res.body || !res.body.getReader) {
      // non-stream fallback
      const data = await res.json().catch(() => ({}));
      const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (text) yield { delta: String(text), model, provider: 'nvidia' };
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      buffer += decoder.decode(item.value, { stream: true });
      let boundary;
      while ((boundary = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, boundary).trim();
        buffer = buffer.slice(boundary + 1);
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') return;
        let parsed;
        try { parsed = JSON.parse(payload); } catch (e) { continue; }
        const deltaObj = parsed && parsed.choices && parsed.choices[0] && parsed.choices[0].delta;
        if (!deltaObj) continue;
        // Deliberately ignore reasoning_content; only final content may reach the UI.
        const delta = deltaObj.content;
        if (typeof delta === 'string' && delta) {
          yield { delta, model, provider: 'nvidia' };
        }
      }
    }
  } finally {
    clearTimeout(timer);
    if (external && parentAbort) external.removeEventListener('abort', parentAbort);
  }
}

module.exports = { nvidiaChat, nvidiaStream };
