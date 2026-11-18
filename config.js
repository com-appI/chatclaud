'use strict';
/**
 * Provider configuration — NVIDIA Nemotron is the only text-chat provider; Groq is reserved for separate capabilities.
 * Keys only from environment. Never hardcode secrets.
 */

function env(name, fallback) {
  const v = process.env[name];
  return v == null || v === '' ? fallback : String(v);
}

function boolEnv(name, defaultValue) {
  const v = process.env[name];
  if (v == null || v === '') return defaultValue;
  return /^(1|true|yes|on)$/i.test(String(v));
}

function getProviderConfig() {
  // Nemotron is the sole text-chat provider. Legacy PRIMARY_PROVIDER and
  // AUTO_FALLBACK variables are intentionally ignored to prevent silent Groq failover.
  return {
    primary: 'nvidia',
    fallbackEnabled: false,
    nvidia: {
      baseUrl: env('NVIDIA_BASE_URL', 'https://integrate.api.nvidia.com/v1').replace(/\/$/, ''),
      apiKey: env('NVIDIA_API_KEY', ''),
      model: env('NVIDIA_MODEL', 'nvidia/nemotron-3-ultra-550b-a55b'),
      enableThinking: boolEnv('NVIDIA_ENABLE_THINKING', true),
      timeoutMs: Math.max(5000, Math.min(180000, Number(env('NVIDIA_TIMEOUT_MS', '90000')) || 90000)),
      maxTokens: Math.max(256, Math.min(16384, Number(env('NVIDIA_MAX_TOKENS', '8192')) || 8192)),
    },
    groq: {
      baseUrl: 'https://api.groq.com/openai/v1',
      model: env('GROQ_MODEL', 'openai/gpt-oss-120b'),
    },
    modules: {
      knowledge: boolEnv('MODULE_KNOWLEDGE', false),
      selfImprove: boolEnv('MODULE_SELF_IMPROVE', false),
      verifier: boolEnv('MODULE_VERIFIER', true),
      webSearch: boolEnv('MODULE_WEB_SEARCH', true),
      memory: boolEnv('MODULE_MEMORY', true),
      streaming: boolEnv('MODULE_STREAMING', true),
      chal: boolEnv('MODULE_CHAL', false),
      agentV2: boolEnv('MODULE_AGENT_V2', true),
    },
  };
}

function nvidiaConfigured() {
  return !!getProviderConfig().nvidia.apiKey;
}

function moduleEnabled(name) {
  const m = getProviderConfig().modules;
  return m[name] !== false;
}

module.exports = { getProviderConfig, nvidiaConfigured, moduleEnabled, boolEnv, env };
