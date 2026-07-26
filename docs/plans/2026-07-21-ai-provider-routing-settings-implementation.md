# Dynamic AI Providers, Model Routing, and Pipeline Step Policies — Implementation Plan

> This plan spans two sibling repositories in the same workspace:
>
> - Frontend/BFF: `rinkuzu/`
> - FastAPI runtime: `rinkuzu-ai-api/`
>
> Implement the tasks in order. Do not skip an acceptance test, silently rename an interface, or combine step enablement with model routing.

## 1. Goal

Build one admin settings surface where an authorized administrator can:

1. Add an OpenAI-compatible provider endpoint.
2. Open that provider and manage multiple masked API keys in strict priority order.
3. Add one or more upstream model names and declare their capabilities.
4. Assign an ordered model chain to every LLM action. The first model is primary; later models are fallbacks.
5. Enable or disable only pipeline steps that have a defined safe bypass strategy.
6. Change configuration without restarting or deploying an additional service.
7. Attribute token usage, cost, fallback attempts, and final outcomes to both the stable LLM action and the owning user, including background execution and recovery.

The FastAPI process continues to call LiteLLM as an in-process SDK. Bifrost is not part of this implementation because its supported Python integration is an HTTP gateway, which would add a second process/service.

## 2. Locked Decisions

These decisions are implementation requirements, not suggestions.

| Concern                              | Decision                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------- |
| Runtime topology                     | One existing FastAPI service; no Bifrost sidecar or new gateway service   |
| Provider protocol                    | OpenAI-compatible HTTP API only in V1                                     |
| Frontend                             | Existing Next.js admin application                                        |
| LLM adapter                          | Existing LiteLLM SDK in `rinkuzu-ai-api`                                  |
| Model selection key                  | Typed `LlmAction`, never a per-feature factory method                     |
| Key behavior                         | Strict priority; smaller `priority` runs first; no round-robin in V1      |
| Model behavior                       | Ordered primary-to-fallback chain                                         |
| Cross-model fallback                 | Only for classified target/recoverable failures                           |
| Hidden retries                       | Disabled in LiteLLM routed clients; the fallback executor owns attempts   |
| Streaming fallback                   | Allowed only before the first non-empty token is emitted                  |
| Configuration consistency            | A request/job pins one immutable routing revision                         |
| Emergency disable/secret replacement | Applies immediately, including to jobs pinned to an older route revision  |
| Step enablement                      | Stored separately from route/model selection                              |
| Empty model chain                    | Configuration error; never interpreted as “step off”                      |
| Relation verification off            | Deterministic acceptance policy, explicitly marked unverified             |
| Cycle handling off                   | Only AI assistance is disabled; DAG enforcement always runs               |
| Theory pre-generation off            | Skip pre-generation; on-demand theory remains available                   |
| Public endpoint policy               | HTTPS and public network targets only in V1; no localhost/LAN/private IP  |
| Secrets                              | Versioned Fernet keyring plus HMAC fingerprint secret; no reveal endpoint |
| Concurrent admin edits               | `ETag`/`If-Match`; missing precondition is `428`, stale revision is `412` |
| Broken explicit route                | Fail closed; do not silently fall back to the legacy environment model    |
| Legacy environment config            | Temporary migration fallback for unassigned actions only, then disabled   |
| Usage attribution                    | Explicit immutable context; product calls require `user_id` + `LlmAction` |
| Usage event granularity              | One event per physical attempt; `operation_id` groups one logical call    |
| Usage persistence failure            | Fail-soft after the call; missing required attribution fails before call  |
| Non-product traffic                  | Admin probes/system work are marked and excluded from product totals      |

## 3. Explicit Non-Goals for V1

- No load balancing or weighted traffic between API keys.
- No weighted or random model selection.
- No per-user or per-tenant routing rules.
- No provider-specific SDKs, Azure/Bedrock ambient credentials, arbitrary request headers, custom TLS-disable switch, or arbitrary provider callback code.
- No browser UI served directly from FastAPI.
- No Ollama/vLLM/private-LAN endpoints until a later phase adds an operations-controlled allowlist and egress isolation.
- No drag-and-drop dependency for route ordering; accessible up/down controls are enough.
- No prompt/response inspection UI and no plaintext secret export.

## 4. Current Code That Must Be Preserved or Migrated

### 4.1 FastAPI

- `api/shared/llm.py` already contains `LLMClient`, `LiteLLMClient`, text generation, structured generation, streaming, message normalization, and usage recording.
- `api/shared/llm_usage.py` already labels calls with action strings and attempts to read a request user from `current_user_id`. Those strings become the stable routing keys, but the `ContextVar` must not remain the authoritative source of user attribution.
- `LlmUsageDocument` already stores `user_id`, `action`, token counts, and cost, while `api/routers/admin_usage.py` already aggregates `by_action`, `by_model`, and `by_user`. Extend this path instead of introducing a second analytics store.
- `get_current_user()` is a synchronous dependency that currently sets `current_user_id`. Do not assume a `ContextVar` mutation made in a FastAPI/AnyIO worker thread propagates back to the async endpoint or into later background/recovery work.
- `api/shared/retry.py` currently retries almost every non-listed exception. The routed path must replace this with a narrow classifier.
- `api/lifespan.py` is the composition root and stores services on `app.state`.
- `api/dependencies.py` exposes those application services to request handlers.
- `api/shared/persistence/documents.py` and `api/shared/mongo_store.py` own Beanie documents and registration.
- `api/routers/admin_ocr_keys.py` demonstrates masked secret CRUD and testing, but its crypto and health-update details must not be copied unchanged.
- Content pipeline jobs already persist and recover. They must also persist `llm_config_revision`.
- Quiz draft processing is background work and must pin an LLM revision as well.

### 4.2 Next.js

- `src/app/[locale]/(app)/admin/layout.tsx` already enforces admin access at the page boundary.
- `src/lib/api/auth.ts` provides `withAdmin` for Route Handlers.
- `src/lib/adaptive/proxy.ts` is the allowlisted BFF proxy to FastAPI.
- `src/app/api/admin/ocr-keys/**` is the pattern for explicit admin proxy handlers.
- `src/features/admin/ocr-keys/**` is the pattern for DTOs, mappers, API functions, and masked-secret UI.
- `src/shared/constants/routes.ts`, `src/shared/constants/nav.ts`, and `messages/{vi,en}` own navigation and translations.

## 5. Architecture

Normal feature code must never ask for a raw model name and must never implement fallback loops.

```text
Domain call site
  -> LlmGateway(action, messages/schema/options)
  -> ConfigSnapshotProvider.capture(...)
  -> ModelRouteResolver.resolve(action, snapshot, runtime capabilities)
  -> FallbackExecutor.execute(route, operation)
  -> LlmClientFactory.create(model target, credential reference)
  -> LiteLLMClient(single physical attempt)
  -> LiteLLM SDK
  -> OpenAI-compatible endpoint
```

Pipeline behavior is a separate path:

```text
PipelineRunner
  -> PipelineStepPolicyResolver(step_id, pinned snapshot)
  -> enabled strategy OR safe bypass strategy
  -> LlmGateway only when the selected strategy needs an LLM
```

### 5.1 Pattern Responsibilities

| Component                    | Pattern                 | Responsibility                                                 | Must not do                                           |
| ---------------------------- | ----------------------- | -------------------------------------------------------------- | ----------------------------------------------------- |
| `LlmGateway`                 | Facade                  | Present text/structured/stream APIs to domains                 | Store secrets or select a step bypass                 |
| `ModelRouteResolver`         | Strategy/Resolver       | Turn `LlmAction` into an ordered, capability-compatible route  | Decrypt keys or call providers                        |
| `FallbackExecutor`           | Chain of Responsibility | Execute ordered key/model attempts and classify failure        | Read admin DTOs or choose pipeline policies           |
| `LlmClientFactory`           | Factory                 | Create one concrete `LiteLLMClient` for one target and one key | Decide which model/action to use                      |
| `ConfigSnapshotProvider`     | Repository/cache        | Return immutable revisioned configuration                      | Cache plaintext secrets                               |
| `PipelineStepPolicyResolver` | Strategy                | Select enabled or bypass implementation                        | Treat an empty route as disabled                      |
| `LlmSettingsService`         | Application service     | Validate and publish admin configuration commands              | Perform provider calls while a DB transaction is open |
| `ModelProbeService`          | Application service     | Run bounded synthetic provider/model tests                     | Accept arbitrary prompts from the browser             |

### 5.2 Forbidden API Shape

Do not create any of these:

```python
factory.get_tutor_model()
factory.get_exercise_model()
factory.get_relation_verification_model()
```

The number of methods would grow with features and would return only one model even though routing requires a chain. The required call shape is:

```python
result = await llm_gateway.generate_structured(
    action=LlmAction.PIPELINE_RELATION_VERIFICATION,
    messages=messages,
    schema=RelationVerificationBatch,
    snapshot=job_snapshot,
)
```

## 6. Stable Action and Capability Registry

Create `rinkuzu-ai-api/api/shared/llm_runtime/actions.py`.

```python
from enum import StrEnum


class LlmAction(StrEnum):
    ADAPTIVE_EXERCISE = "adaptive_exercise"
    ADAPTIVE_THEORY = "adaptive_theory"
    ADAPTIVE_SHORT_ANSWER_EVAL = "adaptive_short_answer_eval"
    ADAPTIVE_TUTOR_CHAT = "adaptive_tutor_chat"
    TUTOR_CHAT_SUMMARY = "tutor_chat_summary"
    QUIZ_EXTRACTION = "quiz_extraction"
    QUIZ_TUTOR = "quiz_tutor"
    PIPELINE_CONCEPT_EXTRACTION = "pipeline_concept_extraction"
    PIPELINE_RELATION_VERIFICATION = "pipeline_relation_verification"
    PIPELINE_CYCLE_REMOVAL = "pipeline_cycle_removal"
    PIPELINE_THEORY_GENERATION = "pipeline_theory_generation"


class LlmCapability(StrEnum):
    TEXT = "text"
    STRUCTURED_OUTPUT = "structured_output"
    STREAMING = "streaming"
    VISION = "vision"
```

