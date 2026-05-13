const AIRTABLE_API_ROOT = "https://api.airtable.com/v0";
const BREVO_API_ROOT = "https://api.brevo.com/v3";
const DEFAULT_BASE_ID = "appLHjLQKQEM8j8Tm";
const DEFAULT_CONTRACT_TABLE = "Lead Magnet Delivery Contracts";
const DEFAULT_EVIDENCE_TABLE = "Lead Magnet Delivery Evidence";
const SCENARIO_ID = "lead-magnet-delivery-runner-proof";

const HOME_ORGANIZATION_DEFAULTS = {
  contractId: "recpjWkUboIb7pOQB",
  contractKey: "home-organization/family-reset-routines/7-day-family-reset-planner/v1",
  parentNiche: "home-organization",
  subNiche: "family-reset-routines",
  leadMagnet: "7-Day Family Reset Planner",
  routeKey: "home-organization/family-reset-routines/signup/default",
  sourceFormId: "home-organization/family-reset-routines/signup/default",
  sourceAssetId: "6a0224af750f20f1568cf7cb",
  listId: "5",
  templateId: "6",
  senderId: "2",
  senderEmail: "hello@modernparentingco.com",
  senderName: "Modern Parenting Co",
  deliveryUrl: "https://modernparentingco.com/home-organization/family-reset-routines/delivery/7-day-family-reset-planner",
  assetByteSize: 613438,
  assetSha256: "53284495b176e7567eed9614c32cdd29f7317db9e1e4721aeac1fbece85c98af",
};

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function numberText(value) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return text(value);
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function contactHash(contactId) {
  const encoded = new TextEncoder().encode(`brevo-contact:${contactId}`);
  return `sha256:${await sha256Hex(encoded)}`;
}

async function constantTimeEqual(left, right) {
  if (!left || !right) return false;

  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftHash);
  const rightBytes = new Uint8Array(rightHash);
  let diff = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < leftBytes.length; index += 1) {
    diff |= leftBytes[index] ^ rightBytes[index];
  }
  return diff === 0;
}

async function authorize(request, env) {
  const expected = text(env.RUNNER_AUTH_SECRET);
  const header = request.headers.get("authorization") || "";
  const provided = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  return constantTimeEqual(provided, expected);
}

function validateProofInput(input) {
  const errors = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) errors.push("invalid_json_body");
  if (errors.length) return errors;

  if (input.mode !== "proof") errors.push("mode_must_be_proof");
  if (text(input.contractId) !== HOME_ORGANIZATION_DEFAULTS.contractId) errors.push("unexpected_contract_id");
  if (text(input.contractKey) !== HOME_ORGANIZATION_DEFAULTS.contractKey) errors.push("unexpected_contract_key");
  if (text(input.brevoContactId) !== "1") errors.push("unexpected_brevo_contact_id");
  if (!text(input.proofId)) errors.push("missing_proof_id");
  if (typeof input.dryRun !== "boolean") errors.push("dry_run_boolean_required");
  return errors;
}

function envValue(env, key, fallback = "") {
  return text(env[key]) || fallback;
}

function requireEnv(env, key) {
  const value = text(env[key]);
  if (!value) throw new RunnerError("missing_secret", 500, `${key} is not configured`);
  return value;
}

function tableUrl(env, table, recordId = "") {
  const baseId = envValue(env, "AIRTABLE_BASE_ID", DEFAULT_BASE_ID);
  const base = `${AIRTABLE_API_ROOT}/${encodeURIComponent(baseId)}/${encodeURIComponent(table)}`;
  return recordId ? `${base}/${encodeURIComponent(recordId)}` : base;
}

