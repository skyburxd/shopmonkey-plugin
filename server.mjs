#!/usr/bin/env node
/**
 * ShopMonkey REST v3 MCP server (stdio). No package dependencies. Node 18+.
 * JSON-RPC 2.0 on stdin/stdout (newline-delimited JSON; also Content-Length).
 * Log only to stderr. Pass through official API JSON; do not invent fields.
 */

import { Buffer } from "node:buffer";

const BASE = "https://api.shopmonkey.cloud/v3";
const MAX_CHARS = 200000;
const PROTOCOL = "2024-11-05";
const SERVER_INFO = { name: "grokbot-shopmonkey-plugin", version: "0.1.0" };

function log(...args) {
  console.error(...args);
}

function getToken() {
  const t = process.env.SM_TOKEN;
  return typeof t === "string" && t.trim() ? t.trim() : "";
}

function queryString(query) {
  if (!query) return "";
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "object") usp.set(k, JSON.stringify(v));
    else usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? "?" + s : "";
}

function textResult(text, isError) {
  return {
    content: [{ type: "text", text: String(text) }],
    isError: Boolean(isError),
  };
}

function missingTokenResult() {
  return textResult(
    JSON.stringify({
      success: false,
      message:
        "SM_TOKEN is required. Set it in Plugins → Configure (Bearer API key from ShopMonkey Settings → Integration → API Keys).",
    }),
    true
  );
}

function truncate(text) {
  if (typeof text !== "string") text = String(text);
  if (text.length <= MAX_CHARS) return text;
  return (
    text.slice(0, MAX_CHARS) +
    "\n… truncated: response was " +
    text.length +
    " chars (limit " +
    MAX_CHARS +
    ")."
  );
}

function pick(obj, keys) {
  const out = {};
  if (!obj || typeof obj !== "object") return out;
  for (const k of keys) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

function need(args, key) {
  const v = args && args[key];
  if (v === undefined || v === null || v === "") {
    return textResult(
      JSON.stringify({
        success: false,
        message: "Missing required argument: " + key,
      }),
      true
    );
  }
  return null;
}

async function smFetch(method, path, { query, body } = {}) {
  const token = getToken();
  if (!token) return missingTokenResult();

  const url = BASE + path + queryString(query);
  const headers = { Authorization: "Bearer " + token };
  const init = { method, headers };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(url, init);
    const text = await res.text();
    const ok = res.status >= 200 && res.status < 300;
    return textResult(truncate(text || ""), !ok);
  } catch (err) {
    return textResult(
      JSON.stringify({
        success: false,
        message: String(err && err.message ? err.message : err),
      }),
      true
    );
  }
}