Define one immutable `LLM_ACTION_DEFINITIONS` registry. It is the backend source of truth returned to the UI. Do not duplicate required capabilities in TypeScript constants.

| Action                         | Base capabilities       | Notes                                         |
| ------------------------------ | ----------------------- | --------------------------------------------- |
| adaptive exercise              | text, structured output | Required feature action                       |
| adaptive theory                | text, structured output | On-demand theory                              |
| short-answer evaluation        | text, structured output | Required feature action                       |
| adaptive tutor chat            | text, streaming         | Add vision at runtime when images are present |
| tutor summary                  | text                    | Non-stream summary                            |
| quiz extraction                | text, structured output | Current extraction uses document text         |
| quiz tutor                     | text, streaming         | Add vision at runtime when images are present |
| pipeline concept extraction    | text, structured output | Required pipeline step                        |
| pipeline relation verification | text, structured output | Optional pipeline strategy                    |
| pipeline cycle removal         | text, structured output | Optional AI assistance; DAG remains required  |
| pipeline theory generation     | text, structured output | Separate from adaptive/on-demand theory       |

`api/shared/llm_usage.py` temporarily re-exports `LlmAction` from the new module so existing imports continue working during migration. Remove the old string-constant class after all call sites have moved.

## 7. Configuration Aggregate and Persistence

Use an immutable materialized configuration revision rather than reconstructing a hot-path snapshot from several independently changing collections. Keep secret ciphertext and runtime health in separate documents.

### 7.1 Why This Shape

- One read loads a complete routing revision.
- A background job can reload the exact revision it started with.
- Routes cannot observe half of an admin update.
- Secret ciphertext is not copied into every revision.
- Key replacement/revocation can apply immediately without rewriting historical routing revisions.
- The aggregate is safely bounded by V1 limits listed below.

### 7.2 New Beanie Models

Add embedded Pydantic records and documents in `rinkuzu-ai-api/api/shared/persistence/documents.py`.

#### `LlmProviderConfigRecord`

```text
provider_id: UUID-like opaque string
name: trimmed display name, 1..80 chars
provider_type: literal "openai_compatible"
base_url: canonical URL including allowed fixed path prefix, no query/fragment
normalized_origin: scheme://host:port
enabled: bool
timeout_sec: float, 1..300
created_at / updated_at
created_by / updated_by
```

#### `LlmCredentialRefRecord`

```text
key_id
provider_id
label: 1..120 chars
masked_key: last four plus optional safe prefix
priority: 0..10000; lower runs first
enabled: bool
secret_version: positive integer
created_at / updated_at
created_by / updated_by
```

#### `LlmModelConfigRecord`

```text
model_id
provider_id
display_name: 1..120 chars
upstream_model_name: opaque OpenAI model identifier, 1..200 chars
enabled: bool
capabilities: unique set of LlmCapability
timeout_sec_override: optional 1..300
input_price_usd_per_m_tokens: optional decimal string
output_price_usd_per_m_tokens: optional decimal string
created_at / updated_at
created_by / updated_by
```

Treat `upstream_model_name` as opaque. It must never select a LiteLLM provider adapter.

#### `LlmActionRouteRecord`

```text
action: LlmAction
model_ids: ordered unique list, primary first
updated_at / updated_by
```

There is no `enabled` field on a route. An action that is used must have at least one usable model.

#### `PipelineStepPolicyRecord`

```text
step_id: PipelineStepId
enabled: bool
updated_at / updated_by
```

Do not persist an arbitrary bypass class name supplied by an admin. The code registry defines the only legal bypass strategy for each optional step.

#### `LlmConfigRevisionDocument`

```text
revision: monotonically increasing integer, unique
providers: list[LlmProviderConfigRecord]
credential_refs: list[LlmCredentialRefRecord]
models: list[LlmModelConfigRecord]
routes: list[LlmActionRouteRecord]
step_policies: list[PipelineStepPolicyRecord]
created_at
created_by
```

Collection: `llm_config_revisions`.

Indexes:

- unique `revision`
- descending `created_at`

#### `LlmConfigStateDocument`

```text
state_id: literal "active"
active_revision: int
updated_at
```

Collection: `llm_config_state`; unique `state_id`.

#### `LlmCredentialSecretDocument`

```text
key_id: unique
provider_id
cipher_version: int
encryption_key_id: str
ciphertext: str
fingerprint_hmac: str
secret_version: int
revoked_at: datetime | None
created_at / updated_at
```

Collection: `llm_credential_secrets`.

Indexes:

- unique `key_id`
- unique `(provider_id, fingerprint_hmac)`
- `(provider_id, revoked_at)`

#### `LlmCredentialHealthDocument`

```text
key_id: unique
secret_version
status: untested | healthy | degraded | cooldown | quarantined
consecutive_failures
success_count
failure_count
cooldown_until
last_used_at / last_success_at / last_error_at
last_error_code: safe taxonomy only
last_error_message: sanitized bounded text only
updated_at
```

Health updates do not create a configuration revision. Every update uses CAS on `key_id + secret_version`; an old in-flight success cannot revive a replaced or revoked key.

#### `LlmConfigAuditDocument`

```text
audit_id
revision
actor_user_id
request_id
command_type
resource_type / resource_id
result: success | rejected
before_summary / after_summary: redacted dicts
created_at
```

Never include raw keys, ciphertext, fingerprints, prompts, model responses, or raw provider bodies. Collection: `llm_config_audit` with actor/time and revision indexes. Use a retention policy only after product requirements are confirmed; do not silently TTL audit data in the first implementation.

### 7.3 Bounded Aggregate Limits

Enforce in the backend:

- Maximum 50 providers.
- Maximum 20 credentials per provider.
- Maximum 500 imported models per provider.
- Maximum 10 models in one action route.
- Maximum 5,000 entries read from a provider `/models` response; the UI imports only selected models.
- Maximum configuration revision BSON size must be checked before insert and remain well below MongoDB's 16 MiB limit.

### 7.4 Publish Transaction

Every configuration mutation follows this exact order inside one Mongo transaction:

1. Parse and validate `If-Match` into `expected_revision`.
2. Load `LlmConfigStateDocument(state_id="active")` in the transaction.
3. Return `412 llm_config_revision_conflict` if active revision differs.
4. Load the active immutable revision.
5. Copy it into mutable domain objects.
6. Apply exactly one command.
7. Validate the complete aggregate invariants.
8. Insert immutable revision `expected_revision + 1`.
9. CAS update active state from `expected_revision` to the new revision.
10. Insert the redacted audit record.
11. Commit.
12. Invalidate the local active-snapshot cache after commit.

For key creation/replacement/revocation, update `LlmCredentialSecretDocument` in the same transaction. If audit or CAS fails, abort the complete mutation.

Provider/model probing is different: never hold a DB transaction open while calling an external endpoint. Load IDs/version, make the bounded external call, then CAS-update health and append a sanitized probe audit record.

Production dynamic configuration requires MongoDB transaction support. At startup, probe this capability. If unavailable:

- Admin settings mutation endpoints return `503`.
- Runtime may continue using the legacy environment adapter while the migration flag permits it.
- Do not perform non-transactional partial writes.

### 7.5 Aggregate Invariants

Reject publication when any condition is false:

1. Every provider/model/key/route ID is unique within its namespace.
2. Every key and model references an existing provider.
3. Every route references existing models and has no duplicates.
4. Every assigned model satisfies the action's base capabilities.
5. Every active route resolves to at least one enabled provider, enabled model, and enabled non-revoked key.
6. A provider/model/key cannot be disabled or deleted if doing so would make an active route unusable.
7. A referenced provider/model cannot be deleted.
8. A required pipeline step cannot be disabled.
9. Every optional step uses the server registry's fixed bypass semantics.
10. An empty route never means disabled.
11. The canonical endpoint passes the runtime SSRF policy.

Reference conflicts return `409`; missing/stale concurrency preconditions return `428`/`412`.

### 7.6 Usage Event Persistence

Extend the existing `LlmUsageDocument`; do not create a disconnected provider-specific usage collection. A V2 document represents one physical provider attempt and contains only accounting/operational metadata:

```text
schema_version: 2
event_id: server-generated opaque ID
operation_id: server-generated ID shared by all fallback attempts for one gateway call
user_id: opaque application user ID; required for product source kinds
action: stable LlmAction; required for product source kinds
source_kind: request | pipeline_job | quiz_draft | admin_probe | system
source_id: job/draft ID where applicable; otherwise null
request_id: validated/truncated request correlation ID or null
product_usage: bool derived from source_kind, never accepted from the client
provider_id / model_config_id / credential_id
config_revision
attempt_index: 1-based physical attempt number within operation_id
fallback_model_index: 0-based position in the resolved model chain
attempt_outcome: success | recoverable_failure | terminal_failure | cancelled | committed_stream_error
is_final_attempt: bool
safe_error_code: bounded internal taxonomy or null
usage_available: bool
input_tokens / output_tokens / total_tokens
token_anomaly: bool
input_price_per_m_usd / output_price_per_m_usd: trusted configured snapshot
cost_usd
created_at / expires_at
```

Persistence semantics:

1. The fallback executor creates the operation ID once and increments `attempt_index` only when it actually opens an upstream request. A disabled/cooldown target that is skipped is not a paid attempt and does not create a usage row.
2. Insert one event after every physical attempt, including failed attempts. If an upstream failure reports no trustworthy usage, store zero tokens, `usage_available=false`, and zero cost; never estimate hidden token consumption.
3. Sum cost/tokens across every event in an operation. Count feature invocations using distinct `operation_id`, not document count; expose document count separately as physical attempts so fallback does not inflate logical call counts.
4. The final attempt has `is_final_attempt=true`. Earlier failed attempts are still retained for fallback-rate and provider-health analysis.
5. Clamp token fields to non-negative bounded integers. If `total_tokens != input_tokens + output_tokens`, use the validated input/output sum and set `token_anomaly=true`.
6. Compute cost only from the price stored on the selected `LlmModelConfigRecord`; snapshot both rates on the event. Never infer a price from a model-name substring. Unknown pricing yields `cost_usd=0` plus a safe `pricing_unknown` metric.
7. Usage persistence is best-effort after attribution has been validated. On insert failure, emit only counters and opaque IDs; do not log prompts, response fragments, raw exceptions from providers, or user identity beyond the already-safe opaque ID.
8. Existing V1 rows remain readable as legacy data. Treat each V1 document as one synthetic logical operation keyed by its document ID. Rows with both `user_id` and `action` remain legacy product usage; rows missing either field contribute only to legacy totals/unknown buckets and never to a named `user × action` row. Aggregations map absent provider/model IDs to `legacy/unknown`; no migration may invent a user or action. Historical probes cannot be distinguished reliably and must be labeled as such in migration notes. New writes are V2 only.

Indexes:

- unique partial index on `(operation_id, attempt_index)` for V2 documents
- `(user_id, action, created_at desc)`
- `(action, created_at desc)`
- `(provider_id, model_config_id, created_at desc)`
- `(source_kind, source_id, created_at desc)`
- existing `(created_at desc)` for time-window scans
- TTL index on `expires_at`

Set `LLM_USAGE_RETENTION_DAYS=180` in V1, validate it to `30..730` in production, and compute `expires_at` server-side. Store only the opaque internal user ID, never email, display name, IP address, prompt, response, or document filename. If longer billing retention is later required, approve that as a separate data-retention decision rather than silently disabling expiry.

## 8. Secret Management

Create `rinkuzu-ai-api/api/shared/llm_secret_crypto.py`. Do not reuse or copy the current OCR passphrase-derived crypto implementation.

### 8.1 Environment Contract

```text
LLM_KEY_ENCRYPTION_KEYS=v2:<urlsafe-fernet-key>,v1:<older-fernet-key>
LLM_KEY_FINGERPRINT_SECRET=<base64 random 32+ bytes>
```

- The first key is the active encryption key.
- Older keys are decrypt-only during rotation.
- Reject duplicate key IDs, malformed Fernet keys, placeholder strings, and short fingerprint secrets at startup in production.
- Never derive a Fernet key by hashing a human passphrase.

### 8.2 Crypto Interface

```python
class CredentialCipher(Protocol):
    def encrypt(self, plaintext: SecretStr) -> EncryptedSecret: ...
    def decrypt(self, encrypted: EncryptedSecret) -> str: ...
    def fingerprint(self, provider_id: str, plaintext: SecretStr) -> str: ...
```

`EncryptedSecret` contains `cipher_version`, `encryption_key_id`, and `ciphertext`.

Fingerprint formula:

```text
HMAC-SHA256(fingerprint_secret, provider_id + NUL + normalized_api_key)
```

The API returns only `label`, `masked_key`, metadata, and health. There is no secret-reveal endpoint. Replace secret uses a dedicated `PUT .../secret` endpoint and increments `secret_version`.

The factory decrypts immediately before an attempt and never caches a client that contains a plaintext key. Python strings cannot be reliably zeroized; document this limitation and keep plaintext lifetime short.

## 9. Endpoint and SSRF Policy

Create `rinkuzu-ai-api/api/shared/llm_endpoint_policy.py` and apply it at provider creation, endpoint update, discovery, probe, snapshot activation, and immediately before every provider attempt.

### 9.1 V1 Rules

- HTTPS only.
- No username/password, query, fragment, control characters, redirects, or ambiguous URL syntax.
- Canonicalize IDNA hostname, IPv4/IPv6, default port, and path.
- Reject loopback, RFC1918/private, link-local, multicast, unspecified, reserved, IPv4-mapped private IPv6, and cloud metadata targets.
- Reject mixed public/private A/AAAA results.
- Re-resolve and validate before every physical attempt.
- `trust_env=False`; do not inherit arbitrary system proxies.
- TLS verification always enabled. Custom CA configuration is operations-only, not an admin UI field.
- No arbitrary request headers or custom query parameters in V1.
- No redirects for `/models` discovery or chat completion.

`LLM_ENDPOINT_ALLOWED_ORIGINS`, when non-empty, further restricts production to exact normalized origins. The UI cannot widen it.

Application validation cannot completely close DNS-to-connect rebinding with LiteLLM. Production acceptance therefore also requires an egress firewall/proxy blocking private/link-local/metadata ranges. Record that infrastructure check separately; do not claim it passed from unit tests alone.

### 9.2 OpenAI Adapter Pinning

The client factory constructs the LiteLLM model string itself:

```python
litellm_model = f"openai/{target.upstream_model_name}"
```

Never pass a user-entered value directly as the LiteLLM provider selector. A stored upstream value such as `bedrock/foo` or `azure/foo` must remain an opaque OpenAI model name under the `openai/` adapter and must never activate ambient cloud credentials.

### 9.3 Discovery and Probe Bounds

- `/models`: 20 second absolute deadline, maximum 2 MiB body, maximum JSON depth, maximum 5,000 items, no redirects.
- Model test: fixed synthetic prompt, maximum 16 output tokens, 20 second deadline.
- Test prompt must contain no student, PDF, quiz, chat, or production data.
- Maximum two concurrent probes per provider and five probe/discovery operations per admin per minute.
- Sanitize error codes; do not return or store a raw upstream response.

## 10. Runtime Types and Services

Create package `rinkuzu-ai-api/api/shared/llm_runtime/`.

### 10.1 `models.py`

Use frozen dataclasses and immutable mappings/tuples:

```python
@dataclass(frozen=True, slots=True)
class KeyRef:
    key_id: str
    provider_id: str
    priority: int
    secret_version: int


@dataclass(frozen=True, slots=True)
class ModelTarget:
    model_id: str
    provider_id: str
    base_url: str
    upstream_model_name: str
    timeout_sec: float
    capabilities: frozenset[LlmCapability]
    key_refs: tuple[KeyRef, ...]


@dataclass(frozen=True, slots=True)
class ResolvedRoute:
    action: LlmAction
    revision: int
    targets: tuple[ModelTarget, ...]


@dataclass(frozen=True, slots=True)
class LlmConfigSnapshot:
    revision: int
    providers: Mapping[str, ProviderSnapshot]
    credential_refs: Mapping[str, CredentialRefSnapshot]
    models: Mapping[str, ModelSnapshot]
    routes: Mapping[LlmAction, tuple[str, ...]]
    step_policies: Mapping[PipelineStepId, bool]


class LlmUsageSource(StrEnum):
    REQUEST = "request"
    PIPELINE_JOB = "pipeline_job"
    QUIZ_DRAFT = "quiz_draft"
    ADMIN_PROBE = "admin_probe"
    SYSTEM = "system"


@dataclass(frozen=True, slots=True)
class LlmUsageAttribution:
    user_id: str | None
    source_kind: LlmUsageSource
    source_id: str | None
    request_id: str | None
```

Snapshots contain no plaintext, ciphertext, fingerprint, or raw provider error.

`LlmUsageAttribution` is created at the application boundary, not reconstructed by the provider adapter. Its constructors enforce these invariants:

- `REQUEST`, `PIPELINE_JOB`, and `QUIZ_DRAFT` require a non-empty authenticated/persisted `user_id`.
- A pipeline job uses its persisted `job_id` as `source_id`; a quiz draft uses its persisted `draft_id`.
- `ADMIN_PROBE` records the admin's user ID but is non-product usage.
- Only an explicitly constructed `SYSTEM` context may have no user ID.
- `request_id` and `source_id` are length-bounded opaque IDs; never place a URL, prompt, filename, email address, or free-form user text in them.
- The gateway creates a fresh server-side `operation_id` for each logical generation call. Clients cannot supply it.

### 10.2 `ports.py`

Define protocols for:

- `LlmConfigRepository`
- `ConfigSnapshotProvider`
- `CredentialSecretStore`
- `LiveAvailabilityOverlay`
- `ModelRouteResolver`
- `LlmClientFactory`
- `CredentialHealthStore`
- `UsageRecorder`

`UsageRecorder.record_attempt(...)` accepts the attribution, action, generated operation ID, physical attempt index, selected target IDs, sanitized outcome, validated token usage, and trusted price snapshot. It never receives messages, schemas, responses, decrypted keys, or raw exceptions.

### 10.3 `snapshot.py`

`MongoConfigSnapshotProvider` behavior:

1. `capture_active()` reads the active pointer and then loads/caches that immutable revision.
2. `capture_revision(revision)` reloads a persisted revision for background recovery.
3. Cache at most 16 revisions and never cache a secret.
4. Build the snapshot fully before putting it into the cache.
5. Return the same immutable object for the same revision.
6. Raise `LlmConfigurationUnavailableError` when the requested revision does not exist.

For ordinary HTTP operations, capture once at the beginning. For a pipeline or quiz draft, capture the persisted revision. Never recapture midway through an operation.

### 10.4 `availability.py`

`LiveAvailabilityOverlay` provides emergency semantics:

- A provider/model/key disabled or deleted in the active configuration is unavailable to every new physical attempt, even if a job pinned an older route revision.
- Route reordering and step-policy changes do not alter an already-running job.
- Secret replacement uses the latest non-revoked secret for the same key ID.

