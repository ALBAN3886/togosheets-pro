exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { to, code, name } = JSON.parse(event.body);

    if (!to || !code) {
      return { statusCode: 400, body: JSON.stringify({ error: "Email ou code manquant" }) };
    }
    if (!/^\d{6}$/.test(String(code))) {
      return { statusCode: 400, body: JSON.stringify({ error: "Code invalide" }) };
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: "RESEND_API_KEY non configurée côté serveur" }) };
    }

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
        'Authorization': `Bearer ${RESEND_API_KEY}`,
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

    if (!response.ok) {
      return { statusCode: response.status, body: JSON.stringify({ error: data.message || 'Échec envoi email' }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
