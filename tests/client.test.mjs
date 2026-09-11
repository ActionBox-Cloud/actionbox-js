import assert from "node:assert/strict";
import test from "node:test";

import {
  ActionboxClient,
  ActionboxError,
  SDK_VERSION,
  control,
  deploymentDecisionContext,
  link,
  sendHeartbeat,
} from "../dist/index.js";

test("control helpers emit the bounded wire schema", () => {
  assert.deepEqual(control("retry", "Retry"), {
    key: "retry",
    label: "Retry",
    kind: "callback",
  });
  assert.deepEqual(control("rollback", "Rollback", { destructive: true }), {
    key: "rollback",
    label: "Rollback",
    kind: "callback",
    destructive: true,
  });
  assert.deepEqual(link("logs", "Open logs", "https://example.test/logs"), {
    key: "logs",
    label: "Open logs",
    kind: "link",
    url: "https://example.test/logs",
  });
});

const jsonResponse = (body, init = {}) => new Response(JSON.stringify(body), {
  status: init.status ?? 200,
  headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
});

test("decision context helpers emit the generic versioned wire contract", () => {
  assert.deepEqual(deploymentDecisionContext({
    reason: "Staging passed.",
    proposed_change: "Deploy 2.18.0.",
    risk_level: "high",
    reversibility: "reversible",
  }), {
    schema_version: 1,
    affected_scope: [],
    reason: "Staging passed.",
    proposed_change: "Deploy 2.18.0.",
    risk_level: "high",
    reversibility: "reversible",
  });
});

test("source get uses the strict source route and Authorization", async () => {
  let captured;
  const client = new ActionboxClient({
    apiKey: "axb_test",
    fetch: async (input, init) => {
      captured = { input, init };
      return jsonResponse({ data: { id: "act/1", status: "open", title: "Test", description: "", resolution_option_id: null } });
    },
  });

  const action = await client.get("act/1");
  assert.equal(action.id, "act/1");
  assert.equal(captured.input, "https://api.actionbox.cloud/v1/source/actions/act%2F1");
  assert.equal(captured.init.headers.get("Authorization"), "Bearer axb_test");
  assert.equal(captured.init.headers.get("X-Actionbox-Client"), `node-sdk/${SDK_VERSION}`);
});

test("ask rejects nonhuman and changed resolutions", async () => {
  for (const resolved of [
    { resolved_by_type: "source", action_version: 1, fingerprint: "sha256:original" },
    { resolved_by_type: "user", action_version: 2, fingerprint: "sha256:changed" },
  ]) {
    const created = {
      id: "act_bound",
      status: "open",
      title: "Deploy?",
      description: "",
      resolution_option_id: null,
      action_version: 1,
      fingerprint: "sha256:original",
    };
    const client = new ActionboxClient({
      apiKey: "axb_test",
      fetch: async (_input, init) => init.method === "POST"
        ? jsonResponse({ data: created }, { status: 201 })
        : jsonResponse({ data: { ...created, ...resolved, status: "resolved", resolution_option_id: "approve" } }),
    });

    await assert.rejects(
      () => client.ask({ title: "Deploy?", options: ["Approve"] }),
      (error) => error instanceof ActionboxError && error.code === "APPROVAL_BINDING_MISMATCH",
    );
  }
});

test("ask accepts valid approval-policy resolution after roster changes or source override", async () => {
  for (const resolved of [
    { resolved_by_type: "user", action_version: 2, fingerprint: "sha256:changed" },
    { resolved_by_type: "source", action_version: 1, fingerprint: "sha256:original" },
  ]) {
    const created = {
      id: "act_policy",
      status: "open",
      title: "Deploy?",
      description: "",
      resolution_option_id: null,
      action_version: 1,
      fingerprint: "sha256:original",
      content_fingerprint: "sha256:same-content",
      approval_policy: { schema_version: 1, mode: "all", allow_source_override: true },
    };
    const client = new ActionboxClient({
      apiKey: "axb_test",
      fetch: async (_input, init) => init.method === "POST"
        ? jsonResponse({ data: created }, { status: 201 })
        : jsonResponse({ data: { ...created, ...resolved, status: "resolved", resolution_option_id: "approve" } }),
    });

    assert.equal(await client.ask({ title: "Deploy?", options: ["Approve"] }), "approve");
  }
});

