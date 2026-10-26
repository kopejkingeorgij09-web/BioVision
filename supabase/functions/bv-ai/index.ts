// Помощник БиоВиза: вопрос с сайта → проверка кода участника → Claude → ответ потоком (SSE).
// Секреты (задаются в Supabase → Edge Functions → Secrets, в репозиторий не кладутся):
//   ANTHROPIC_API_KEY — ключ Anthropic API.
// SUPABASE_URL и SUPABASE_ANON_KEY Supabase подставляет сам.
// Разворачивается с verify_jwt = false: вход проверяется по коду группы через bv_login.
import Anthropic from "npm:@anthropic-ai/sdk";

const MODEL = "claude-opus-5-5";
const ORIGINS = [
  "https://kopejkingeorgij09-web.github.io",
  "http://localhost:8000",
  "http://localhost:8765",
];
const MAX_MESSAGES = 16;
const MAX_CHARS = 4000; // на одно сообщение
const MAX_CONTEXT = 14000; // текст открытого раздела

const SYSTEM = `Ты помощник научной группы по микробиологии на платформе БиоВиз. Отвечаешь по-русски.
Участники — сильные школьники и студенты, которые готовятся к олимпиадам и вузовскому уровню.
Опирайся прежде всего на конспект лекции, который передан ниже как контекст. Если в конспекте ответа нет, отвечай по общепринятым учебникам (Нетрусов, Котова «Микробиология»; Мадиган «Brock Biology of Microorganisms»; Альбертс) и прямо скажи, что это выходит за рамки конспекта.
Не выдумывай чисел, авторов и ссылок. Если не уверен, так и скажи.
Пиши живым языком, коротко и по делу: сначала суть, потом детали. Формулы записывай текстом. Можно использовать короткие списки, **выделение** и \`код\`.
Если просят решить задачу из самопроверки, сначала дай наводящий вопрос или подсказку, а полный разбор давай, когда попросят.`;

function cors(origin: string | null) {
  const allow = origin && ORIGINS.includes(origin) ? origin : ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Vary": "Origin",
  };
}

function json(status: number, body: unknown, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8" },
  });
}

async function login(code: string) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !key || !code) return null;
  const r = await fetch(`${url}/rest/v1/rpc/bv_login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify({ p_code: code }),
  });
  if (!r.ok) return null;
  return await r.json(); // {role, id, name} или null
}

type Msg = { role: "user" | "assistant"; content: string };

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(origin) });
  if (req.method !== "POST") return json(405, { error: "Только POST." }, origin);

  let body: { code?: string; messages?: Msg[]; context?: Record<string, string> | null };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Неверный запрос." }, origin);
  }

  const who = await login(String(body.code || "").trim().toUpperCase());
  if (!who) return json(403, { error: "Код не подошёл. Войди заново в профиле." }, origin);

  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return json(400, { error: "Пустой вопрос." }, origin);
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json(503, { error: "Помощник ещё не подключён: в Supabase не задан ключ Anthropic." }, origin);

  const ctx = body.context || {};
  const material = [
    ctx.lecture ? `Открыта: ${ctx.lecture}${ctx.section ? `, ${ctx.section}` : ""}.` : "Открыта главная страница курса.",
    ctx.toc ? `Оглавление лекции:\n${String(ctx.toc).slice(0, 2000)}` : "",
    ctx.text ? `Текст открытого раздела:\n${String(ctx.text).slice(0, MAX_CONTEXT)}` : "",
  ].filter(Boolean).join("\n\n");

  const client = new Anthropic({ apiKey });
  const enc = new TextEncoder();
  const send = (c: ReadableStreamDefaultController, data: unknown) =>
    c.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Параметры собраны отдельно: fallbacks — бета-поле, его может не быть в типах установленной версии SDK.
        const params = {
          model: MODEL,
          max_tokens: 16000,
          output_config: { effort: "medium" },
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          system: [
            { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
            { type: "text", text: `Участник: ${who.name || "без имени"}.\n\n${material}` },
          ],
          messages,
        };
        // deno-lint-ignore no-explicit-any
        const s = client.beta.messages.stream(params as any);
        for await (const ev of s) {
          if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") send(controller, { t: ev.delta.text });
        }
        const final = await s.finalMessage();
        if (final.stop_reason === "refusal") {
          send(controller, { error: "На этот вопрос помощник ответить не может. Попробуй сформулировать иначе." });
        } else if (final.stop_reason === "max_tokens") {
          send(controller, { t: "\n\n(Ответ получился слишком длинным и оборван. Попроси продолжить.)" });
        }
        send(controller, { done: true });
      } catch (e) {
        console.error("bv-ai", e);
        let msg = "Помощник сейчас недоступен. Попробуй через минуту.";
        if (e instanceof Anthropic.RateLimitError) msg = "Слишком много вопросов подряд. Подожди минуту.";
        else if (e instanceof Anthropic.AuthenticationError) msg = "Ключ Anthropic в Supabase не подходит.";
        send(controller, { error: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { ...cors(origin), "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" },
  });
});
