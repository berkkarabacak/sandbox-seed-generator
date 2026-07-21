/**
 * Seedling · Jira Cloud local proxy
 * ---------------------------------
 * Browsers can't call https://<site>.atlassian.net directly (CORS), and API
 * tokens shouldn't live in app code. This zero-dependency relay:
 *
 *   1. receives  <vite-dev-server>/jira/*  (proxied here by vite)
 *   2. validates the target site is a real *.atlassian.net host (anti-SSRF)
 *   3. injects Basic auth built from the email + token headers
 *   4. forwards the request and streams the JSON response back
 *
 * Run:  npm run proxy        (listens on http://localhost:8787)
 */

import http from "node:http";

const PORT = Number(process.env.JIRA_PROXY_PORT || 8787);
const SITE_RE = /^[a-z0-9][a-z0-9-]{1,62}\.atlassian\.net$/i;

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type,x-jira-site,x-jira-email,x-jira-token",
};

function send(res, status, obj, extra = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "content-type": "application/json", ...cors, ...extra });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    return res.end();
  }

  const url = new URL(req.url || "/", `http://localhost:${PORT}`);

  // health check used by the UI to detect "proxy offline"
  if (url.pathname === "/health" || url.pathname === "/jira/health") {
    return send(res, 200, { ok: true, service: "seedling-jira-proxy", ts: Date.now() });
  }

  if (!url.pathname.startsWith("/jira/")) {
    return send(res, 404, { error: "not_found", hint: "use /jira/<rest-api-path> or /health" });
  }

  const site = String(req.headers["x-jira-site"] || "").trim().toLowerCase();
  const email = String(req.headers["x-jira-email"] || "").trim();
  const token = String(req.headers["x-jira-token"] || "").trim();

  if (!SITE_RE.test(site)) {
    return send(res, 400, { error: "bad_site", hint: "x-jira-site must be <name>.atlassian.net" });
  }
  if (!email || !token) {
    return send(res, 400, { error: "missing_credentials", hint: "x-jira-email / x-jira-token required" });
  }

  const apiPath = url.pathname.slice("/jira".length) + url.search;
  const target = `https://${site}${apiPath}`;

  let body;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await new Promise((resolve) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => resolve(Buffer.concat(chunks)));
    });
  }

  const started = Date.now();
  try {
    const auth = "Basic " + Buffer.from(`${email}:${token}`).toString("base64");
    const upstream = await fetch(target, {
      method: req.method,
      headers: {
        authorization: auth,
        accept: "application/json",
        "content-type": "application/json",
        "x-atlassian-force-account-id": "true",
      },
      body,
      redirect: "error",
    });

    const text = await upstream.text();
    const latency = Date.now() - started;
    res.writeHead(upstream.status, {
      "content-type": upstream.headers.get("content-type") || "application/json",
      "x-upstream-latency": String(latency),
      ...cors,
    });
    res.end(text || "{}");
  } catch (err) {
    send(res, 502, { error: "upstream_unreachable", target: site, detail: String(err?.message || err) });
  }
});

server.listen(PORT, () => {
  console.log(`[seedling-proxy] listening on http://localhost:${PORT}`);
  console.log(`[seedling-proxy] vite forwards /jira/* here; credentials are relayed per-request, never stored.`);
});