test("additive Action fields and the legacy decision summary remain readable", async () => {
  const payload = {
    id: "act_future",
    status: "open",
    title: "Deploy?",
    description: "",
    resolution_option_id: null,
    action_version: 3,
    fingerprint: "sha256:bound",
    context: [{
      type: "logs",
      title: "Decision summary",
      content: "Proposed change: Deploy 2.18.0.",
      _actionbox_projection: "decision_context_v1",
    }],
    decision_context: { schema_version: 1, risk_level: "high" },
    future_server_field: { safe: true },
  };
  const client = new ActionboxClient({
    apiKey: "axb_test",
    fetch: async () => jsonResponse({ data: payload }),
  });

  const action = await client.get("act_future");

  assert.equal(action.action_version, 3);
  assert.equal(action.fingerprint, "sha256:bound");
  assert.equal(action.context[0].content, "Proposed change: Deploy 2.18.0.");
  assert.deepEqual(action.future_server_field, { safe: true });
});

test("source sees a context request and can update the same Action", async () => {
  const calls = [];
  const client = new ActionboxClient({
    apiKey: "axb_test",
    fetch: async (input, init) => {
      calls.push({ input, init });
      return jsonResponse({ data: {
        id: "act_1",
        status: "open",
        title: "Deploy?",
        description: "",
        resolution_option_id: null,
        context_request: { id: "evt_1", question: "What can fail?", requested_fields: ["risk"], requested_by_user_id: "usr_1", requested_at: "2026-09-04T00:00:00Z", status: "pending" },
      } });
    },
  });

  const action = await client.get("act_1");
  assert.equal(action.context_request.question, "What can fail?");
  await client.update(action.id, { context: [{ type: "logs", content: "canary passed" }] });
  assert.equal(calls[1].input, "https://api.actionbox.cloud/v1/actions/act_1");
  assert.equal(calls[1].init.method, "PATCH");
  assert.deepEqual(JSON.parse(calls[1].init.body), { context: [{ type: "logs", content: "canary passed" }] });
});

test("source can close a context request as unavailable", async () => {
  let captured;
  const client = new ActionboxClient({
    apiKey: "axb_test",
    fetch: async (input, init) => {
      captured = { input, init };
      return jsonResponse({ data: { id: "act_1", status: "open", title: "Deploy?", description: "", resolution_option_id: null } });
    },
  });
  await client.markContextUnavailable("act_1", "Production data is inaccessible.", "cannot_access");
  assert.equal(captured.input, "https://api.actionbox.cloud/v1/source/actions/act_1/context-request/unavailable");
  assert.deepEqual(JSON.parse(captured.init.body), { reason: "Production data is inaccessible.", reason_code: "cannot_access" });
});

