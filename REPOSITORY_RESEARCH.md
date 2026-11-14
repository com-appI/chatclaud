# ChatClaud 1.6.x — сравнительное исследование репозиториев

**Дата оценки:** 14 ноября 2026 г.  
**Задача:** выбрать архитектурные идеи и возможные компоненты для существующего ChatClaud v1.5.2, не заменяя его работающий backend, Groq и Nova Browser.

## 1. Источники и границы исследования

Локально проверены приложенные архивы:

- `deepagentsjs-main(3).zip`;
- `langgraphjs-main.zip`;
- `mem0-main(1).zip`;
- `typescript-sdk-main(1).zip`;
- `mastra-main.zip`;
- `ai-main.zip`;
- `langfuse-js-main(1).zip`.

`Promptfoo` ZIP среди приложений нет: для него использована официальная документация и metadata пакета на публичном сайте. Поэтому Promptfoo не выдаётся за локально клонированный или собранный проект; его тесты в этом аудите не запускались.

Локальные архивы изучались выборочно по `package.json`, license files, ключевым исходным модулям и документации. Все репозитории не устанавливались, зависимости не скачивались, примеры и полный upstream test suites не запускались. Версии в архиве — снимок, приложенный пользователем; версия/условия upstream могут меняться. Перед фактическим добавлением пакета нужно повторно фиксировать tag/commit, актуальную лицензию и lockfile.

### Текущая среда ChatClaud

- `package.json`: Node.js `>=18`, 0 runtime dependencies.
- Локальный Node при аудите: `v22.16.0`.
- Backend: native Node `http`, single-file `server.js`.
- Основной provider: Groq Chat Completions, primary model `openai/gpt-oss-120b`.
- Agent runtime, planner и tool registry уже реализованы частично внутри `server.js`.
- Отдельные 35 тестов ChatClaud прошли, но это не тесты исследуемых библиотек.

## 2. Сводная таблица

Оценки 1–10 — экспертная оценка применительно к указанной задаче ChatClaud, а не рейтинг качества репозитория. Для «простоты интеграции» 10 = легко подключить с небольшим риском. Для «соответствия ChatClaud» 10 = хорошо совпадает с текущими архитектурными границами и ограничениями.

| Проект | Планирование | Память | Инструменты | Самопроверка / eval | Стабильность / зрелость | Простота интеграции | Соответствие ChatClaud |
|---|---:|---:|---:|---:|---:|---:|---:|
| Deep Agents JS | 9 | 8 | 9 | 6 | 7 | 3 | 5 |
| LangGraph.js | 8 | 9 | 8 | 6 | 8 | 3 | 5 |
| Mem0 TypeScript | 2 | 9 | 4 | 3 | 6 | 4 | 4 |
| Promptfoo | 3 | 1 | 3 | 9 | 8 | 7* | 8 |
| Vercel AI SDK | 7 | 3 | 9 | 4 | 8 | 7 | 8 |
| MCP TypeScript SDK | 3 | 2 | 10 | 3 | 8 | 4 | 6 |
| Langfuse JS | 2 | 2 | 6 | 7 | 8 | 6 | 7 |
| Mastra (дополнительный анализ) | 8 | 8 | 9 | 8 | 7 | 2 | 4 |

\* Для Promptfoo интеграция легко изолируется как CLI/CI evaluation, но текущая локальная версия Node `22.16.0` ниже актуального требования Promptfoo `22.22.0+`; без выделенного runner/обновления Node фактическая простота запуска снижается.

## 3. Анализ репозиториев

### 3.1. Deep Agents JS

**Что подтверждено локальным архивом.** Пакет `deepagents` версии `1.16.5`, лицензия MIT; в манифесте пакета есть небольшие прямые зависимости `fast-glob`, `micromatch`, `yaml`, `zod` и peer dependencies на LangChain/LangGraph: `@langchain/core`, `@langchain/langgraph`, `@langchain/langgraph-checkpoint`, `langchain`, provider adapters и `langsmith`. Сам пакет не задаёт отдельного поля `engines`; фактическая совместимость определяется также peer stack. В архиве найдены:

- `libs/deepagents/src/agent.ts` — сборка агента и middleware stack;
- `libs/deepagents/src/middleware/agent-memory.ts` и соседние middleware;
- `libs/deepagents/src/middleware/async_subagents.ts` — делегирование подзадач;
- `libs/deepagents/src/backends/protocol.ts`, `state.ts`, `store.ts` — интерфейсы и backend state/store;
- eval/workspace-пакеты и примеры.

