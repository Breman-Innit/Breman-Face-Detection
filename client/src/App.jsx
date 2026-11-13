import { useEffect, useRef, useState } from 'react'
import './App.css'

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const MAX_FILE_SIZE = 10 * 1024 * 1024

function Icon({ name, size = 20 }) {
  const paths = {
    arrow: <path d="M5 12h13m-6-6 6 6-6 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></>,
    spark: <><path d="m12 3 1.2 4.8L18 9l-4.8 1.2L12 15l-1.2-4.8L6 9l4.8-1.2L12 3Z" /><path d="m19 15 .6 2.4L22 18l-2.4.6L19 21l-.6-2.4L16 18l2.4-.6L19 15Z" /></>,
    upload: <><path d="M12 16V4m0 0L7 9m5-5 5 5" /><path d="M5 15v4h14v-4" /></>,
  }
  return <svg aria-hidden="true" className="icon" fill="none" height={size} viewBox="0 0 24 24" width={size}>{paths[name]}</svg>
}

function Header() {
  return <header className="site-header">
    <a className="wordmark" href="/" aria-label="Breman Face Detection home"><span className="wordmark-mark"><span /></span><span>Breman</span></a>
    <div className="header-status"><span className="status-dot" /><span>Private detection workspace</span></div>
  </header>
}

function UploadPanel({ file, isDragging, onDrop, onBrowse, onDragEnter, onDragLeave }) {
  return <div className={`upload-panel ${isDragging ? 'is-dragging' : ''} ${file ? 'has-file' : ''}`} onClick={onBrowse} onDragEnter={onDragEnter} onDragLeave={onDragLeave} onDragOver={(event) => event.preventDefault()} onDrop={onDrop} role="button" tabIndex="0" onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onBrowse() }}>
    <div className="upload-icon"><Icon name={file ? 'image' : 'upload'} size={22} /></div>
    <div className="upload-copy"><strong>{file ? file.name : 'Drop an image here'}</strong><span>{file ? formatFileSize(file.size) : 'or click to browse from your device'}</span></div>
    <span className="upload-action">{file ? 'Change' : 'Choose image'} <Icon name="arrow" size={16} /></span>
  </div>
}

function Settings({ confidence, imageSize, onConfidenceChange, onImageSizeChange }) {
  return <div className="settings-row">
    <label><span>Confidence</span><select value={confidence} onChange={(event) => onConfidenceChange(event.target.value)}><option value="0.15">15% · Sensitive</option><option value="0.25">25% · Balanced</option><option value="0.5">50% · Precise</option><option value="0.75">75% · Strict</option></select></label>
    <label><span>Image size</span><select value={imageSize} onChange={(event) => onImageSizeChange(event.target.value)}><option value="640">640 px</option><option value="1024">1024 px</option><option value="1280">1280 px</option></select></label>
  </div>
}

function Preview({ file, previewUrl, detections, imageDimensions, onRemove }) {
  return <div className="preview-card">
    <div className="preview-heading"><div><span className="eyebrow">Image preview</span><p>{file.name}</p></div><button className="icon-button" onClick={onRemove} type="button" aria-label="Remove image"><Icon name="close" size={18} /></button></div>
    <div className="image-stage">
      <img src={previewUrl} alt="Selected image for face detection" />
      {imageDimensions.width > 0 && detections.map((detection, index) => <div className="bounding-box" key={`${detection.x1}-${detection.y1}-${index}`} style={{ left: `${(detection.x1 / imageDimensions.width) * 100}%`, top: `${(detection.y1 / imageDimensions.height) * 100}%`, width: `${((detection.x2 - detection.x1) / imageDimensions.width) * 100}%`, height: `${((detection.y2 - detection.y1) / imageDimensions.height) * 100}%` }}><span>{detection.name || `Detection ${String(index + 1).padStart(2, '0')}`}</span></div>)}
    </div>
    {detections.length > 0 && <div className="detection-summary"><span className="summary-check"><Icon name="check" size={15} /></span><span>{detections.length} {detections.length === 1 ? 'face' : 'faces'} detected</span><span className="summary-divider" /><span>{detections.some((detection) => detection.confidence !== null) ? 'Confidence available' : 'Coordinates available'}</span></div>}
  </div>
}

