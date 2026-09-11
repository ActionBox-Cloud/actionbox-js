export const SDK_VERSION = "0.2.1";

export type ActionStatus = "open" | "resolved" | "cancelled" | "expired";

export type OptionStyle = "default" | "primary" | "destructive";

export interface ActionOption {
  id: string;
  label: string;
  style?: OptionStyle;
  sort_order?: number;
}

export type ActionOptionInput = ActionOption;

export interface MutatingActionControl {
  key: string;
  label: string;
  kind: "callback" | "actionbox";
  destructive?: boolean;
  expires_at?: string;
}

export interface LinkActionControl {
  key: string;
  label: string;
  kind: "link";
  url: string;
  expires_at?: string;
}

export type ActionControl = MutatingActionControl | LinkActionControl;

export function control(
  key: string,
  label: string,
  options: Omit<MutatingActionControl, "key" | "label" | "kind"> & {
    kind?: "callback" | "actionbox";
  } = {},
): MutatingActionControl {
  const { kind = "callback", ...rest } = options;
  return { key, label, kind, ...rest };
}

export function link(key: string, label: string, url: string, expiresAt?: string): LinkActionControl {
  return { key, label, kind: "link", url, ...(expiresAt ? { expires_at: expiresAt } : {}) };
}

export interface BooleanInteraction {
  type: "boolean";
  label: string;
  true_label?: string;
  false_label?: string;
}

export interface SingleChoiceInteraction {
  type: "single_choice";
  label: string;
  options: ActionOption[];
}

export interface MultiChoiceInteraction {
  type: "multi_choice";
  label: string;
  options: ActionOption[];
  min_selections?: number;
  max_selections?: number | null;
}

export interface TextInteraction {
  type: "text";
  label: string;
  placeholder?: string | null;
  multiline?: boolean;
  min_length?: number;
  max_length?: number;
}

export interface IntegerInteraction {
  type: "integer";
  label: string;
  min?: number | null;
  max?: number | null;
  step?: number;
  unit?: string | null;
}

export interface NumberInteraction {
  type: "number";
  label: string;
  min?: number | null;
  max?: number | null;
  step?: number;
  unit?: string | null;
}

export interface RatingInteraction {
  type: "rating";
  label: string;
  min?: number;
  max?: number;
  low_label?: string | null;
  high_label?: string | null;
}

export interface FormBooleanField extends BooleanInteraction {
  id: string;
  required?: boolean;
}

export interface FormSingleChoiceField extends SingleChoiceInteraction {
  id: string;
  required?: boolean;
}

export interface FormMultiChoiceField extends MultiChoiceInteraction {
  id: string;
  required?: boolean;
}

export interface FormTextField extends TextInteraction {
  id: string;
  required?: boolean;
}

export interface FormIntegerField extends IntegerInteraction {
  id: string;
  required?: boolean;
}

export interface FormNumberField extends NumberInteraction {
  id: string;
  required?: boolean;
}

export interface FormRatingField extends RatingInteraction {
  id: string;
  required?: boolean;
}

export type FormField =
  | FormBooleanField
  | FormSingleChoiceField
  | FormMultiChoiceField
  | FormTextField
  | FormIntegerField
  | FormNumberField
  | FormRatingField;

export interface FormInteraction {
  type: "form";
  label: string;
  fields: FormField[];
}

export type TypedInteraction =
  | BooleanInteraction
  | SingleChoiceInteraction
  | MultiChoiceInteraction
  | TextInteraction
  | IntegerInteraction
  | NumberInteraction
  | RatingInteraction
  | FormInteraction;

export type Interaction = TypedInteraction;

export interface BooleanResponse {
  type: "boolean";
  value: boolean;
}

export interface TextResponse {
  type: "text";
  value: string;
}

export interface IntegerResponse {
  type: "integer";
  value: number;
}

export interface NumberResponse {
  type: "number";
  value: number;
}

export interface RatingResponse {
  type: "rating";
  value: number;
}

export interface SingleChoiceResponse {
  type: "single_choice";
  value: string;
}

export interface MultiChoiceResponse {
  type: "multi_choice";
  value: string[];
}

export interface FormResponse {
  type: "form";
  values: Record<string, unknown>;
}

export type TypedResponse =
  | BooleanResponse
  | TextResponse
  | IntegerResponse
  | NumberResponse
  | RatingResponse
  | SingleChoiceResponse
  | MultiChoiceResponse
  | FormResponse;

export type InteractionResponse = TypedResponse;
export type Response = TypedResponse;

export type DecisionRiskLevel = "unknown" | "low" | "medium" | "high" | "critical";
export type DecisionReversibility = "unknown" | "reversible" | "partially_reversible" | "irreversible";

export interface DecisionContext {
  schema_version?: 1;
  reason: string;
  current_state?: string | null;
  proposed_change: string;
  expected_effect?: string | null;
  risk_level: DecisionRiskLevel;
  risk_summary?: string | null;
  reversibility: DecisionReversibility;
  rollback_plan?: string | null;
  affected_scope?: string[];
}

export function decisionContext(input: Omit<DecisionContext, "schema_version">): DecisionContext {
  return { schema_version: 1, affected_scope: [], ...input };
}

export const genericDecisionContext = decisionContext;
export const deploymentDecisionContext = decisionContext;
export const refundDecisionContext = decisionContext;
export const databaseChangeDecisionContext = decisionContext;
export const accessRequestDecisionContext = decisionContext;

export interface ApprovalPolicy {
  schema_version?: 1;
  mode: "any" | "all" | "quorum";
  required_approvals?: number;
  approval_option_id?: string;
  rejection_option_id?: string;
  allow_source_override?: boolean;
}

export interface ApprovalVote {
  id: string;
  reviewer_user_id: string | null;
  outcome: "approve" | "reject";
  option_id?: string | null;
  response?: TypedResponse | null;
  reason?: string | null;
  action_version: number;
  created_at: string;
}

