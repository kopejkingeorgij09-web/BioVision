const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });
const url = Deno.env.get("SUPABASE_URL")!;
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceHeaders = { apikey: service, Authorization: "Bearer " + service };
const json = { "Content-Type": "application/json" };

function signIn(email: string, password: string) {
  return fetch(url + "/auth/v1/token?grant_type=password", {
    method: "POST", headers: { ...json, apikey: anon }, body: JSON.stringify({ email, password }),
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return reply({ message: "Метод недоступен" }, 405);
  try {
    const length = Number(request.headers.get("content-length"));
    if (length > 256) return reply({ message: "Неверный формат кода" }, 400);
    const raw = await request.text();
    const input = raw.length <= 256 ? JSON.parse(raw) : null;
    const code = typeof input?.code === "string" ? input.code.toLowerCase().replace(/[\s-]/g, "") : "";
    if (!/^[a-f0-9]{32}$/.test(code)) return reply({ message: "Неверный формат кода" }, 400);
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
    const digest = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const check = await fetch(url + "/rest/v1/notes_access_codes?select=digest&digest=eq." + digest, { headers: serviceHeaders });
    if (!check.ok) return reply({ message: "Сервис входа временно недоступен" }, 503);
    if (!(await check.json()).length) return reply({ message: "Код не найден" }, 401);

    const email = "notes-" + digest.slice(0, 48) + "@polya.invalid";
    const password = "Notes-v1-" + code;
    let session = await signIn(email, password);
    if (session.status === 400) {
      const created = await fetch(url + "/auth/v1/admin/users", {
        method: "POST", headers: { ...serviceHeaders, ...json },
        body: JSON.stringify({ email, password, email_confirm: true, app_metadata: { notes_access_code: true } }),
      });
      if (!created.ok && created.status !== 422) return reply({ message: "Не удалось активировать код" }, 503);
      session = await signIn(email, password);
    }
    if (session.status === 429) return reply({ message: "Слишком много попыток. Попробуй позже." }, 429);
    if (!session.ok) return reply({ message: "Не удалось войти по коду" }, 503);
    return reply(await session.json());
  } catch {
    return reply({ message: "Сервис входа временно недоступен" }, 503);
  }
});