const tools = [
  {
    name: "shopmonkey_auth_status",
    description:
      "GET /v3/auth/api_key/status — check the ShopMonkey API key (SM_TOKEN) status.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "shopmonkey_list_orders",
    description:
      "GET /v3/order — list orders. Core Order fields: id, number, publicId, companyId, locationId, customerId, vehicleId, status (Estimate|RepairOrder|Invoice), name, coalescedName, authorized, invoiced, paid, workflowStatusId, totalCostCents, createdDate. Optional query: limit, skip, where, orderby, include. List meta may include hasMore, total, sums. Returns official API JSON.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Limit on the number of records to return.",
        },
        skip: {
          type: "number",
          description: "Number of records to skip for pagination.",
        },
        where: {
          type: "object",
          description: "Filter object (GET query where; sent as JSON).",
          additionalProperties: true,
        },
        orderby: {
          type: "string",
          description: "Order instructions (GET query name is orderby).",
        },
        include: {
          type: "object",
          description:
            "Optional expansions documented on list orders: appointments, authorizations, customer, inspections, paymentTerm, services, vehicle.",
          additionalProperties: true,
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "shopmonkey_get_order",
    description: "GET /v3/order/:id — find one order by id. Returns official API JSON.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Order id." },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "shopmonkey_create_order",
    description:
      "POST /v3/order — create an order. No body field is required. Optional documented fields: customerId, vehicleId, locationId, name, complaint. Additional documented create fields may be passed in fields. Returns official API JSON.",
    inputSchema: {
      type: "object",
      properties: {
        customerId: { type: "string" },
        vehicleId: { type: "string" },
        locationId: { type: "string" },
        name: { type: "string" },
        complaint: { type: "string" },
        fields: {
          type: "object",
          description:
            "Other documented create-order body fields (do not invent names). Merged with named optional args; named args win on conflict.",
          additionalProperties: true,
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "shopmonkey_search_customers",
    description:
      "POST /v3/customer/search — search customers. Empty body is ok. Optional body: where, limit, skip, orderBy (camelCase). Core Customer fields: id, publicId, companyId, customerType, firstName, lastName, companyName, emails, phoneNumbers, locationIds, createdDate. emails/phoneNumbers are resource extras, not table columns. Returns official API JSON.",
    inputSchema: {
      type: "object",
      properties: {
        where: {
          type: "object",
          description: "Filter object for the search body.",
          additionalProperties: true,
        },
        limit: { type: "number" },
        skip: { type: "number" },
        orderBy: {
          type: "string",
          description: "Order instructions (POST search uses camelCase orderBy).",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "shopmonkey_get_customer",
    description:
      "GET /v3/customer/:id — find one customer by id. Returns official API JSON (emails/phoneNumbers extras when present).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Customer id." },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "shopmonkey_create_customer",
    description:
      "POST /v3/customer — create a customer. Required: customerType (Customer|Fleet). Optional: firstName, lastName, companyName, emails, phoneNumbers. Returns official API JSON.",
    inputSchema: {
      type: "object",
      properties: {
        customerType: {
          type: "string",
          enum: ["Customer", "Fleet"],
          description: "Required. Customer or Fleet.",
        },
        firstName: { type: "string" },
        lastName: { type: "string" },
        companyName: { type: "string" },
        emails: {
          type: "array",
          description: "Email extras on create (not table columns).",
        },
        phoneNumbers: {
          type: "array",
          description: "Phone number extras on create (not table columns).",
        },
      },
      required: ["customerType"],
      additionalProperties: false,
    },
  },
  {
    name: "shopmonkey_list_customer_vehicles",
    description:
      "GET /v3/customer/:id/vehicle — list vehicles for a customer. This is the documented vehicle list path (no shop-wide vehicle list). Core Vehicle fields: id, companyId, year, make, model, vin, licensePlate, mileage, mileageUnit, size, type, locationIds. Returns official API JSON.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Customer id (path /v3/customer/:id/vehicle).",
        },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "shopmonkey_get_vehicle",
    description: "GET /v3/vehicle/:id — find one vehicle by id. Returns official API JSON.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Vehicle id." },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "shopmonkey_create_vehicle",
    description:
      "POST /v3/vehicle — create a vehicle. Required: size (HeavyDuty|LightDuty|Other). Optional: customerId, locationId, vin, year, make, model, mileage. Returns official API JSON.",
    inputSchema: {
      type: "object",
      properties: {
        size: {
          type: "string",
          enum: ["HeavyDuty", "LightDuty", "Other"],
          description: "Required. HeavyDuty, LightDuty, or Other.",
        },
        customerId: { type: "string" },
        locationId: { type: "string" },
        vin: { type: "string" },
        year: { type: "integer" },
        make: { type: "string" },
        model: { type: "string" },
        mileage: { type: "number" },
      },
      required: ["size"],
      additionalProperties: false,
    },
  },
];

async function callTool(name, args) {
  const a = args && typeof args === "object" ? args : {};
  if (!tools.some((t) => t.name === name)) {
    return textResult(
      JSON.stringify({ success: false, message: "Unknown tool: " + name }),
      true
    );
  }
  if (!getToken()) return missingTokenResult();
  switch (name) {
    case "shopmonkey_auth_status":
      return smFetch("GET", "/auth/api_key/status");
    case "shopmonkey_list_orders": {
      const query = pick(a, ["limit", "skip", "where", "orderby", "include"]);
      return smFetch("GET", "/order", { query });
    }
    case "shopmonkey_get_order": {
      const err = need(a, "id");
      if (err) return err;
      return smFetch("GET", "/order/" + encodeURIComponent(String(a.id)));
    }
    case "shopmonkey_create_order": {
      const extra =
        a.fields && typeof a.fields === "object" && !Array.isArray(a.fields)
          ? a.fields
          : {};
      const body = { ...extra };
      for (const k of ["customerId", "vehicleId", "locationId", "name", "complaint"]) {
        if (a[k] !== undefined) body[k] = a[k];
      }
      return smFetch("POST", "/order", { body });
    }
    case "shopmonkey_search_customers": {
      const body = pick(a, ["where", "limit", "skip", "orderBy"]);
      return smFetch("POST", "/customer/search", { body });
    }
    case "shopmonkey_get_customer": {
      const err = need(a, "id");
      if (err) return err;
      return smFetch("GET", "/customer/" + encodeURIComponent(String(a.id)));
    }
    case "shopmonkey_create_customer": {
      const err = need(a, "customerType");
      if (err) return err;
      const body = pick(a, [
        "customerType",
        "firstName",
        "lastName",
        "companyName",
        "emails",
        "phoneNumbers",
      ]);
      return smFetch("POST", "/customer", { body });
    }
    case "shopmonkey_list_customer_vehicles": {
      const err = need(a, "id");
      if (err) return err;
      return smFetch(
        "GET",
        "/customer/" + encodeURIComponent(String(a.id)) + "/vehicle"
      );
    }
    case "shopmonkey_get_vehicle": {
      const err = need(a, "id");
      if (err) return err;
      return smFetch("GET", "/vehicle/" + encodeURIComponent(String(a.id)));
    }
    case "shopmonkey_create_vehicle": {
      const err = need(a, "size");
      if (err) return err;
      const body = pick(a, [
        "size",
        "customerId",
        "locationId",
        "vin",
        "year",
        "make",
        "model",
        "mileage",
      ]);
      return smFetch("POST", "/vehicle", { body });
    }
    default:
      return textResult(
        JSON.stringify({ success: false, message: "Unknown tool: " + name }),
        true
      );
  }
}


function rpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

async function handleMessage(msg) {
  if (!msg || typeof msg !== "object" || Array.isArray(msg)) {
    return rpcError(null, -32600, "Invalid Request");
  }

  const { id, method, params } = msg;
  const hasId = Object.prototype.hasOwnProperty.call(msg, "id");

  if (!method || typeof method !== "string") {
    if (hasId) return rpcError(id, -32600, "Invalid Request");
    return null;
  }

  if (method === "notifications/initialized" || method === "initialized") {
    return null;
  }

  if (method === "initialize") {
    return rpcResult(id, {
      protocolVersion: PROTOCOL,
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
    });
  }

  if (method === "ping") {
    return rpcResult(id, {});
  }

  if (method === "tools/list") {
    return rpcResult(id, { tools });
  }

  if (method === "tools/call") {
    const name = params && params.name;
    const args = (params && params.arguments) || {};
    if (!name) {
      return rpcResult(
        id,
        textResult(
          JSON.stringify({
            success: false,
            message: "tools/call requires params.name",
          }),
          true
        )
      );
    }
    const result = await callTool(name, args);
    return rpcResult(id, result);
  }

  if (!hasId) return null;
  return rpcError(id, -32601, "Method not found: " + method);
}

let framing = null;
let buf = Buffer.alloc(0);
let chain = Promise.resolve();

function send(obj) {
  const json = JSON.stringify(obj);
  if (framing === "lsp") {
    const payload = Buffer.from(json, "utf8");
    process.stdout.write("Content-Length: " + payload.length + "\r\n\r\n");
    process.stdout.write(payload);
  } else {
    process.stdout.write(json + "\n");
  }
}

function enqueue(jsonText) {
  chain = chain
    .then(async () => {
      let msg;
      try {
        msg = JSON.parse(jsonText);
      } catch {
        send(rpcError(null, -32700, "Parse error"));
        return;
      }
      try {
        const reply = await handleMessage(msg);
        if (reply) send(reply);
      } catch (err) {
        log(err);
        if (msg && Object.prototype.hasOwnProperty.call(msg, "id")) {
          send(
            rpcError(
              msg.id,
              -32603,
              String(err && err.message ? err.message : err)
            )
          );
        }
      }
    })
    .catch((err) => log(err));
}

function pump() {
  while (true) {
    if (framing === null) {
      if (buf.length === 0) return;
      const s = buf.toString("utf8");
      if (/^\s*Content-Length:/i.test(s)) framing = "lsp";
      else if (s.includes("\n")) framing = "ndjson";
      else return;
    }

    if (framing === "ndjson") {
      const idx = buf.indexOf(0x0a);
      if (idx === -1) return;
      const line = buf.subarray(0, idx).toString("utf8").replace(/\r$/, "").trim();
      buf = buf.subarray(idx + 1);
      if (line) enqueue(line);
      continue;
    }

    const sep = buf.indexOf("\r\n\r\n");
    if (sep === -1) return;
    const header = buf.subarray(0, sep).toString("utf8");
    const m = header.match(/Content-Length:\s*(\d+)/i);
    if (!m) {
      buf = buf.subarray(sep + 4);
      continue;
    }
    const len = Number(m[1]);
    const start = sep + 4;
    if (buf.length < start + len) return;
    const jsonText = buf.subarray(start, start + len).toString("utf8");
    buf = buf.subarray(start + len);
    enqueue(jsonText);
  }
}

process.stdin.on("data", (chunk) => {
  buf = Buffer.concat([buf, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
  pump();
});

process.stdin.on("end", () => {
  if (framing !== "lsp" && buf.length) {
    const line = buf.toString("utf8").trim();
    buf = Buffer.alloc(0);
    if (line) enqueue(line);
  }
});

process.stdin.resume();
log("grokbot-shopmonkey-plugin MCP server 0.1.0");