export interface ApprovalProgress {
  state: "pending" | "approved" | "rejected" | "overridden" | "expired" | "cancelled";
  required_approvals: number;
  approval_count: number;
  rejection_count: number;
  remaining_approvals: number;
  eligible_reviewer_count: number;
  votes: ApprovalVote[];
}

export interface ActionCreateInput {
  chat_delivery?: "inherit" | "disabled";
  title: string;
  description?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  open_url?: string;
  dedupe_key?: string;
  callback_url?: string;
  controls?: ActionControl[];
  expires_at?: string;
  on_expire?: { type: "return_expired" } | { type: "resolve"; response: TypedResponse; reason?: string | null };
  context?: ActionContextBlock[];
  decision_class?: string;
  decision_context?: DecisionContext;
  options?: ActionOption[];
  interaction?: TypedInteraction;
  metadata?: Record<string, unknown>;
  visibility?: "workspace" | "restricted";
  reviewer_user_ids?: string[];
  reviewer_emails?: string[];
  approval_policy?: ApprovalPolicy;
  assignee_user_id?: string;
  assignee_email?: string;
  run_id?: string;
}

export type ActionPatchInput = Partial<Pick<ActionCreateInput,
  "title" | "description" | "priority" | "open_url" | "expires_at" |
  "on_expire" | "context" | "decision_class" | "decision_context" |
  "controls" | "metadata" | "chat_delivery"
>>;

export interface ActionContextRequest {
  id: string;
  question: string;
  requested_fields: string[];
  requested_by_user_id: string | null;
  requested_at: string;
  status: "pending" | "provided" | "unavailable";
  reason?: string;
  reason_code?: "not_available" | "cannot_access" | "not_applicable" | "sensitive" | "unknown";
  responded_at?: string;
}

export type ActionContextBlock =
  | { type: "key_value"; title?: string | null; items: Record<string, string | number | boolean | null> }
  | { type: "code" | "diff" | "logs" | "command"; title?: string | null; content: string; language?: string | null }
  | { type: "json"; title?: string | null; value: unknown }
  | { type: "metrics"; title?: string | null; items: Array<{ label: string; value: string | number; unit?: string | null }> }
  | { type: "links"; title?: string | null; items: Array<{ label: string; url: string }> };

export interface ResolveInput {
  action_version?: number;
  fingerprint?: string;
  option_id?: string;
  response?: TypedResponse;
  reason?: string;
  approval_override?: boolean;
}

export interface ActionOutcome {
  id: string;
  action_id: string;
  status: "success" | "failed";
  duration_ms: number | null;
  rollback: boolean;
  reason_code: string | null;
  action_version: number;
  fingerprint: string;
  created_at: string;
}

export interface ActionOutcomeInput {
  status: "success" | "failed";
  duration_ms?: number | null;
  rollback?: boolean;
  reason_code?: string | null;
  action_version: number;
  fingerprint: string;
}

export type ControlRequestStatus = "requested" | "delivered" | "running" | "succeeded" | "failed" | "expired" | "cancelled";

export interface ControlRequest {
  id: string;
  action_id: string;
  action_version: number;
  action_fingerprint: string;
  control_key: string;
  control_label: string;
  control_kind: "callback" | "actionbox";
  status: ControlRequestStatus;
  result_message?: string | null;
  result_reason_code?: string | null;
  verified_at?: string | null;
  verification_source?: "watch" | "agent_run" | null;
  verification_reference?: string | null;
  requested_at: string;
  completed_at?: string | null;
}

export interface ControlResultInput {
  status: "running" | "succeeded" | "failed";
  message?: string | null;
  reason_code?: string | null;
}

export interface Action {
  id: string;
  run_id?: string | null;
  visibility?: "workspace" | "restricted";
  reviewers?: Array<{ user_id: string; email?: string; display_name?: string }>;
  approval_policy?: ApprovalPolicy | null;
  approval_progress?: ApprovalProgress | null;
  assignee_user_id?: string | null;
  title: string;
  description: string;
  status: ActionStatus;
  environment?: "live" | "test";
  action_version?: number;
  fingerprint?: string;
  content_fingerprint?: string;
  interaction?: TypedInteraction | null;
  response?: TypedResponse | null;
  receipt?: string | null;
  outcome?: ActionOutcome | null;
  context?: ActionContextBlock[];
  decision_class?: string | null;
  decision_context?: DecisionContext | null;
  context_request?: ActionContextRequest | null;
  on_expire?: ActionCreateInput["on_expire"];
  controls?: ActionControl[];
  control_requests?: ControlRequest[];
  resolution_option_id: string | null;
  resolved_by_type?: "user" | "source" | "system" | null;
  [key: string]: unknown;
}

export type AgentRunStatus = "queued" | "running" | "waiting" | "succeeded" | "failed" | "cancelled";

