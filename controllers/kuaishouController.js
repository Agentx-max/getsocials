const { fetchKuaishouData } = require("../services/kuaishouService");

async function handleKuaishouDownload(req, res) {
  const { url } = req.query;

  if (!url) {
    return res
      .status(400)
      .json({ success: false, error: "Missing 'url' query parameter." });
  }

  try {
    const data = await fetchKuaishouData(url);
    res.json({ success: true, data });
  } catch (err) {
    res.status(502).json({ success: false, error: err.message });
  }
}

module.exports = { handleKuaishouDownload };
