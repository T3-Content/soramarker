import { useState, useRef, useEffect } from 'react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import './App.css'

function App() {
  const [videoFile, setVideoFile] = useState(null)
  const [watermarkFile, setWatermarkFile] = useState(null)
  const [outputVideo, setOutputVideo] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState('')
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false)

  const ffmpegRef = useRef(new FFmpeg())
  const videoPreviewRef = useRef(null)
  const outputPreviewRef = useRef(null)

  // Load FFmpeg
  useEffect(() => {
    const loadFFmpeg = async () => {
      const ffmpeg = ffmpegRef.current

      ffmpeg.on('log', ({ message }) => {
        console.log(message)
      })

      ffmpeg.on('progress', ({ progress: prog, time }) => {
        setProgress(`Processing: ${Math.round(prog * 100)}%`)
      })

      try {
        const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm'
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        })
        setFfmpegLoaded(true)
        setProgress('FFmpeg loaded successfully')
      } catch (error) {
        console.error('Failed to load FFmpeg:', error)
        setProgress(`Failed to load FFmpeg: ${error.message}`)
      }
    }

    loadFFmpeg()
  }, [])

  const handleVideoUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      setVideoFile(file)
      setOutputVideo(null)

      // Preview video
      if (videoPreviewRef.current) {
        videoPreviewRef.current.src = URL.createObjectURL(file)
      }
    }
  }

  const handleWatermarkUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      setWatermarkFile(file)
    }
  }

  const applyWatermark = async () => {
    if (!videoFile || !watermarkFile || !ffmpegLoaded) {
      alert('Please upload both video and watermark files')
      return
    }

    setIsProcessing(true)
    setProgress('Starting...')

    try {
      const ffmpeg = ffmpegRef.current

      // Write files to FFmpeg's virtual file system
      await ffmpeg.writeFile('input.mp4', await fetchFile(videoFile))
      await ffmpeg.writeFile('watermark.png', await fetchFile(watermarkFile))

      // Apply watermark (positioned in top-right corner with 10px margin)
      // You can customize the position by changing the overlay parameter
      // overlay=W-w-10:10 means: (video_width - watermark_width - 10px):(10px from top)
      await ffmpeg.exec([
        '-i', 'input.mp4',
        '-i', 'watermark.png',
        '-filter_complex', 'overlay=W-w-10:10',
        '-codec:a', 'copy',
        'output.mp4'
      ])

      // Read the output file
      const data = await ffmpeg.readFile('output.mp4')
      const blob = new Blob([data.buffer], { type: 'video/mp4' })
      const url = URL.createObjectURL(blob)

      setOutputVideo(url)
      setProgress('Complete! Download your watermarked video below.')

      // Preview output
      if (outputPreviewRef.current) {
        outputPreviewRef.current.src = url
      }
    } catch (error) {
      console.error('Error processing video:', error)
      setProgress('Error processing video. Check console for details.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="app">
      <h1>Video Watermarker</h1>
      <p className="subtitle">Add watermarks to your videos directly in the browser</p>

      <div className="status">
        {progress && <p>{progress}</p>}
      </div>

      <div className="upload-section">
        <div className="upload-box">
          <h3>1. Upload Video</h3>
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
          <h3>2. Upload Watermark (PNG/Image)</h3>
          <input
            type="file"
            accept="image/*"
            onChange={handleWatermarkUpload}
            disabled={isProcessing}
          />
          {watermarkFile && (
            <div className="preview">
              <p>Selected: {watermarkFile.name}</p>
              <img src={URL.createObjectURL(watermarkFile)} alt="Watermark preview" width="150" />
            </div>
          )}
        </div>
      </div>

      <button
        className="process-btn"
        onClick={applyWatermark}
        disabled={!videoFile || !watermarkFile || isProcessing || !ffmpegLoaded}
      >
        {isProcessing ? 'Processing...' : '3. Apply Watermark'}
      </button>

      {outputVideo && (
        <div className="output-section">
          <h3>Result</h3>
          <video ref={outputPreviewRef} controls width="500" />
          <a href={outputVideo} download="watermarked-video.mp4" className="download-btn">
            Download Watermarked Video
          </a>
        </div>
      )}
    </div>
  )
}

export default App