export interface AgentRun {
  id: string;
  workspace_id: string;
  source_id: string;
  environment: "live" | "test";
  external_id: string;
  agent_name: string;
  task_id: string | null;
  title: string;
  status: AgentRunStatus;
  stage: string | null;
  checkpoint: string | null;
  stall_after_seconds: number | null;
  progress_changed_at: string | null;
  stall_due_at: string | null;
  stall_detected_at: string | null;
  stall_action_id: string | null;
  stalled: boolean;
  progress_sequence: number;
  completion_reason_code: string | null;
  metadata: Record<string, unknown>;
  action_count: number;
  waiting_action_count: number;
  started_at: string | null;
  last_progress_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentRunCreateInput {
  external_id: string;
  agent_name: string;
  title: string;
  task_id?: string;
  status?: "queued" | "running";
  stage?: string;
  checkpoint?: string;
  stall_after_seconds?: number;
  metadata?: Record<string, unknown>;
}

export interface AgentRunProgressInput {
  status?: "running" | "waiting";
  stage?: string;
  checkpoint?: string;
}

export type WatchStatus = "new" | "healthy" | "down" | "paused";
export type WatchScheduleType = "interval" | "cron";
export type WatchSignalMethod = "any" | "post";

export interface Watch {
  id: string;
  workspace_id: string;
  source_id: string;
  name: string;
  schedule_type: WatchScheduleType;
  interval_seconds: number | null;
  cron_expression: string | null;
  timezone: string;
  grace_seconds: number;
  max_runtime_seconds: number | null;
  priority: "low" | "normal" | "high" | "urgent";
  runbook_url: string | null;
  signal_method: WatchSignalMethod;
  status: WatchStatus;
  derived_status: WatchStatus | "late" | "running";
  late: boolean;
  running: boolean;
  token_prefix: string;
  token_rotated_at: string;
  armed_at: string | null;
  last_heartbeat_at: string | null;
  last_started_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  active_run_started_at: string | null;
  run_deadline_at: string | null;
  next_expected_at: string | null;
  next_evaluation_at: string | null;
  incident_action_id: string | null;
  incident_kind: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WatchCreateInput {
  /** Optional compatibility check; the authenticated Source is authoritative. */
  source_id?: string;
  name: string;
  schedule_type: WatchScheduleType;
  interval_seconds?: number;
  cron_expression?: string;
  timezone?: string;
  grace_seconds?: number;
  max_runtime_seconds?: number;
  priority?: Watch["priority"];
  runbook_url?: string;
  signal_method?: WatchSignalMethod;
}

export interface WatchEvent {
  id: string;
  watch_id: string;
  event_type: string;
  state_before: WatchStatus | null;
  state_after: WatchStatus | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export class ActionboxError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message);
    this.name = "ActionboxError";
  }
}

export interface ActionboxOptions {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  /** Per-request timeout. Defaults to 10 seconds. */
  timeoutMs?: number;
  /** Additional attempts for safe or idempotent requests. Defaults to 2. */
  maxRetries?: number;
}

export interface RequestOptions {
  signal?: AbortSignal;
  waitSeconds?: number;
}

export interface CreateWatchRequestOptions extends RequestOptions {
  idempotencyKey?: string;
}

const MAX_RESPONSE_BYTES = 1_048_576;
const MAX_RETRY_DELAY_MS = 30_000;

