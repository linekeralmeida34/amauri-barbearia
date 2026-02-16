export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const webhookUrl = process.env.N8N_MKT_WEBHOOK_URL;
  if (!webhookUrl) {
    return res.status(500).json({
      error: "N8N_MKT_WEBHOOK_URL is not configured on Vercel.",
    });
  }

  try {
    const upstream = await fetch(webhookUrl, { method: "GET" });
    const contentType = upstream.headers.get("content-type") || "";
    const status = upstream.status;

    if (contentType.includes("application/json")) {
      const json = await upstream.json();
      return res.status(status).json(json);
    }

    const text = await upstream.text();
    return res.status(status).send(text);
  } catch (error) {
    return res.status(502).json({
      error: "Failed to reach N8N webhook.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