Before creating a client, the executor asks the overlay whether provider, model, and key are still permitted. If not, it skips that attempt and continues the pinned chain.

### 10.5 `resolver.py`

`DefaultModelRouteResolver.resolve()` follows this exact algorithm:

1. Find route by `LlmAction`.
2. If absent or empty, raise `LlmRouteNotConfiguredError`.
3. Merge the action registry capabilities with request-specific capabilities such as vision.
4. Traverse `model_ids` in stored order.
5. Skip missing/disabled models and disabled/missing providers.
6. Skip models missing any required capability.
7. Collect enabled credential refs for the provider.
8. Sort credentials by `(priority, created_at, key_id)`.
9. Skip a model that has no usable credential refs.
10. Return all remaining `ModelTarget`s in route order.
11. If none remain, raise `LlmRouteUnavailableError`.

The resolver never decrypts secrets, calls a provider, mutates health, or silently reads the environment fallback.

### 10.6 `factory.py`

`DefaultLlmClientFactory.create(target, key_ref)`:

1. Re-check endpoint policy.
2. Re-check live availability.
3. Load current secret by `key_id` from `CredentialSecretStore`.
4. Reject revoked or unavailable secret.
5. Decrypt in a local variable.
6. Build `LLMProviderConfig` with provider/model/key/revision metadata.
7. Force `model="openai/<opaque upstream name>"` and provider `openai`.
8. Set LiteLLM `num_retries=0` and client retry attempts to one.
9. Return an uncached `LiteLLMClient` for this one attempt.

Factory tests must prove that model input `bedrock/foo` still produces the OpenAI adapter and that no plaintext is retained in a snapshot or public representation.

### 10.7 `errors.py`

Create a safe taxonomy and classifier. Do not expose `str(raw_exception)` to HTTP, SSE, audit, or logs.

| Failure                     | Disposition                               | Health effect                      |
| --------------------------- | ----------------------------------------- | ---------------------------------- |
| Client cancellation         | stop immediately                          | none                               |
| Timeout/network/408/425     | next key; next model after keys exhausted | bounded cooldown                   |
| 429/quota                   | next key; next model after keys exhausted | honor bounded `Retry-After`        |
| 500/502/503/504             | next key; next model after keys exhausted | exponential cooldown               |
| 401/403 for credential      | next key                                  | quarantine that key/version        |
| Model missing/404           | next model directly                       | mark model target invalid/degraded |
| Empty completion            | next model directly                       | model failure                      |
| Structured parse exhaustion | next model directly                       | model capability failure           |
| 400/422 invalid request     | fail request                              | none                               |
| Content-policy refusal      | fail request; never provider-hop          | none                               |
| Programmer/schema/input bug | fail request                              | none                               |

Safe errors contain only code, action, request ID, attempt count, and resource IDs. Raw bodies and headers are discarded.

### 10.8 `fallback.py`

`FallbackExecutor` owns the only routed attempt loop.

Example chain:

```text
Route: Model A [Key 1, Key 2] -> Model B [Key 3]

Key 1 timeout     -> Key 2
Key 2 rate limit  -> Model B / Key 3
Model A bad input -> stop immediately; do not call Model B
Model A bad JSON  -> Model B directly; do not waste Key 2
```

Rules:

- One `(model_id, key_id)` pair gets at most one physical call per operation.
- Default maximum physical attempts across the entire chain: six.
- Enforce one absolute operation deadline in addition to per-attempt timeout.
- Skip cooldown/quarantined targets.
- Success records the selected IDs, fallback index, attempts, and revision.
- Health success never changes `enabled` and uses CAS on `secret_version`.
- When exhausted, raise `LlmRouteExhaustedError` with a safe aggregate error code.

For routed structured output, set Instructor retries/reasks to zero in V1 so one target attempt is one provider call. A parse failure moves directly to the next model and is counted against the shared attempt budget.

### 10.9 `gateway.py`

Expose only:

```python
generate_text(action, messages, *, attribution, snapshot=None, required_capabilities=..., options=...)
generate_structured(action, messages, schema, *, attribution, snapshot=None, required_capabilities=..., options=...)
stream_text(action, messages, *, attribution, snapshot=None, required_capabilities=..., options=...)
```

Normal application methods do not accept `model`, `base_url`, `api_key`, or arbitrary provider kwargs.

The gateway validates attribution before any provider call, creates one `operation_id`, captures a snapshot when none is supplied, resolves the route, runs fallback, and records safe attempt metadata. Provider/model/key direct selection is available only through `ModelProbeService` and is never callable from a normal user request.

### 10.10 User Attribution Across Async and Background Boundaries

Do not use `current_user_id.get()` as the source of truth. Explicit data flow is required:

```text
Authenticated HTTP endpoint
  -> user_id returned by get_current_user/get_current_admin_user
  -> LlmUsageAttribution.for_request(user_id, request_id)
  -> application service
  -> LlmGateway(..., attribution=attribution)

Background scheduling
  -> persist owner user_id + source ID on job/draft
  -> worker/recovery reloads persisted owner
  -> LlmUsageAttribution.for_pipeline_job(...) or for_quiz_draft(...)
  -> every gateway call in that job receives the same attribution
```

Rules:

- Never assume FastAPI dependency `ContextVar` mutations cross a thread-pool boundary.
- Never assume an `asyncio.create_task`, task queue, process restart, or recovered job inherits request context.
- A request handler passes the authenticated ID returned by the dependency; it does not reread an untrusted header.
- A worker uses the persisted owner, not a user ID from task payload text or current process context.
- User-started `PipelineJob.user_id` becomes required for newly created jobs. Legacy nullable records may recover only through an explicit legacy/system attribution path and must increment an anomaly metric.
- `QuizDraftDocument.user_id` remains required and is used during initial execution, automatic recovery, and explicit retry.
- Missing attribution for product source kinds raises `LlmUsageAttributionError` before the first provider attempt. Failure to persist a valid usage event after a call remains fail-soft and emits a sanitized telemetry failure counter.
- Keep `current_user_id` only as a temporary compatibility fallback while call sites migrate, warn/measure every use, and delete it once the explicit-attribution tests pass.

### 10.11 Streaming

The executor must open the upstream stream and read until the first non-empty text delta before committing:

- Error or empty stream before first token: classify and try the next permitted target.
- After first token has been yielded: never restart or splice another model's output.
- Post-commit error becomes the existing safe SSE failure event.
- Record an attempt event for every physical upstream stream opened. Pre-commit failures normally have `usage_available=false` and zero tokens; if the provider safely reports usage, retain the validated values.
- For the committed target, attach token usage from the final usage chunk when available. A post-commit error remains the outcome of that same attempt; never fabricate a second operation.

## 11. Pipeline Step Policy Registry

Create `rinkuzu-ai-api/api/domains/content_pipeline/domain/step_definitions.py`.

```python
@dataclass(frozen=True, slots=True)
class PipelineStepDefinition:
    step_id: PipelineStepId
    label: str
    required: bool
    default_enabled: bool
    llm_action: LlmAction | None
    bypass_kind: PipelineBypassKind | None
```

### 11.1 Required Steps

These always run and the UI shows a `Required` badge instead of a toggle:

- document loading
- concept extraction
- concept merge/normalization
- prerequisite candidate ranking
- graph construction
- DAG enforcement
- quality gate
- result assembly/persistence

Embedding stages required by current domain invariants remain required unless a separate downstream compatibility audit proves otherwise.

### 11.2 Optional Steps

| Step                           | Default | When off                                                        |
| ------------------------------ | ------- | --------------------------------------------------------------- |
| relation verification          | on      | deterministic candidate acceptance                              |
| AI-assisted cycle resolution   | on      | deterministic weakest-edge cycle resolution; DAG still required |
| pipeline theory pre-generation | on      | no pre-generated theory; on-demand theory still works           |
| transitive reduction           | on      | return the valid DAG with redundant edges retained              |
| SAINT embedding pre-generation | on      | persist `None`; session computes lazily if needed               |

Step off preserves the configured model chain. Enabling it again requires no route re-entry.

### 11.3 Relation Acceptance Strategy

Create `application/relation_acceptance.py`:

```python
class RelationAcceptanceStrategy(Protocol): ...
class LlmRelationAcceptanceStrategy: ...
class DeterministicRelationAcceptanceStrategy: ...
```

Rename the domain result from `VerifiedRelation` to `AcceptedRelation` and add:

```text
verification_status = llm_verified | deterministic_unverified
```

Deterministic algorithm when verification is off:

1. A candidate containing source `mlp` is accepted because the ranker already applied `prs_threshold`.
2. An extraction-only candidate is accepted only when `extraction_confidence >= min_confidence`.
3. A candidate supported by both sources is accepted.
4. Preserve candidate direction `source_id -> target_id`.
5. Confidence is the maximum non-null ranker/extraction score, clamped to `[0, 1]`.
6. Preserve extracted evidence.
7. Set `verification_status="deterministic_unverified"`.
8. Set a machine reason such as `relation_verification_disabled`; do not claim LLM reasoning.
9. Deduplicate by directed pair.

When verification is enabled and its complete model route is exhausted, fail the stage. Do not silently switch the configured behavior to deterministic acceptance. This makes outages visible instead of pretending verification occurred.

Update graph building and serialization to accept `AcceptedRelation`. Serialized edges expose `verification_status`.

### 11.4 Quality Gate

Replace `has_verified_relation_when_multi_concept` with `has_accepted_relation_when_multi_concept`.

Persist and report separately:

- candidate count
- accepted count
- LLM-verified count
- deterministic-unverified count

Known-concept references and `is_dag` remain mandatory. Multi-concept output with zero accepted relations still fails the quality gate.

### 11.5 Cycle Resolution Strategy

