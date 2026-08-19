/**
 * mlClient.js — Node.js HTTP client for the Python ML microservice.
 * Falls back to null if the ML service is unreachable so the
 * rule-based enrichmentPipeline.js can take over transparently.
 */

const http = require("http");

const ML_HOST = process.env.ML_SERVICE_HOST || "localhost";
const ML_PORT = parseInt(process.env.ML_SERVICE_PORT || "8000", 10);
const TIMEOUT_MS = 3000; // 3 s timeout per request

let _mlAvailable = null; // null = unknown, true/false after first probe

/**
 * Make a JSON POST request to the ML service.
 */
function postJSON(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const options = {
      hostname: ML_HOST,
      port: ML_PORT,
      path,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
      timeout: TIMEOUT_MS,
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error("Invalid JSON from ML service"));
        }
      });
    });

    req.on("timeout", () => { req.destroy(); reject(new Error("ML service timeout")); });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Probe the ML service health endpoint.
 * Updates _mlAvailable and returns true/false.
 */
async function probeHealth() {
  return new Promise((resolve) => {
    const req = http.get(
      { hostname: ML_HOST, port: ML_PORT, path: "/health", timeout: TIMEOUT_MS },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            const body = JSON.parse(data);
            _mlAvailable = body.ok && body.modelsReady;
          } catch {
            _mlAvailable = false;
          }
          resolve(_mlAvailable);
        });
      }
    );
    req.on("timeout", () => { req.destroy(); _mlAvailable = false; resolve(false); });
    req.on("error",   () => { _mlAvailable = false; resolve(false); });
  });
}

/**
 * Predict enrichment for a single product row.
 * Returns null if ML service is unavailable (triggers rule fallback).
 */
async function predictOne(row) {
  try {
    const result = await postJSON("/predict", row);
    _mlAvailable = true;
    return result;
  } catch {
    _mlAvailable = false;
    return null;
  }
}

/**
 * Predict enrichment for a batch of rows.
 * Returns null if ML service is unavailable.
 */
async function predictBatch(rows) {
  try {
    const result = await postJSON("/predict/batch", { rows });
    _mlAvailable = true;
    return result.results || null;
  } catch {
    _mlAvailable = false;
    return null;
  }
}

/**
 * Trigger retraining on the ML service.
 */
async function triggerRetrain() {
  return postJSON("/retrain", {});
}

/**
 * Is the ML service currently reachable?
 */
function isAvailable() {
  return _mlAvailable === true;
}

module.exports = { predictOne, predictBatch, probeHealth, triggerRetrain, isAvailable };