export class ActionboxClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly requestFetch: typeof globalThis.fetch;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(options: ActionboxOptions) {
    if (typeof window !== "undefined" && typeof document !== "undefined") {
      throw new Error("ActionboxClient is server-only; do not expose a Source API key in browser code");
    }
    if (!options.apiKey || /\s/.test(options.apiKey)) throw new Error("apiKey must be a non-empty token without whitespace");
    this.apiKey = options.apiKey;
    this.baseUrl = validateBaseUrl(options.baseUrl ?? "https://api.actionbox.cloud");
    this.requestFetch = options.fetch ?? globalThis.fetch;
    if (typeof this.requestFetch !== "function") throw new Error("a Fetch implementation is required");
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.maxRetries = options.maxRetries ?? 2;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) throw new Error("timeoutMs must be greater than zero");
    if (!Number.isInteger(this.maxRetries) || this.maxRetries < 0 || this.maxRetries > 5) throw new Error("maxRetries must be an integer from 0 through 5");
  }

  private async request<T>(path: string, init: RequestInit = {}, timeoutMs = this.timeoutMs): Promise<T> {
    const method = (init.method ?? "GET").toUpperCase();
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${this.apiKey}`);
    headers.set("X-Actionbox-Client", `node-sdk/${SDK_VERSION}`);
    if (init.body !== undefined && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const retryable = method === "GET" || method === "HEAD" || headers.has("Idempotency-Key");
    const attempts = retryable ? this.maxRetries + 1 : 1;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const controller = new AbortController();
      const onAbort = () => controller.abort(init.signal?.reason);
      if (init.signal?.aborted) controller.abort(init.signal.reason);
      else init.signal?.addEventListener("abort", onAbort, { once: true });
      const timeout = setTimeout(() => controller.abort(new Error("request timed out")), timeoutMs);

      try {
        const response = await this.requestFetch(`${this.baseUrl}${path}`, {
          ...init,
          headers,
          signal: controller.signal,
        });
        const rawBody = await readBoundedBody(response);
        if (retryable && attempt + 1 < attempts && (response.status === 429 || response.status >= 500)) {
          await retryDelay(attempt, response.headers.get("Retry-After"), init.signal);
          continue;
        }

        const body = parseResponseBody(rawBody, response.status);
        if (!response.ok) {
          const envelope = isRecord(body) && isRecord(body.error) ? body.error : undefined;
          const detail = isRecord(body) && typeof body.detail === "string" ? body.detail : undefined;
          throw new ActionboxError(
            typeof envelope?.code === "string" ? envelope.code : "UNKNOWN",
            typeof envelope?.message === "string" ? envelope.message : detail ?? "Actionbox request failed.",
            response.status,
          );
        }
        return (isRecord(body) && "data" in body ? body.data : body) as T;
      } catch (error) {
        if (controller.signal.aborted) {
          if (init.signal?.aborted) throw new ActionboxError("ABORTED", "Actionbox request was cancelled.", 0);
          throw new ActionboxError("TIMEOUT", `Actionbox request timed out after ${timeoutMs}ms.`, 0);
        }
        if (error instanceof ActionboxError) throw error;
        if (retryable && attempt + 1 < attempts) {
          await retryDelay(attempt, null, init.signal);
          continue;
        }
        // Native fetch errors can expose request URLs and platform-specific
        // details. Return a stable SDK error without leaking credentials or
        // transport internals to callers.
        throw new ActionboxError("NETWORK_ERROR", "Actionbox request could not reach the API.", 0);
      } finally {
        clearTimeout(timeout);
        init.signal?.removeEventListener("abort", onAbort);
      }
    }
    throw new ActionboxError("RETRY_EXHAUSTED", "Actionbox request failed after retries.", 0);
  }

  async create(input: ActionCreateInput, idempotencyKey?: string, requestOptions: RequestOptions = {}): Promise<Action> {
    assertAllowedKeys(input, ACTION_CREATE_KEYS, "Action create input");
    const key = idempotencyKey ?? newIdempotencyKey();
    return this.request<Action>("/v1/actions", { method: "POST", body: JSON.stringify(input), headers: { "Idempotency-Key": key }, signal: requestOptions.signal });
  }

  async get(id: string, requestOptions: RequestOptions = {}): Promise<Action> {
    const waitSeconds = Math.max(0, Math.min(30, Math.floor(requestOptions.waitSeconds ?? 0)));
    const query = waitSeconds > 0 ? `?wait_seconds=${waitSeconds}` : "";
    const requestTimeout = waitSeconds > 0 ? Math.max(this.timeoutMs, (waitSeconds + 5) * 1000) : this.timeoutMs;
    return this.request<Action>(
      `/v1/source/actions/${encodeURIComponent(id)}${query}`,
      { signal: requestOptions.signal },
      requestTimeout,
    );
  }

  /** Update an open Action, including context requested by its reviewer. */
  async update(id: string, input: ActionPatchInput, requestOptions: RequestOptions = {}): Promise<Action> {
    if (Object.keys(input).length === 0) throw new Error("provide at least one field to update");
    assertAllowedKeys(input, ACTION_PATCH_KEYS, "Action update input");
    return this.request<Action>(`/v1/actions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
      signal: requestOptions.signal,
    });
  }

  /** Close a pending context request when the requested information cannot be supplied. */
  async markContextUnavailable(
    id: string,
    reason: string,
    reasonCode: "not_available" | "cannot_access" | "not_applicable" | "sensitive" | "unknown" = "not_available",
    requestOptions: RequestOptions = {},
  ): Promise<Action> {
    return this.request<Action>(`/v1/source/actions/${encodeURIComponent(id)}/context-request/unavailable`, {
      method: "POST",
      body: JSON.stringify({ reason, reason_code: reasonCode }),
      signal: requestOptions.signal,
    });
  }

  async reportControlResult(
    controlRequestId: string,
    input: ControlResultInput,
    requestOptions: RequestOptions = {},
  ): Promise<ControlRequest> {
    return this.request<ControlRequest>(
      `/v1/source/control-requests/${encodeURIComponent(controlRequestId)}/result`,
      {
        method: "POST",
        body: JSON.stringify(input),
        headers: { "Idempotency-Key": `control-result-${controlRequestId}-${input.status}` },
        signal: requestOptions.signal,
      },
    );
  }

  /** Start one autonomous task. Reusing external_id with the same input is safe. */
  async startRun(input: AgentRunCreateInput, requestOptions: RequestOptions = {}): Promise<AgentRun> {
    return this.request<AgentRun>("/v1/runs", {
      method: "POST",
      body: JSON.stringify(input),
      headers: { "Idempotency-Key": `run-start-${input.external_id}` },
      signal: requestOptions.signal,
    });
  }

  async getRun(id: string, requestOptions: RequestOptions = {}): Promise<AgentRun> {
    return this.request<AgentRun>(`/v1/source/runs/${encodeURIComponent(id)}`, {
      signal: requestOptions.signal,
    });
  }

  /** Send progress without manually managing sequence numbers. */
  async progressRun(run: AgentRun, input: AgentRunProgressInput, requestOptions: RequestOptions = {}): Promise<AgentRun> {
    const sequence = run.progress_sequence + 1;
    return this.request<AgentRun>(`/v1/source/runs/${encodeURIComponent(run.id)}/progress`, {
      method: "PATCH",
      body: JSON.stringify({ sequence, ...input }),
      headers: { "Idempotency-Key": `run-progress-${run.id}-${sequence}` },
      signal: requestOptions.signal,
    });
  }

  async completeRun(
    run: AgentRun,
    status: "succeeded" | "failed" | "cancelled" = "succeeded",
    reasonCode?: string,
    requestOptions: RequestOptions = {},
  ): Promise<AgentRun> {
    return this.request<AgentRun>(`/v1/source/runs/${encodeURIComponent(run.id)}/complete`, {
      method: "POST",
      body: JSON.stringify({
        status,
        progress_sequence: run.progress_sequence,
        reason_code: reasonCode,
      }),
      headers: { "Idempotency-Key": `run-complete-${run.id}` },
      signal: requestOptions.signal,
    });
  }

  /** List Watches owned by this Source; capability URLs are never returned. */
  async watches(requestOptions: RequestOptions = {}): Promise<Watch[]> {
    return this.request<Watch[]>("/v1/source/watches", { signal: requestOptions.signal });
  }

  /** Create a Watch for this Source. The returned heartbeat URL is shown once. */
  async createWatch(input: WatchCreateInput, requestOptions: CreateWatchRequestOptions = {}): Promise<Watch & { heartbeat_url: string }> {
    if (!input.name || !input.schedule_type) throw new Error("name and schedule_type are required");
    const idempotencyKey = requestOptions.idempotencyKey ?? `watch-${newIdempotencyKey()}`;
    return this.request<Watch & { heartbeat_url: string }>("/v1/source/watches", {
      method: "POST",
      body: JSON.stringify(input),
      headers: { "Idempotency-Key": idempotencyKey },
      signal: requestOptions.signal,
    });
  }

  async pauseWatch(id: string, requestOptions: RequestOptions = {}): Promise<Watch> {
    return this.request<Watch>(`/v1/source/watches/${encodeURIComponent(id)}/pause`, { method: "POST", signal: requestOptions.signal });
  }

  async resumeWatch(id: string, requestOptions: RequestOptions = {}): Promise<Watch> {
    return this.request<Watch>(`/v1/source/watches/${encodeURIComponent(id)}/resume`, { method: "POST", signal: requestOptions.signal });
  }

  async rotateWatchToken(id: string, requestOptions: RequestOptions = {}): Promise<Watch & { heartbeat_url: string }> {
    return this.request<Watch & { heartbeat_url: string }>(`/v1/source/watches/${encodeURIComponent(id)}/token/rotate`, { method: "POST", signal: requestOptions.signal });
  }

  async archiveWatch(id: string, requestOptions: RequestOptions = {}): Promise<void> {
    await this.request<unknown>(`/v1/source/watches/${encodeURIComponent(id)}`, { method: "DELETE", signal: requestOptions.signal });
  }

  async resolve(id: string, input?: ResolveInput, requestOptions?: RequestOptions): Promise<Action>;
  async resolve(id: string, optionId?: string, reason?: string, requestOptions?: RequestOptions): Promise<Action>;
  async resolve(id: string, inputOrOptionId?: ResolveInput | string, reasonOrRequestOptions?: string | RequestOptions, requestOptions: RequestOptions = {}): Promise<Action> {
    const reason = typeof reasonOrRequestOptions === "string" ? reasonOrRequestOptions : undefined;
    const resolvedRequestOptions = typeof reasonOrRequestOptions === "object" ? reasonOrRequestOptions : requestOptions;
    const input: ResolveInput = typeof inputOrOptionId === "string"
      ? { option_id: inputOrOptionId, reason }
      : inputOrOptionId ?? {};
    assertAllowedKeys(input, RESOLVE_INPUT_KEYS, "Resolve input");
    return this.request<Action>(`/v1/actions/${encodeURIComponent(id)}/resolve`, { method: "POST", body: JSON.stringify(input), signal: resolvedRequestOptions.signal });
  }

  async cancel(id: string, reason?: string, requestOptions: RequestOptions = {}): Promise<Action> {
    return this.request<Action>(`/v1/actions/${encodeURIComponent(id)}/cancel`, { method: "POST", body: JSON.stringify({ reason }), signal: requestOptions.signal });
  }

  /** Report one immutable execution result for the exact resolved Action snapshot. */
  async reportOutcome(id: string, input: ActionOutcomeInput, requestOptions: RequestOptions = {}): Promise<ActionOutcome> {
    return this.request<ActionOutcome>(`/v1/actions/${encodeURIComponent(id)}/outcome`, {
      method: "POST",
      body: JSON.stringify(input),
      headers: { "Idempotency-Key": `outcome-${id}` },
      signal: requestOptions.signal,
    });
  }

  async wait(id: string, timeoutMs = 3_600_000, pollMs = 2_000, requestOptions: RequestOptions = {}): Promise<Action> {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("timeoutMs must be greater than zero");
    if (!Number.isFinite(pollMs) || pollMs <= 0) throw new Error("pollMs must be greater than zero");
    const deadline = Date.now() + timeoutMs;
    const getBeforeDeadline = async (waitSeconds = 0): Promise<Action> => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new ActionboxError("WAIT_TIMEOUT", "Actionbox wait reached its deadline.", 0);
      const controller = new AbortController();
      let deadlineExpired = false;
      const forwardAbort = () => controller.abort(requestOptions.signal?.reason);
      if (requestOptions.signal?.aborted) forwardAbort();
      else requestOptions.signal?.addEventListener("abort", forwardAbort, { once: true });
      const deadlineTimer = setTimeout(() => {
        deadlineExpired = true;
        controller.abort(new Error("wait deadline reached"));
      }, remaining);
      try {
        return await this.get(id, { ...requestOptions, signal: controller.signal, waitSeconds });
      } catch (error) {
        if (deadlineExpired && !requestOptions.signal?.aborted) {
          throw new ActionboxError("WAIT_TIMEOUT", "Actionbox wait reached its deadline.", 0);
        }
        throw error;
      } finally {
        clearTimeout(deadlineTimer);
        requestOptions.signal?.removeEventListener("abort", forwardAbort);
      }
    };
    let action = await getBeforeDeadline();
    while (action.status === "open" && Date.now() < deadline) {
      const cycleStarted = Date.now();
      const remaining = deadline - cycleStarted;
      const longPollMs = Math.min(remaining, pollMs, 30_000);
      if (longPollMs < 1_000) {
        await abortableDelay(longPollMs, requestOptions.signal);
        if (Date.now() >= deadline) break;
        try {
          action = await getBeforeDeadline();
        } catch (error) {
          if (error instanceof ActionboxError && error.code === "WAIT_TIMEOUT") break;
          throw error;
        }
        continue;
      }
      try {
        action = await getBeforeDeadline(Math.max(1, Math.floor(longPollMs / 1_000)));
      } catch (error) {
        if (error instanceof ActionboxError && error.code === "WAIT_TIMEOUT") break;
        throw error;
      }
      if (action.status === "open") {
        const pacingDelay = Math.min(Math.max(0, pollMs - (Date.now() - cycleStarted)), Math.max(0, deadline - Date.now()));
        if (pacingDelay > 0) await abortableDelay(pacingDelay, requestOptions.signal);
      }
    }
    return action;
  }

  async ask(input: { title: string; options: string[]; wait?: boolean; timeoutMs?: number; signal?: AbortSignal } & Omit<ActionCreateInput, "title" | "options" | "interaction">): Promise<Action | string | null>;
  async ask(input: { title: string; interaction: TypedInteraction; wait?: boolean; timeoutMs?: number; signal?: AbortSignal } & Omit<ActionCreateInput, "title" | "options" | "interaction">): Promise<Action | TypedResponse | string | null>;
  async ask(input: { title: string; options?: string[]; interaction?: TypedInteraction; wait?: boolean; timeoutMs?: number; signal?: AbortSignal } & Omit<ActionCreateInput, "title" | "options" | "interaction">): Promise<Action | TypedResponse | string | null> {
    const { title, options, interaction, wait = true, timeoutMs = 3_600_000, signal, ...rest } = input;
    if (!options && !interaction) throw new Error("provide options or interaction");
    if (options && interaction) throw new Error("provide options or interaction, not both");
    const action = await this.create({
      title,
      ...(options ? { options: normalizeOptionLabels(options) } : {}),
      ...(interaction ? { interaction } : {}),
      ...rest,
    }, undefined, { signal });
    if (!wait) return action;
    const result = await this.wait(action.id, timeoutMs, 2_000, { signal });
    const sameBinding = result.action_version === action.action_version &&
      Boolean(action.fingerprint) && result.fingerprint === action.fingerprint;
    const sameContent = Boolean(action.content_fingerprint) &&
      result.content_fingerprint === action.content_fingerprint;
    const policyResolution = Boolean(action.approval_policy && result.approval_policy) &&
      (sameBinding || sameContent) && (
        result.resolved_by_type === "user" || (
          result.resolved_by_type === "source" &&
          action.approval_policy?.allow_source_override === true &&
          result.approval_policy?.allow_source_override === true
        )
      );
    if (result.status === "resolved" && !policyResolution && (
      !sameBinding || result.resolved_by_type !== "user"
    )) {
      throw new ActionboxError(
        "APPROVAL_BINDING_MISMATCH",
        "The Action was not resolved by a human against the originally created request.",
        409,
      );
    }
    return result.resolution_option_id ?? result.response ?? null;
  }

  async verifyReceipt(
    receipt: string,
    publicKeys: string | Uint8Array | Record<string, string | Uint8Array> | Array<Record<string, unknown>>,
    options: VerifyReceiptOptions = {},
  ): Promise<DecisionReceiptPayload> {
    return verifyDecisionReceipt(receipt, publicKeys, options);
  }
}

