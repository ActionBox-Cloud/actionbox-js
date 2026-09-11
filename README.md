<img src="https://actionbox.cloud/appbox.svg" width="64" alt="Actionbox logo">

# Actionbox Node/TypeScript SDK

Actionbox gives backend services a durable, server-authoritative way to ask a
human for a decision and continue when that decision is available. This package
is the typed Node.js/TypeScript client for creating, resolving, and waiting on
Actions, plus managing source-scoped heartbeat Watches.

## Documentation

- [Actionbox documentation](https://actionbox.cloud/docs)
- [API reference and OpenAPI](https://api.actionbox.cloud/docs)

## Requirements

- Node.js 18 or newer
- An Actionbox Source API key, supplied through `ACTIONBOX_API_KEY`

Keep API keys and Watch capability URLs on trusted servers, workers, or CI
jobs. Do not bundle this SDK or its credentials into a browser application.

## Install

```bash
npm install @actionbox/sdk
```

```ts
import { ActionboxClient } from "@actionbox/sdk";

const client = new ActionboxClient({ apiKey: process.env.ACTIONBOX_API_KEY! });
const decision = await client.ask({
  title: "Deploy to production?",
  options: ["Approve", "Reject"],
  assignee_email: "reviewer@example.com",
});
console.log(decision);
```

Use `assignee_email` for human-managed configuration. Actionbox resolves it
only among active reviewers in the Source workspace. Stable integrations may
use `assignee_user_id` instead; the ID is copyable from the Team settings
page. Do not send both fields.

Team integrations can restrict discovery to several reviewers:

```ts
await client.create({
  title: "Approve emergency access",
  visibility: "restricted",
  reviewer_emails: ["incident@example.com", "security@example.com"],
});
```

Use either `reviewer_emails` or `reviewer_user_ids`, with at most 15 members.

The SDK uses the hosted production API at `https://api.actionbox.cloud` by
default. Customer integrations should use that default; the optional
`baseUrl` override is reserved for maintainer-controlled test environments.

The SDK uses the same REST contract as the CLI and Python SDK. It does not own state; the API remains authoritative. The concise single-choice API returns the selected option ID as a string.

## Typed interactions and responses

The SDK exports typed interaction and response unions matching the REST API. Use `interaction` with `create` or `ask` for boolean, text, numeric, multi-choice, or form responses:

```ts
import {
  ActionboxClient,
  BooleanInteraction,
  TypedResponse,
} from "@actionbox/sdk";

const client = new ActionboxClient({ apiKey: process.env.ACTIONBOX_API_KEY! });
const interaction: BooleanInteraction = {
  type: "boolean",
  label: "Deploy now?",
  true_label: "Deploy",
  false_label: "Hold",
};

const action = await client.create({
  title: "Deploy configuration",
  interaction,
});

const resolved = await client.resolve(action.id, {
  response: { type: "boolean", value: true },
  reason: "Approved by release manager",
});
const response: TypedResponse | null = resolved.response;
console.log(response); // { type: "boolean", value: true }
```

Supported interaction types are `boolean`, `single_choice`, `multi_choice`, `text`, `integer`, `number`, `rating`, and `form`. Form responses use `{ type: "form", values: { ... } }`. Create inputs also accept bounded developer `context` blocks and an explicit typed `on_expire` fallback; omitting it returns `expired` without inventing a response.

`resolve` supports the typed request shape and a concise positional form for a single choice:

```ts
await client.resolve(action.id, { response: { type: "text", value: "ship" } });
await client.resolve(action.id, "approve", "Approved"); // single-choice shorthand
```

`Action.interaction` and `Action.response` expose the canonical typed wire values. `options`, `option_id`, and `ask({ options: [...] })` are first-class single-choice conveniences.

## Optional decision context

Keep simple Actions unchanged. For higher-impact reviews, add the generic
structured context with a semantic helper:

```ts
import { deploymentDecisionContext } from "@actionbox/sdk";

const action = await client.create({
  title: "Deploy 2.18.0?",
  decision_class: "production_deployment",
  decision_context: deploymentDecisionContext({
    reason: "Release passed staging.",
    proposed_change: "Deploy 2.18.0 to production.",
    risk_level: "high",
    reversibility: "reversible",
    rollback_plan: "Restore the previous image.",
  }),
});
```

The generic, refund, database-change, and access-request helpers emit the same
wire shape; they do not create server-side template types.

If `action.context_request` is present, a reviewer has asked for more detail.
Update the same Action so the pending request clears and the reviewer sees the
latest, version-bound context:

```ts
await client.update(action.id, {
  decision_context: deploymentDecisionContext({
    reason: "The reviewer requested the operational risk.",
    proposed_change: "Deploy 2.18.0 to production.",
    risk_level: "high",
    reversibility: "reversible",
    rollback_plan: "Restore the previous image.",
  }),
});
```

If the Source cannot truthfully supply it, close the request explicitly:

```ts
await client.markContextUnavailable(
  action.id,
  "Production customer data is not accessible to this worker.",
  "cannot_access",
);
```

## Execution outcomes

After carrying out an approved operation, report its real result with the
resolved Action's exact binding:

```ts
const outcome = await client.reportOutcome(resolved.id, {
  status: "success",
  duration_ms: 48_312,
  rollback: false,
  action_version: resolved.action_version!,
  fingerprint: resolved.fingerprint!,
});
```

Exact retries are safe; Actionbox rejects a conflicting second outcome.

## Action Controls

Paid plans can attach a few secondary operations to an Action. A control does
not answer or close the Action. It asks the Source to do something, such as
retrying a job, while the reviewer keeps the original decision open.

```ts
import { ActionboxClient, control, link } from "@actionbox/sdk";

const action = await client.create({
  title: "Deployment failed",
  callback_url: "https://ci.example.com/actionbox",
  controls: [
    control("retry", "Retry deployment"),
    control("rollback", "Roll back", { destructive: true }),
    link("logs", "Open logs", "https://ci.example.com/runs/4821"),
  ],
});
```

The signed `action.control_requested` webhook includes a
`control_request_id`. Report the operation state with the Source client:

```ts
await client.reportControlResult(controlRequestId, {
  status: "running",
  message: "Retry started",
});
await client.reportControlResult(controlRequestId, {
  status: "succeeded",
  message: "Deployment recovered",
});
```

Use `failed` when the operation does not complete. ActionBox records the result
without resolving the parent Action. During staged rollout, the API may return
`CONTROLS_DISABLED` until the feature is enabled for the paid workspace.
ActionBox never runs an infrastructure command itself. Your callback handler
maps each control key to an operation and reports the result. A later Watch
heartbeat or meaningful Agent Run update can add independent recovery evidence.
That evidence does not replace the Source's reported result.

## Agent Runs

Group one agent task and its Actions with three small calls:

```ts
let run = await client.startRun({
  external_id: "checkout-fix-42",
  agent_name: "codex",
  title: "Fix checkout deadlock",
  stall_after_seconds: 900,
});
run = await client.progressRun(run, { stage: "tests", checkpoint: "test-184" });
const action = await client.create({
  title: "Approve staging migration",
  run_id: run.id,
  callback_url: "https://agent.example.com/actionbox",
  controls: [control("resume", "Resume run")],
});
run = await client.completeRun(run);
```

The SDK handles progress sequence numbers. Runs are optional; standalone
Actions continue to work exactly as before. When `stall_after_seconds` is set,
unchanged status/stage/checkpoint updates do not reset the timer. Actionbox
creates one ordinary Action if progress stalls and resolves it when progress
changes or the Run completes; `waiting` pauses the timer. Meaningful progress
or completion also verifies the latest delivered control on an Action linked
to that Run.

## Heartbeat Watches

Source credentials can create and list Watches scoped to that Source. The raw heartbeat URL is returned only by creation:

```ts
import { sendHeartbeat } from "@actionbox/sdk";

const watch = await client.createWatch({
  name: "Nightly backup",
  schedule_type: "interval",
  interval_seconds: 3600,
  grace_seconds: 60,
  signal_method: "post",
});
await sendHeartbeat(watch.heartbeat_url, "start");
```

Watch creation automatically uses a secure idempotency key. If your application
retries the whole call, pass the same key as the second argument:

```ts
await client.createWatch(input, { idempotencyKey: "watch-nightly-backup-v1" });
```

Use `sendHeartbeat` for `ping`, `start`, `success`, or `fail`; it always sends
POST. `signal_method: "post"` prevents link previewers and security scanners
from accidentally recording a heartbeat with GET. Source-scoped
management helpers are available as `pauseWatch`, `resumeWatch`,
`rotateWatchToken`, and `archiveWatch`; only create/rotate return a raw URL.
Store capability URLs in a secret manager; Watch details and exports never
return them.
When Action Controls are enabled for a paid workspace, a Watch incident also
offers `Skip this occurrence` and `Pause monitoring`. Skipping closes only the
current incident and advances the Watch schedule. A later healthy signal can
independently verify a delivered control request.

## Verify decision receipts

Resolved Actions include an Ed25519-signed receipt. Fetch ActionBox's public key
set and bind verification to the Action you expected:

```ts
const keys = await fetch(
  "https://api.actionbox.cloud/.well-known/actionbox-receipt-keys.json",
).then((response) => response.json());

const claims = await client.verifyReceipt(action.receipt, keys, {
  expectedActionId: action.id,
  expectedEnvironment: "live",
  expectedFingerprint: action.fingerprint,
  maxAgeSeconds: 300,
});
```

Cache the public key set according to its response headers and refresh it when
verification encounters a new key ID. Receipt verification expects the `live`
environment by default. Pass `expectedEnvironment: null` only when a tool
deliberately accepts receipts from more than one environment.
The verifier always validates the timezone-aware `resolved_at` timestamp and
rejects receipts beyond the future-clock-skew tolerance. `maxAgeSeconds` is
optional and adds an upper age limit when your workflow needs one.

## License

MIT. See [LICENSE](./LICENSE).
