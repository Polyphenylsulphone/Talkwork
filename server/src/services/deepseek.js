const API = 'https://api.deepseek.com/chat/completions';

async function* streamDemoText(text) {
  for (const ch of text) {
    yield ch;
    await new Promise((r) => setTimeout(r, 10));
  }
}

export async function deepseekChat(messages, { stream = false, temperature = 0.7 } = {}) {
  const key = process.env.DEEPSEEK_API_KEY;
  const demoText =
    '（演示模式：未配置 DEEPSEEK_API_KEY）我是 T 宝，建议你完善 server/.env 后重启服务，即可启用真实流式回复。当前可先体验界面与数据流。';

  if (!key) {
    if (stream) return streamDemoText(demoText);
    return demoText;
  }

  const body = {
    model: 'deepseek-chat',
    messages,
    temperature,
    stream,
  };

  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`DeepSeek error: ${res.status} ${t}`);
  }

  if (!stream) {
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }

  return streamDeepseek(res);
}

async function* streamDeepseek(res) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      const s = line.trim();
      if (!s.startsWith('data:')) continue;
      const payload = s.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        /* ignore */
      }
    }
  }
}
