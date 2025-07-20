const express = require("express");
const { generateURL } = require("../controllers/upload-controller");

const router = express.Router();

router.get("/get-upload-url", async (req, res) => {

  const { filename, contentType } = req.query;

  if (!filename || !contentType) {
    return res.status(400).json({ error: "Missing filename or contentType" });
  }

  try {
    const { signedURL, key } = await generateURL(filename, contentType);
    res.json({ uploadUrl: signedURL, key });
  } catch (error) {
    console.log("Error:", error);
    res.status(500).json({ error: "Could not generate signed URL" });
  }
});

module.exports = router;