function ResultPanel({ file, status, detections, error, onReset }) {
  if (!file) return <aside className="result-panel empty-result"><div className="result-number">02</div><div className="result-copy"><span className="eyebrow">Results</span><h2>Your results<br /><em>appear here.</em></h2><p>Upload an image and run detection to see the model output overlaid on your image.</p></div><div className="result-line" /></aside>
  return <aside className={`result-panel result-${status}`}>
    <div className="result-number">02</div><div className="result-copy"><span className="eyebrow">Results</span>
      {status === 'loading' && <><h2>Reading the<br /><em>image.</em></h2><p className="loading-copy"><span className="loading-bar" />Comparing features against your model</p></>}
      {status === 'error' && <><h2>Something went<br /><em>off course.</em></h2><p>{error}</p><button className="text-button" onClick={onReset} type="button">Try another image <Icon name="arrow" size={16} /></button></>}
      {status === 'success' && detections.length > 0 && <><h2>{detections.length} {detections.length === 1 ? 'face' : 'faces'}<br /><em>found.</em></h2><p>The returned detections are marked directly on the image preview.</p><div className="result-list">{detections.map((detection, index) => <div className="result-list-item" key={`${detection.x1}-${index}`}><span>Detection {String(index + 1).padStart(2, '0')}</span><strong>{detection.confidence !== null ? `${Math.round(detection.confidence * 100)}% confidence` : 'Confidence unavailable'}</strong></div>)}</div></>}
      {status === 'success' && detections.length === 0 && <><h2>No face<br /><em>detected.</em></h2><p>We couldn’t find a target face in this image. Try a clearer, front-facing photo.</p><button className="text-button" onClick={onReset} type="button">Try another image <Icon name="arrow" size={16} /></button></>}
    </div>
  </aside>
}

function App() {
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 })
  const [detections, setDetections] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [confidence, setConfidence] = useState('0.25')
  const [imageSize, setImageSize] = useState('640')

  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl])

  function selectFile(nextFile) {
    if (!nextFile) return
    if (!nextFile.type.startsWith('image/')) { setError('Please choose an image file such as JPG, PNG, or WEBP.'); setStatus('error'); return }
    if (nextFile.size > MAX_FILE_SIZE) { setError('That image is larger than 10 MB. Please choose a smaller file.'); setStatus('error'); return }
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(nextFile); setPreviewUrl(URL.createObjectURL(nextFile)); setDetections([]); setImageDimensions({ width: 0, height: 0 }); setStatus('idle'); setError('')
  }

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(null); setPreviewUrl(''); setDetections([]); setImageDimensions({ width: 0, height: 0 }); setStatus('idle'); setError('')
    if (inputRef.current) inputRef.current.value = ''
  }

  async function detectFace() {
    if (!file) return
    setStatus('loading'); setError('')
    try {
      if (!API_URL) throw new Error('VITE_API_URL is not configured for this frontend deployment.')
      const formData = new FormData(); formData.append('image', file); formData.append('confidence', confidence); formData.append('imgsz', imageSize)
      const response = await fetch(`${API_URL}/api/detect`, { method: 'POST', body: formData }); const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.success) throw new Error(data.error || 'The detection request could not be completed.')
      setDetections(extractDetections(data.predictions)); setStatus('success')
    } catch (requestError) {
      const message = requestError instanceof TypeError && requestError.message === 'Failed to fetch'
        ? 'Unable to connect to the detection server. Start the Express server with “npm start” in the server folder.'
        : requestError.message || 'Unable to reach the detection service.'
      setError(message)
      setStatus('error')
    }
  }

  return <div className="app-shell"><Header /><main>
    <section className="intro-section"><div className="section-number">01</div><div className="intro-copy"><span className="eyebrow">Personalised computer vision</span><h1>See the faces<br /><em>that matter.</em></h1><p>Upload an image and let your trained model identify the faces it knows best.</p></div><div className="intro-note"><span>Built for</span><strong>Focused detection</strong></div></section>
    <section className="workspace-grid"><div className="input-panel"><div className="panel-heading"><span className="eyebrow">01 / Upload</span><span className="format-note">JPG, PNG, WEBP · 10 MB max</span></div><UploadPanel file={file} isDragging={isDragging} onBrowse={() => inputRef.current?.click()} onDragEnter={(event) => { event.preventDefault(); setIsDragging(true) }} onDragLeave={(event) => { event.preventDefault(); setIsDragging(false) }} onDrop={(event) => { event.preventDefault(); setIsDragging(false); selectFile(event.dataTransfer.files[0]) }} /><input ref={inputRef} accept="image/*" className="visually-hidden" onChange={(event) => selectFile(event.target.files[0])} type="file" /><Settings confidence={confidence} imageSize={imageSize} onConfidenceChange={setConfidence} onImageSizeChange={setImageSize} /><button className="detect-button" disabled={!file || status === 'loading'} onClick={detectFace} type="button"><span>{status === 'loading' ? 'Analysing image' : 'Run face detection'}</span><span className="button-arrow"><Icon name={status === 'loading' ? 'spark' : 'arrow'} size={18} /></span></button>{status === 'error' && <p className="inline-error">{error}</p>}<p className="privacy-note"><Icon name="check" size={14} /> Images are sent securely for analysis and are not stored here.</p></div><ResultPanel file={file} status={status} detections={detections} error={error} onReset={reset} /></section>
    {file && <section className="preview-section"><div className="preview-section-heading"><span className="eyebrow">02 / Inspect</span><span>{status === 'success' ? 'Detection complete' : 'Live image canvas'}</span></div><Preview file={file} previewUrl={previewUrl} detections={detections} imageDimensions={imageDimensions} onRemove={reset} /><img className="dimension-loader" src={previewUrl} alt="" onLoad={(event) => setImageDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} /></section>}
  </main><footer><span>Breman Face Detection</span><span>Private workspace <i /></span></footer></div>
}

