const express = require("express");
const router = express.Router();
const { handleYtMusicDownload } = require("../controllers/ytmusicController");

router.get("/download", handleYtMusicDownload);

module.exports = router;
