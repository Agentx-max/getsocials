const { fetchYouTubeData, extractVideoId } = require("../services/youtubeService");

const CASES = [
  ["watch", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
  ["youtu.be", "https://youtu.be/dQw4w9WgXcQ"],
  ["shorts", "https://www.youtube.com/shorts/dQw4w9WgXcQ"],
  ["embed", "https://www.youtube.com/embed/dQw4w9WgXcQ"],
  ["m.youtube", "https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=30s"],
  ["with extra params", "https://www.youtube.com/watch?app=desktop&v=dQw4w9WgXcQ&feature=share"],
  ["bad id", "https://www.youtube.com/watch?v=notavalididxx"],
  ["not a video url", "https://www.youtube.com/feed/subscriptions"],
  ["private video", "https://www.youtube.com/watch?v=aaaaaaaaaaa"],
  ["removed video", "https://www.youtube.com/watch?v=aaaaaaaaaaa"],
];

async function main() {
  for (const [label, url] of CASES) {
    const id = extractVideoId(url);
    try {
      const data = await fetchYouTubeData(url);
      console.log(
        `✅ ${label.padEnd(18)} id=${String(id).padEnd(13)} title="${(data.title || "").slice(0, 34)}" v=${data.videos.length} a=${data.audios.length} dur=${data.duration}`
      );
    } catch (e) {
      console.log(`⚠️  ${label.padEnd(18)} id=${String(id).padEnd(13)} -> ${e.message}`);
    }
  }
}

main();
