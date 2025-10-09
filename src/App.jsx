import { useState, useRef, useEffect } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import "./App.css";

function App() {
  const [videoFile, setVideoFile] = useState(null);
  const [outputVideo, setOutputVideo] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);

  const ffmpegRef = useRef(new FFmpeg());
  const videoPreviewRef = useRef(null);
  const outputPreviewRef = useRef(null);

  // Load FFmpeg
  useEffect(() => {
    const loadFFmpeg = async () => {
      const ffmpeg = ffmpegRef.current;

      ffmpeg.on("log", ({ message }) => {
        console.log(message);
      });

      ffmpeg.on("progress", ({ progress: prog, time }) => {
        setProgress(`Processing: ${Math.round(prog * 100)}%`);
      });

      try {
        const baseURL =
          "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm";
        await ffmpeg.load({
          coreURL: await toBlobURL(
            `${baseURL}/ffmpeg-core.js`,
            "text/javascript"
          ),
          wasmURL: await toBlobURL(
            `${baseURL}/ffmpeg-core.wasm`,
            "application/wasm"
          ),
        });
        setFfmpegLoaded(true);
        setProgress("FFmpeg loaded successfully");
      } catch (error) {
        console.error("Failed to load FFmpeg:", error);
        setProgress(`Failed to load FFmpeg: ${error.message}`);
      }
    };

    loadFFmpeg();
  }, []);

  const handleVideoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setVideoFile(file);
      setOutputVideo(null);

      // Preview video
      if (videoPreviewRef.current) {
        videoPreviewRef.current.src = URL.createObjectURL(file);
      }
    }
  };

  const applyWatermark = async () => {
    if (!videoFile || !ffmpegLoaded) {
      alert("Please upload a video file");
      return;
    }

    setIsProcessing(true);
    setProgress("Starting...");

    try {
      const ffmpeg = ffmpegRef.current;

      // Write video file to FFmpeg's virtual file system
      await ffmpeg.writeFile("input.mp4", await fetchFile(videoFile));

      // Fetch the watermark from the public folder
      const watermarkResponse = await fetch("/sora.png");
      const watermarkBlob = await watermarkResponse.blob();
      await ffmpeg.writeFile("watermark.png", await fetchFile(watermarkBlob));

      // Complex filter explanation:
      // [0:v] - input video
      // scale='if(gt(iw,ih),min(1280,iw),-2):if(gt(iw,ih),-2,min(1280,ih))' - scale video to max 1280px (maintain aspect ratio)
      // [1:v] - watermark image
      // scale='iw/4:-1' - scale watermark to 1/4 of video width (maintain aspect ratio)
      // overlay - position watermark with rotation every 3 seconds:
      //   - 0-3s: center-right
      //   - 3-6s: bottom-left
      //   - 6-9s: top-right
      //   - 9-12s: bottom-right
      //   - 12-15s: top-left
      const filterComplex = [
        "[0:v]scale='if(gte(iw,ih),min(1280,iw),-2):if(gte(iw,ih),-2,min(1280,ih))'[scaled];",
        "[1:v]scale='iw/4:-1'[wm];",
        "[scaled][wm]overlay=",
        "x='if(lt(mod(t,15),3),W-5*w/4,if(lt(mod(t,15),6),w/4,if(lt(mod(t,15),9),W-5*w/4,if(lt(mod(t,15),12),W-5*w/4,w/4))))':",
        "y='if(lt(mod(t,15),3),(H-h)/2,if(lt(mod(t,15),6),H-3*h/2,if(lt(mod(t,15),9),h/2,if(lt(mod(t,15),12),H-3*h/2,h/2))))'",
      ].join("");

      await ffmpeg.exec([
        "-i",
        "input.mp4",
        "-i",
        "watermark.png",
        "-filter_complex",
        filterComplex,
        "-codec:a",
        "copy",
        "-preset",
        "ultrafast",
        "watermarked.mp4",
      ]);

      // Read the output file
      const data = await ffmpeg.readFile("watermarked.mp4");
      const blob = new Blob([data.buffer], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);

      setOutputVideo(url);
      setProgress("Complete! Download your watermarked video below.");

      // Preview output
      if (outputPreviewRef.current) {
        outputPreviewRef.current.src = url;
      }
    } catch (error) {
      console.error("Error processing video:", error);
      setProgress("Error processing video. Check console for details.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="app">
      <h1>Video Watermarker</h1>
      <p className="subtitle">
        Add Sora watermark to your videos directly in the browser
      </p>

      <div className="status">{progress && <p>{progress}</p>}</div>

      <div className="upload-section">
        <div className="upload-box">
          <h3>Upload Video</h3>
          <input
            type="file"
            accept="video/*"
            onChange={handleVideoUpload}
            disabled={isProcessing}
          />
          {videoFile && (
            <div className="preview">
              <p>Selected: {videoFile.name}</p>
              <video ref={videoPreviewRef} controls width="300" />
            </div>
          )}
        </div>

        <div className="upload-box">
          <h3>Watermark Info</h3>
          <div className="preview">
            <img src="/sora.png" alt="Sora watermark" width="200" />
            <p style={{ marginTop: "1rem" }}>
              Watermark will rotate between corners every 3 seconds
            </p>
            <p style={{ fontSize: "0.9rem", color: "#888" }}>
              Size: 1/4 of video width
            </p>
          </div>
        </div>
      </div>

      <button
        className="process-btn"
        onClick={applyWatermark}
        disabled={!videoFile || isProcessing || !ffmpegLoaded}
      >
        {isProcessing ? "Processing..." : "Apply Watermark"}
      </button>

      {outputVideo && (
        <div className="output-section">
          <h3>Result</h3>
          <video ref={outputPreviewRef} controls width="500" />
          <a
            href={outputVideo}
            download="watermarked-video.mp4"
            className="download-btn"
          >
            Download Watermarked Video
          </a>
        </div>
      )}
    </div>
  );
}

export default App;
