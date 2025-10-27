import { useState } from "react";
import type { ChangeEvent } from "react";
import {
  Input,
  Output,
  Conversion,
  BufferTarget,
  Mp4OutputFormat,
  BlobSource,
  ALL_FORMATS,
} from "mediabunny";

function App() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [outputVideo, setOutputVideo] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);

  const handleVideoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setVideoFile(file);
    setShowResultDialog(false);
    if (outputVideo) {
      URL.revokeObjectURL(outputVideo);
      setOutputVideo(null);
    }
    setStatus("Clip loaded. Ready when you are.");
  };

  const applyWatermark = async () => {
    if (!videoFile) {
      alert("Please upload a video file");
      return;
    }

    setIsProcessing(true);
    setStatus("Rendering watermark…");

    try {
      // Load watermark image
      const watermarkImage = new Image();
      watermarkImage.src = "/sora.png";
      await new Promise<void>((resolve) => {
        watermarkImage.onload = () => resolve();
      });

      // Create input from file
      const input = new Input({
        formats: ALL_FORMATS,
        source: new BlobSource(videoFile),
      });

      // Create output with buffer target
      const output = new Output({
        format: new Mp4OutputFormat(),
        target: new BufferTarget(),
      });

      // Create canvas context for watermark compositing
      let ctx: OffscreenCanvasRenderingContext2D | null = null;

      const conversion = await Conversion.init({
        input,
        output,
        video: {
          process: (sample) => {
            if (!ctx) {
              // Create canvas for compositing
              const canvas = new OffscreenCanvas(
                sample.displayWidth,
                sample.displayHeight
              );
              ctx = canvas.getContext("2d");
              if (!ctx) {
                throw new Error("Failed to get 2d context");
              }
            }

            // Clear canvas
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

            // Draw original video frame
            sample.draw(ctx, 0, 0);

            // Calculate watermark size (25% of video width)
            const wmWidth = ctx.canvas.width / 4;
            const wmHeight =
              (watermarkImage.height / watermarkImage.width) * wmWidth;

            // Get current timestamp in seconds
            const t = sample.timestamp;

            // Calculate position based on animation (15 second cycle)
            const cycle = t % 15;
            let x: number, y: number;

            if (cycle < 3) {
              // Bottom-right: x = W - 5*w/4, y = (H-h)/2
              x = ctx.canvas.width - (5 * wmWidth) / 4;
              y = (ctx.canvas.height - wmHeight) / 2;
            } else if (cycle < 6) {
              // Bottom-left: x = w/4, y = H - 3*h/2
              x = wmWidth / 4;
              y = ctx.canvas.height - (3 * wmHeight) / 2;
            } else if (cycle < 9) {
              // Top-right: x = W - 5*w/4, y = h/2
              x = ctx.canvas.width - (5 * wmWidth) / 4;
              y = wmHeight / 2;
            } else if (cycle < 12) {
              // Top-right (different y): x = W - 5*w/4, y = H - 3*h/2
              x = ctx.canvas.width - (5 * wmWidth) / 4;
              y = ctx.canvas.height - (3 * wmHeight) / 2;
            } else {
              // Bottom-left (different y): x = w/4, y = h/2
              x = wmWidth / 4;
              y = wmHeight / 2;
            }

            // Draw watermark
            ctx.drawImage(watermarkImage, x, y, wmWidth, wmHeight);

            return ctx.canvas;
          },
        },
      });

      // Execute conversion
      await conversion.execute();

      // Get result buffer
      const resultBuffer = output.target.buffer;
      if (!resultBuffer) {
        throw new Error("Failed to get result buffer");
      }
      const blob = new Blob([resultBuffer], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);

      setOutputVideo(url);
      setStatus("Complete! Download your watermarked video.");
      setShowResultDialog(true);
    } catch (error) {
      console.error("Error processing video:", error);
      setStatus("Error processing video. Check console for details.");
    } finally {
      setIsProcessing(false);
    }
  };

  const resetSession = () => {
    if (outputVideo) {
      URL.revokeObjectURL(outputVideo);
    }
    setVideoFile(null);
    setOutputVideo(null);
    setShowResultDialog(false);
    setStatus(null);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[-140px] top-[-120px] h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute right-[-180px] top-1/2 h-[20rem] w-[20rem] rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-6 pb-16 pt-14">
        <header className="text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-[2.75rem]">
            Sora Watermarker
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-400 sm:text-base">
            Add the Sora watermark to any video.
          </p>
        </header>

        <main className="mt-12 flex-1">
          <section className="flex flex-col gap-8 rounded-3xl border border-slate-900/70 bg-slate-950/60 p-10 shadow-[0_20px_70px_-60px_rgba(56,189,248,0.9)] backdrop-blur-sm">
            <div className="space-y-3 text-left">
              <h2 className="text-lg font-medium text-white">
                Upload your footage
              </h2>
              <p className="text-sm text-slate-400">
                Supports MP4 and MOV. Powered by Mediabunny for fast processing.
              </p>
            </div>

            <label className="group relative block cursor-pointer overflow-hidden rounded-2xl border border-dashed border-slate-800 bg-slate-950/80 p-8 transition hover:border-sky-500/60">
              <input
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                disabled={isProcessing}
                className="sr-only"
              />
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-slate-800 bg-slate-900/60 text-slate-400 transition group-hover:border-sky-500/50 group-hover:text-sky-300">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="h-7 w-7"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 16V7m0 0-3 3m3-3 3 3"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 19h14"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    {videoFile ? "Replace video" : "Drop or browse your video"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {videoFile ? videoFile.name : "We keep it on-device"}
                  </p>
                </div>
              </div>
            </label>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex-1 min-w-0 truncate text-sm text-slate-500">
                {status ||
                  (videoFile
                    ? "Ready to watermark."
                    : "Upload a clip to enable watermarking.")}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={applyWatermark}
                  disabled={!videoFile || isProcessing}
                  className="inline-flex items-center justify-center rounded-md bg-sky-500 px-5 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isProcessing ? "Processing…" : "Apply Sora watermark"}
                </button>
                {outputVideo && (
                  <a
                    href={outputVideo}
                    download="watermarked-video.mp4"
                    className="inline-flex items-center justify-center rounded-md border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:text-white"
                  >
                    Download
                  </a>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={resetSession}
                disabled={isProcessing && !outputVideo}
                className="text-xs font-medium text-slate-500 transition hover:text-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reset session
              </button>
            </div>
          </section>
        </main>

        <footer className="mt-16 flex justify-center">
          <a
            href="https://github.com/T3-Content/soramarker"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-300"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.183 5.183 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
              <path d="M9 18c-4.51 2-5-2-7-2" />
            </svg>
            GitHub
          </a>
        </footer>
      </div>

      {outputVideo && showResultDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-6 backdrop-blur-sm">
          <div className="relative w-full max-w-3xl rounded-3xl border border-slate-900 bg-slate-950/90 p-6 shadow-2xl">
            <button
              type="button"
              aria-label="Close result"
              onClick={() => setShowResultDialog(false)}
              className="absolute right-6 top-6 text-slate-500 transition hover:text-slate-200"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-5 w-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m6 6 12 12M18 6 6 18"
                />
              </svg>
            </button>

            <div className="space-y-4 pr-6">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Watermarked result
                </h3>
                <p className="text-sm text-slate-400">
                  Preview your render, then download instantly.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-900/70 bg-black/50 p-3">
                <video
                  key={outputVideo}
                  src={outputVideo}
                  controls
                  className="h-full w-full max-h-[420px] rounded-xl border border-slate-900/80 bg-black object-contain"
                />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs font-medium uppercase tracking-[0.3em] text-slate-500">
                  Ready to ship
                </span>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <a
                    href={outputVideo}
                    download="watermarked-video.mp4"
                    className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-sky-400 via-sky-500 to-indigo-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-sky-500/40 transition hover:from-sky-300 hover:to-indigo-400"
                  >
                    Download watermarked video
                  </a>
                  <button
                    type="button"
                    onClick={() => setShowResultDialog(false)}
                    className="inline-flex items-center justify-center rounded-full border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white"
                  >
                    Keep editing
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