Split DAG enforcement from AI assistance:

```python
class CycleResolutionStrategy(Protocol): ...
class LlmThenDeterministicCycleStrategy: ...
class DeterministicCycleStrategy: ...
```

Deterministic algorithm:

1. While graph is cyclic, call `networkx.find_cycle`.
2. Score each edge from its `confidence`, then `ranker_score`, then `extraction_confidence`; a missing score is weakest.
3. Remove the weakest edge.
4. Tie-break deterministically by `(source_id, target_id)`.
5. Continue until DAG or the explicit iteration safety limit.
6. If the safety limit is reached and graph remains cyclic, fail the mandatory DAG invariant.

When AI assistance is on but its route fails, deterministic cycle resolution is allowed because DAG enforcement cannot be skipped. Record `resolution_mode="deterministic_after_llm_failure"` and a warning; never claim an LLM decision.

Change the UI label to “AI-assisted cycle resolution”, not “Cycle removal”.

### 11.6 Theory and Reduction

- Add `PIPELINE_THEORY_GENERATION`; pipeline theory must no longer share `ADAPTIVE_THEORY`.
- Use `GeneratedTheoryEnricher` and `SkippedTheoryEnricher` (Null Object).
- When off, do not add fake content; leave theory absent/`None` consistently.
- Preserve current best-effort behavior when generation is on: failures produce warnings rather than invalidating a graph that already passed the quality gate.
- Effective transitive reduction is `admin_policy_enabled and request.apply_reduction`; the existing request field can opt out but cannot override a global admin OFF.

### 11.7 Debug Trace

Every optional step emits a trace entry even when bypassed:

```text
status: skipped | completed | failed
policy_enabled
bypass_kind
llm_config_revision
output counts/warnings
```

Skipped steps still advance their progress checkpoint so the UI does not appear stuck.

## 12. FastAPI Admin API Contract

Create `api/schemas/admin_llm_settings.py` and `api/routers/admin_llm_settings.py`. Prefix: `/api/v1/admin/llm-settings`.

All endpoints require `get_current_admin_user` plus the optional production `LLM_CONFIG_ADMIN_USER_IDS` allowlist. All successful reads return `meta.revision` and `ETag: "llm-config-<revision>"`. All configuration mutations require `If-Match`.

### 12.1 Snapshot

```text
GET /snapshot
```

Returns:

- action definitions and required capabilities
- pipeline step definitions
- provider summaries
- masked credential metadata and health
- model metadata
- ordered routes
- step-policy values
- active revision
- legacy migration/fallback status, without exposing env values

Always set `Cache-Control: private, no-store` and `Pragma: no-cache`.

### 12.2 Providers

```text
POST   /providers
PATCH  /providers/{provider_id}
DELETE /providers/{provider_id}
POST   /providers/{provider_id}/test
```

Create/patch fields: name, base URL, timeout, enabled. Test performs endpoint/model-free protocol checks with a selected current key; it does not accept an arbitrary prompt.

### 12.3 Credentials

```text
POST   /providers/{provider_id}/keys
PATCH  /providers/{provider_id}/keys/{key_id}
PUT    /providers/{provider_id}/keys/{key_id}/secret
DELETE /providers/{provider_id}/keys/{key_id}
POST   /providers/{provider_id}/keys/{key_id}/test
```

- Create accepts `SecretStr api_key`.
- Metadata patch accepts label, priority, enabled; never accepts a secret.
- Replace endpoint accepts only a new `SecretStr api_key` and increments `secret_version`.
- Responses are masked-only.

### 12.4 Models

```text
POST   /providers/{provider_id}/models
PATCH  /providers/{provider_id}/models/{model_id}
DELETE /providers/{provider_id}/models/{model_id}
POST   /providers/{provider_id}/models/discover
POST   /providers/{provider_id}/models/{model_id}/test
```

Manual entry is the primary flow. Discovery reads bounded `/models` data and returns candidates; it does not automatically import all entries. Test uses the fixed synthetic prompt and reports only safe result fields.

### 12.5 Routing and Step Policies

```text
PUT /routing
```

One request atomically replaces the complete routing draft and optional step policy values:

```json
{
  "routes": [
    {
      "action": "adaptive_tutor_chat",
      "model_ids": ["model_primary", "model_fallback"]
    }
  ],
  "step_policies": [{ "step_id": "relation_verification", "enabled": false }]
}
```

The backend merges only known actions/steps, validates the full aggregate, preserves model order exactly, and returns the new revision. Turning a step off does not clear its route.

### 12.6 Error Codes

Add and document:

- `llm_config_revision_required` → 428
- `llm_config_revision_conflict` → 412
- `llm_config_reference_conflict` → 409
- `llm_endpoint_not_allowed` → 422
- `llm_route_not_configured` → 503 for runtime feature requests
- `llm_route_unavailable` → 503
- `llm_route_exhausted` → 503
- `llm_key_decrypt_failed` → safe internal/runtime error
- `llm_provider_probe_failed` → sanitized test result/error
- `llm_settings_unavailable` → 503

Never return a raw provider exception or response body.

### 12.7 Usage Accounting API

Keep the existing prefix `/api/v1/admin/llm-usage` and require `get_current_admin_user` plus the same optional production admin allowlist used by AI settings.

```text
GET /summary
GET /events
```

`GET /summary` accepts validated optional filters:

```text
window=1d|7d|30d|90d|180d
user_id=<opaque exact ID>
action=<known LlmAction>
provider_id=<opaque exact ID>
model_config_id=<opaque exact ID>
source_kind=request|pipeline_job|quiz_draft|admin_probe|system
include_non_product=false
```

Default `include_non_product=false` excludes admin probes and system work from product totals. Return:

- totals for distinct logical operations, physical attempts, successful/failed operations, fallback operations, tokens, and cost
- `by_action`, `by_user`, `by_provider`, and `by_model`
- `by_user_action` rows with `{user_id, action, logical_operations, physical_attempts, total_tokens, cost_usd}`
- daily logical-operation/attempt/token/cost series
- token-anomaly count, unknown-price count, usage-persistence failure count when available from metrics

For action/user totals, deduplicate by `operation_id` before counting logical operations. Model/provider breakdowns must label counts explicitly as attempts because one fallback operation can touch multiple targets. Cap every breakdown to 100 rows and include a `truncated` flag; never run an unbounded group into an HTTP response.

`GET /events` is a cursor-paginated diagnostic view with `limit=1..100` and the same filters. It returns only the safe V2 fields in Section 7.6; it never joins an email/name, decrypts a key, or returns content/raw errors. Sort by `(created_at desc, event_id desc)`, sign/validate the cursor, and force `Cache-Control: private, no-store` on both endpoints.

The current `/summary` endpoint is backward-compatible during rollout: keep legacy `calls`, `by_action`, `by_model`, and `by_user` response fields until the Next.js client migrates, but define `calls` as distinct logical operations for V2 rows. Add the new unambiguous `logical_operations` and `physical_attempts` fields immediately.

## 13. FastAPI File-by-File Implementation

Before modifying an existing symbol, obey each repository's `AGENTS.md`: run GitNexus upstream impact analysis, report HIGH/CRITICAL blast radius, and run change detection before commits/handoff. If GitNexus tooling is unavailable, stop and report that limitation before editing production symbols.

### Wave 0 — Security Prerequisites

1. Modify `api/exceptions.py`.
   - Sanitize request validation logging to `loc`, `type`, and safe `msg` only.
   - Never log Pydantic's raw `input` for `SecretStr` fields.
   - Add a log-capture regression test proving an API key is absent.
2. Create `api/shared/llm_safe_errors.py`.
   - Define public-safe error taxonomy and redaction.
3. Update tutor SSE and other LLM exception handlers.
   - Remove every `str(exc)` that can cross an HTTP/SSE boundary.
4. Change `api/routers/admin_usage.py` from `get_current_user` to `get_current_admin_user` as defense in depth.
5. Disable LiteLLM verbose/content logging for routed calls; do not log prompts/responses.

Exit criterion: malformed secret input and upstream errors cannot leak a key through response, Loguru, traceback, audit, or SSE.

### Wave 1 — Contracts and Domain Types

Create:

- `api/shared/llm_runtime/__init__.py`
- `api/shared/llm_runtime/actions.py`
- `api/shared/llm_runtime/models.py`
- `api/shared/llm_runtime/ports.py`
- `api/shared/llm_runtime/errors.py`
- `api/domains/content_pipeline/domain/step_definitions.py`

Modify `api/shared/llm_usage.py` to re-export the new action enum temporarily.

Write registry and frozen-model unit tests before persistence or network code.

### Wave 2 — Crypto and Persistence

Create:

- `api/shared/llm_secret_crypto.py`
- `api/shared/persistence/llm_settings.py`

Modify:

- `api/config.py`: parse/validate keyring, fingerprint secret, endpoint policy, cache and probe limits, legacy flags, admin allowlist.
- `api/shared/persistence/documents.py`: add revision, secret, health, state, audit documents; extend usage/job/draft fields.
- `api/shared/mongo_store.py`: register documents and expose transaction/database capability helpers.
- `api/shared/persistence/__init__.py`: export the new repository surface.

Repository public serializers must never include ciphertext or fingerprint. Add transaction/CAS tests before adding routers.

### Wave 3 — Endpoint Policy and Probe Transport

Create:

- `api/shared/llm_endpoint_policy.py`
- `api/shared/llm_probe.py`

Implement canonicalization, DNS classification, response bounds, fixed paths, fixed prompt, no redirects, and `trust_env=False`. Do not reuse `url_fetch.py` without closing its DNS-rebinding/redirect gaps.

### Wave 4 — Runtime Router

Create:

- `api/shared/llm_runtime/snapshot.py`
- `api/shared/llm_runtime/availability.py`
- `api/shared/llm_runtime/resolver.py`
- `api/shared/llm_runtime/factory.py`
- `api/shared/llm_runtime/fallback.py`
- `api/shared/llm_runtime/gateway.py`
- `api/shared/llm_runtime/probe_service.py`

Modify `api/shared/llm.py`:

- Keep it as the concrete LiteLLM adapter and message/response normalization layer.
- Extend provider config with safe provider/model/revision metadata.
- Allow message normalization to preserve images from resolved capabilities rather than LiteLLM's guessed model catalogue.
- Make the routed client single-attempt.
- Keep old `ainvoke_*` wrappers only for migration compatibility.

Modify `api/shared/retry.py` so the new classifier, not “almost every Exception”, controls LLM retry/fallback.

### Wave 5 — Composition Root and Dependencies

Modify `api/lifespan.py` after Mongo initialization:

1. Probe transaction support.
2. Build settings repository.
3. Build secret cipher/store and endpoint policy.
4. Build snapshot provider and live availability overlay.
5. Build resolver, client factory, health store, fallback executor, gateway, and probe service.
6. Put them on `app.state`.
7. Inject gateway/snapshot provider into existing long-lived services.
8. Replace `_log_llm_config()` so missing legacy env no longer crashes startup and no sensitive URL/key details are logged.

Modify `api/dependencies.py` to add typed getters for gateway, snapshot provider, settings service, and probe service.

### Wave 6 — Admin Control Plane

Create:

- `api/schemas/admin_llm_settings.py`
- `api/routers/admin_llm_settings.py`
- application service/command models in `api/shared/llm_runtime/settings_service.py` or a dedicated `api/domains/llm_settings/application/` package; choose one location and keep router logic thin.

Modify `api/main.py` to register the router. Add rate limits that do not exempt every internal service-token request as an admin.

### Wave 7 — Learning and Tutor Call Sites

Modify `api/domains/learning/exercise_gen.py`:

- Remove `_resolve_shared_llm_model` use.
- Pass/inject `LlmGateway` and optional snapshot.
- Call `generate_structured(action=...)`.
- Allow pipeline theory caller to pass `PIPELINE_THEORY_GENERATION`.

Modify `api/domains/learning/exercise_service.py`:

- Inject gateway/snapshot provider from lifespan.
- Capture one snapshot for one service operation.
- Accept the authenticated user ID at the HTTP/application boundary, construct one request attribution object, and pass it to every gateway call in that service operation.

Modify:

- `api/domains/quiz/tutor_core.py`
- `api/domains/quiz/tutor_chat.py`
- `api/domains/quiz/quiz_tutor.py`

Remove explicit model resolution and route through the gateway. Summary and final tutor response in one request use the same snapshot. When images are present, add runtime `VISION` capability. Preserve the pre-first-token streaming rule.

### Wave 8 — Quiz Extraction Background Work

Modify:

- `api/domains/quiz/extraction.py`: remove model/API-key parameters and env validation; use `QUIZ_EXTRACTION`.
- `api/domains/quiz/draft_service.py` and `draft_tasks.py`: persist/capture `llm_config_revision` at schedule time and reconstruct `LlmUsageAttribution.for_quiz_draft(user_id=draft.user_id, draft_id=draft.draft_id, ...)` inside the worker.
- `QuizDraftDocument` and serializers: round-trip the revision.

Automatic recovery uses the persisted revision and persisted owner. An explicit user retry captures the current active revision but still attributes usage to the draft owner; it never inherits a stale request `ContextVar`.

### Wave 9 — Content Pipeline Routing Revision

Modify:

- `api/domains/content_pipeline/domain/jobs.py`
- `api/shared/persistence/documents.py`
- `api/shared/persistence/pipeline_jobs.py`
- `api/domains/content_pipeline/application/pipeline_service.py`
- `api/domains/content_pipeline/application/pipeline_runner.py`
- `api/lifespan.py`

Add `llm_config_revision` before queueing and require `user_id` for newly created user jobs. The runner calls `capture_revision()` once, reconstructs `LlmUsageAttribution.for_pipeline_job(user_id=job.user_id, job_id=job.job_id, ...)`, and passes the same snapshot and attribution to every LLM-backed stage. Automatic recovery keeps the old revision and persisted owner; explicit retry captures the new active revision without changing usage ownership.

### Wave 10 — Content Pipeline Call Sites

Modify:

- `infrastructure/llm/structured_generation.py`: inject gateway/snapshot; remove env config builder.
- `infrastructure/llm/extract_chain.py`: no implicit client construction; keep explicit action IDs.
- `infrastructure/graph/cycle_removal.py`: depend on cycle strategy/gateway, not `ainvoke_structured_completion`.
- `infrastructure/runtime.py`: build snapshot-bound collaborators instead of caching a globally configured extraction client.
- `application/pipeline_runner.py`: pass the snapshot and policies.

After migration, this command must return no normal domain call sites:

```powershell
rg "ainvoke_|astream_text_completion|get_default_llm_client|_resolve_shared_llm_model" rinkuzu-ai-api/api/domains
```

### Wave 11 — Optional Pipeline Strategies

Create/modify:

- `application/relation_acceptance.py`
- `application/relation_engine.py`
- `application/ports.py`
- `domain/relations.py`
- `application/stages/relation_verification.py`
- `application/stages/graph_building.py`
- `application/stages/quality_gate.py`
- `application/stages/graph_optimization.py`
- `application/stages/enrichment.py`
- `application/stages/result_assembly.py`
- `infrastructure/graph/cycle_removal.py`
- `application/pipeline_runner.py`

Implement the exact strategies and metrics from Section 11. Do not scatter raw `if policy.enabled` checks through unrelated modules; resolve a strategy once and inject it.

### Wave 12 — Usage and Observability

This wave is not only a schema edit. Complete it in the following order:

1. Add `LlmUsageSource`, `LlmUsageAttribution`, validation constructors, and `LlmUsageAttributionError`.
2. Extend `LlmUsageDocument` to the exact V2 schema and indexes in Section 7.6 while keeping old documents readable.
3. Replace model-name substring pricing with the trusted per-model input/output price snapshot.
4. Change `UsageRecorder` to record every physical attempt with one shared `operation_id`, 1-based attempt index, 0-based fallback index, source, owner, safe outcome, validated token values, and price/cost.
5. Make `LlmGateway` require attribution. Generate the operation ID internally and pass it through `FallbackExecutor`; do not let routers or clients provide it.
6. Migrate every HTTP-backed LLM call site to build attribution from the user ID returned by `get_current_user`/`get_current_admin_user`.
7. Migrate pipeline and quiz workers/recovery to build attribution from persisted `job.user_id`/`draft.user_id`; do not read request context in a worker.
8. Treat admin provider/model/key tests as `ADMIN_PROBE`, keep the admin actor ID, and exclude them from product aggregates by default.
9. Keep current `ContextVar` attribution only behind a temporary measured compatibility fallback. Add a counter for every use, then remove it when repository search proves no call site depends on it.
10. Upgrade `api/routers/admin_usage.py`, `api/schemas/admin_usage.py`, and aggregation repository helpers to the filtering, cross-dimensional breakdown, operation/attempt semantics, limits, and access control in Section 12.7.
11. Add retention configuration, V2 index migration/dry run, and metrics for write failure, missing attribution, token anomaly, unknown pricing, fallback operations, and per-target recoverable failures.
12. Update OpenAPI and the existing Next.js admin usage client after the backend contract is green.

Do not store prompt, response, ciphertext, fingerprint, masked key, email, display name, IP address, document filename, or raw provider error. Provider-reported token numbers are untrusted: clamp invalid negatives/overflow/inconsistencies and mark an anomaly.

Exit criterion: every product usage event has both a known `LlmAction` and non-empty owner `user_id`; request, initial background execution, automatic recovery, explicit retry, and ordered fallback all preserve correct attribution in tests.

### Wave 13 — Migration Script

Create `rinkuzu-ai-api/scripts/migrate_llm_settings.py` with:

```text
python scripts/migrate_llm_settings.py
python scripts/migrate_llm_settings.py --apply --approve-plan=<sha256>
python scripts/migrate_llm_settings.py --verify
```

Dry-run output is deterministic and redacted. Apply re-reads source settings and requires the exact plan hash. Verify decrypts internally and resolves every action but sends no provider request.

Legacy mapping:

- Provider from `LLM_BASE_URL` and one encrypted credential from `LLM_API_KEY`.
- Base model from `LLM_MODEL`.
- Exercise model from `EXERCISE_LLM_MODEL` when different.
- Base model routes: quiz extraction and pipeline concept/relation/cycle actions.
- Exercise model, or base fallback: adaptive exercise/theory/evaluation/tutor/summary/quiz tutor and pipeline theory generation.
- All optional policies default on.

The script is idempotent and never overwrites an existing active DB configuration.

## 14. Next.js Implementation

The admin settings page remains in the existing authenticated Next.js application. Do not place the internal service token in browser code.

### 14.1 Route and Navigation Files

Modify:

- `src/shared/constants/routes.ts`: add `ROUTES.ADMIN.AI_SETTINGS`.
- `src/shared/constants/nav.ts`: add the admin sidebar item.
- `messages/vi/admin.json`, `messages/en/admin.json`, `messages/vi/nav.json`, `messages/en/nav.json`: add all labels, validation, health, conflict, fallback, and warning strings.

Create:

- `src/app/[locale]/(app)/admin/ai-settings/page.tsx`
- `src/app/[locale]/(app)/admin/ai-settings/loading.tsx`

`page.tsx` is a Server Component. It parses `tab=providers|routing` and optional `provider=<id>`, then renders the client feature. It does not fetch or serialize secret-bearing data. Admin authorization remains in the existing layout and every API handler rechecks it.

### 14.2 Feature Boundary

