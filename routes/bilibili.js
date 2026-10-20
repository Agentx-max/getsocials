const express = require("express");
const router = express.Router();
const { handleBilibiliDownload } = require("../controllers/bilibiliController");

router.get("/download", handleBilibiliDownload);

module.exports = router;
