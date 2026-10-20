const { fetchYouTubeData, extractVideoId } = require("../services/youtubeService");

async function main() {
  const url =
    process.argv[2] || "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

  console.log("video id:", extractVideoId(url));
  console.log("url:", url);
  console.log("---");

  try {
    const data = await fetchYouTubeData(url);
    console.log("title:", data.title);
    console.log("author:", data.author);
    console.log("duration:", data.duration);
    console.log("thumbnail:", data.thumbnail ? data.thumbnail.slice(0, 70) : null);
    console.log("videos:", data.videos.length, "audios:", data.audios.length);
    console.log("\ntop video formats:");
    data.videos.slice(0, 6).forEach((v) => {
      console.log(
        `  ${String(v.quality).padEnd(8)} ${v.format.padEnd(5)} ${String(v.sizeMB).padStart(8)} MB  ${v.text || ""}  ${v.url.slice(0, 55)}...`
      );
    });
    console.log("\naudio formats:");
    data.audios.slice(0, 4).forEach((a) => {
      console.log(
        `  ${String(a.quality).padEnd(8)} ${a.format.padEnd(5)} ${String(a.sizeMB).padStart(8)} MB  ${a.text || ""}  ${a.url.slice(0, 55)}...`
      );
    });

    // Verify the first video URL is actually reachable
    if (data.videos.length) {
      const axios = require("axios");
      try {
        const r = await axios.head(data.videos[0].url, {
          timeout: 15000,
          maxRedirects: 5,
          headers: { "user-agent": "Mozilla/5.0" },
        });
        console.log(
          `\nHEAD on top video URL -> ${r.status}, content-length=${r.headers["content-length"]}`
        );
      } catch (e) {
        console.log("\nHEAD on top video URL failed:", e.message);
      }
    }
  } catch (e) {
    console.log("ERROR:", e.message);
    process.exitCode = 1;
  }
}

main();