function escapeFormulaString(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function readJsonResponse(response) {
  const raw = await response.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

class RunnerError extends Error {
  constructor(code, status = 400, detail = "") {
    super(code);
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

async function fetchJson(fetcher, url, init, failureCode) {
  const response = await fetcher(url, init);
  const payload = await readJsonResponse(response);
  if (!response.ok) {
    throw new RunnerError(failureCode, 502, `upstream_status_${response.status}`);
  }
  return payload;
}

async function airtableGetContract(env, contractId, fetcher) {
  const table = envValue(env, "CONTRACT_TABLE", DEFAULT_CONTRACT_TABLE);
  return fetchJson(
    fetcher,
    tableUrl(env, table, contractId),
    {
      headers: { authorization: `Bearer ${requireEnv(env, "AIRTABLE_TOKEN")}` },
      cache: "no-store",
    },
    "airtable_contract_read_failed",
  );
}

async function airtableFindEvidence(env, idempotencyKey, fetcher) {
  const table = envValue(env, "EVIDENCE_TABLE", DEFAULT_EVIDENCE_TABLE);
  const params = new URLSearchParams({
    maxRecords: "1",
    filterByFormula: `OR({Evidence Key} = "${escapeFormulaString(idempotencyKey)}", {Idempotency Key} = "${escapeFormulaString(idempotencyKey)}")`,
  });
  const payload = await fetchJson(
    fetcher,
    `${tableUrl(env, table)}?${params.toString()}`,
    {
      headers: { authorization: `Bearer ${requireEnv(env, "AIRTABLE_TOKEN")}` },
      cache: "no-store",
    },
    "airtable_evidence_search_failed",
  );
  return Array.isArray(payload?.records) ? payload.records : [];
}

async function airtableWriteEvidence(env, fields, fetcher) {
  const table = envValue(env, "EVIDENCE_TABLE", DEFAULT_EVIDENCE_TABLE);
  return fetchJson(
    fetcher,
    tableUrl(env, table),
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${requireEnv(env, "AIRTABLE_TOKEN")}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ fields }),
    },
    "airtable_evidence_write_failed",
  );
}

async function brevoGetContact(env, contactId, fetcher) {
  return fetchJson(
    fetcher,
    `${BREVO_API_ROOT}/contacts/${encodeURIComponent(contactId)}`,
    {
      headers: {
        accept: "application/json",
        "api-key": requireEnv(env, "BREVO_API_KEY"),
      },
      cache: "no-store",
    },
    "brevo_contact_read_failed",
  );
}

async function brevoGetTemplate(env, templateId, fetcher) {
  return fetchJson(
    fetcher,
    `${BREVO_API_ROOT}/smtp/templates/${encodeURIComponent(templateId)}`,
    {
      headers: {
        accept: "application/json",
        "api-key": requireEnv(env, "BREVO_API_KEY"),
      },
      cache: "no-store",
    },
    "brevo_template_read_failed",
  );
}

async function brevoSendTemplate(env, email, templateId, params, fetcher) {
  return fetchJson(
    fetcher,
    `${BREVO_API_ROOT}/smtp/email`,
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": requireEnv(env, "BREVO_API_KEY"),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        to: [{ email }],
        templateId: Number(templateId),
        params,
        tags: ["factory-lead-magnet-delivery", "worker-proof"],
      }),
    },
    "brevo_template_send_failed",
  );
}

