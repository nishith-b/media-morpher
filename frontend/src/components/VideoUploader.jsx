import React, { useRef, useState } from "react";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";

const VideoUploader = () => {
  const fileInputRef = useRef();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [showDownload, setShowDownload] = useState(false);
  const [downloadLinks, setDownloadLinks] = useState({
    "360p": "",
    "480p": "",
    "720p": "",
  });

  let KEY;
  // Helper to get video duration asynchronously and return in seconds
  const getVideoDuration = (file) =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = function () {
        URL.revokeObjectURL(url);
        resolve(video.duration);
      };
      video.onerror = reject;
      video.src = url;
    });

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setShowDownload(false);
    setProcessingProgress(0);
    setProcessing(false);
    setProgress(0);

    // 1. Get video duration
    let duration = 0;
    try {
      duration = await getVideoDuration(file);
    } catch (e) {
      toast.error("Couldn't read video metadata.");
      return;
    }
    // 2. Proceed with upload
    setIsUploading(true);

    const filename = encodeURIComponent(file.name);
    const contentType = encodeURIComponent(file.type);

    const api_server = import.meta.env.VITE_API_URL;

    try {
      // Step 1: Get the signed URL from your backend
      const response = await axios.get(
        `${api_server}/api/upload/get-upload-url?filename=${filename}&contentType=${contentType}`
      );

      if (response.status !== 200) {
        throw new Error("Failed to get signed URL");
      }

      const { uploadUrl, key } = response.data;
      KEY = key.split("-")[0];

      // Step 2: Upload the file to S3 with Axios so we can track progress
      await axios.put(uploadUrl, file, {
        headers: {
          "Content-Type": file.type,
        },
        onUploadProgress: (event) => {
          const percent = Math.round((event.loaded * 100) / event.total);
          setProgress(percent);
        },
      });

      setProgress(100);
      toast.success(`✅ Video uploaded successfully!`, {
        duration: 3000,
      });

      // 3. Start processing bar after upload completes
      setIsUploading(false);
      startProcessing(duration);
    } catch (error) {
      toast.error("❌ Upload failed. Check console for details.", {
        duration: 4000,
      });
      console.error("❌ Upload failed:", error);
      setIsUploading(false);
      setProgress(0);
    }
  };

  // Simulate processing bar for 60% of the original video duration
  const startProcessing = (videoDuration) => {
    setProcessing(true);
    const processingTime = Math.max(2, Math.round(videoDuration * 0.9)); // At least 2 seconds for demo
    const intervalMs = 100;
    let progress = 0;
    let elapsed = 0;
    setProcessingProgress(0);

    const interval = setInterval(() => {
      elapsed += intervalMs / 1000; // In seconds
      progress = Math.min(100, Math.round((elapsed / processingTime) * 100));
      setProcessingProgress(progress);
      if (elapsed >= processingTime) {
        clearInterval(interval);
        setProcessing(false);
        setProcessingProgress(100);

        const BUCKET_NAME = "video-transcoder.production-output";

        const URL_360 = `https://s3.ap-south-1.amazonaws.com/${BUCKET_NAME}/${KEY}-video-360p.mp4`;
        const URL_480 = `https://s3.ap-south-1.amazonaws.com/${BUCKET_NAME}/${KEY}-video-480p.mp4`;
        const URL_720 = `https://s3.ap-south-1.amazonaws.com/${BUCKET_NAME}/${KEY}-video-720p.mp4`;

        setDownloadLinks({
          "360p": URL_360,
          "480p": URL_480,
          "720p": URL_720,
        });
        setShowDownload(true);
        toast.success("Processing complete! Downloads ready.");
      }
    }, intervalMs);
  };

  // Download handlers (for security, consider using rel="noopener noreferrer" with target="_blank")
  const handleDownload = (res) => {
    window.open(res, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 bg-gradient-to-r from-blue-200 via-purple-200 to-pink-200 font-poppins">
      <Toaster position="top-right" />
      <div className="w-full max-w-md p-10 text-center bg-white shadow-lg rounded-xl">
        <h2 className="mb-6 text-3xl font-semibold text-gray-800 font-poppins">
          VIDEO TRANSCODER
        </h2>
        <button
          onClick={() => fileInputRef.current.click()}
          disabled={isUploading || processing}
          className={`w-full py-3 rounded-lg font-semibold text-white transition-colors duration-300 focus:outline-none ${
            isUploading || processing
              ? "bg-blue-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {isUploading
            ? "Uploading..."
            : processing
            ? "Processing..."
            : "Upload"}
        </button>
        <input
          type="file"
          accept="video/*"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileChange}
          disabled={isUploading || processing}
        />

        {/* Upload Progress Bar */}
        {isUploading && (
          <div className="w-full mt-6">
            <div className="w-full h-4 bg-gray-200 rounded-full">
              <div
                className="h-4 transition-all duration-200 bg-blue-500 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-1 text-sm text-gray-700">{progress}%</div>
          </div>
        )}

        {/* Processing Progress Bar */}
        {processing && (
          <div className="w-full mt-6">
            <div className="w-full h-4 bg-green-200 rounded-full">
              <div
                className="h-4 transition-all duration-200 bg-green-500 rounded-full"
                style={{ width: `${processingProgress}%` }}
              />
            </div>
            <div className="mt-1 text-sm text-green-700">
              Processing: {processingProgress}%
            </div>
          </div>
        )}

        {/* Download Buttons */}
        {showDownload && (
          <div className="flex flex-col w-full gap-4 mt-8">
            <button
              className="w-full py-2 font-semibold text-white bg-gray-700 rounded-lg hover:bg-gray-900"
              onClick={() => handleDownload(downloadLinks["360p"])}
            >
              Download 360p
            </button>
            <button
              className="w-full py-2 font-semibold text-white bg-gray-700 rounded-lg hover:bg-gray-900"
              onClick={() => handleDownload(downloadLinks["480p"])}
            >
              Download 480p
            </button>
            <button
              className="w-full py-2 font-semibold text-white bg-gray-700 rounded-lg hover:bg-gray-900"
              onClick={() => handleDownload(downloadLinks["720p"])}
            >
              Download 720p
            </button>
          </div>
        )}
      </div>
      <footer className="mt-12 text-sm text-gray-600">
        Supported format: <span className="italic">MP4</span>
      </footer>
    </div>
  );
};

export default VideoUploader;