test("create supplies an idempotency key and retries transient responses", async () => {
  let calls = 0;
  let key;
  const client = new ActionboxClient({
    apiKey: "axb_test",
    maxRetries: 1,
    fetch: async (_input, init) => {
      calls += 1;
      key = init.headers.get("Idempotency-Key");
      if (calls === 1) return jsonResponse({ error: { code: "TEMPORARY", message: "retry" } }, { status: 503, headers: { "Retry-After": "0" } });
      return jsonResponse({ data: { id: "act_1", status: "open", title: "Test", description: "", resolution_option_id: null } });
    },
  });

  await client.create({ title: "Test" });
  assert.equal(calls, 2);
  assert.match(key, /^sdk-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("create accepts a reviewer email", async () => {
  let body;
  const client = new ActionboxClient({
    apiKey: "axb_test",
    fetch: async (_input, init) => {
      body = JSON.parse(init.body);
      return jsonResponse({ data: { id: "act_1", status: "open", title: "Review", description: "", resolution_option_id: null } });
    },
  });
  await client.create({ title: "Review", assignee_email: "reviewer@example.com" });
  assert.equal(body.assignee_email, "reviewer@example.com");
});

test("create forwards a restricted reviewer list", async () => {
  let body;
  const client = new ActionboxClient({
    apiKey: "axb_test",
    fetch: async (_input, init) => {
      body = JSON.parse(init.body);
      return jsonResponse({ data: { id: "act_1", status: "open", title: "Private", description: "", resolution_option_id: null } });
    },
  });
  await client.create({
    title: "Private",
    visibility: "restricted",
    reviewer_emails: ["one@example.com", "two@example.com"],
  });
  assert.equal(body.visibility, "restricted");
  assert.deepEqual(body.reviewer_emails, ["one@example.com", "two@example.com"]);
});

test("create forwards a typed approval policy", async () => {
  let body;
  const client = new ActionboxClient({ apiKey: "axb_test", fetch: async (_input, init) => { body = JSON.parse(init.body); return jsonResponse({ data: { id: "act_1", status: "open" } }); } });
  await client.create({ title: "Approve", visibility: "restricted", reviewer_user_ids: ["usr_one", "usr_two"], approval_policy: { schema_version: 1, mode: "quorum", required_approvals: 2, approval_option_id: "approve", rejection_option_id: "reject", allow_source_override: false } });
  assert.equal(body.approval_policy.mode, "quorum");
  assert.equal(body.approval_policy.required_approvals, 2);
});

test("client snapshots the API key instead of retaining mutable options", async () => {
  let authorization;
  const options = {
    apiKey: "axb_original",
    fetch: async (_input, init) => {
      authorization = init.headers.get("Authorization");
      return jsonResponse({ data: { id: "act_1", status: "open" } });
    },
  };
  const client = new ActionboxClient(options);
  options.apiKey = "axb_mutated";
  await client.get("act_1");
  assert.equal(authorization, "Bearer axb_original");
});

test("create and update reject unsupported outgoing fields", async () => {
  const client = new ActionboxClient({
    apiKey: "axb_test",
    fetch: async () => { throw new Error("transport should not run"); },
  });
  await assert.rejects(() => client.create({ title: "Test", session_token: "secret" }), /unsupported field.*session_token/i);
  await assert.rejects(() => client.update("act_1", { db_password: "secret" }), /unsupported field.*db_password/i);
  await assert.rejects(() => client.resolve("act_1", { signal: new AbortController().signal }), /unsupported field.*signal/i);
});

test("source reports a durable control result", async () => {
  let captured;
  const client = new ActionboxClient({
    apiKey: "axb_test",
    fetch: async (input, init) => {
      captured = { input, init };
      return jsonResponse({ data: {
        id: "ctrlreq/1",
        action_id: "act_1",
        action_version: 1,
        action_fingerprint: "sha256:bound",
        control_key: "retry",
        control_label: "Retry",
        control_kind: "callback",
        status: "succeeded",
        requested_at: "2026-08-30T00:00:00Z",
      } });
    },
  });

  const result = await client.reportControlResult("ctrlreq/1", {
    status: "succeeded",
    message: "Recovered",
  });
  assert.equal(result.status, "succeeded");
  assert.equal(captured.input, "https://api.actionbox.cloud/v1/source/control-requests/ctrlreq%2F1/result");
  assert.deepEqual(JSON.parse(captured.init.body), {
    status: "succeeded",
    message: "Recovered",
  });
});

test("non-idempotent resolve is not retried", async () => {
  let calls = 0;
  const client = new ActionboxClient({
    apiKey: "axb_test",
    fetch: async () => {
      calls += 1;
      return jsonResponse({ error: { code: "TEMPORARY", message: "retry" } }, { status: 503 });
    },
  });

  await assert.rejects(() => client.resolve("act_1", "approve"), ActionboxError);
  assert.equal(calls, 1);
});

test("typed resolve sends one response envelope and escapes the action id", async () => {
  let captured;
  const client = new ActionboxClient({
    apiKey: "axb_test",
    fetch: async (input, init) => {
      captured = { input, init };
      return jsonResponse({ data: { id: "act/1", status: "resolved", title: "Test", description: "", resolution_option_id: null } });
    },
  });

  await client.resolve("act/1", { response: { type: "boolean", value: true } });
  assert.equal(captured.input, "https://api.actionbox.cloud/v1/actions/act%2F1/resolve");
  assert.deepEqual(JSON.parse(captured.init.body), { response: { type: "boolean", value: true } });
});

test("resolve accepts the reviewed action version and fingerprint", async () => {
  let captured;
  const fingerprint = `sha256:${"a".repeat(64)}`;
  const client = new ActionboxClient({
    apiKey: "axb_test",
    fetch: async (input, init) => {
      captured = { input, init };
      return jsonResponse({ data: { id: "act_1", status: "resolved", action_version: 3, fingerprint, receipt: "compact-receipt" } });
    },
  });

  const action = await client.resolve("act_1", {
    option_id: "approve",
    action_version: 3,
    fingerprint,
  });
  assert.equal(action.action_version, 3);
  assert.equal(action.fingerprint, fingerprint);
  assert.equal(action.receipt, "compact-receipt");
  assert.deepEqual(JSON.parse(captured.init.body), {
    option_id: "approve",
    action_version: 3,
    fingerprint,
  });
});

test("reportOutcome binds the execution result and marks transport retries safe", async () => {
  let captured;
  const fingerprint = `sha256:${"a".repeat(64)}`;
  const client = new ActionboxClient({
    apiKey: "axb_test",
    fetch: async (input, init) => {
      captured = { input, init };
      return jsonResponse({ data: {
        id: "out_1",
        action_id: "act/1",
        status: "failed",
        duration_ms: 1200,
        rollback: true,
        reason_code: "LOCK_TIMEOUT",
        action_version: 3,
        fingerprint,
        created_at: "2026-08-23T00:00:00Z",
      } }, { status: 201 });
    },
  });

  const outcome = await client.reportOutcome("act/1", {
    status: "failed",
    duration_ms: 1200,
    rollback: true,
    reason_code: "LOCK_TIMEOUT",
    action_version: 3,
    fingerprint,
  });
  assert.equal(outcome.id, "out_1");
  assert.equal(captured.input, "https://api.actionbox.cloud/v1/actions/act%2F1/outcome");
  assert.equal(captured.init.headers.get("Idempotency-Key"), "outcome-act/1");
  assert.deepEqual(JSON.parse(captured.init.body), {
    status: "failed",
    duration_ms: 1200,
    rollback: true,
    reason_code: "LOCK_TIMEOUT",
    action_version: 3,
    fingerprint,
  });
});

test("oversized responses fail closed", async () => {
  const client = new ActionboxClient({
    apiKey: "axb_test",
    maxRetries: 0,
    fetch: async () => jsonResponse({ data: { value: "x".repeat(1_048_576) } }),
  });

  await assert.rejects(
    () => client.get("act_1"),
    (error) => error instanceof ActionboxError && error.code === "RESPONSE_TOO_LARGE",
  );
});

test("rejects plaintext remote endpoints but allows loopback development", () => {
  assert.throws(() => new ActionboxClient({ apiKey: "axb_test", baseUrl: "http://example.com" }), /HTTPS/);
  assert.doesNotThrow(() => new ActionboxClient({ apiKey: "axb_test", baseUrl: "http://127.0.0.1:8000" }));
  assert.doesNotThrow(() => new ActionboxClient({ apiKey: "axb_test", baseUrl: "http://127.0.0.2:8000" }));
  assert.doesNotThrow(() => new ActionboxClient({ apiKey: "axb_test", baseUrl: "http://[::1]:8000" }));
  assert.doesNotThrow(() => new ActionboxClient({ apiKey: "axb_test", baseUrl: "http://[::ffff:127.0.0.1]:8000" }));
});

test("request timeout is reported with a stable code", async () => {
  const client = new ActionboxClient({
    apiKey: "axb_test",
    timeoutMs: 5,
    maxRetries: 0,
    fetch: async (_input, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
    }),
  });

  await assert.rejects(
    () => client.get("act_1"),
    (error) => error instanceof ActionboxError && error.code === "TIMEOUT",
  );
});

test("transport failures are wrapped without exposing native details", async () => {
  const client = new ActionboxClient({
    apiKey: "axb_secret",
    maxRetries: 0,
    fetch: async () => { throw new TypeError("fetch failed for https://api.actionbox.cloud/?token=secret"); },
  });

  await assert.rejects(
    () => client.get("act_1"),
    (error) => error instanceof ActionboxError
      && error.code === "NETWORK_ERROR"
      && !error.message.includes("token=secret"),
  );
});

test("ask rejects colliding derived option IDs before transport", async () => {
  const client = new ActionboxClient({
    apiKey: "axb_test",
    fetch: async () => { throw new Error("transport should not run"); },
  });
  await assert.rejects(
    () => client.ask({ title: "Choose", options: ["A B", "A-B"], wait: false }),
    /unique IDs/,
  );
});

test("ask normalizes common symbols into valid option IDs", async () => {
  let body;
  const client = new ActionboxClient({
    apiKey: "axb_test",
    fetch: async (_input, init) => {
      body = JSON.parse(init.body);
      return jsonResponse({ data: { id: "act_1", status: "open", title: "Choose", description: "", resolution_option_id: null } });
    },
  });

  await client.ask({
    title: "Choose",
    options: ["Deploy to /var/www", "Cancel (abort)!", "Review & ship?"],
    wait: false,
  });

  assert.deepEqual(body.options, [
    { id: "deploy-to-var-www", label: "Deploy to /var/www" },
    { id: "cancel-abort", label: "Cancel (abort)!" },
    { id: "review-ship", label: "Review & ship?" },
  ]);
});

test("ask rejects collisions after symbol normalization", async () => {
  const client = new ActionboxClient({
    apiKey: "axb_test",
    fetch: async () => { throw new Error("transport should not run"); },
  });
  await assert.rejects(
    () => client.ask({ title: "Choose", options: ["A/B", "A & B"], wait: false }),
    /unique IDs/,
  );
});

test("Watch source methods keep capability URLs out of list requests", async () => {
  const calls = [];
  const client = new ActionboxClient({
    apiKey: "axb_test",
    fetch: async (input, init) => {
      calls.push({ input, init });
      if (init.method === undefined || init.method === "GET") {
        return jsonResponse({ data: [{ id: "wat_1", name: "Backup", status: "healthy", derived_status: "healthy" }] });
      }
      return jsonResponse({ data: { id: "wat_1", name: "Backup", status: "new", heartbeat_url: "https://api.example/hb/hb_secret" } });
    },
  });
  const watches = await client.watches();
  assert.equal(watches[0].id, "wat_1");
  const created = await client.createWatch({ name: "Backup", schedule_type: "interval", interval_seconds: 300 });
  assert.equal(created.heartbeat_url, "https://api.example/hb/hb_secret");
  assert.equal(JSON.parse(calls[1].init.body).source_id, undefined);
  assert.match(calls[1].init.headers.get("Idempotency-Key"), /^watch-sdk-/);
  assert.equal(calls[0].init.headers.get("Authorization"), "Bearer axb_test");
});

test("Watch creation reuses its idempotency key across retries", async () => {
  const keys = [];
  const client = new ActionboxClient({
    apiKey: "axb_test",
    maxRetries: 1,
    fetch: async (_input, init) => {
      keys.push(init.headers.get("Idempotency-Key"));
      if (keys.length === 1) return jsonResponse({ error: { code: "TEMPORARY" } }, { status: 503, headers: { "Retry-After": "0" } });
      return jsonResponse({ data: { id: "wat_1", name: "Backup", status: "new", heartbeat_url: "https://api.example/hb/hb_secret" } });
    },
  });
  await client.createWatch(
    { name: "Backup", schedule_type: "interval", interval_seconds: 300 },
    { idempotencyKey: "watch-caller-key" },
  );
  assert.deepEqual(keys, ["watch-caller-key", "watch-caller-key"]);
});

test("wait uses pollMs to pace immediate open responses", async () => {
  const calls = [];
  const client = new ActionboxClient({
    apiKey: "axb_test",
    fetch: async () => {
      calls.push(Date.now());
      return jsonResponse({ data: { id: "act_1", status: "open" } });
    },
  });
  const started = Date.now();
  await client.wait("act_1", 125, 40);
  const elapsed = Date.now() - started;
  assert.ok(calls.length >= 3 && calls.length <= 5, `unexpected request count: ${calls.length}`);
  assert.ok(elapsed >= 100 && elapsed < 400, `unexpected elapsed time: ${elapsed}ms`);
  for (let index = 2; index < calls.length; index += 1) {
    assert.ok(calls[index] - calls[index - 1] >= 25, "polls should not form a busy loop");
  }
});

test("wait aborts an in-flight request at its overall deadline", async () => {
  const client = new ActionboxClient({
    apiKey: "axb_test",
    timeoutMs: 10_000,
    maxRetries: 0,
    fetch: async (_input, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
    }),
  });
  const started = Date.now();
  await assert.rejects(
    () => client.wait("act_1", 40, 10),
    (error) => error instanceof ActionboxError && error.code === "WAIT_TIMEOUT",
  );
  assert.ok(Date.now() - started < 250);
});

test("Watch source lifecycle helpers stay scoped and expose rotation only once", async () => {
  const paths = [];
  const client = new ActionboxClient({
    apiKey: "axb_test",
    fetch: async (input, init) => {
      paths.push({ path: new URL(input).pathname, method: init.method ?? "GET" });
      if (init.method === "DELETE") return new Response(null, { status: 204 });
      const body = init.method === "POST" && new URL(input).pathname.endsWith("/token/rotate")
        ? { heartbeat_url: "https://api.example/hb/hb_rotated" }
        : {};
      return jsonResponse({ data: { id: "wat_1", name: "Backup", status: "healthy", derived_status: "healthy", ...body } });
    },
  });
  await client.pauseWatch("wat/1");
  await client.resumeWatch("wat/1");
  const rotated = await client.rotateWatchToken("wat/1");
  await client.archiveWatch("wat/1");
  assert.equal(rotated.heartbeat_url, "https://api.example/hb/hb_rotated");
  assert.deepEqual(paths.map((entry) => entry.path), [
    "/v1/source/watches/wat%2F1/pause",
    "/v1/source/watches/wat%2F1/resume",
    "/v1/source/watches/wat%2F1/token/rotate",
    "/v1/source/watches/wat%2F1",
  ]);
});

test("Agent Run helpers hide progress sequence bookkeeping", async () => {
  const captured = [];
  const client = new ActionboxClient({
    apiKey: "axb_test",
    fetch: async (input, init) => {
      const body = init.body ? JSON.parse(init.body) : {};
      captured.push({ path: new URL(input).pathname, body });
      const status = new URL(input).pathname.endsWith("/complete") ? body.status : "running";
      const progress_sequence = body.sequence ?? body.progress_sequence ?? 0;
      return jsonResponse({ data: {
        id: "run/1",
        status,
        progress_sequence,
      } });
    },
  });

  let run = await client.startRun({
    external_id: "task-42",
    agent_name: "codex",
    title: "Fix checkout",
  });
  run = await client.progressRun(run, { stage: "tests", checkpoint: "test-184" });
  run = await client.completeRun(run);

  assert.equal(run.status, "succeeded");
  assert.deepEqual(captured.map((request) => request.path), [
    "/v1/runs",
    "/v1/source/runs/run%2F1/progress",
    "/v1/source/runs/run%2F1/complete",
  ]);
  assert.equal(captured[1].body.sequence, 1);
  assert.equal(captured[2].body.progress_sequence, 1);
});

test("sendHeartbeat validates capability shape and returns only status failures", async () => {
  let captured;
  let capturedMethod;
  await sendHeartbeat("http://127.0.0.1/hb/hb_test", "success", {
    fetch: async (input, init) => {
      captured = String(input);
      capturedMethod = init?.method;
      return new Response(null, { status: 204 });
    },
  });
  assert.equal(captured, "http://127.0.0.1/hb/hb_test/success");
  assert.equal(capturedMethod, "POST");
  await assert.rejects(() => sendHeartbeat("http://example.com/hb/hb_test"), /HTTPS/);
});

test("sendHeartbeat distinguishes caller cancellation from timeout", async () => {
  const controller = new AbortController();
  const pending = sendHeartbeat("http://127.0.0.1/hb/hb_test", "ping", {
    signal: controller.signal,
    timeoutMs: 1_000,
    fetch: async (_input, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
    }),
  });
  controller.abort();
  await assert.rejects(
    () => pending,
    (error) => error instanceof ActionboxError && error.code === "ABORTED",
  );
});

