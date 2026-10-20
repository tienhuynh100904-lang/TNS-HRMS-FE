// Gets an access token from the backend (OAuth2 client credentials, POST /oauth2/token) on behalf of the login form.
// Done on the server because the backend's token endpoint sends no CORS headers, so a browser could not read its answer.
// The client secret is only forwarded: it is neither stored nor logged here.
const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

const fail = (status: number, message: string) => Response.json({ message }, { status });

export async function POST(request: Request) {
  const input = await request.json().catch(() => null);
  const clientId = typeof input?.clientId === "string" ? input.clientId.trim() : "";
  const clientSecret = typeof input?.clientSecret === "string" ? input.clientSecret : "";
  if (!clientId || !clientSecret) return fail(400, "Nhập Client ID và Client Secret");

  let res: Response;
  try {
    res = await fetch(`${API_URL}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
      cache: "no-store",
    });
  } catch {
    return fail(502, "Không kết nối được máy chủ");
  }

  if (res.status === 401) return fail(401, "Client ID hoặc Client Secret không đúng");
  const body = await res.json().catch(() => null);
  if (!res.ok || typeof body?.access_token !== "string") return fail(502, `Máy chủ từ chối cấp token (${res.status})`);

  return Response.json({ access_token: body.access_token, expires_in: Number(body.expires_in) || 3600 });
}
