// Pi Network authentication (App Studio)
function onIncompletePaymentFound(payment) {}

(async () => {
  try {
    if (!window.Pi) return;
    await Pi.init({ version: "2.0" });
    const auth = await Pi.authenticate(["username"], onIncompletePaymentFound);
    const res = await fetch(
      "https://backend.appstudio-u7cm9zhmha0ruwv8.piappengine.com/pi/auth/v1/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: auth.accessToken }),
      }
    );
    if (!res.ok) throw new Error("Login failed: " + res.status);
    const data = await res.json();
    // Seule identité fiable : celle renvoyée par App Studio
    window.piSession = { sessionToken: data.sessionToken, user: data.user };
  } catch (e) {
    console.error("Pi auth error", e);
  }
})();
