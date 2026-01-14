/**
 * HOTMART OAUTH PROXY FOR RAILWAY
 * ================================
 * 
 * Deploy this to Railway to bypass Cloudflare blocking on Supabase Edge Functions.
 * 
 * SETUP:
 * 1. Create a new Railway project
 * 2. Connect this repo or paste this code
 * 3. Add environment variables:
 *    - HOTMART_CLIENT_ID
 *    - HOTMART_CLIENT_SECRET
 *    - PROXY_API_KEY (optional, for security)
 * 4. Deploy and copy the URL
 * 5. Add HOTMART_PROXY_URL secret in Lovable Cloud
 * 
 * ENDPOINTS:
 * POST /hotmart - Proxy any Hotmart API call
 * GET /health - Health check
 */

import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const HOTMART_CLIENT_ID = process.env.HOTMART_CLIENT_ID;
const HOTMART_CLIENT_SECRET = process.env.HOTMART_CLIENT_SECRET;
const PROXY_API_KEY = process.env.PROXY_API_KEY; // Optional security

let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Get Hotmart OAuth token (with caching)
 */
async function getHotmartToken() {
  // Return cached token if still valid
  if (cachedToken && Date.now() < tokenExpiresAt) {
    console.log("[PROXY] Using cached token");
    return cachedToken;
  }

  console.log("[PROXY] Requesting new OAuth token...");

  const response = await fetch("https://developers.hotmart.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: HOTMART_CLIENT_ID,
      client_secret: HOTMART_CLIENT_SECRET,
    }),
  });

  const text = await response.text();
  
  if (!response.ok) {
    console.error("[PROXY] OAuth failed:", response.status, text);
    throw new Error(`OAuth failed (${response.status}): ${text}`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`OAuth returned invalid JSON: ${text.slice(0, 500)}`);
  }

  if (!data.access_token) {
    throw new Error("OAuth response missing access_token");
  }

  // Cache token (expire 1 minute early for safety)
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in * 1000) - 60000;

  console.log("[PROXY] Token acquired, expires in", data.expires_in, "seconds");

  return cachedToken;
}

/**
 * Health check endpoint
 */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    hasClientId: !!HOTMART_CLIENT_ID,
    hasClientSecret: !!HOTMART_CLIENT_SECRET,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Main proxy endpoint
 * 
 * POST /hotmart
 * Body: { path: "/payments/api/v1/sales/history", params: { ... }, method?: "GET" }
 */
app.post("/hotmart", async (req, res) => {
  try {
    // Optional API key check
    if (PROXY_API_KEY) {
      const authHeader = req.headers["x-api-key"];
      if (authHeader !== PROXY_API_KEY) {
        return res.status(401).json({ error: "Invalid API key" });
      }
    }

    const token = await getHotmartToken();

    const { path, params = {}, method = "GET", body: requestBody } = req.body;

    if (!path) {
      return res.status(400).json({ error: "path is required" });
    }

    // Build URL
    const queryString = new URLSearchParams(params).toString();
    const url = `https://api.hotmart.com${path}${queryString ? '?' + queryString : ''}`;

    console.log(`[PROXY] ${method} ${url}`);

    // Make request to Hotmart
    const fetchOptions = {
      method,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
      },
    };

    // Add body for POST/PUT requests
    if (requestBody && (method === "POST" || method === "PUT" || method === "PATCH")) {
      fetchOptions.headers["Content-Type"] = "application/json";
      fetchOptions.body = JSON.stringify(requestBody);
    }

    const apiResponse = await fetch(url, fetchOptions);
    const responseText = await apiResponse.text();

    // Try to parse as JSON
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      // If not JSON, return as-is with error
      console.error("[PROXY] Non-JSON response:", responseText.slice(0, 500));
      return res.status(apiResponse.status).json({
        error: "Hotmart returned non-JSON response",
        status: apiResponse.status,
        body: responseText.slice(0, 1000),
      });
    }

    // Log summary
    const itemCount = responseData?.items?.length ?? "N/A";
    console.log(`[PROXY] Response: ${apiResponse.status}, items: ${itemCount}`);

    // Return with original status
    res.status(apiResponse.status).json(responseData);

  } catch (err) {
    console.error("[PROXY] Error:", err.message);
    res.status(500).json({
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[PROXY] Hotmart OAuth Proxy running on port ${PORT}`);
  console.log(`[PROXY] Has credentials: client_id=${!!HOTMART_CLIENT_ID}, client_secret=${!!HOTMART_CLIENT_SECRET}`);
});