async function verifyDeliveryAsset(contract, fetcher) {
  const response = await fetcher(contract.deliveryUrl, {
    headers: { accept: "application/pdf" },
    cache: "no-store",
  });
  if (!response.ok) throw new RunnerError("delivery_asset_fetch_failed", 502, `upstream_status_${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/pdf")) throw new RunnerError("delivery_asset_not_pdf", 409, contentType);

  const body = await response.arrayBuffer();
  const byteSize = body.byteLength;
  const hash = await sha256Hex(body);
  if (byteSize !== contract.assetByteSize) throw new RunnerError("delivery_asset_byte_mismatch", 409, String(byteSize));
  if (hash !== contract.assetSha256) throw new RunnerError("delivery_asset_hash_mismatch", 409, hash);
  return {
    contentType,
    byteSize,
    sha256: hash,
    cacheControl: response.headers.get("cache-control") || "",
    xRobotsTag: response.headers.get("x-robots-tag") || "",
  };
}

function contractFromRecord(record) {
  const fields = record?.fields || {};
  return {
    id: record?.id || "",
    contractKey: text(fields["Contract Key"]),
    status: text(fields.Status),
    mode: text(fields.Mode),
    automationStatus: text(fields["Delivery Automation Status"]) || text(fields["Automation Status"]),
    parentNiche: text(fields["Parent Niche"]) || HOME_ORGANIZATION_DEFAULTS.parentNiche,
    subNiche: text(fields["Sub-Niche"]) || HOME_ORGANIZATION_DEFAULTS.subNiche,
    leadMagnet: text(fields["Lead Magnet"]) || HOME_ORGANIZATION_DEFAULTS.leadMagnet,
    routeKey: text(fields["Route Key"]) || HOME_ORGANIZATION_DEFAULTS.routeKey,
    sourceFormId: text(fields["Source Form ID"]) || HOME_ORGANIZATION_DEFAULTS.sourceFormId,
    sourceAssetId: text(fields["Source Asset ID"]) || HOME_ORGANIZATION_DEFAULTS.sourceAssetId,
    brevoListId: numberText(fields["Brevo List ID"]) || HOME_ORGANIZATION_DEFAULTS.listId,
    brevoTemplateId: numberText(fields["Brevo Template ID"]) || HOME_ORGANIZATION_DEFAULTS.templateId,
    brevoSenderId: numberText(fields["Brevo Sender ID"]) || HOME_ORGANIZATION_DEFAULTS.senderId,
    deliveryUrl: text(fields["Delivery URL"]) || HOME_ORGANIZATION_DEFAULTS.deliveryUrl,
    assetByteSize: Number(fields["Asset Byte Size"] || HOME_ORGANIZATION_DEFAULTS.assetByteSize),
    assetSha256: text(fields["Asset SHA-256"]) || HOME_ORGANIZATION_DEFAULTS.assetSha256,
    maxSendCount: Number(fields["Max Send Count"] || 1),
  };
}

function validateContract(input, contract) {
  const errors = [];
  if (contract.id !== input.contractId) errors.push("contract_id_mismatch");
  if (contract.contractKey !== input.contractKey) errors.push("contract_key_mismatch");
  if (contract.status !== "Proof Only") errors.push("contract_not_proof_only");
  if (contract.mode !== "Manual Proof") errors.push("contract_not_manual_proof");
  if (contract.automationStatus !== "Paused") errors.push("contract_not_paused");
  if (contract.maxSendCount !== 1) errors.push("contract_max_send_count_not_one");
  if (contract.deliveryUrl !== HOME_ORGANIZATION_DEFAULTS.deliveryUrl) errors.push("delivery_url_mismatch");
  if (contract.assetByteSize !== HOME_ORGANIZATION_DEFAULTS.assetByteSize) errors.push("asset_byte_size_mismatch");
  if (contract.assetSha256 !== HOME_ORGANIZATION_DEFAULTS.assetSha256) errors.push("asset_sha_mismatch");
  return errors;
}

function validateContact(contact, contract) {
  const attributes = contact?.attributes || {};
  const listIds = Array.isArray(contact?.listIds) ? contact.listIds.map(String) : [];
  const errors = [];
  if (!text(contact?.email)) errors.push("contact_email_missing");
  if (!listIds.includes(contract.brevoListId)) errors.push("contact_not_in_required_list");
  if (text(attributes["PRIMARY_NICHE"]) !== contract.parentNiche) errors.push("primary_niche_mismatch");
  if (text(attributes["SUB_NICHE"]) !== contract.subNiche) errors.push("sub_niche_mismatch");
  if (text(attributes["LEAD_MAGNET"]) !== contract.leadMagnet) errors.push("lead_magnet_mismatch");
  if (text(attributes["SOURCE_FORM_ID"]) !== contract.sourceFormId) errors.push("source_form_id_mismatch");
  if (text(attributes["SOURCE_ASSET_ID"]) !== contract.sourceAssetId) errors.push("source_asset_id_mismatch");
  if (!["1", "true", "yes"].includes(text(attributes["DOUBLE_OPT-IN"]).toLowerCase())) errors.push("double_opt_in_not_confirmed");
  if (!text(attributes["CONSENT_SOURCE"])) errors.push("consent_source_missing");
  if (!text(attributes["CONSENT_TIMESTAMP"])) errors.push("consent_timestamp_missing");
  return errors;
}

function validateTemplate(template, contract) {
  const sender = template?.sender || {};
  const html = text(template?.htmlContent);
  const errors = [];
  if (numberText(template?.id) !== contract.brevoTemplateId) errors.push("template_id_mismatch");
  if (template?.isActive !== true) errors.push("template_not_active");
  if (numberText(sender.id) !== contract.brevoSenderId) errors.push("sender_id_mismatch");
  if (text(sender.email) !== HOME_ORGANIZATION_DEFAULTS.senderEmail) errors.push("sender_email_mismatch");
  if (text(sender.name) !== HOME_ORGANIZATION_DEFAULTS.senderName) errors.push("sender_name_mismatch");
  if (!html.includes(contract.deliveryUrl)) errors.push("template_delivery_url_missing");
  if (html.includes("pages.dev")) errors.push("template_branch_preview_url_present");
  if (!html.toLowerCase().includes("unsubscribe")) errors.push("template_unsubscribe_missing");
  return errors;
}

function failIf(errors, code, status = 409) {
  if (errors.length) throw new RunnerError(code, status, errors.join(","));
}

function evidenceFields({ input, contract, contactId, contactDigest, idempotencyKey, messageId }) {
  return {
    "Evidence Key": idempotencyKey,
    "Contract Key": contract.contractKey,
    "Proof ID": input.proofId,
    "Brevo Contact ID": contactId,
    "Contact Hash": contactDigest,
    "Idempotency Key": idempotencyKey,
    "Status": "Accepted",
    "Brevo Message ID": messageId,
    "Event Status": "accepted",
    "Sent At": new Date().toISOString(),
    "Brevo Template ID": contract.brevoTemplateId,
    "Brevo Sender ID": contract.brevoSenderId,
    "Delivery URL": contract.deliveryUrl,
    "Asset SHA-256": contract.assetSha256,
    "Scenario ID": SCENARIO_ID,
    "Scenario Run ID": input.proofId,
    "Notes": "WS34DW Worker proof accepted after contract/contact/template/idempotency validation. No public signup route, content generation, publishing, or account gate change.",
  };
}

export async function runProof(input, env, fetcher = fetch) {
  const inputErrors = validateProofInput(input);
  failIf(inputErrors, "invalid_proof_input", 400);

  const contractRecord = await airtableGetContract(env, input.contractId, fetcher);
  const contract = contractFromRecord(contractRecord);
  failIf(validateContract(input, contract), "contract_validation_failed");

  const idempotencyKey = `${contract.contractKey}:${input.brevoContactId}:${input.proofId}`;
  const existingEvidence = await airtableFindEvidence(env, idempotencyKey, fetcher);
  if (existingEvidence.length > 0) throw new RunnerError("duplicate_evidence_exists", 409);

  const contact = await brevoGetContact(env, input.brevoContactId, fetcher);
  failIf(validateContact(contact, contract), "contact_validation_failed");

  const template = await brevoGetTemplate(env, contract.brevoTemplateId, fetcher);
  failIf(validateTemplate(template, contract), "template_validation_failed");

  const asset = await verifyDeliveryAsset(contract, fetcher);
  const digest = await contactHash(input.brevoContactId);

  if (input.dryRun) {
    return {
      ok: true,
      dryRun: true,
      proofId: input.proofId,
      contractKey: contract.contractKey,
      brevoContactId: input.brevoContactId,
      contactHash: digest,
      delivery: asset,
      send: "not_attempted",
      evidence: "not_written",
    };
  }

  if (envValue(env, "ENABLE_PROOF_SEND", "0") !== "1") {
    throw new RunnerError("proof_send_disabled", 409);
  }

  const sendResponse = await brevoSendTemplate(
    env,
    contact.email,
    contract.brevoTemplateId,
    {
      proof_id: input.proofId,
      contract_key: contract.contractKey,
      lead_magnet: contract.leadMagnet,
    },
    fetcher,
  );
  const messageId = text(sendResponse?.messageId);
  if (!messageId) throw new RunnerError("brevo_message_id_missing", 502);

  const evidence = await airtableWriteEvidence(
    env,
    evidenceFields({
      input,
      contract,
      contactId: input.brevoContactId,
      contactDigest: digest,
      idempotencyKey,
      messageId,
    }),
    fetcher,
  );

  return {
    ok: true,
    dryRun: false,
    proofId: input.proofId,
    contractKey: contract.contractKey,
    brevoContactId: input.brevoContactId,
    contactHash: digest,
    delivery: asset,
    messageId,
    evidenceRecordId: evidence?.id || null,
  };
}

async function parseJson(request) {
  try {
    return await request.json();
  } catch {
    throw new RunnerError("invalid_json_body", 400);
  }
}

export async function handleRequest(request, env, fetcher = fetch) {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/health") {
    return jsonResponse({ ok: true, service: "lead-magnet-delivery-runner", mode: "proof" });
  }

  if (url.pathname !== "/proof") {
    return jsonResponse({ ok: false, error: "not_found" }, 404);
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  if (!(await authorize(request, env))) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  try {
    const input = await parseJson(request);
    const result = await runProof(input, env, fetcher);
    return jsonResponse(result);
  } catch (error) {
    if (error instanceof RunnerError) {
      return jsonResponse({ ok: false, error: error.code, detail: error.detail || undefined }, error.status);
    }
    return jsonResponse({ ok: false, error: "runner_failed" }, 500);
  }
}

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  },
};
