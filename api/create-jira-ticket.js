const allowedOrigins = [
  "https://megabrain.studio",
  "https://www.megabrain.studio",
  "https://megabrain.figma.site"
];

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function getBody(req) {
  if (!req.body) return {};

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  return req.body;
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  try {
    const body = getBody(req);
    const { service, name, phone, email, language, pageUrl } = body;

    if (!name || !phone || !email) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    const auth = Buffer.from(
      `${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`
    ).toString("base64");

    const descriptionText =
      `New website request\n\n` +
      `Service: ${service || "Not selected"}\n` +
      `Name: ${name}\n` +
      `Phone: ${phone}\n` +
      `Email: ${email}\n` +
      `Language: ${language || "Unknown"}\n` +
      `Page URL: ${pageUrl || "Unknown"}`;

    const jiraPayload = {
      fields: {
        project: {
          key: process.env.JIRA_PROJECT_KEY,
        },
        summary: `Website request from ${name}`,
        issuetype: {
          name: process.env.JIRA_ISSUE_TYPE || "Task",
        },
        description: {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: descriptionText,
                },
              ],
            },
          ],
        },
        labels: ["website", "lead", "megabrain"],
      },
    };

    const jiraResponse = await fetch(
      `https://${process.env.JIRA_DOMAIN}/rest/api/3/issue`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(jiraPayload),
      }
    );

    const jiraData = await jiraResponse.json();

    if (!jiraResponse.ok) {
      return res.status(jiraResponse.status).json({
        success: false,
        message: "Jira issue was not created",
        jiraError: jiraData,
      });
    }

    return res.status(200).json({
      success: true,
      issueKey: jiraData.key,
      issueUrl: `https://${process.env.JIRA_DOMAIN}/browse/${jiraData.key}`,
    });
  } catch (error) {
    console.error("Server error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}
