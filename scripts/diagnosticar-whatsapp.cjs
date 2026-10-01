// Diagnóstico de solo lectura. No imprime tokens, secretos ni contenido de mensajes.
const fs = require('fs');
const crypto = require('crypto');
Object.assign(
  process.env,
  require('dotenv').parse(fs.readFileSync('.env.production')),
);
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
function decrypt(value) {
  const [iv, tag, data] = value.split('.').map((v) => Buffer.from(v, 'base64'));
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(process.env.META_TOKEN_ENCRYPTION_KEY, 'base64'),
    iv,
  );
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    'utf8',
  );
}
async function graph(path, token, params = {}) {
  const url = new URL(
    `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || 'v26.0'}/${path}`,
  );
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20000),
  });
  const body = await res.json();
  if (!res.ok)
    return {
      error: {
        status: res.status,
        code: body.error?.code,
        subcode: body.error?.error_subcode,
        message: body.error?.message,
      },
    };
  return body;
}
(async () => {
  try {
    const lines = await prisma.whatsappConexion.findMany({
      select: {
        id: true,
        estado: true,
        organizacionId: true,
        phoneNumberId: true,
        wabaId: true,
        numeroDisplay: true,
        rolLinea: true,
        callingHabilitado: true,
        webhookSuscrito: true,
        webhookUltimoCheckEn: true,
        webhookUltimoError: true,
        fechaModificacion: true,
        metaConexion: {
          select: {
            id: true,
            estado: true,
            appId: true,
            appSecretCifrado: true,
            tokenCifrado: true,
            tokenExpiraEn: true,
          },
        },
      },
    });
    for (const line of lines) {
      const { metaConexion: meta, ...publicLine } = line;
      const inbound = await prisma.whatsappMensaje.aggregate({
        where: {
          direccion: 'entrante',
          whatsappConversacion: { whatsappConexionId: line.id },
        },
        _count: true,
        _max: { fechaMensaje: true, fechaCreacion: true },
      });
      console.log(
        JSON.stringify({
          line: publicLine,
          meta: {
            id: meta.id,
            estado: meta.estado,
            appId: meta.appId,
            tokenExpiraEn: meta.tokenExpiraEn,
          },
          inbound,
        }),
      );
      const outbound = await prisma.whatsappMensaje.aggregate({
        where: {
          direccion: 'saliente',
          whatsappConversacion: { whatsappConexionId: line.id },
        },
        _count: true,
        _max: { fechaMensaje: true, fechaCreacion: true },
      });
      const deliveryErrors = await prisma.whatsappMensaje.groupBy({
        by: ['errorMensaje'],
        where: {
          whatsappConversacion: { whatsappConexionId: line.id },
          errorMensaje: { not: null },
          fechaCreacion: { gte: new Date('2026-09-23T00:00:00-05:00') },
        },
        _count: true,
      });
      console.log(
        JSON.stringify({ lineId: line.id, outbound, deliveryErrors }),
      );
      if (line.estado !== 1 || !meta.tokenCifrado || !meta.appSecretCifrado)
        continue;
      let token, secret;
      try {
        token = decrypt(meta.tokenCifrado);
        secret = decrypt(meta.appSecretCifrado);
      } catch {
        console.log(JSON.stringify({ lineId: line.id, decrypt: 'FAILED' }));
        continue;
      }
      const [apps, subscriptions, phone] = await Promise.all([
        graph(`${line.wabaId}/subscribed_apps`, token),
        graph(`${meta.appId}/subscriptions`, `${meta.appId}|${secret}`),
        graph(line.phoneNumberId, token, {
          fields:
            'id,display_phone_number,verified_name,platform_type,code_verification_status,is_on_biz_app',
        }),
      ]);
      const whatsappSubscription = subscriptions.data?.find(
        (s) => s.object === 'whatsapp_business_account',
      );
      const callback = whatsappSubscription?.callback_url;
      if (
        process.argv.includes('--probe') &&
        callback &&
        new URL(callback).hostname === 'back-crm.proyectosgvr.com'
      ) {
        const payload = JSON.stringify({
          object: 'whatsapp_business_account',
          entry: [
            {
              id: line.wabaId,
              changes: [
                {
                  field: 'messages',
                  value: {
                    messaging_product: 'whatsapp',
                    metadata: { phone_number_id: line.phoneNumberId },
                    messages: [],
                  },
                },
              ],
            },
          ],
        });
        const signature = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
        const response = await fetch(callback, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Hub-Signature-256': signature,
          },
          body: payload,
          signal: AbortSignal.timeout(20000),
        });
        console.log(
          JSON.stringify({
            lineId: line.id,
            emptySignedWebhook: {
              status: response.status,
              body: (await response.text()).slice(0, 80),
            },
            callbackTokenMatchesLocal:
              new URL(callback).searchParams.get('token') ===
              process.env.META_WEBHOOK_URL_TOKEN,
          }),
        );
        const [phoneHealth, wabaHealth, cloudProfile] = await Promise.all([
          graph(line.phoneNumberId, token, {
            fields:
              'id,status,health_status,quality_rating,throughput,last_onboarded_time',
          }),
          graph(line.wabaId, token, {
            fields:
              'id,name,account_review_status,business_verification_status,health_status',
          }),
          graph(`${line.phoneNumberId}/whatsapp_business_profile`, token, {
            fields: 'messaging_product',
          }),
        ]);
        console.log(
          JSON.stringify({
            lineId: line.id,
            phoneHealth,
            wabaHealth,
            cloudProfile,
          }),
        );
      }
      if (subscriptions.data)
        subscriptions.data = subscriptions.data.map((s) => ({
          ...s,
          callback_url: s.callback_url
            ? s.callback_url.split('?')[0]
            : undefined,
        }));
      console.log(
        JSON.stringify({ lineId: line.id, apps, subscriptions, phone }),
      );
    }
  } finally {
    await prisma.$disconnect();
  }
})().catch((error) => {
  console.error('Diagnóstico falló:', error.code || error.name);
  process.exitCode = 1;
});
