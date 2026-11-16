'use strict';

const GREETING = /^(?:привет|здравствуй(?:те)?|хай|hi|hello|hey|как дела|thanks|thank you|спасибо|пока|ок(?:ей)?)[\s!.?]*$/i;
const ARITHMETIC = /^\s*[\d(][\d\s+\-*/×÷().^%]*\s*$/;

function clean(value) {
  return String(value || '').normalize('NFKC').replace(/ё/gi, 'е').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

function has(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function detectSearchIntent(text, context) {
  const q = clean(text);
  const lower = q.toLowerCase();
  const previous = context && Array.isArray(context.previousUserMessages)
    ? context.previousUserMessages.map(clean).filter(Boolean).slice(-6)
    : [];

  if (!q) return { needSearch: false, reason: 'empty', mode: null, confidence: 1 };
  if (GREETING.test(q)) return { needSearch: false, reason: 'greeting', mode: null, confidence: 0.98 };
  if (ARITHMETIC.test(q) && /[+\-*/×÷^%]/.test(q)) {
    return { needSearch: false, reason: 'arithmetic', mode: null, confidence: 0.98 };
  }

  if (previous.length) {
    const previousQuery = previous[previous.length - 1];
    const previousRoute = detectSearchIntent(previousQuery, { previousUserMessages: previous.slice(0, -1) });
    const followUp = /^(?:а\s+)?(?:что\s+изменилось|какие\s+изменения|по\s+сравнению|а\s+если|а\s+насчет|и\s+что|what\s+about|and\s+what|how\s+about|what\s+changed|что|как|почему)(?=$|[\s?!.,])/i.test(q);
    if (previousRoute.needSearch && followUp) {
      return { needSearch: true, reason: 'follow_up', mode: previousRoute.mode || 'DEEP_RESEARCH', confidence: 0.78, expandFrom: previousQuery };
    }
  }

  const mode =
    has(lower, [/\b(compare|comparison|versus|vs\.?|which is better)\b/i, /сравни|сравнение|что лучше|разниц[ауе]/i]) ? 'COMPARISON' :
    has(lower, [/\b(fact[ -]?check|verify|is it true|true or false)\b/i, /проверь|правда ли|это правда|подтверди|факт.?чек/i]) ? 'FACT_CHECK' :
    has(lower, [/\b(official|documentation|api reference|docs)\b/i, /официальн|документац|справочник api/i]) ? 'OFFICIAL_SOURCE' :
    has(lower, [/\b(deep research|research|academic|scientific|literature review)\b/i, /исследуй|глубок(ое|ое) исследован|научн(ое|ый) обзор/i]) ? 'DEEP_RESEARCH' :
    has(lower, [/\b(latest|breaking|news|current version|recent updates)\b/i, /последн|новост|свеж|текущая версия|актуальн/i]) ? 'LATEST' :
    has(lower, [/\b(today|tonight|right now|currently|this week|this month|price|cost|exchange rate|stock price)\b/i, /сегодня|сейчас|на этой неделе|в этом месяце|цена|стоимость|курс|котировк/i]) ? 'LATEST' :
    has(lower, [/\b(search|find|look up|google|browse|search the web)\b/i, /найди|поищи|загугли|погугли|в интернете|посмотри в сети|ищи в сети/i]) ? 'FAST_LOOKUP' :
    has(lower, [/\b(what is|who is|where is|when did|define|definition|tell me about)\b/i, /что такое|кто такой|кто такая|где находится|когда произош|расскажи про|информация о/i]) ? 'FAST_LOOKUP' :
    null;

  if (mode) {
    const explicit = has(lower, [/\b(search|find|look up|google|browse)\b/i, /найди|поищи|загугли|погугли|в интернете/i]);
    const freshness = mode === 'LATEST';
    return {
      needSearch: true,
      reason: explicit ? 'explicit' : (freshness ? 'freshness' : (mode === 'FACT_CHECK' ? 'fact_check' : 'informational')),
      mode,
      confidence: explicit ? 0.97 : (freshness ? 0.86 : 0.78),
    };
  }


  return { needSearch: false, reason: 'default_no', mode: null, confidence: 0.58 };
}

module.exports = { detectSearchIntent };