/** Send one Watch heartbeat without including the capability in thrown errors. */
export async function sendHeartbeat(heartbeatUrl: string, signal: "ping" | "start" | "success" | "fail" = "ping", options: { fetch?: typeof globalThis.fetch; timeoutMs?: number; signal?: AbortSignal } = {}): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(heartbeatUrl);
  } catch {
    throw new Error("heartbeatUrl must be an Actionbox heartbeat URL");
  }
  const pathSegments = parsed.pathname.split("/").filter(Boolean);
  if (pathSegments.length !== 2 || pathSegments[0] !== "hb" || !/^hb_[^/]+$/.test(pathSegments[1]) || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error("heartbeatUrl must be an Actionbox heartbeat URL");
  if (![
    "ping", "start", "success", "fail",
  ].includes(signal)) throw new Error("invalid heartbeat signal");
  const url = parsed;
  const timeoutMs = options.timeoutMs ?? 10_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("timeoutMs must be greater than zero");
  if (signal !== "ping") url.pathname = `${url.pathname.replace(/\/$/, "")}/${signal}`;
  const loopback = isLoopbackHostname(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) throw new Error("heartbeatUrl must use HTTPS unless it targets localhost");
  const controller = new AbortController();
  const abort = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) abort(); else options.signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await (options.fetch ?? globalThis.fetch)(url.toString(), { method: "POST", signal: controller.signal, headers: { "User-Agent": "actionbox-node-sdk/heartbeat" } });
    if (response.status !== 204) throw new ActionboxError("HEARTBEAT_FAILED", `Heartbeat delivery failed with HTTP ${response.status}.`, response.status);
  } catch (error) {
    if (controller.signal.aborted) {
      if (options.signal?.aborted) throw new ActionboxError("ABORTED", "Heartbeat delivery was cancelled.", 0);
      throw new ActionboxError("TIMEOUT", "Heartbeat delivery timed out.", 0);
    }
    if (error instanceof ActionboxError) throw error;
    // Fetch transport errors may include the full URL, which is the bearer
    // capability. Keep the public error deliberately content-free.
    throw new ActionboxError("HEARTBEAT_FAILED", "Heartbeat delivery failed.", 0);
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}

