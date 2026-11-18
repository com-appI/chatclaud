'use strict';
/**
 * Strict text-provider router: NVIDIA Nemotron only.
 * Groq is deliberately excluded from text fallback; it is used by separate
 * server-side capabilities such as Vision and transcription.
 */
const { getProviderConfig, nvidiaConfigured } = require('./config');
const { nvidiaChat, nvidiaStream } = require('./nvidia');

function isRetryable(err) {
  if (!err) return false;
  const status = err.status || err.statusCode;
  if (status === 401 || status === 403) return false;
  if (status === 404) return true;
  if (status === 429 || status === 500 || status === 502 || status === 503) return true;
  return /timeout|ECONN|network|fetch failed|aborted|overloaded|capacity|empty/i.test(String(err.message || err));
}

function createRouter() {
  async function chat(messages, system, reasoning, requestOptions) {
    const cfg = getProviderConfig();
    const opts = requestOptions || {};
    const result = await nvidiaChat(messages, system, {
      temperature: opts.temperature,
      max_tokens: opts.maxCompletionTokens || opts.max_tokens,
      timeoutMs: opts.timeoutMs,
      enableThinking: reasoning || cfg.nvidia.enableThinking,
      model: opts.model,
    });
    return {
      text: result.text,
      provider: 'nvidia',
      model: result.model,
      usage: result.usage,
      usedFallback: false,
    };
  }

  async function* stream(messages, system, reasoning, requestOptions) {
    const cfg = getProviderConfig();
    const opts = requestOptions || {};
    let yieldedText = false;
    for await (const chunk of nvidiaStream(messages, system, {
      temperature: opts.temperature,
      max_tokens: opts.maxCompletionTokens || opts.max_tokens,
      timeoutMs: opts.timeoutMs,
      signal: opts.signal,
      enableThinking: reasoning || cfg.nvidia.enableThinking,
      model: opts.model,
      // reasoning_content is deliberately never forwarded to consumers.
    })) {
      if (chunk && typeof chunk.delta === 'string' && chunk.delta) yieldedText = true;
      if (chunk && typeof chunk.delta === 'string') yield chunk;
    }
    if (!yieldedText) throw new Error('nvidia_empty_stream');
  }

  function modelInfo() {
    const cfg = getProviderConfig();
    return {
      provider: 'nvidia',
      model: cfg.nvidia.model,
      configured: nvidiaConfigured(),
      fallback: null,
      fallbackEnabled: false,
    };
  }

  return { chat, stream, modelInfo, isRetryable };
}

module.exports = { createRouter, isRetryable };
