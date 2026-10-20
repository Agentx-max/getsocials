const http = require("http");

const BASE = process.env.BASE || "http://localhost:3000";
const SECRET = process.env.MEDIA_TOKEN_SECRET;

function sign(url) {
  const crypto = require("crypto");
  const payload = {
    url,
    exp: Date.now() + 10 * 60 * 1000,
    nonce: crypto.randomBytes(6).toString("hex"),
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = crypto.createHmac("sha256", SECRET).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function stream(token, filename) {
  return new Promise((resolve) => {
    const u = new URL(
      `${BASE}/api/stream?token=${encodeURIComponent(token)}&filename=${encodeURIComponent(filename)}`
    );
    http.get(
      { hostname: u.hostname, port: u.port, path: u.pathname + u.search },
      (res) => {
        let received = 0;
        res.on("data", (c) => {
          received += c.length;
        });
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            received,
            declared: res.headers["content-length"],
            type: res.headers["content-type"],
            disposition: res.headers["content-disposition"],
          })
        );
        res.on("error", (e) => resolve({ status: res.statusCode, received, error: e.message }));
        res.on("aborted", () => resolve({ status: res.statusCode, received, error: "aborted" }));
      }
    ).on("error", (e) => resolve({ error: e.message }));
  });
}

async function main() {
  if (!SECRET) {
    console.log("MEDIA_TOKEN_SECRET must be set for this test");
    process.exitCode = 1;
    return;
  }

  const source = "https://www.w3schools.com/html/mov_bbb.mp4";

  console.log("1) stream a media file through /api/stream");
  const r = await stream(sign(source), "Test Video.mp4");
  console.log("   ", JSON.stringify(r));
  const ok = r.received && Number(r.declared) === r.received;
  console.log(`   ${ok ? "✅ full body received" : "❌ body truncated"}`);

  console.log("\n2) forged token is rejected");
  const bad = await stream("abc.def", "x.mp4");
  console.log(`   status=${bad.status} ${bad.error || ""}`);

  console.log("\n3) token signed with the wrong secret is rejected");
  const crypto = require("crypto");
  const payload = { url: source, exp: Date.now() + 60000, nonce: "x" };
  const enc = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", "a-completely-different-secret").update(enc).digest("base64url");
  const wrong = await stream(`${enc}.${sig}`, "x.mp4");
  console.log(`   status=${wrong.status} ${wrong.error || ""}`);

  console.log("\n4) missing token is rejected");
  const missing = await stream("", "x.mp4");
  console.log(`   status=${missing.status} ${missing.error || ""}`);
}

main();