Create `src/features/admin/ai-settings/` with:

```text
types/admin-ai-settings-view-model.ts
validation/admin-ai-settings.schema.ts
mappers/admin-ai-settings.mapper.ts
api/admin-ai-providers-api.ts
api/admin-ai-routing-api.ts
components/AiSettingsClient.tsx
components/ProvidersPanel.tsx
components/ProviderDetail.tsx
components/ProviderFormModal.tsx
components/ProviderKeysPanel.tsx
components/ProviderModelsPanel.tsx
components/PipelineRoutingPanel.tsx
components/ModelChainEditor.tsx
components/AdminAiSettingsSkeleton.tsx
```

Rules:

- DTOs use generated OpenAPI types where available; mappers produce camelCase view models.
- Raw `apiKey` exists only in create/replace input types and local form state.
- Provider/model/key lists never contain raw/encrypted secrets or fingerprints.
- Client Zod validation is UX only; FastAPI remains authoritative.
- Preserve ordered `modelIds` exactly.
- Keep routing edits in a local draft with save/discard and unsaved-change warning.
- A `412` never silently merges; refetch and ask the admin to reapply the draft.
- Step toggles and model chains are separate fields. Toggling off never clears the chain.

### 14.3 Providers UX

Providers tab:

- Left/master list: name, endpoint origin, enabled/health status, enabled-key count, model count.
- Right/detail: provider metadata, separate Keys and Models sections.
- Mobile: list or detail with a back action; desktop: master/detail.
- Add/edit provider modal contains name, base URL, timeout, explicit enabled state, and data-egress warning.

Key panel:

- Sort ascending priority and label it clearly: “1 runs before 10”.
- Add, metadata edit, replace secret, test, enable/disable, delete.
- Password input uses `autoComplete="new-password"` and is cleared on success, close, and unmount.
- Never put a secret into URL, toast, reducer history, localStorage, query state, or rendered debug output.

Model panel:

- Manual upstream name is primary.
- Discovery is optional secondary flow and imports only selected candidates.
- Configure display name, capabilities, enabled, optional timeout/pricing.
- Test uses a synthetic backend probe only.

### 14.4 Routing UX

Group cards by Adaptive Learning, Tutor, Quiz, and Content Pipeline.

Each action card shows:

- label and description from backend registry
- required capability badges
- ordered model chain
- provider/model health warnings
- primary/fallback numbering
- add, remove, move up, and move down controls

For optional pipeline steps, show an additional “Run this step” toggle and a description of the exact bypass. Required steps show a badge and cannot be toggled.

`ModelChainEditor`:

- Filters new choices by capabilities.
- Keeps disabled/missing existing assignments visible as invalid repair rows.
- Blocks save while any row is invalid or duplicated.
- Uses keyboard-accessible up/down buttons; no new drag library.

Save `PUT /routing` atomically. Do not save each row independently.

### 14.5 Explicit BFF Route Handlers

Create explicit handlers under `src/app/api/admin/ai-settings/**`; do not add a broad catch-all:

```text
route.ts                                      GET snapshot
providers/route.ts                            POST
providers/[providerId]/route.ts               PATCH, DELETE
providers/[providerId]/test/route.ts          POST
providers/[providerId]/keys/route.ts          POST
providers/[providerId]/keys/[keyId]/route.ts  PATCH, DELETE
providers/[providerId]/keys/[keyId]/secret/route.ts PUT
providers/[providerId]/keys/[keyId]/test/route.ts   POST
providers/[providerId]/models/route.ts        POST
providers/[providerId]/models/discover/route.ts POST
providers/[providerId]/models/[modelId]/route.ts PATCH, DELETE
providers/[providerId]/models/[modelId]/test/route.ts POST
routing/route.ts                              PUT
```

Every handler:

- exports `dynamic = "force-dynamic"`
- uses a new `withLlmConfigAdmin` wrapper
- URL-encodes every dynamic ID
- proxies only to the corresponding fixed FastAPI path
- forwards only JSON content type, trusted request ID, and `If-Match` when required
- forces `private, no-store`

### 14.6 Auth/CSRF and Proxy Changes

Modify `src/lib/api/auth.ts`:

- Add `withLlmConfigAdmin` around `withAdmin`.
- In production, require the user ID to be present in `LLM_CONFIG_ADMIN_USER_IDS` when configured.
- For mutations require exact same origin, `Sec-Fetch-Site: same-origin`, and JSON content type.

Modify `src/lib/adaptive/proxy.ts`:

- Add `PUT` to allowed methods.
- Add an explicit `forwardIfMatch` option; never forward arbitrary browser headers.
- Forward a validated/truncated `x-request-id`.
- Preserve upstream `ETag`.
- Force no-store for `/admin/llm-settings/**`.
- Never log or reflect raw upstream bodies.

The existing global CSRF guard accepts `same-site`/`none`; sensitive AI-settings mutations must use the stricter route wrapper even if the global middleware remains unchanged.

### 14.7 Generated Contracts

After backend OpenAPI changes:

1. Regenerate `contracts/adaptive-openapi.json`.
2. Regenerate `src/generated/adaptive-api.d.ts`.
3. Run the vendored/live contract checks.
4. Use generated DTOs in the feature and keep UI-only view models separate.

### 14.8 Existing Admin Usage Dashboard

Usage reporting stays on the existing admin stats page; do not duplicate it inside the provider editor. Extend:

- `src/app/api/admin/llm-usage/route.ts`
- `src/features/admin/stats/api/llm-usage-api.ts`
- `src/features/admin/stats/types/llm-usage-view-model.ts`
- `src/features/admin/stats/components/LlmUsageSection.tsx`
- `messages/vi/admin.json` and `messages/en/admin.json`

Required UI behavior:

- Keep current totals and `byAction`/`byModel`/`byUser` views during migration.
- Add time-window, action, exact user-ID, provider, and model filters. The BFF forwards only those allowlisted query parameters and URL-encodes values.
- Show logical operations and physical attempts as separate numbers; label fallback rate as operations with more than one physical attempt.
- Add a `User × Action` table showing operations, attempts, tokens, and cost so the administrator can answer “which user spent how much on which feature?” without correlating two separate top-ten lists.
- Add provider/model attempt tables and token-anomaly/unknown-price warnings.
- Exclude probes/system usage by default. A clearly labeled admin-only toggle may include them and must not persist in local storage.
- Display only the opaque user ID. Do not join or render email, name, prompt, response, key label, filename, or raw provider error.
- Empty/legacy values render as `legacy/unknown`; they must not be silently assigned to the currently signed-in admin.
- Summary and event requests use `no-store`; filter changes cancel stale requests and never cache per-user results in a shared client cache.

An optional expandable diagnostic row may load `/events` for one operation, but it may show only the safe fields in Section 7.6. It must not become a prompt/response inspection screen.

## 15. Migration and Rollout

### Phase A — Additive Code, Dynamic Config Off

- Deploy schema/runtime support with `LLM_DYNAMIC_CONFIG_ENABLED=false` and legacy env behavior unchanged.
- Verify Mongo transactions, crypto keyring, endpoint egress policy, and indexes.
- No UI mutation is enabled until those checks pass.

### Phase B — Bootstrap and Verify

- Run redacted dry-run migration.
- Review/approve plan hash.
- Apply and verify every action resolves.
- Enable admin UI while inference still uses legacy env.

### Phase C — Shadow Resolution

- Resolve DB routes and compare expected IDs, but make only the legacy provider call.
- Do not send duplicate LLM calls or duplicate data.
- Record mismatches without secrets.

### Phase D — Canary

- Enable selected non-stream actions first.
- Then enable content-pipeline background actions.
- Then enable tutor streaming.
- Use an explicit action allowlist for canary, not random per-call behavior.

### Phase E — Full Dynamic Routing

- Set dynamic routing active for all actions.
- Keep `LLM_ALLOW_ENV_FALLBACK=true` only for actions with no DB assignment during a bounded soak period.
- An explicit but unusable DB route fails closed and never falls back to env.

### Phase F — Remove Legacy Secrets

- Set `LLM_ALLOW_ENV_FALLBACK=false`.
- Remove `LLM_API_KEY`, `LLM_MODEL`, and `EXERCISE_LLM_MODEL` from runtime pods after soak.
- Keep migration compatibility code for one release, then remove it.

Rollback before env removal is a feature-flag/action-allowlist change. After env removal, rollback requires re-injecting the legacy secret from the deployment secret manager; never implement a plaintext DB export.

## 16. Test Plan

### 16.1 Backend Runtime Tests

Create:

- `tests/core/shared/llm_runtime/test_actions.py`
- `test_snapshot_provider.py`
- `test_route_resolver.py`
- `test_client_factory.py`
- `test_fallback_executor.py`
- `test_gateway.py`
- `test_stream_fallback.py`
- `test_llm_secret_crypto.py`
- `test_llm_endpoint_policy.py`

Mandatory cases:

- exact model order and strict key priority
- disabled/missing provider/model/key skipped
- required capability filtering
- key auth failure moves to next key
- timeout/429/5xx moves through keys then models
- model 404/empty/structured parse moves directly to next model
- bad request/content policy/cancellation does not fallback
- total attempt/deadline budget enforced
- stream fallback before first token
- no fallback after first token
- factory sets all hidden retries to zero
- OpenAI adapter pinning for hostile model prefixes
- snapshot contains no plaintext/ciphertext/fingerprint
- old revision stays immutable while live disable/revocation still blocks an attempt

### 16.2 Endpoint Security Tests

Cover:

- `127.0.0.1`, `::1`, RFC1918, metadata, link-local, multicast, unspecified
- IPv4-mapped IPv6
- decimal/octal/hex/ambiguous IP notation
- IDNA normalization
- mixed public/private A/AAAA
- CNAME to private target
- public-to-private rebinding sequence
- userinfo, query, fragment, control chars
- HTTP and redirect rejection
- response byte/model-count/deadline limits

