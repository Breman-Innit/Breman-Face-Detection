require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");

const app = express();
const port = process.env.PORT || 5000;
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, callback) => {
    if (file.mimetype.startsWith("image/")) {
      callback(null, true);
      return;
    }

    callback(new Error("Only image files are allowed."));
  },
});

const ultralyticsEndpoint =
  "https://predict-6ae8747843cd1470360a421d-dproatj77a-ey.a.run.app/predict";
const upstreamTimeoutMs = 15_000;

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin is not allowed by CORS."));
    },
  }),
);
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is healthy",
  });
});

app.post("/api/detect", upload.single("image"), async (req, res) => {
  if (!process.env.ULTRALYTICS_API_KEY) {
    return res.status(500).json({
      success: false,
      error: "The server is missing ULTRALYTICS_API_KEY.",
    });
  }

  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: "An image file is required in the 'image' field.",
    });
  }

  const requestBody = req.body || {};
  const confidence =
    requestBody.confidence || req.query.confidence || "0.25";
  const imageSize = requestBody.imgsz || req.query.imgsz || "640";

  if (!isValidConfidence(confidence)) {
    return res.status(400).json({
      success: false,
      error: "confidence must be a number between 0 and 1.",
    });
  }

  if (!isValidImageSize(imageSize)) {
    return res.status(400).json({
      success: false,
      error: "imgsz must be an integer between 32 and 4096.",
    });
  }

  const upstreamForm = new FormData();
  upstreamForm.append(
    "file",
    new Blob([req.file.buffer], { type: req.file.mimetype }),
    req.file.originalname,
  );
  upstreamForm.append("conf", String(confidence));
  upstreamForm.append("imgsz", String(imageSize));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), upstreamTimeoutMs);

  try {
    const upstreamResponse = await fetch(ultralyticsEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.ULTRALYTICS_API_KEY}`,
      },
      body: upstreamForm,
      signal: controller.signal,
    });

    const responseText = await upstreamResponse.text();
    let upstreamData;

    try {
      upstreamData = JSON.parse(responseText);
    } catch (error) {
      return res.status(502).json({
        success: false,
        error: "The model service returned an unexpected non-JSON response.",
      });
    }

    if (!upstreamResponse.ok) {
      return res.status(502).json({
        success: false,
        error: "The model service rejected the detection request.",
        upstreamStatus: upstreamResponse.status,
        upstream: upstreamData,
      });
    }

    return res.json({
      success: true,
      predictions: upstreamData,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      return res.status(504).json({
        success: false,
        error: "The model service request timed out.",
      });
    }

    console.error("Detection request failed:", error.message);
    return res.status(502).json({
      success: false,
      error: "Unable to reach the model service.",
    });
  } finally {
    clearTimeout(timeout);
  }
});

function isValidConfidence(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 1;
}

function isValidImageSize(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 32 && number <= 4096;
}

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "The image must be 10 MB or smaller."
        : "The image upload could not be processed.";

    return res.status(400).json({
      success: false,
      error: message,
    });
  }

  if (error.message === "Only image files are allowed.") {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }

  console.error("Unexpected server error:", error.message);
  return res.status(500).json({
    success: false,
    error: "An unexpected server error occurred.",
  });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

module.exports = app;
