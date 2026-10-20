const express = require("express");
const router = express.Router();
const { handlePornhubDownload } = require("../controllers/pornhubController");

router.get("/download", handlePornhubDownload);

module.exports = router;
