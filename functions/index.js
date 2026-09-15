/**
 * Remplace les fonctions Netlify (netlify/functions/approve.js, complete.js,
 * send-email-code.js, upload-image.js) qui ne peuvent pas s'exécuter tant que
 * le site est servi par GitHub Pages (alban3886.github.io/togosheets-pro/).
 *
 * Déploiement :
 *   firebase deploy --only functions
 *
 * Secrets à configurer AVANT le déploiement (une seule fois) :
 *   firebase functions:secrets:set PI_API_KEY
 *   firebase functions:secrets:set RESEND_API_KEY
 *   firebase functions:secrets:set IMGBB_API_KEY
 *
 * Côté frontend, il suffit de remplacer les URLs :
 *   /.netlify/functions/approve         -> https://<region>-gestion-salaire-9d3e9.cloudfunctions.net/approve
 *   /.netlify/functions/complete        -> .../complete
 *   /.netlify/functions/send-email-code -> .../sendEmailCode
 *   /.netlify/functions/upload-image    -> .../uploadImage
 * (voir le fichier PATCH-FRONTEND.md fourni à côté pour les lignes exactes à changer).
 */

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');

const PI_API_KEY     = defineSecret('PI_API_KEY');
const RESEND_API_KEY = defineSecret('RESEND_API_KEY');
const IMGBB_API_KEY  = defineSecret('IMGBB_API_KEY');

// CORS simple : la même page (GitHub Pages) appelle ces fonctions en fetch().
function withCors(res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
}

function handleOptions(req, res) {
  if (req.method === 'OPTIONS') {
    withCors(res);
    res.status(204).send('');
    return true;
  }
  return false;
}

// ── Pi Network : approve ──
exports.approve = onRequest({ secrets: [PI_API_KEY], region: 'us-central1' }, async (req, res) => {
  withCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }

  try {
    const { paymentId } = req.body || {};
    if (!paymentId) { res.status(400).json({ error: 'paymentId manquant' }); return; }

    const response = await fetch(`https://api.minepi.com/v2/payments/${paymentId}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${PI_API_KEY.value()}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    if (!response.ok) { res.status(response.status).json(data); return; }
    res.status(200).json({ success: true, data });
  } catch (err) {
    logger.error('approve failed', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Pi Network : complete ──
exports.complete = onRequest({ secrets: [PI_API_KEY], region: 'us-central1' }, async (req, res) => {
  withCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }

  try {
    const { paymentId, txid } = req.body || {};
    if (!paymentId || !txid) { res.status(400).json({ error: 'paymentId ou txid manquant' }); return; }

    const response = await fetch(`https://api.minepi.com/v2/payments/${paymentId}/complete`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${PI_API_KEY.value()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ txid })
    });
    const data = await response.json();
    if (!response.ok) { res.status(response.status).json(data); return; }
    res.status(200).json({ success: true, data });
  } catch (err) {
    logger.error('complete failed', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Email : code de confirmation via Resend ──
exports.sendEmailCode = onRequest({ secrets: [RESEND_API_KEY], region: 'us-central1' }, async (req, res) => {
  withCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }

  try {
    const { to, code, name } = req.body || {};
    if (!to || !code) { res.status(400).json({ error: 'Email ou code manquant' }); return; }
    if (!/^\d{6}$/.test(String(code))) { res.status(400).json({ error: 'Code invalide' }); return; }

    const safeName = (name || '').replace(/[<>]/g, '').slice(0, 60) || 'là';
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#2563eb">TogoSheets</h2>
        <p>Bonjour ${safeName},</p>
        <p>Voici ton code de confirmation :</p>
        <div style="font-size:32px;font-weight:800;letter-spacing:8px;background:#f1f5f9;padding:16px 24px;border-radius:12px;text-align:center;margin:20px 0">${code}</div>
        <p style="color:#64748b;font-size:13px">Ce code expire dans 10 minutes. Si tu n'as pas demandé ce code, ignore cet email.</p>
      </div>
    `;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY.value()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'TogoSheets <onboarding@resend.dev>',
        to: [to],
        subject: `Ton code de confirmation : ${code}`,
        html
      })
    });
    const data = await response.json();
    if (!response.ok) { res.status(response.status).json({ error: data.message || 'Échec envoi email' }); return; }
    res.status(200).json({ success: true });
  } catch (err) {
    logger.error('sendEmailCode failed', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Upload photo produit vers ImgBB ──
exports.uploadImage = onRequest({ secrets: [IMGBB_API_KEY], region: 'us-central1', memory: '256MiB' }, async (req, res) => {
  withCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }

  try {
    const { base64, name } = req.body || {};
    if (!base64) { res.status(400).json({ error: 'Image (base64) manquante' }); return; }

    const form = new URLSearchParams();
    form.append('key', IMGBB_API_KEY.value());
    form.append('image', base64);
    form.append('name', name || `upload_${Date.now()}`);

    const response = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: form });
    const data = await response.json();
    if (!response.ok || !data.success) {
      res.status(response.status || 500).json({ error: data.error?.message || 'Échec upload ImgBB' });
      return;
    }
    res.status(200).json({ url: data.data.display_url });
  } catch (err) {
    logger.error('uploadImage failed', err);
    res.status(500).json({ error: err.message });
  }
});