Архитектурно Deep Agents не является независимым от LangGraph: он построен поверх LangChain agent interfaces и LangGraph runtime. В нём полезны явное планирование через todos, передача подзадач специализированным subagents, файловое рабочее пространство, middleware и разделение durable state/store. В актуальных docs memory middleware рекомендуется использовать новый `createMemoryMiddleware`; старый `agent-memory.ts` помечен deprecated.

**Groq/Node.** Provider-agnostic подход допускает разные model integrations, но приложенный пакет сам не даёт оснований автоматически подключать Groq к текущему `groqChat()`. Введённая им peer-инфраструктура LangGraph/LangChain увеличит поверхность зависимостей. Прямого теста совместимости с `openai/gpt-oss-120b` в рамках этого аудита не запускалось.

**Лицензия:** MIT для пакета в архиве.

**Оценка:** сильный источник идей для task decomposition и middleware, но включение `deepagents` вместе с уже имеющимся `runAgentGraph()` создаст второй agent orchestrator. Не внедрять как runtime на v1.6.0.

Источники: [Deep Agents JS source](https://github.com/langchain-ai/deepagentsjs/tree/main/libs/deepagents/src), [agent implementation](https://github.com/langchain-ai/deepagentsjs/blob/main/libs/deepagents/src/agent.ts), [architecture docs](https://docs.langchain.com/oss/javascript/deepagents/overview), [middleware docs](https://docs.langchain.com/oss/javascript/deepagents/middleware).

### 3.2. LangGraph.js

**Что подтверждено локальным архивом.** Репозиторий содержит JS runtime и checkpoint packages. В package metadata `langgraph` v1.0.47 — MIT, Node `>=20`; у core `@langchain/langgraph` в архиве отдельный package manifest и собственные peer dependencies. Root dev engine в архиве — Node `^22.11 || ^24 || >=26`. Следовательно, локальный Node `22.16.0` удовлетворяет root dev range `^22.11`.

Ключевая архитектура — Pregel/BSP-граф, channels и явные state transitions. Checkpointer сохраняет checkpoint после super-step в рамках `thread_id`; store предназначен для пользовательской/приложенческой памяти вне отдельного thread. Механизм помогает возобновлять run, строить human-in-the-loop, смотреть историю состояния и обеспечивать восстановление после ошибки. В локальном архиве изучались docs по persistence, low-level graph API и checkpoint integration.

**Groq/Node.** Графовый runtime не привязан к Groq, поэтому текущий provider можно оставить adapter-ом. Но внедрение в текущий native-Node single-file backend потребует переноса orchestration и persistence boundary на LangGraph interfaces, тестирования checkpoint adapter и определения `thread_id`/store ownership. Это архитектурное, а не косметическое изменение.

**Лицензия:** MIT для LangGraph.js.

**Оценка:** лучший референс для строгого task state/checkpoint model и разграничения кратковременной и долговременной памяти. Для v1.6.0 стоит взять идею lifecycle/checkpoint snapshots, но пока не заменять `runAgentGraph()`.

Источники: [LangGraph.js repository](https://github.com/langchain-ai/langgraphjs), [persistence](https://github.com/langchain-ai/langgraphjs/blob/main/docs/docs/concepts/persistence.md), [checkpoint and store concepts](https://langchain-ai.github.io/langgraphjs/concepts/persistence/).

### 3.3. Mem0 TypeScript

**Что подтверждено локальным архивом.** В `mem0-ts/package.json` находится `mem0ai` v3.3.1, Apache-2.0, Node `>=18`, 4 прямые dependencies и 41 peer dependency для дополнительных LLM/vector-store integrations. Отдельный `mem0-ts/src/oss/package.json` обозначен как MIT и имеет более широкий список SDK/storage dependencies, включая `groq-sdk`, OpenAI/Anthropic/Google integrations и клиенты для разных storage/vector backends. Поэтому нельзя переносить или копировать произвольный подкаталог, полагаясь на одну лицензию root package: надо сверять конкретный package path и LICENSE.

Изучены `mem0-ts/src/oss/src/memory/index.ts`, `llms/groq.ts`, `utils/factory.ts`, README и package metadata. API предлагает `add`, `search`, `get`, `update`, `delete`, `deleteAll`, `history`, `reset`, `getAll`. Вызов памяти требует scope/identity (`userId`, `agentId` или `runId`), а поиск проверяет наличие scope-фильтра. Это полезный паттерн изоляции. Присутствует Groq LLM adapter, но он не отменяет необходимость отдельно выбрать embedder и vector store, а также конфигурировать их и credentials.

**Node/Groq.** Node `>=18` в основном пакете формально совместим с `package.json` ChatClaud. Groq adapter доступен. Но это не значит, что память заработает только от текущего GROQ_KEY: embedding provider, storage, retention, deletion и namespace остаются обязательными архитектурными решениями.

**Лицензия:** корневой npm package `mem0ai` — Apache-2.0; отдельный OSS package в приложенном архиве заявлен как MIT. Перед включением нужно подтвердить выбранный package distribution и полный набор third-party licences.

**Оценка:** отложить. Сейчас в ChatClaud нет формализованной персональной памяти; сначала следует определить авторитетный user ID, согласие, хранилище, retention и удаление. Mem0 не подключать до этих решений.

Источники: [Mem0 TypeScript repo](https://github.com/mem0ai/mem0/tree/main/mem0-ts), [Memory API](https://github.com/mem0ai/mem0/blob/main/mem0-ts/src/oss/src/memory/index.ts), [Groq LLM adapter](https://github.com/mem0ai/mem0/blob/main/mem0-ts/src/oss/src/llms/groq.ts), [Memory add/search/update/delete docs](https://docs.mem0.ai/platform/memory).

### 3.4. Promptfoo

**Источник:** локальный ZIP Promptfoo не приложен. Изучена официальная документация и package/runtime metadata на официальном сайте.

Promptfoo — отдельная система тестирования и red-team оценки LLM: несколько prompts/providers/variants, cases, assertions, model-graded checks, similarity/JSON/regex/custom tests, плагины и стратегии adversarial testing. Встроенный Groq provider документирован, в том числе модель `groq:openai/gpt-oss-120b`, так что он может оценивать текущую модель без переписывания production provider.

Актуальное требование официальной Node package документации — **Node.js `22.22.0` или новее**; текущий локальный Node ChatClaud `22.16.0` не проходит это требование. `package.json` текущего Promptfoo на момент проверки указывает MIT и engine `>=22.22.0`.

**Интеграция:** только отдельный evaluation runner или CI pipeline; не включать Promptfoo в production request handler и не импортировать в `server.js`. Можно держать YAML/JSON case files рядом с тестами, с baseline по git revision/model/prompt version.

**Оценка:** приоритетный кандидат для v1.6.4, но сначала решить версию Node CI. В тестах следует проверять correctness/criterion-based success и citations, а не просто «уверенность» текста.

Источники: [Promptfoo package/runtime docs](https://www.promptfoo.dev/docs/usage/node-package/), [Groq provider](https://www.promptfoo.dev/docs/providers/groq/), [assertions](https://www.promptfoo.dev/docs/configuration/expected-outputs/), [red-team](https://www.promptfoo.dev/docs/red-team/).

### 3.5. Vercel AI SDK

**Что подтверждено локальным архивом.** Архив большой (около 96 MB распакованных данных). В корне — Apache 2.0; пакет `ai` v7.0.173 — Apache-2.0, Node `>=22`; `@ai-sdk/groq` v4.0.84 — Apache-2.0, Node `>=22`, зависимости на provider/provider-utils и optional Zod peer. Изучены `packages/ai/src/agent/tool-loop-agent.ts`, Groq provider package, stop conditions и model adapter.

SDK даёт стандартизированный provider API, `generateText`/`streamText`, tools и многошаговый `ToolLoopAgent` со stop condition и ограничением числа шагов. Есть официальный Groq provider. Это может упростить настоящий streaming и унификацию provider interfaces, но ChatClaud уже имеет рабочие HTTP-пути к Groq, собственную нормализацию сообщений, image/audio маршруты, frontend API и agent controller.

**Node/Groq.** Совместимость runtime требует Node `>=22`; текущий аудиторский runtime `22.16` соответствует, но package ChatClaud заявляет `>=18`, то есть обновление SDK сузило бы поддерживаемый диапазон deployment. Groq provider доступен, но подключение потребовало бы адаптации текущих настроек/fallbacks/мультимодальных endpoint и регрессионного сравнения.

**Лицензия:** Apache-2.0.

**Оценка:** использовать как референс API `ModelProvider`, stop conditions и настоящий stream lifecycle. Не мигрировать весь ChatClaud на AI SDK пока нет доказанной выгоды и решения по минимальной версии Node.

Источники: [AI SDK repo](https://github.com/vercel/ai), [ToolLoopAgent source](https://github.com/vercel/ai/blob/main/packages/ai/src/agent/tool-loop-agent.ts), [Groq provider source](https://github.com/vercel/ai/tree/main/packages/groq), [agents and tool loop docs](https://ai-sdk.dev/docs/agents/overview).

### 3.6. MCP TypeScript SDK

**Что подтверждено локальным архивом.** Архив относится к v2 переходу. Пакеты `@modelcontextprotocol/client` и `@modelcontextprotocol/server` в приложенной копии — v2.4.0, Apache-2.0, Node `>=20`; у client есть зависимости для транспорта, auth/OAuth и core, у server — core и Zod. Root archive metadata указывает alpha package version, поэтому для реальной установки надо фиксировать конкретный package/version, а не использовать root version без проверки.

MCP стандартизирует внешний интерфейс tools/resources/prompts и разделяет tool server и client. Это полезно, если ChatClaud действительно должен подключаться к сторонним сервисам или предоставлять свои tools другим агентам. MCP не является planner, LLM provider или памятью; он не решает permissions сам по себе — host должен проверять scope, allowlist, auth, timeout, output size и обработку недоверенного контента.

**Node/Groq.** Node `>=20` у v2 packages; текущая среда `22.16` совместима. Прямой зависимости от Groq нет.

**Лицензия:** проект объявляет Apache-2.0 для новых contributions/code и сохраняет MIT для существующих участков; в package manifests v2 packages указана Apache-2.0. Проверять точный файл/пакет, который будет использоваться.

**Оценка:** отложить до появления конкретного внешнего инструмента (например, реальный сторонний MCP server). Для внутренних шести инструментов текущего allowlist достаточно.

Источники: [MCP SDK README](https://github.com/modelcontextprotocol/typescript-sdk), [v2 server README](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/packages/server/README.md), [v2 client README](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/packages/client/README.md), [v2 docs](https://github.com/modelcontextprotocol/typescript-sdk/tree/main/docs).

### 3.7. Langfuse JS

**Что подтверждено локальным архивом.** `langfuse-js` v6.1.1, MIT. Корневой package engine — `^22.13.0 || >=24.0.0`; пакет `@langfuse/tracing` v6.1.1 требует Node `>=22`. В составе есть `@langfuse/client`, tracing и AI SDK integration packages; tracing использует OpenTelemetry API. Текущий ChatClaud поддерживает Node `>=18`, поэтому интеграция Langfuse в production исключила бы Node 18–21 deployment без отдельного решения.

Langfuse полезен для traces по запросам/шагам/tools, latency, model usage, datasets/evaluations и debugging. Но трассировка LLM может содержать prompt inputs, outputs и tool payloads. Это пользовательский контент; нельзя включать полное tracing по умолчанию до решения о redaction, opt-out, retention, регионе хранения, доступе, секретах и договорах обработки данных.

**Groq/Node.** Провайдерно-независимый: можно создать spans вокруг текущего Groq API и tool calls без замены Groq. Node runtime как выше.

**Лицензия:** MIT.

**Оценка:** отложить. Для v1.6.4 сначала собрать локальные безопасные структурированные логи/метрики и определиться с privacy policy; после этого можно сделать короткий POC Langfuse с очищенными payloads.

Источники: [Langfuse JS repo](https://github.com/langfuse/langfuse-js), [tracing package](https://github.com/langfuse/langfuse-js/tree/main/packages/tracing), [JS/TS SDK docs](https://langfuse.com/docs/observability/sdk/overview), [data masking](https://langfuse.com/docs/observability/features/masking).

### 3.8. Mastra — дополнительный проект из первой части задания

Mastra не включён в окончательный список из семи проектов раздела 19, но он был явно указан в разделе 3 исходной инструкции и приложен отдельным ZIP, поэтому добавлен как дополнительный сравнительный объект.

**Что подтверждено локальным архивом.** Это крупный монорепозиторий (около 284 MB распакованных данных, более 27 тысяч entries). В архиве `@mastra/core` v1.84.0-alpha.1, `@mastra/memory` v1.41.2-alpha.0 и `@mastra/evals` v1.10.11; эти packages Apache-2.0 и требуют Node `>=22.13`. Root dev environment требует `^22.19.0 || >=24.11.0`, что выше текущего локального Node `22.16.0`. У core обширный набор внутренних/внешних dependencies и интеграций.

Изучены `packages/core/src/agent/agent.ts`, `packages/memory/src/index.ts`, `packages/evals/src/index.ts`, package manifests и LICENSE. В Mastra собраны агенты, workflow orchestration, tools, memory, processors, tracing/observability и evaluation. Агент тесно связан с собственным runtime/storage/request context; это полноценная платформа, а не лёгкая библиотека памяти.

**Лицензия:** основной код вне `ee/` — Apache-2.0; все каталоги с именем `ee/` регулируются отдельным `ee/LICENSE`, поэтому их нельзя считать доступными на тех же условиях без проверки. Наличие лицензии Apache-2.0 в root не распространяется автоматически на `ee/`.

**Оценка:** не внедрять. В текущем ChatClaud это заменит большую часть существующего backend/agent lifecycle и значительно расширит зависимости/минимальную версию Node. Брать идеи по memory boundaries, processors и eval hooks; не переносить framework целиком.

Источники: [Mastra agent source](https://github.com/mastra-ai/mastra/blob/main/packages/core/src/agent/agent.ts), [memory package](https://github.com/mastra-ai/mastra/tree/main/packages/memory), [evals package](https://github.com/mastra-ai/mastra/tree/main/packages/evals), [license](https://github.com/mastra-ai/mastra/blob/main/LICENSE.md).

## 4. Совместимость, зависимости и влияние на архитектуру

| Проект | Node.js из локального source/package metadata | Лицензия в изученном пакете/коде | Связь с Groq | Главный риск для ChatClaud |
|---|---|---|---|---|
| Deep Agents JS | Нет собственного `engines` в `deepagents` manifest; требует LangGraph/LangChain peer stack | MIT | Возможна через model adapter, в архиве не доказан готовый Groq preset | Второй orchestrator поверх имеющегося runtime, peer dependency stack |
| LangGraph.js | package `langgraph` >=20; root dev engine `^22.11\|\|^24\|\|>=26` | MIT | Provider-agnostic | Перенос графа/состояния и checkpoint persistence |
| Mem0 TS | package `mem0ai` >=18 | Apache-2.0 root npm package; отдельный OSS package manifest MIT | Есть Groq LLM adapter, нужен отдельный embedder и vector store | Неопределённое storage/privacy/identity; дополнительные SDK integrations |
| Promptfoo | >=22.22.0 по текущей официальной docs | MIT | Официальный `groq:` provider и GPT-OSS preset | Не совместим с локальным Node 22.16 для latest; должен оставаться dev/CI-only |
| Vercel AI SDK | `ai` >=22; `@ai-sdk/groq` >=22 | Apache-2.0 | Есть официальный Groq provider | ChatClaud baseline >=18 будет сужен до Node>=22; нужно портировать streaming/tool flow |
| MCP SDK v2 | client/server >=20 | v2 packages Apache-2.0; existing repo portions MIT | Не зависит от provider | Увеличение remote tool attack surface, пока нет use case |
| Langfuse JS | tracing >=22; root range `^22.13.0\|\|>=24.0.0` | MIT | Provider-agnostic tracing | Логирование чувствительных prompt/output payloads и data retention |
| Mastra | core/memory/evals >=22.13; root repo dev `^22.19\|\|>=24.11` | Apache-2.0 вне `ee/`; `ee/` отдельная лицензия | Через встроенные model integrations/AI SDK adapters | Очень крупный runtime и широкая замена текущей архитектуры |

Не следует сравнивать количество функций библиотек с качеством конечной модели. Framework может улучшить контроль выполнения и observability, но сам по себе не увеличивает фактологическую точность Groq.

## 5. Решение по категориям

### A. Внедрить сейчас

**Ни один сторонний framework/npm package на данном этапе не устанавливать.** Внедрить только локальные архитектурные улучшения после утверждения аудита:

- формальную модель task lifecycle и criteria;
- строгие входные/выходные tool contracts и отмену timeout operations;
- fail-closed проверку JSON planner/reviewer;
- единый evidence schema;
- safe structured logging с request/task IDs;
- изолированный benchmark harness.

Это путь наименьшего вмешательства: текущие Agent Runtime, Groq provider, Nova pipeline и deployment contract остаются.

### B. Использовать отдельные идеи и модули

- **LangGraph:** идеи checkpoint/thread ID, task state snapshots и разделение short-term checkpointer vs long-term store; без обязательного импорта пакета.
- **Deep Agents:** decomposition/todo, middleware boundaries и независимые workspace/worker contexts; не добавлять второй orchestrator.
- **Promptfoo:** отдельная CLI/CI evaluation система v1.6.4. Сначала выделить Node `>=22.22.0` runner или выбрать совместимую зафиксированную версию; production ChatClaud не должен зависеть от неё.
- **Vercel AI SDK:** использовать API patterns для `ModelProvider`, stream lifecycle, stop conditions и Groq adapter, только если сравнительный POC докажет преимущества перед текущим `fetch`-wrapper.
- **Mem0:** изучить user-scope CRUD и isolation patterns как референс для v1.6.1; не включать до выбора embedder/vector store/storage и проверки согласия/удаления.
- **Langfuse:** изучить trace/span schema и scoring; пока сформировать локальную политику redaction/retention.
- **Mastra:** использовать как reference для processors, working memory boundaries и eval instrumentation, не копируя framework.

### C. Отложить

- **Mem0 package** до определения identity, storage, embedder, retention и data deletion.
- **Langfuse** до утверждения privacy policy и политики, какие prompt/output поля можно передавать внешнему сервису.
- **MCP SDK** до появления конкретного внешнего tool integration и threat model.
- **Vercel AI SDK adapter** до POC на текущем Groq GPT-OSS 120B и проверки streaming/vision/audio/fallback compatibility.
- **LangGraph runtime** до доказанной потребности в durable checkpoints/resume across requests, которую нельзя закрыть меньшим собственным task store.

### D. Не использовать

- Одновременное подключение Deep Agents + LangGraph + Mastra как конкурирующих orchestrator frameworks.
- Полную замену существующего agent runtime на Mastra или Deep Agents в рамках 1.6.0 без отдельного migration project.
- Mem0 и векторную БД «на всякий случай» без user identity, consent, storage, retention и deletion design.
- Promptfoo как зависимость production `/api/chat`.
- Langfuse с полным сбором пользовательских сообщений и ответов до определения защиты данных.
- MCP-серверы с произвольными правами или shell/admin/deploy tools по умолчанию.

## 6. Рекомендуемая последовательность технических решений

1. Согласовать `CHATCLAUD_AUDIT.md` и этот файл.
2. На v1.6.0 укрепить встроенные компоненты и тесты без npm dependencies.
3. До v1.6.1 зафиксировать user identity и storage design; только затем выбрать простой store или Mem0 POC.
4. Для v1.6.2 добавить evidence contract и строгий review loop.
5. В v1.6.3 оценивать MCP только для конкретного интеграционного сценария.
6. В v1.6.4 развернуть отдельный eval pipeline; Promptfoo — кандидат, но требование Node >=22.22 нужно учесть в CI.
7. Не менять `GROQ_MODEL=openai/gpt-oss-120b`, backend API, Nova Browser, public service URLs и production configuration без согласования, отдельной проверки и rollback.

## 7. Чего аудит не доказывает

- Не запускались тестовые наборы самих Deep Agents, LangGraph, Mem0, MCP SDK, Mastra, AI SDK и Langfuse.
- Не проверялась интеграция к production Groq ключу/аккаунту или реальная доступность каждого резервного model ID.
- Не анализировались приватные правила Firestore/Firebase, Render dashboard, production env variables, deploy logs и persistent disk settings.
- Не выполнялись security penetration tests и независимый benchmark качества генерации.
- Promptfoo исследовался по официальным актуальным онлайн-источникам, а не по приложенному исходному архиву.

Итоговый выбор: **сначала укрепить собственный ChatClaud Core; не добавлять новый агентный фреймворк.** В качестве первой внешней зависимости, которая может дать заметную практическую пользу, рассматривать Promptfoo исключительно как dev/CI evaluator после решения вопроса с Node.js runner. Остальные технологии пока предоставляют архитектурные идеи или закрывают ещё не подтверждённую потребность.
