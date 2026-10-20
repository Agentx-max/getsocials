const axios = require("axios");

async function main() {
  const r = await axios.post(
    "http://localhost:3000/api/formats",
    { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
    { headers: { "Content-Type": "application/json" } }
  );

  const formats = r.data.data.formats;
  console.log("formats returned:", formats.length);

  const picks = [
    formats.find((f) => f.quality === "1080p" && f.format === "mp4"),
    formats.find((f) => f.quality === "720p" && f.format === "mp4"),
    formats.find((f) => f.quality === "medium" && f.format === "mp4"),
  ].filter(Boolean);

  for (const f of picks) {
    try {
      const head = await axios.head(f.url, {
        timeout: 20000,
        maxRedirects: 5,
        headers: { "user-agent": "Mozilla/5.0" },
      });
      const len = Number(head.headers["content-length"] || 0);
      const mb = len ? (len / 1024 / 1024).toFixed(2) : "?";
      console.log(
        `✅ ${String(f.quality).padEnd(8)} ${String(f.format).padEnd(5)} claimed=${String(f.sizeMB).padStart(8)}MB  actual=${mb.padStart(9)}MB  status=${head.status}  type=${head.headers["content-type"]}`
      );
    } catch (e) {
      console.log(`❌ ${f.quality} ${f.format}: ${e.message}`);
    }
  }
}

main();
