import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleRequest, runProof } from "../src/worker.js";

const CONTRACT_KEY = "home-organization/family-reset-routines/7-day-family-reset-planner/v1";
const CONTRACT_ID = "recpjWkUboIb7pOQB";
const DELIVERY_URL = "https://modernparentingco.com/home-organization/family-reset-routines/delivery/7-day-family-reset-planner";
const PDF_BYTES = new Uint8Array(613438);
const PDF_SHA256 = "53284495b176e7567eed9614c32cdd29f7317db9e1e4721aeac1fbece85c98af";
const REAL_DIGEST = crypto.subtle.digest.bind(crypto.subtle);
const PDF_DIGEST_BYTES = Uint8Array.from(PDF_SHA256.match(/.{2}/g).map((part) => Number.parseInt(part, 16)));
Object.defineProperty(globalThis, "crypto", {
  configurable: true,
  value: {
    subtle: {
      digest: async (algorithm, data) => {
        const bytes =
          data instanceof ArrayBuffer
            ? new Uint8Array(data)
            : ArrayBuffer.isView(data)
              ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
              : new Uint8Array(data);
        if (bytes.byteLength === PDF_BYTES.byteLength) return PDF_DIGEST_BYTES.slice().buffer;
        return REAL_DIGEST(algorithm, data);
      },
    },
  },
});

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function contractRecord(overrides = {}) {
  return {
    id: CONTRACT_ID,
    fields: {
      "Contract Key": CONTRACT_KEY,
      Status: "Proof Only",
      Mode: "Manual Proof",
      "Delivery Automation Status": "Paused",
      "Parent Niche": "home-organization",
      "Sub-Niche": "family-reset-routines",
      "Lead Magnet": "7-Day Family Reset Planner",
      "Route Key": "home-organization/family-reset-routines/signup/default",
      "Source Form ID": "home-organization/family-reset-routines/signup/default",
      "Source Asset ID": "6a0224af750f20f1568cf7cb",
      "Brevo List ID": "5",
      "Brevo Template ID": "6",
      "Brevo Sender ID": "2",
      "Delivery URL": DELIVERY_URL,
      "Asset Byte Size": PDF_BYTES.byteLength,
      "Asset SHA-256": PDF_SHA256,
      "Max Send Count": 1,
      ...overrides,
    },
  };
}

function contact(overrides = {}) {
  return {
    id: 1,
    email: "proof@example.test",
    listIds: [2, 4, 5],
    attributes: {
      PRIMARY_NICHE: "home-organization",
      SUB_NICHE: "family-reset-routines",
      LEAD_MAGNET: "7-Day Family Reset Planner",
      SOURCE_FORM_ID: "home-organization/family-reset-routines/signup/default",
      SOURCE_ASSET_ID: "6a0224af750f20f1568cf7cb",
      "DOUBLE_OPT-IN": "1",
      CONSENT_SOURCE: "storefront_signup",
      CONSENT_TIMESTAMP: "2026-05-13T10:00:00.000Z",
      ...(overrides.attributes || {}),
    },
    ...overrides,
  };
}

function template(overrides = {}) {
  return {
    id: 6,
    isActive: true,
    sender: {
      id: 2,
      name: "Modern Parenting Co",
      email: "hello@modernparentingco.com",
    },
    htmlContent: `<a href="${DELIVERY_URL}">Open the planner</a><a href="{{ unsubscribe }}">Unsubscribe</a>`,
    ...overrides,
  };
}

function proofInput(overrides = {}) {
  return {
    mode: "proof",
    contractId: CONTRACT_ID,
    contractKey: CONTRACT_KEY,
    brevoContactId: "1",
    proofId: "ws34dw-home-organization-contact-1",
    dryRun: true,
    ...overrides,
  };
}

function env(overrides = {}) {
  return {
    AIRTABLE_TOKEN: "airtable-secret",
    AIRTABLE_BASE_ID: "appLHjLQKQEM8j8Tm",
    BREVO_API_KEY: "brevo-secret",
    RUNNER_AUTH_SECRET: "runner-secret",
    ENABLE_PROOF_SEND: "0",
    ...overrides,
  };
}

function jsonResponse(payload, status = 200) {
  return Response.json(payload, { status });
}