### 16.3 Persistence/Admin Tests

Create:

- `tests/core/persistence/test_llm_settings_repository.py`
- `tests/core/persistence/test_llm_config_transactions.py`
- `tests/test_admin_llm_settings.py`
- `tests/test_llm_security_redaction.py`

Cover:

- non-admin and non-allowlisted admin denied
- usage summary/events also require `get_current_admin_user`; a valid non-admin service-token caller remains denied
- missing/stale revision 428/412
- one of two concurrent admins commits; the other fails
- audit, revision, and mutation are atomic
- duplicate fingerprint rejected without leaking value
- public response/log/audit never contains secret/ciphertext/fingerprint
- dedicated secret replacement increments version and resets health safely
- old health success cannot revive replaced/disabled key
- deleting referenced resources returns 409
- disabling final usable target returns 409
- route reorder is atomic and preserves exact order
- required step cannot be disabled
- probe uses fixed synthetic content and sanitized errors

### 16.4 Pipeline Tests

Create/update:

- `test_relation_acceptance_strategies.py`
- relation engine/verification/graph building tests
- quality gate tests
- graph optimization/cycle removal tests
- enrichment tests
- pipeline runner/recovery/persistence round-trip tests

Cover:

- verification off never calls verifier
- deterministic relation is marked unverified
- quality gate counts accepted versus verified correctly
- AI cycle assistance off never calls gateway but output is a DAG
- AI failure uses deterministic DAG fallback with warning
- theory off makes no generation call
- reduction uses `admin enabled AND request enabled`
- skipped trace advances progress
- active config change does not alter a running job's route/order/policy
- emergency disable/revocation does block the next physical attempt
- automatic recovery uses persisted revision
- explicit retry captures current revision

### 16.5 Frontend Tests

Add mapper/API/route/component tests for:

- no raw/encrypted secret fields in view models
- encoded dynamic IDs
- correct methods and fixed upstream paths
- `If-Match`, `PUT`, ETag/revision metadata, and no-store
- 401/403/412/428/409 handling
- secret input clearing and masked-only rendering
- provider selection and master/detail navigation
- capability filtering
- duplicate prevention
- exact add/remove/up/down model order
- step off preserves the saved chain
- unsaved changes and stale-revision recovery
- usage filters forward only allowlisted encoded values
- logical operations and physical attempts never share one ambiguous `calls` label
- `User × Action` mapping preserves both keys and all accounting fields
- probes/system usage are excluded by default and the include toggle is explicit
- no usage view model or rendered diagnostic row contains content, email, filename, key metadata, or raw errors

Playwright flow:

1. Add provider.
2. Add two prioritized masked keys.
3. Add two models.
4. Assign Tutor primary/fallback chain.
5. Save and reload; order is preserved.
6. Simulate recoverable primary failure; backend records fallback target.
7. Verify no DOM/network response exposes a raw key.

### 16.6 Usage Attribution and Accounting Tests

Create/update:

- `tests/core/shared/llm_runtime/test_usage_attribution.py`
- `tests/core/shared/llm_runtime/test_usage_recorder.py`
- `tests/test_admin_llm_usage.py`
- corresponding pipeline runner/recovery and quiz draft task tests

Mandatory cases:

- An authenticated request persists the exact returned dependency `user_id` and explicit `LlmAction` even when `current_user_id` is unset or deliberately contains a different value.
- Every product source constructor rejects empty/whitespace user IDs before `LlmClientFactory` or an HTTP client is called.
- Explicit `SYSTEM` attribution permits `user_id=None`; no other source does.
- Initial pipeline execution, automatic recovery, and explicit retry use the persisted job owner and correct action for every stage.
- Initial quiz extraction, automatic recovery, and explicit retry use the persisted draft owner.
- Two fallback attempts share one operation ID, use attempt indexes 1/2, expose one logical operation and two physical attempts, and keep each selected model/key ID.
- A failed attempt without provider usage stores zero tokens, zero cost, and `usage_available=false`; a later success stores only its validated reported usage.
- A provider-reported negative, non-numeric, overflowing, or inconsistent token field is safely normalized and marks `token_anomaly`.
- Cost uses the selected model's stored price snapshot; changing the model price later does not change historical event cost.
- Unknown price records usage with zero cost and an anomaly metric; it never guesses based on model-name text.
- Streaming pre-commit fallback records each opened upstream attempt. Streaming post-commit failure records one committed attempt and never opens another.
- `record_attempt` storage failure does not fail an already completed LLM response and logs/metrics contain no content or raw provider exception.
- Summary filters by user, action, provider, model, source, and window; operation counts are distinct and token/cost sums include all physical attempts.
- `by_user_action` is correct when one user invokes multiple actions and multiple users invoke the same action.
- Admin probes and system operations are excluded by default and included only when explicitly requested.
- Legacy rows remain readable under `legacy/unknown` without being assigned a current user/action.
- Non-admin access, invalid action/source, overlong IDs, oversized limit, malformed cursor, and over-retention window are rejected safely.
- Usage responses/documents never contain prompt, response, email, display name, IP, filename, key/ciphertext/fingerprint, or raw provider error.
- TTL/index migration creates the exact indexes in Section 7.6 and its dry run is idempotent.

### 16.7 Migration Tests

Create `tests/scripts/test_migrate_llm_settings.py` and secret-rotation tests:

- base/exercise model deduplication
- different exercise override mapping
- missing secret fails without printing it
- existing active config untouched
- deterministic redacted plan hash
- apply requires exact approved hash
- verify resolves all actions without provider calls
- old encryption key decrypts during rotation; new writes use active key

## 17. Verification Commands

Run targeted tests after each wave, then full gates.

Backend:

```powershell
cd rinkuzu-ai-api
uv run pytest
uv run ruff check api tests scripts
uv run mypy api
uv run pip-audit
```

Frontend:

```powershell
cd rinkuzu
npm run typecheck:strict
npm run lint
npm run test:unit
npm run check:adaptive-contract
npm run build
npm run test:e2e
```

Also run repository-required GitNexus change detection and database index migration dry-run/verify steps from each `AGENTS.md`. Never use `--no-verify`.

Live checks that cannot be proven locally must be reported separately:

- Mongo transaction/replica-set support
- production egress firewall rules
- DNS rebinding blocked at network layer
- real provider compatibility
- encryption keyring installed consistently on every FastAPI replica

## 18. Implementation Sequence for a Weaker Model

The implementing model must follow this discipline:

1. Work on one wave only.
2. Read every existing file listed in that wave before editing.
3. Run required GitNexus impact analysis before editing existing symbols.
4. Write or update the targeted tests first when practical.
5. Implement only the interfaces and semantics specified here.
6. Run targeted tests and static checks.
7. Search for forbidden leftovers and secret fields.
8. Report changed files, tests run, and remaining blockers.
9. Do not begin the next wave while the current wave is red.
10. Preserve unrelated worktree changes.

Do not improvise these changes:

- Do not replace strict key priority with random/load-balanced selection.
- Do not use LiteLLM Router hidden fallback in addition to `FallbackExecutor`.
- Do not let call sites pass model names.
- Do not clear a route when a step is disabled.
- Do not claim deterministic relations are verified.
- Do not disable DAG enforcement.
- Do not retry/fallback content-policy or invalid-request errors.
- Do not restart a stream after the first token.
- Do not cache plaintext keys.
- Do not silently fall back to env when an explicit route is broken.
- Do not return raw provider errors.
- Do not derive a product usage owner from inherited `ContextVar` state inside async/background work; pass the authenticated or persisted owner explicitly.
- Do not count physical fallback attempts as separate logical feature invocations.

## 19. Definition of Done

The feature is complete only when all statements are true:

- An authorized admin can add an OpenAI-compatible provider, multiple masked priority keys, and multiple models.
- Every `LlmAction` can store an ordered model chain.
- Normal domain call sites provide only action, content/schema, explicit usage attribution, and generation options; they never provide a model/key/provider.
- `ModelRouteResolver`, `FallbackExecutor`, and `LlmClientFactory` have distinct responsibilities.
- Multiple keys are attempted in deterministic priority order.
- Cross-model fallback happens only according to the failure matrix.
- There are no hidden adapter retries multiplying attempts.
- Streaming never restarts after emitting the first token.
- Requests/background jobs use pinned immutable revisions.
- Every product usage event has a non-empty persisted owner `user_id`, a known `LlmAction`, a server-generated operation ID, and safe source metadata.
- Foreground requests, pipeline/quiz background execution, automatic recovery, and explicit retry preserve the correct owning user without relying on inherited `ContextVar` state.
- One logical operation and its physical fallback attempts are counted separately; all attempts share one operation ID and historical prices remain immutable.
- The admin usage API/dashboard can filter and summarize by user, action, `user × action`, provider, and model; probes/system traffic are excluded from product totals by default.
- Usage retention is enforced and usage data contains no prompt/response or direct profile data such as email, name, IP, or filename.
- Emergency disable/revocation is effective on the next physical attempt.
- Optional pipeline steps use the specified safe bypasses and required steps cannot be disabled.
- Relation metrics distinguish LLM-verified from deterministic-unverified edges.
- DAG enforcement always succeeds or fails the pipeline explicitly.
- API keys never appear in public responses, logs, tracebacks, audit, usage, jobs, or revision snapshots.
- Admin mutations are revisioned, transactional, audited, and conflict-safe.
- V1 endpoints reject private/LAN/metadata targets and production egress protection is verified separately.
- Legacy environment migration is idempotent, redacted, verified, and eventually disabled.
- Backend and frontend targeted/full gates pass, generated contracts are current, and live infrastructure checks are accurately reported.