test("policy ask rejects changed content and unapproved machine provenance", async () => {
  for (const change of [
    { content_fingerprint: "sha256:other", fingerprint: "sha256:other", action_version: 2 },
    { resolved_by_type: "system" },
    { resolved_by_type: "source", approval_policy: { schema_version: 1, mode: "all", allow_source_override: true } },
  ]) {
    const created = { id: "act_binding", status: "open", action_version: 1,
      fingerprint: "sha256:original", content_fingerprint: "sha256:original-content",
      approval_policy: { schema_version: 1, mode: "all", allow_source_override: false } };
    const client = new ActionboxClient({ apiKey: "axb_test", fetch: async (_url, init) =>
      jsonResponse({ data: init.method === "POST" ? created : {
        ...created, status: "resolved", resolved_by_type: "user", resolution_option_id: "approve", ...change,
      } }) });
    await assert.rejects(client.ask({ title: "Deploy?", options: ["Approve"] }),
      (error) => error.code === "APPROVAL_BINDING_MISMATCH");
  }
});

test("chat delivery policy is forwarded on create and update", async () => {
  const payloads = [];
  const client = new ActionboxClient({ apiKey: "axb_test", fetch: async (_input, init) => {
    payloads.push(JSON.parse(init.body));
    return jsonResponse({ data: { id: "act_chat", title: "Private review", status: "open" } });
  }});
  await client.create({ title: "Private review", chat_delivery: "disabled" });
  await client.update("act_chat", { chat_delivery: "inherit" });
  assert.equal(payloads[0].chat_delivery, "disabled");
  assert.deepEqual(payloads[1], { chat_delivery: "inherit" });
});