function pdfResponse() {
  return new Response(PDF_BYTES, {
    headers: {
      "content-type": "application/pdf",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

async function fetcherFactory(options = {}) {
  const calls = [];
  const contract = await contractRecord(options.contractFields || {});
  const handler = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });

    if (url.includes("/Lead%20Magnet%20Delivery%20Contracts/")) return jsonResponse(contract);
    if (url.includes("/Lead%20Magnet%20Delivery%20Evidence?")) {
      return jsonResponse({ records: options.duplicate ? [{ id: "recEvidence" }] : [] });
    }
    if (url.includes("/v3/contacts/1")) return jsonResponse(contact(options.contactOverrides || {}));
    if (url.includes("/v3/smtp/templates/6")) return jsonResponse(template(options.templateOverrides || {}));
    if (url === DELIVERY_URL) return pdfResponse();
    if (url.includes("/v3/smtp/email")) return jsonResponse({ messageId: "message-123" }, 201);
    if (url.includes("/Lead%20Magnet%20Delivery%20Evidence") && init.method === "POST") {
      return jsonResponse({ id: "recEvidenceCreated" }, 201);
    }

    return jsonResponse({ error: "unexpected", url }, 500);
  };
  handler.calls = calls;
  return handler;
}

describe("lead magnet delivery runner", () => {
  it("rejects unauthenticated proof requests before any network calls", async () => {
    const fetcher = await fetcherFactory();
    const response = await handleRequest(
      new Request("https://runner.example/proof", {
        method: "POST",
        body: JSON.stringify(proofInput()),
      }),
      env(),
      fetcher,
    );

    assert.equal(response.status, 401);
    assert.equal(fetcher.calls.length, 0);
  });

  it("performs a dry-run without sending email or writing evidence", async () => {
    const fetcher = await fetcherFactory();
    const result = await runProof(proofInput(), env(), fetcher);

    assert.equal(result.ok, true);
    assert.equal(result.dryRun, true);
    assert.equal(result.send, "not_attempted");
    assert.equal(result.evidence, "not_written");
    assert.equal(fetcher.calls.some((call) => call.url.includes("/v3/smtp/email")), false);
    assert.equal(fetcher.calls.some((call) => call.init.method === "POST"), false);
  });

  it("blocks duplicate evidence before contact readback or send", async () => {
    const fetcher = await fetcherFactory({ duplicate: true });
    await assert.rejects(
      () => runProof(proofInput(), env(), fetcher),
      /duplicate_evidence_exists/,
    );

    assert.equal(fetcher.calls.some((call) => call.url.includes("/v3/contacts/1")), false);
    assert.equal(fetcher.calls.some((call) => call.url.includes("/v3/smtp/email")), false);
  });

  it("blocks mismatched contact attribution", async () => {
    const fetcher = await fetcherFactory({
      contactOverrides: { attributes: { SUB_NICHE: "wrong" } },
    });

    await assert.rejects(
      () => runProof(proofInput(), env(), fetcher),
      /contact_validation_failed/,
    );
    assert.equal(fetcher.calls.some((call) => call.url.includes("/v3/smtp/email")), false);
  });

  it("keeps real proof sending disabled unless the explicit flag is enabled", async () => {
    const fetcher = await fetcherFactory();

    await assert.rejects(
      () => runProof(proofInput({ dryRun: false }), env(), fetcher),
      /proof_send_disabled/,
    );
    assert.equal(fetcher.calls.some((call) => call.url.includes("/v3/smtp/email")), false);
  });

  it("sends and writes evidence only when the proof-send flag is enabled", async () => {
    const fetcher = await fetcherFactory();
    const result = await runProof(proofInput({ dryRun: false }), env({ ENABLE_PROOF_SEND: "1" }), fetcher);

    assert.equal(result.ok, true);
    assert.equal(result.dryRun, false);
    assert.equal(result.messageId, "message-123");
    assert.equal(result.evidenceRecordId, "recEvidenceCreated");
    assert.equal(fetcher.calls.filter((call) => call.url.includes("/v3/smtp/email")).length, 1);
    assert.equal(fetcher.calls.filter((call) => call.init.method === "POST" && call.url.includes("Lead%20Magnet%20Delivery%20Evidence")).length, 1);
  });
});