function formatFileSize(bytes) { return `${(bytes / (1024 * 1024)).toFixed(2)} MB selected` }

function extractDetections(payload) {
  const candidates = []; const visited = new Set()
  function walk(value) {
    if (!value || typeof value !== 'object' || visited.has(value)) return
    visited.add(value)
    if (Array.isArray(value)) { value.forEach(walk); return }
    const box = value.box || value.bbox || value; const coordinates = getCoordinates(box)
    if (coordinates) { candidates.push({ ...coordinates, confidence: getConfidence(value, box), name: getName(value, box) }); return }
    Object.values(value).forEach(walk)
  }
  walk(payload); return candidates
}

function getCoordinates(box) {
  if (hasNumbers(box, ['x1', 'y1', 'x2', 'y2'])) return { x1: Number(box.x1), y1: Number(box.y1), x2: Number(box.x2), y2: Number(box.y2) }
  if (Array.isArray(box.xyxy) && box.xyxy.length >= 4) return arrayCoordinates(box.xyxy)
  if (Array.isArray(box) && box.length >= 4) return arrayCoordinates(box)
  if (hasNumbers(box, ['x', 'y', 'width', 'height'])) return { x1: Number(box.x), y1: Number(box.y), x2: Number(box.x) + Number(box.width), y2: Number(box.y) + Number(box.height) }
  return null
}
function arrayCoordinates(values) { const [x1, y1, x2, y2] = values.map(Number); return [x1, y1, x2, y2].every(Number.isFinite) ? { x1, y1, x2, y2 } : null }
function hasNumbers(value, keys) { return value && keys.every((key) => Number.isFinite(Number(value[key]))) }
function getConfidence(value, box) { const number = Number(value.confidence ?? value.conf ?? box.confidence ?? box.conf); return Number.isFinite(number) ? number : null }
function getName(value, box) { const candidate = value.name ?? value.className ?? value.label ?? box.name ?? box.className ?? box.label; return typeof candidate === 'string' && candidate.trim() ? candidate : null }

export default App
