const UPSTREAM = 'https://opencode.ai';
const AUTH_KEY = 'sk-mimo';

const MODEL_MAP = {
  'deepseek-v4-flash': 'deepseek-v4-flash-free',
  'mimo-v2.5-pro': 'mimo-v2.5-free',
};

const MODELS_LIST = {
  object: 'list',
  data: Object.keys(MODEL_MAP).map(id => ({
    id, object: 'model', created: Math.floor(Date.now() / 1000), owned_by: 'mimo',
  })),
};

const FAKE_PAGE = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Forever中转 — 使用 TOKEN forever</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a0a;color:#e0e0e0;min-height:100vh;display:flex;align-items:center;justify-content:center}
.card{background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid #333;border-radius:16px;padding:48px;max-width:520px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.5)}
h1{font-size:28px;background:linear-gradient(90deg,#667eea,#764ba2);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:16px}
p{color:#999;line-height:1.8;font-size:14px}
.badge{display:inline-block;background:#667eea22;color:#667eea;border:1px solid #667eea44;padding:4px 12px;border-radius:20px;font-size:12px;margin-top:20px}</style></head>
<body><div class="card"><h1>Forever 中转站</h1><p>高速稳定的 AI API 中转服务<br>支持 OpenAI / Claude / DeepSeek 全系列模型</p><span class="badge">🔒 仅限授权用户</span></div></body></html>`;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
};

export default async (request, context) => {
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (!url.pathname.startsWith('/v1')) {
    return new Response(FAKE_PAGE, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const auth = request.headers.get('Authorization') || '';
  const apiKey = request.headers.get('x-api-key') || '';
  if (auth !== `Bearer ${AUTH_KEY}` && apiKey !== AUTH_KEY) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  if (url.pathname === '/v1/models') {
    return new Response(JSON.stringify(MODELS_LIST), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  let body = request.body;
  let contentLength = request.headers.get('Content-Length');

  if (request.method === 'POST' && body) {
    try {
      const text = await request.text();
      const data = JSON.parse(text);
      if (data.model && MODEL_MAP[data.model]) {
        data.model = MODEL_MAP[data.model];
      }
      const newBody = JSON.stringify(data);
      body = newBody;
      contentLength = new TextEncoder().encode(newBody).length.toString();
    } catch {
      body = request.body;
    }
  }

  const upstreamUrl = `${UPSTREAM}/zen${url.pathname}${url.search}`;
  const upstreamHeaders = new Headers();
  for (const [k, v] of request.headers.entries()) {
    if (!['host', 'x-forwarded-for', 'x-real-ip', 'x-nf-client-connection-ip', 'x-nf-request-id'].includes(k.toLowerCase())) {
      upstreamHeaders.set(k, v);
    }
  }
  upstreamHeaders.set('Host', 'opencode.ai');
  upstreamHeaders.set('Authorization', 'Bearer public');
  upstreamHeaders.set('x-opencode-client', 'desktop');
  if (contentLength) upstreamHeaders.set('Content-Length', contentLength);

  const resp = await fetch(upstreamUrl, {
    method: request.method,
    headers: upstreamHeaders,
    body: request.method === 'POST' ? body : undefined,
  });

  const respHeaders = new Headers(resp.headers);
  Object.entries(CORS).forEach(([k, v]) => respHeaders.set(k, v));

  return new Response(resp.body, {
    status: resp.status,
    headers: respHeaders,
  });
};

export const config = { path: "/*" };