function normalizeOptionLabels(labels: string[]): ActionOption[] {
  const seen = new Set<string>();
  return labels.map((label) => {
    const id = label.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
    if (!id) throw new Error("option labels must not be empty");
    if (seen.has(id)) throw new Error(`option labels must produce unique IDs; duplicate ID: ${id}`);
    seen.add(id);
    return { id, label };
  });
}

function validateBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("baseUrl must be a full HTTPS URL");
  }
  const loopback = isLoopbackHostname(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) throw new Error("baseUrl must use HTTPS unless it targets localhost");
  if (url.username || url.password || url.search || url.hash || (url.pathname !== "" && url.pathname !== "/")) {
    throw new Error("baseUrl must not contain credentials, a path, query parameters, or a fragment");
  }
  return url.origin;
}

function newIdempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID !== "function") {
    throw new Error("secure random UUID generation is unavailable in this runtime");
  }
  return `sdk-${globalThis.crypto.randomUUID()}`;
}

const ACTION_CREATE_KEYS = new Set([
  "title", "description", "priority", "open_url", "dedupe_key", "callback_url", "controls", "chat_delivery",
  "expires_at", "on_expire", "context", "decision_class", "decision_context", "options",
  "interaction", "metadata", "visibility", "reviewer_user_ids", "reviewer_emails", "approval_policy",
  "assignee_user_id", "assignee_email", "run_id",
]);
const ACTION_PATCH_KEYS = new Set([
  "title", "description", "priority", "open_url", "expires_at", "on_expire", "context",
  "decision_class", "decision_context", "controls", "metadata", "chat_delivery",
]);
const RESOLVE_INPUT_KEYS = new Set(["action_version", "fingerprint", "option_id", "response", "reason", "approval_override"]);

function assertAllowedKeys(value: object, allowed: ReadonlySet<string>, label: string): void {
  const unsupported = Object.keys(value).filter((key) => !allowed.has(key));
  if (unsupported.length > 0) {
    throw new TypeError(`${label} contains unsupported field(s): ${unsupported.sort().join(", ")}`);
  }
}

