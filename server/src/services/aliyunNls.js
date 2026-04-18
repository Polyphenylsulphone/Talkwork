import RPCClient from '@alicloud/pop-core';

let tokenCache = { id: null, expireAtSec: 0 };

export function isAliyunSpeechConfigured() {
  return !!(
    process.env.ALIYUN_ACCESS_KEY_ID &&
    process.env.ALIYUN_ACCESS_KEY_SECRET &&
    process.env.ALIYUN_NLS_APP_KEY
  );
}

function nlsMetaEndpoint() {
  return (
    process.env.ALIYUN_NLS_META_ENDPOINT || 'https://nls-meta.cn-shanghai.aliyuncs.com'
  ).replace(/\/$/, '');
}

function nlsGatewayBase() {
  return (
    process.env.ALIYUN_NLS_GATEWAY || 'https://nls-gateway-cn-shanghai.aliyuncs.com'
  ).replace(/\/$/, '');
}

async function getNlsToken() {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache.id && tokenCache.expireAtSec > now + 120) {
    return tokenCache.id;
  }

  const client = new RPCClient({
    accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
    accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
    endpoint: nlsMetaEndpoint(),
    apiVersion: '2019-02-28',
  });

  const res = await client.request('CreateToken', { RegionId: 'cn-shanghai' }, { method: 'POST' });
  const id = res?.Token?.Id;
  const expireRaw = res?.Token?.ExpireTime;
  const expireAtSec = expireRaw != null ? Number(expireRaw) : now + 3500;
  if (!id) {
    throw new Error('阿里云 CreateToken 未返回 Token.Id');
  }
  tokenCache = { id, expireAtSec };
  return id;
}

/**
 * 一句话识别：上传完整 WAV（16kHz、16bit、单声道）或文档支持格式。
 * @param {Buffer} audioBuffer
 */
export async function recognizeSpeech(audioBuffer) {
  if (!isAliyunSpeechConfigured()) {
    throw new Error('未配置阿里云语音（ALIYUN_ACCESS_KEY_ID / ALIYUN_ACCESS_KEY_SECRET / ALIYUN_NLS_APP_KEY）');
  }
  const token = await getNlsToken();
  const appkey = process.env.ALIYUN_NLS_APP_KEY;
  const qs = new URLSearchParams({
    appkey,
    format: 'wav',
    sample_rate: '16000',
    enable_punctuation_prediction: 'true',
    enable_inverse_text_normalization: 'true',
  });
  const url = `${nlsGatewayBase()}/stream/v1/asr?${qs.toString()}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-NLS-Token': token,
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(audioBuffer.length),
    },
    body: audioBuffer,
  });

  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`语音识别响应非 JSON：${text.slice(0, 300)}`);
  }

  if (body.status !== 20000000) {
    const msg = body.message || body.Message || JSON.stringify(body);
    throw new Error(msg || `识别失败 status=${body.status}`);
  }

  return { text: String(body.result || '').trim() };
}

/**
 * 语音合成（短文本，<=300 字）。
 * 返回音频二进制 Buffer，默认 wav 16k。
 */
export async function synthesizeSpeech(text, opts = {}) {
  if (!isAliyunSpeechConfigured()) {
    throw new Error('未配置阿里云语音（ALIYUN_ACCESS_KEY_ID / ALIYUN_ACCESS_KEY_SECRET / ALIYUN_NLS_APP_KEY）');
  }
  const payloadText = String(text || '').trim();
  if (!payloadText) throw new Error('缺少 text');
  const token = await getNlsToken();
  const appkey = process.env.ALIYUN_NLS_APP_KEY;
  const body = {
    appkey,
    token,
    text: payloadText.slice(0, 300),
    format: opts.format || 'wav',
    sample_rate: Number(opts.sampleRate || 16000),
    voice: opts.voice || process.env.ALIYUN_NLS_TTS_VOICE || 'xiaoyun',
    speech_rate: Number(opts.speechRate || process.env.ALIYUN_NLS_TTS_SPEECH_RATE || 0),
    pitch_rate: Number(opts.pitchRate || process.env.ALIYUN_NLS_TTS_PITCH_RATE || 0),
    volume: Number(opts.volume || process.env.ALIYUN_NLS_TTS_VOLUME || 50),
  };

  const res = await fetch(`${nlsGatewayBase()}/stream/v1/tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-NLS-Token': token,
    },
    body: JSON.stringify(body),
  });

  const contentType = String(res.headers.get('content-type') || '').toLowerCase();
  const ab = await res.arrayBuffer();
  const buf = Buffer.from(ab);

  // 错误时接口通常返回 JSON
  if (contentType.includes('application/json')) {
    try {
      const j = JSON.parse(buf.toString('utf8'));
      throw new Error(j.error_message || j.message || JSON.stringify(j));
    } catch (e) {
      throw new Error(e.message || '语音合成失败');
    }
  }
  if (!buf.length) throw new Error('语音合成返回空音频');
  return { audio: buf, contentType: contentType || 'audio/wav' };
}
