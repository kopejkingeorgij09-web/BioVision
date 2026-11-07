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
const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

function signIn(email: string, password: string) {
  return fetch(url + "/auth/v1/token?grant_type=password", {
    method: "POST", headers: { ...json, apikey: anon }, body: JSON.stringify({ email, password }),
  });
}

// Читаем не больше 256 байт, даже если Content-Length не указан.
async function smallBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 256) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(all);
}

// Пароль аккаунта случайный и нигде не хранится: войти можно только через эту функцию,
// пока код действует. Раньше пароль выводился из кода, и отозванный код всё равно открывал вход.
async function rotateAndSignIn(userId: string, email: string) {
  const password = hex(crypto.getRandomValues(new Uint8Array(32)));
  const updated = await fetch(url + "/auth/v1/admin/users/" + userId, {
    method: "PUT", headers: { ...serviceHeaders, ...json }, body: JSON.stringify({ password }),
  });
  if (!updated.ok) return null;
  return signIn(email, password);
}

async function remember(digest: string, userId: string) {
  const saved = await fetch(url + "/rest/v1/notes_access_codes?digest=eq." + digest, {
    method: "PATCH", headers: { ...serviceHeaders, ...json, Prefer: "return=minimal" }, body: JSON.stringify({ user_id: userId }),
  });
  return saved.ok;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return reply({ message: "Метод недоступен" }, 405);
  try {
    const length = Number(request.headers.get("content-length"));
    if (length > 256) return reply({ message: "Неверный формат кода" }, 400);
    const raw = await smallBody(request);
    const input = raw ? JSON.parse(raw) : null;
    const code = typeof input?.code === "string" ? input.code.toLowerCase().replace(/[\s-]/g, "") : "";
    if (!/^[a-f0-9]{32}$/.test(code)) return reply({ message: "Неверный формат кода" }, 400);
    const digest = hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code))));
    const check = await fetch(url + "/rest/v1/notes_access_codes?select=digest,user_id,revoked_at&digest=eq." + digest, { headers: serviceHeaders });
    if (!check.ok) return reply({ message: "Сервис входа временно недоступен" }, 503);
    const [row] = await check.json();
    if (!row || row.revoked_at) return reply({ message: "Код не найден или отозван" }, 401);

    const email = "notes-" + digest.slice(0, 48) + "@polya.invalid";
    let userId: string | null = row.user_id;
    if (!userId) {
      // Аккаунты из версий до 0.4 входили с паролем, выведенным из кода. Переводим их на случайный.
      const legacy = await signIn(email, "Notes-v1-" + code);
      if (legacy.ok) userId = (await legacy.json()).user?.id ?? null;
      else if (legacy.status === 400) {
        const created = await fetch(url + "/auth/v1/admin/users", {
          method: "POST", headers: { ...serviceHeaders, ...json },
          body: JSON.stringify({
            email, password: hex(crypto.getRandomValues(new Uint8Array(32))), email_confirm: true,
            app_metadata: { notes_access_code: true },
          }),
        });
        if (created.ok) userId = (await created.json()).id ?? null;
        else if (created.status === 422) return reply({ message: "Аккаунт кода требует проверки администратором" }, 409);
        else return reply({ message: "Не удалось активировать код" }, 503);
      } else if (legacy.status === 429) return reply({ message: "Слишком много попыток. Попробуй позже." }, 429);
      if (!userId) return reply({ message: "Не удалось войти по коду" }, 503);
      if (!(await remember(digest, userId))) return reply({ message: "Сервис входа временно недоступен" }, 503);
    }

    const session = await rotateAndSignIn(userId, email);
    if (!session) return reply({ message: "Не удалось войти по коду" }, 503);
    if (session.status === 429) return reply({ message: "Слишком много попыток. Попробуй позже." }, 429);
    if (!session.ok) return reply({ message: "Не удалось войти по коду. Попробуй ещё раз." }, 503);
    return reply(await session.json());
  } catch {
    return reply({ message: "Сервис входа временно недоступен" }, 503);
  }
});