function isLoopbackHostname(value: string): boolean {
  const hostname = value.toLowerCase().replace(/^\[|\]$/g, "");
  if (hostname === "localhost" || hostname === "::1") return true;
  if (/^127(?:\.\d{1,3}){3}$/.test(hostname)) {
    return hostname.split(".").every((part) => Number(part) <= 255);
  }
  const mapped = hostname.match(/^::ffff:(127(?:\.\d{1,3}){3})$/);
  if (mapped !== null) return mapped[1].split(".").every((part) => Number(part) <= 255);
  return /^::ffff:7f[0-9a-f]{2}:[0-9a-f]{1,4}$/.test(hostname);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseResponseBody(raw: string, status: number): unknown {
  if (raw === "") return {};
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new ActionboxError("INVALID_RESPONSE", `Actionbox returned invalid JSON (HTTP ${status}).`, status);
  }
}

async function readBoundedBody(response: globalThis.Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let length = 0;
  let body = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new ActionboxError("RESPONSE_TOO_LARGE", `Actionbox response exceeds ${MAX_RESPONSE_BYTES} bytes.`, response.status);
    }
    body += decoder.decode(value, { stream: true });
  }
  return body + decoder.decode();
}

function retryDelayMs(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1_000, MAX_RETRY_DELAY_MS);
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : Math.min(Math.max(timestamp - Date.now(), 0), MAX_RETRY_DELAY_MS);
}

async function retryDelay(attempt: number, retryAfter: string | null, signal?: AbortSignal | null): Promise<void> {
  const serverDelay = retryDelayMs(retryAfter);
  const base = 250 * (2 ** attempt);
  await abortableDelay(serverDelay ?? base + Math.random() * (base / 2), signal);
}

function abortableDelay(delayMs: number, signal?: AbortSignal | null): Promise<void> {
  if (signal?.aborted) return Promise.reject(new ActionboxError("ABORTED", "Actionbox request was cancelled.", 0));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, Math.max(delayMs, 0));
    const onAbort = () => {
      clearTimeout(timer);
      reject(new ActionboxError("ABORTED", "Actionbox request was cancelled.", 0));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export interface DecisionReceiptPayload {
  iss: string;
  receipt_version: number;
  action_id: string;
  environment: string;
  version: number;
  action_version: number;
  fingerprint: string;
  status: string;
  option_id?: string | null;
  response?: unknown;
  reason?: string | null;
  resolved_at: string;
  resolved_by?: string | null;
  [key: string]: unknown;
}

export interface VerifyReceiptOptions {
  expectedActionId?: string;
  /** Defaults to "live". Pass null only when intentionally accepting any environment. */
  expectedEnvironment?: string | null;
  expectedFingerprint?: string;
  maxAgeSeconds?: number;
  maxFutureSkewSeconds?: number;
}

function b64urlToBytes(str: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(str)) {
    throw new Error("invalid base64url value");
  }
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  if (bytesToB64url(bytes) !== str) {
    throw new Error("non-canonical base64url value");
  }
  return bytes;
}

