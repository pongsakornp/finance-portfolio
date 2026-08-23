import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { resolveApiUser } from "@/lib/auth/api-key";
import { buildMcpServer } from "@/lib/mcp/tools";

export const dynamic = "force-dynamic";
// ponytail: stateless per-request server+transport — no session affinity needed; add sessions only if an MCP client demands it
export async function POST(req: Request) {
  const userId = await resolveApiUser(req);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = buildMcpServer(userId);
  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    await server.close();
  }
}

const notAllowed = () => new Response("Method Not Allowed", { status: 405 });

export async function GET() {
  return notAllowed();
}

export async function DELETE() {
  return notAllowed();
}
