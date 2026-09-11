import assert from "node:assert/strict";
import * as crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";

import { ActionboxError, verifyDecisionReceipt } from "../dist/index.js";

const fixtures = fs.existsSync(new URL("./fixtures/", import.meta.url))
  ? new URL("./fixtures/", import.meta.url)
  : new URL("../../../test-fixtures/", import.meta.url);

function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}

function generateTestKeys() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const jwk = publicKey.export({ format: "jwk" });
  const rawPub = Buffer.from(jwk.x, "base64url");
  return { privateKey, publicKey, jwk, rawPub };
}

function makeReceipt(privateKey, kid = "test-key-1", overrides = {}, tamperSig = false) {
  const header = {
    alg: "EdDSA",
    typ: "actionbox-decision-receipt",
    v: 1,
    kid,
  };
  const payload = {
    iss: "actionbox",
    receipt_version: 1,
    action_id: "act_test_node_123",
    environment: "live",
    version: 1,
    action_version: 1,
    fingerprint: "fp_node_xyz",
    status: "resolved",
    resolved_at: new Date().toISOString(),
    ...overrides,
  };

  const encodedH = b64url(JSON.stringify(header));
  const encodedP = b64url(JSON.stringify(payload));
  const signingInput = Buffer.from(`${encodedH}.${encodedP}`, "ascii");
  let sig = crypto.sign(null, signingInput, privateKey);
  if (tamperSig) {
    sig = Buffer.from(sig);
    sig[0] ^= 0xff;
  }
  const encodedS = b64url(sig);
  return `${encodedH}.${encodedP}.${encodedS}`;
}

test("verifyDecisionReceipt succeeds on valid receipt with JWK", async () => {
  const fixtureUrl = new URL("decision-receipt-v1.json", fixtures);
  const fixture = JSON.parse(fs.readFileSync(fixtureUrl, "utf8"));
  const verified = await verifyDecisionReceipt(fixture.receipt, fixture.jwks, {
    expectedActionId: "act_contract_fixture",
    expectedEnvironment: "live",
    expectedFingerprint: `sha256:${"a".repeat(64)}`,
  });

  for (const [key, value] of Object.entries(fixture.claims)) {
    assert.deepEqual(verified[key], value);
  }
});

test("verifyDecisionReceipt accepts the shared approval-policy v2 fixture", async () => {
  const fixtureUrl = new URL("decision-receipt-v2.json", fixtures);
  const fixture = JSON.parse(fs.readFileSync(fixtureUrl, "utf8"));
  const verified = await verifyDecisionReceipt(fixture.receipt, fixture.jwks, { expectedActionId: "act_approval_fixture" });
  assert.equal(verified.receipt_version, 2);
  assert.equal(verified.resolution_method, "approval_policy");
  assert.equal(verified.approval_progress.votes.length, 2);
});

test("verifyDecisionReceipt succeeds on valid receipt with raw public key buffer", async () => {
  const { privateKey, rawPub } = generateTestKeys();
  const receipt = makeReceipt(privateKey, "test-key-1");
  const verified = await verifyDecisionReceipt(receipt, {
    "test-key-1": rawPub,
  });

  assert.equal(verified.action_id, "act_test_node_123");
});

test("verifyDecisionReceipt defaults to live and requires an explicit opt-out", async () => {
  const { privateKey, rawPub } = generateTestKeys();
  const receipt = makeReceipt(privateKey, "test-key-1", { environment: "test" });

  await assert.rejects(
    () => verifyDecisionReceipt(receipt, { "test-key-1": rawPub }),
    (error) => error instanceof ActionboxError && error.code === "INVALID_RECEIPT",
  );
  const verified = await verifyDecisionReceipt(receipt, { "test-key-1": rawPub }, {
    expectedEnvironment: null,
  });
  assert.equal(verified.environment, "test");
});

test("verifyDecisionReceipt rejects tampered signature", async () => {
  const { privateKey, jwk } = generateTestKeys();
  const receipt = makeReceipt(privateKey, "test-key-1", {}, true);

  await assert.rejects(async () => {
    await verifyDecisionReceipt(receipt, [{ ...jwk, kid: "test-key-1" }]);
  }, (err) => err instanceof ActionboxError && err.code === "INVALID_RECEIPT");
});

test("verifyDecisionReceipt rejects mismatched expectedActionId", async () => {
  const { privateKey, jwk } = generateTestKeys();
  const receipt = makeReceipt(privateKey, "test-key-1");

  await assert.rejects(async () => {
    await verifyDecisionReceipt(receipt, [{ ...jwk, kid: "test-key-1" }], {
      expectedActionId: "act_wrong_id",
    });
  }, (err) => err instanceof ActionboxError && err.code === "INVALID_RECEIPT");
});

test("verifyDecisionReceipt rejects expired receipts", async () => {
  const { privateKey, jwk } = generateTestKeys();
  const pastTime = new Date(Date.now() - 120_000).toISOString();
  const receipt = makeReceipt(privateKey, "test-key-1", { resolved_at: pastTime });

  await assert.rejects(async () => {
    await verifyDecisionReceipt(receipt, [{ ...jwk, kid: "test-key-1" }], {
      maxAgeSeconds: 30,
    });
  }, (err) => err instanceof ActionboxError && err.code === "INVALID_RECEIPT");
});

test("verifyDecisionReceipt rejects receipts dated too far in the future", async () => {
  const { privateKey, jwk } = generateTestKeys();
  const futureTime = new Date(Date.now() + 300_000).toISOString();
  const receipt = makeReceipt(privateKey, "test-key-1", { resolved_at: futureTime });

  await assert.rejects(async () => {
    await verifyDecisionReceipt(receipt, [{ ...jwk, kid: "test-key-1" }], {
      maxAgeSeconds: 30,
      maxFutureSkewSeconds: 10,
    });
  }, (err) => err instanceof ActionboxError && err.code === "INVALID_RECEIPT");
});

test("verifyDecisionReceipt rejects future receipts without maxAgeSeconds", async () => {
  const { privateKey, jwk } = generateTestKeys();
  const futureTime = new Date(Date.now() + 300_000).toISOString();
  const receipt = makeReceipt(privateKey, "test-key-1", { resolved_at: futureTime });

  await assert.rejects(async () => {
    await verifyDecisionReceipt(receipt, [{ ...jwk, kid: "test-key-1" }], {
      maxFutureSkewSeconds: 10,
    });
  }, (err) => err instanceof ActionboxError && err.code === "INVALID_RECEIPT");
});

test("verifyDecisionReceipt rejects invalid timestamps without maxAgeSeconds", async () => {
  const { privateKey, jwk } = generateTestKeys();
  const receipt = makeReceipt(privateKey, "test-key-1", { resolved_at: "not-a-timestamp" });

  await assert.rejects(
    verifyDecisionReceipt(receipt, [{ ...jwk, kid: "test-key-1" }]),
    (err) => err instanceof ActionboxError && err.code === "INVALID_RECEIPT",
  );
});

test("verifyDecisionReceipt rejects an unknown key id", async () => {
  const { privateKey, jwk } = generateTestKeys();
  const receipt = makeReceipt(privateKey, "unknown-key");

  await assert.rejects(
    verifyDecisionReceipt(receipt, [{ ...jwk, kid: "trusted-key" }]),
    (err) => err instanceof ActionboxError && err.code === "INVALID_RECEIPT",
  );
});