function bytesToB64url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function verifyDecisionReceipt(
  receipt: string,
  publicKeys: string | Uint8Array | Record<string, string | Uint8Array> | Array<Record<string, unknown>>,
  options: VerifyReceiptOptions = {},
): Promise<DecisionReceiptPayload> {
  if (typeof receipt !== "string" || receipt.split(".").length !== 3) {
    throw new ActionboxError("INVALID_RECEIPT", "Receipt must contain exactly three compact segments.", 400);
  }

  const [encodedHeader, encodedPayload, encodedSignature] = receipt.split(".");
  let headerRaw: Uint8Array;
  let payloadRaw: Uint8Array;
  let signature: Uint8Array;

  try {
    headerRaw = b64urlToBytes(encodedHeader);
    payloadRaw = b64urlToBytes(encodedPayload);
    signature = b64urlToBytes(encodedSignature);
  } catch (err) {
    throw new ActionboxError("INVALID_RECEIPT", `Receipt has invalid base64url encoding: ${err}`, 400);
  }

  if (signature.length !== 64) {
    throw new ActionboxError("INVALID_RECEIPT", "Ed25519 signatures must be exactly 64 bytes.", 400);
  }

  const decoder = new TextDecoder();
  let header: Record<string, unknown>;
  let payload: DecisionReceiptPayload;

  try {
    header = JSON.parse(decoder.decode(headerRaw));
    payload = JSON.parse(decoder.decode(payloadRaw));
  } catch (err) {
    throw new ActionboxError("INVALID_RECEIPT", `Receipt contains invalid JSON: ${err}`, 400);
  }

  if (header?.alg !== "EdDSA" || header?.typ !== "actionbox-decision-receipt" || ![1, 2].includes(Number(header?.v))) {
    throw new ActionboxError("INVALID_RECEIPT", "Receipt has an unsupported or invalid header.", 400);
  }

  if (payload?.iss !== "actionbox" || ![1, 2].includes(payload?.receipt_version) || payload?.status !== "resolved") {
    throw new ActionboxError("INVALID_RECEIPT", "Receipt payload has an invalid issuer, version, or status.", 400);
  }

  const requiredClaims = ["action_id", "environment", "version", "action_version", "fingerprint", "resolved_at"];
  if (requiredClaims.some((claim) => !(claim in payload))) {
    throw new ActionboxError("INVALID_RECEIPT", "Receipt payload is incomplete.", 400);
  }
  if (header.v !== payload.receipt_version) {
    throw new ActionboxError("INVALID_RECEIPT", "Receipt header and payload versions do not match.", 400);
  }
  if (payload.receipt_version === 2 && (!("approval_policy" in payload) || !("approval_progress" in payload) || !("resolution_method" in payload))) {
    throw new ActionboxError("INVALID_RECEIPT", "Approval receipt payload is incomplete.", 400);
  }

  const kid = typeof header.kid === "string" ? header.kid : undefined;
  if (!kid) {
    throw new ActionboxError("INVALID_RECEIPT", "Receipt key id is missing or invalid.", 400);
  }
  let jwk: Record<string, unknown> | null = null;

  if (publicKeys instanceof Uint8Array) {
    if (publicKeys.length !== 32) {
      throw new ActionboxError("INVALID_RECEIPT", "Ed25519 public keys must be exactly 32 bytes.", 400);
    }
    jwk = { kty: "OKP", crv: "Ed25519", x: bytesToB64url(publicKeys) };
  } else if (typeof publicKeys === "string") {
    if (publicKeys.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(publicKeys);
        if (parsed && typeof parsed === "object" && Array.isArray(parsed.keys)) {
          publicKeys = parsed.keys;
        } else {
          throw new ActionboxError("INVALID_RECEIPT", "Public key set must be a JWKS object.", 400);
        }
      } catch (err) {
        if (err instanceof ActionboxError) throw err;
        throw new ActionboxError("INVALID_RECEIPT", "Public key set contains invalid JSON.", 400);
      }
    } else {
      const rawKey = b64urlToBytes(publicKeys);
      if (rawKey.length !== 32) {
        throw new ActionboxError("INVALID_RECEIPT", "Ed25519 public keys must be exactly 32 bytes.", 400);
      }
      const x = bytesToB64url(rawKey);
      jwk = { kty: "OKP", crv: "Ed25519", x };
    }
  }

  if (!jwk && publicKeys && typeof publicKeys === "object" && !Array.isArray(publicKeys) && "keys" in publicKeys) {
    const keys = (publicKeys as { keys?: unknown }).keys;
    if (!Array.isArray(keys)) {
      throw new ActionboxError("INVALID_RECEIPT", "Public key set must contain a keys array.", 400);
    }
    publicKeys = keys as Array<Record<string, unknown>>;
  }

  if (!jwk && Array.isArray(publicKeys)) {
    for (const item of publicKeys) {
      if (item && typeof item === "object" && item.kid === kid) {
        if (item.kty === "OKP" && item.crv === "Ed25519") {
          jwk = item;
          break;
        }
      }
    }
  }

  if (!jwk && typeof publicKeys === "object" && !Array.isArray(publicKeys)) {
    const rawVal = kid && (publicKeys as Record<string, string | Uint8Array>)[kid];
    if (rawVal) {
      const rawKey = typeof rawVal === "string" ? b64urlToBytes(rawVal) : rawVal;
      if (rawKey.length !== 32) {
        throw new ActionboxError("INVALID_RECEIPT", "Ed25519 public keys must be exactly 32 bytes.", 400);
      }
      const x = bytesToB64url(rawKey);
      jwk = { kty: "OKP", crv: "Ed25519", x };
    }
  }

  if (!jwk) {
    throw new ActionboxError("INVALID_RECEIPT", `No valid Ed25519 public key found for kid '${kid}'.`, 400);
  }

  const { subtle } = globalThis.crypto;
  if (!subtle) {
    throw new ActionboxError("CRYPTO_UNAVAILABLE", "Web Cryptography API (crypto.subtle) is not available in this environment.", 500);
  }

  let cryptoKey: CryptoKey;
  try {
    cryptoKey = await subtle.importKey(
      "jwk",
      jwk as JsonWebKey,
      { name: "Ed25519" },
      false,
      ["verify"],
    );
  } catch (err) {
    throw new ActionboxError("INVALID_RECEIPT", `Failed to import Ed25519 public key: ${err}`, 400);
  }

  const signingInput = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
  let verified = false;
  try {
    const sigArray = signature instanceof Uint8Array ? signature : new Uint8Array(signature);
    verified = await subtle.verify({ name: "Ed25519" }, cryptoKey, sigArray as BufferSource, signingInput);
  } catch (err) {
    throw new ActionboxError("INVALID_RECEIPT", `Signature verification failed: ${err}`, 400);
  }

  if (!verified) {
    throw new ActionboxError("INVALID_RECEIPT", "Receipt cryptographic signature is invalid.", 400);
  }

  if (options.expectedActionId && payload.action_id !== options.expectedActionId) {
    throw new ActionboxError("INVALID_RECEIPT", `Receipt action_id '${payload.action_id}' does not match expected '${options.expectedActionId}'.`, 400);
  }

  const expectedEnvironment = options.expectedEnvironment === undefined
    ? "live"
    : options.expectedEnvironment;
  if (expectedEnvironment !== null && payload.environment !== expectedEnvironment) {
    throw new ActionboxError("INVALID_RECEIPT", `Receipt environment '${payload.environment}' does not match expected '${expectedEnvironment}'.`, 400);
  }

  if (options.expectedFingerprint && payload.fingerprint !== options.expectedFingerprint) {
    throw new ActionboxError("INVALID_RECEIPT", "Receipt fingerprint does not match expected.", 400);
  }

  const futureSkew = options.maxFutureSkewSeconds ?? 60;
  if (!Number.isFinite(futureSkew) || futureSkew < 0) {
    throw new TypeError("maxFutureSkewSeconds must be a finite non-negative number");
  }
  const resolvedAtTime = Date.parse(payload.resolved_at);
  if (Number.isNaN(resolvedAtTime)) {
    throw new ActionboxError("INVALID_RECEIPT", `Invalid resolved_at timestamp '${payload.resolved_at}'.`, 400);
  }
  const ageSeconds = (Date.now() - resolvedAtTime) / 1000;
  if (ageSeconds < -futureSkew) {
    throw new ActionboxError("INVALID_RECEIPT", `Receipt resolved_at is too far in the future (${(-ageSeconds).toFixed(1)}s).`, 400);
  }
  if (options.maxAgeSeconds !== undefined) {
    if (!Number.isFinite(options.maxAgeSeconds) || options.maxAgeSeconds < 0) {
      throw new TypeError("maxAgeSeconds must be a finite non-negative number");
    }
    if (ageSeconds > options.maxAgeSeconds) {
      throw new ActionboxError("INVALID_RECEIPT", `Receipt has expired (age ${ageSeconds.toFixed(1)}s > max ${options.maxAgeSeconds}s).`, 400);
    }
  }

  return payload;
}
