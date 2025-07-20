const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const fs = require("node:fs/promises");
const fsold = require("node:fs");
const path = require("node:path");
const ffmpeg = require("fluent-ffmpeg");

const RESOLUTIONS = [
  { name: "360p", width: 480, height: 360 },
  { name: "480p", width: 858, height: 480 },
  { name: "720p", width: 1280, height: 720 },
];

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.BUCKET_NAME;
const KEY = process.env.KEY;

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function init() {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: KEY,
  });

  const result = await s3Client.send(command);
  const originalFilePath = `original-video.mp4`;
  const buffer = await streamToBuffer(result.Body);
  await fs.writeFile(originalFilePath, buffer);

  const originalVideoPath = path.resolve(originalFilePath);
  const promises = RESOLUTIONS.map((resolution) => {
    const uniqueId = KEY.split("-")[0];
    const output = `${uniqueId}-video-${resolution.name}.mp4`;

    return new Promise((resolve, reject) => {
      ffmpeg(originalVideoPath)
        .output(output)
        .withVideoCodec("libx264")
        .withAudioCodec("aac")
        .withSize(`${resolution.width}x${resolution.height}`)
        .on("start", () =>
          console.log("start", `${resolution.width}x${resolution.height}`)
        )
        .on("error", (err) => {
          console.error(
            `Transcoding failed for ${resolution.name}:`,
            err.message
          );
          reject(err);
        })
        .on("end", async () => {
          try {
            const putCommand = new PutObjectCommand({
              Bucket: process.env.OUTPUT_BUCKET_NAME,
              Key: output,
              Body: fsold.createReadStream(path.resolve(output)),
            });
            await s3Client.send(putCommand);
            console.log("Uploaded", output);
            resolve();
          } catch (uploadErr) {
            console.error(
              `Upload failed for ${resolution.name}:`,
              uploadErr.message
            );
            reject(uploadErr);
          }
        })
        .format("mp4")
        .run();
    });
  });

  try {
    await Promise.all(promises);

    // ✅ All successful — safe to delete original
    const deleteCommand = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: KEY,
    });

    await s3Client.send(deleteCommand);
    console.log(`Deleted ${KEY} from bucket ${BUCKET_NAME}`);
  } catch (err) {
    console.error(
      "❌ One or more transcoding/upload tasks failed:",
      err.message
    );
    return; // Don't continue if any part failed
  }

  console.log(`Performing Cleanup Inside Container...🧹🧹`);
  try {
    await fs.unlink(originalFilePath);
    console.log(`${originalFilePath} Deleted Successfully From Container...`);
  } catch (err) {
    console.warn("Original file already deleted or missing:", err.message);
  }

  await Promise.all(
    RESOLUTIONS.map(async (r) => {
      const uniqueId = KEY.split("-")[0];
      const output = `${uniqueId}-video-${r.name}.mp4`;

      try {
        await fs.unlink(output);
        console.log(`${output} Deleted Successfully From Container...`);
      } catch (err) {
        console.warn(`File ${output} not found:`, err.message);
      }
    })
  );
}

init();
