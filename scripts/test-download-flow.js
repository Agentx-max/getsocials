const axios = require("axios");

const BASE = process.env.BASE || "http://localhost:3000";

async function main() {
  const url = process.argv[2] || "https://www.pornhub.com/view_video.php?viewkey=689e04c2314af";

  console.log("1) analyse");
  const a = await axios.post(
    `${BASE}/api/analyze`,
    { url },
    { headers: { "Content-Type": "application/json" }, timeout: 60000 }
  );

  if (!a.data.success) {
    console.log("   analyse failed:", a.data.error);
    return;
  }

  const d = a.data.data;
  console.log(`   title: ${d.title}`);
  console.log(`   videos: ${d.videos.length}`);
  d.videos.forEach((v) => console.log(`     ${v.quality} ${v.format}`));

  if (!d.videos.length) return;

  const format = d.videos[0];
  console.log(`\n2) stream ${format.quality} via the signed endpoint`);

  try {
    const res = await axios.get(
      `${BASE}/api/stream?token=${encodeURIComponent(format.token)}&filename=${encodeURIComponent("test - getsocials.com.mp4")}`,
      { responseType: "stream", timeout: 120000, validateStatus: () => true }
    );

    console.log("   status:", res.status);
    console.log("   content-type:", res.headers["content-type"]);
    console.log("   content-length:", res.headers["content-length"]);
    console.log("   content-disposition:", res.headers["content-disposition"]);

    let received = 0;
    await new Promise((resolve, reject) => {
      res.data.on("data", (c) => {
        received += c.length;
      });
      res.data.on("end", resolve);
      res.data.on("error", reject);
    });

    console.log(`   received: ${received} bytes (${(received / 1024 / 1024).toFixed(2)} MB)`);
    console.log(received > 0 ? "   ✅ DOWNLOAD WORKS" : "   ❌ empty body");
  } catch (e) {
    console.log("   ❌ stream failed:", e.response?.status, e.response?.data?.error || e.message);
  }
}

main().catch((e) => console.log("ERR", e.message));
