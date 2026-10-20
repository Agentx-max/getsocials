const axios = require("axios");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

const CANDIDATES = [
  "B_K4CykAOtf",
  "DLHQfPiyucu",
  "CGF2kZ2uQaK",
  "Cu4ZpH3uQaJ",
];

async function main() {
  for (const sc of CANDIDATES) {
    // The embed endpoint is public and needs no session.
    try {
      const r = await axios.get(`https://www.instagram.com/p/${sc}/embed/`, {
        headers: { "user-agent": UA, accept: "text/html" },
        timeout: 20000,
        validateStatus: () => true,
      });
      const html = String(r.data);
      const title = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      const hasMedia =
        html.includes('"display_url"') ||
        html.includes('"video_url"') ||
        html.includes('"video_versions"');
      const notFound = /Page Not Found|not found/i.test(html);
      console.log(
        `${sc.padEnd(14)} embed=${r.status} len=${String(html.length).padStart(7)} media=${hasMedia} notFound=${notFound} title="${(title ? title[1] : '').slice(0, 40)}"`
      );
    } catch (e) {
      console.log(`${sc.padEnd(14)} ERR ${e.message.slice(0, 60)}`);
    }
  }
}

main();
