exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { base64, name } = JSON.parse(event.body);

    if (!base64) {
      return { statusCode: 400, body: JSON.stringify({ error: "Image (base64) manquante" }) };
    }

    const IMGBB_API_KEY = process.env.IMGBB_API_KEY;

    if (!IMGBB_API_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: "IMGBB_API_KEY non configurée côté serveur" }) };
    }

    const form = new URLSearchParams();
    form.append('key', IMGBB_API_KEY);
    form.append('image', base64);
    form.append('name', name || `upload_${Date.now()}`);

    const response = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: form
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return {
        statusCode: response.status || 500,
        body: JSON.stringify({ error: data.error?.message || "Échec upload ImgBB" })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ url: data.data.display_url })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "Erreur serveur" })
    };
  }
};
