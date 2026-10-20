const { fetchInstagramData, isInstagramUrl } = require("../services/instagramService");
const { fetchFacebookData, isFacebookUrl } = require("../services/facebookService");

/**
 * Meta controller — handles Instagram and Facebook.
 *
 * Instagram uses instaloader and Facebook uses yt-dlp, both invoked through
 * the Python bridge. The original `metadownloader` package is kept as a last
 * resort because it still resolves some older Facebook link shapes.
 */
async function handleMetaDownload(req, res) {
  const { url } = req.query;

  if (!url) {
    return res
      .status(400)
      .json({ success: false, error: "Missing 'url' query parameter." });
  }

  try {
    let data;

    if (isInstagramUrl(url)) {
      data = await fetchInstagramData(url);
    } else if (isFacebookUrl(url)) {
      data = await fetchFacebookData(url);
    } else {
      // Neither Instagram nor Facebook — try the generic Meta extractor.
      const snapsave = require("metadownloader");
      data = await snapsave(url);

      if (!data || data.status === false) {
        throw new Error(
          (data && data.msg) || "No media was found for this Meta URL."
        );
      }
    }

    res.json({ success: true, data });
  } catch (err) {
    res.status(502).json({ success: false, error: err.message });
  }
}

module.exports = { handleMetaDownload };
