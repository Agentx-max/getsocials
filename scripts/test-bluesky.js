const { fetchBlueskyMedia } = require("../services/blueskyService");

async function main() {
  const url = process.argv[2] || "https://bsky.app/profile/bsky.app/post/3myapuxlwxk22";
  console.log("testing:", url);
  try {
    const r = await fetchBlueskyMedia(url);
    console.log("title:", r.title);
    console.log("author:", r.author);
    console.log("thumbnail:", r.thumbnail);
    console.log("videos:", r.videos.length, "photos:", r.photos.length);
    if (r.videos.length) console.log("video url:", r.videos[0].url);
    if (r.photos.length) console.log("photo url:", r.photos[0].url);
  } catch (e) {
    console.log("ERROR:", e.message);
  }
}

main();
