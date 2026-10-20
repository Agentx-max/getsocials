const axios = require("axios");

const BASE = process.argv[2] || "https://getsocials.onrender.com";

async function main() {
  const r = await axios.get(BASE, {
    timeout: 60000,
    validateStatus: () => true,
    headers: { "user-agent": "Mozilla/5.0" },
  });

  console.log("=== response headers ===");
  Object.entries(r.headers).forEach(([k, v]) => {
    if (k === "set-cookie") return;
    console.log(`${k}: ${v}`);
  });

  const html = String(r.data);

  console.log("\n=== script / link tags ===");
  (html.match(/<(?:script|link)[^>]*>/g) || []).forEach((t) => console.log("  " + t));

  console.log("\n=== is this the old build? ===");
  console.log("  mentions FluxSave :", html.includes("FluxSave"));
  console.log("  mentions GETSocials:", html.includes("GETSocials"));
}

main();
