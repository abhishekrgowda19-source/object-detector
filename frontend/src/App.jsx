// frontend/src/App.jsx
import React, { useState, useRef, useEffect } from "react";

export default function App() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [detections, setDetections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [conf, setConf] = useState(0.25); // confidence threshold
  const [useServerImage, setUseServerImage] = useState(true); // return annotated image from server
  const canvasRef = useRef(null);
  const imgRef = useRef(null);

  useEffect(() => {
    return () => {
      // revoke preview on unmount
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const onFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
    setDetections([]);
  };

  const handleDetect = async () => {
    if (!file) {
      alert("Choose an image first");
      return;
    }
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("conf", conf.toString());
    formData.append("return_image", useServerImage ? "1" : "0");

    try {
      const res = await fetch("http://127.0.0.1:5000/detect", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Server error: " + res.status);
      }

      if (useServerImage) {
        // server returned annotated image PNG
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        // fetch detections by running same request without return_image, or backend can include detections in headers
        // simpler: call detect again for JSON result (or build API to return both)
        // here, we'll request JSON separately:
        const jsonRes = await fetch("http://127.0.0.1:5000/detect", {
          method: "POST",
          body: formData, // note: re-sending same formData may not work after consumed; recreate
        });
        const json = await jsonRes.json();
        setDetections(json.detections || []);
      } else {
        // server returned JSON directly
        const json = await res.json();
        setDetections(json.detections || []);
      }
    } catch (err) {
      console.error(err);
      alert("Error connecting to backend: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // draw boxes on canvas if backend returned raw JSON and we want client overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || detections.length === 0) {
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }
    // set canvas dims to displayed image size
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // draw image underneath
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // scale factors (server coords are in original image pixels)
    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    const scaleX = canvas.width / naturalW;
    const scaleY = canvas.height / naturalH;
    ctx.lineWidth = 3;
    ctx.font = "16px Arial";
    detections.forEach((d) => {
      const [x1, y1, x2, y2] = d.bbox;
      const sx = x1 * scaleX;
      const sy = y1 * scaleY;
      const sw = (x2 - x1) * scaleX;
      const sh = (y2 - y1) * scaleY;
      ctx.strokeStyle = "lime";
      ctx.strokeRect(sx, sy, sw, sh);
      const labelText = `${d.label} ${d.confidence.toFixed(1)}%`;
      const textW = ctx.measureText(labelText).width;
      ctx.fillStyle = "lime";
      ctx.fillRect(sx, sy - 20, textW + 8, 20);
      ctx.fillStyle = "black";
      ctx.fillText(labelText, sx + 4, sy - 4);
    });
  }, [detections, previewUrl]);

  return (
    <div style={{ textAlign: "center", padding: 20 }}>
      <h2>Object Detection — YOLOv8</h2>

      <div style={{ margin: "16px 0" }}>
        <input type="file" accept="image/*" onChange={onFileChange} />
        <button onClick={handleDetect} style={{ marginLeft: 10 }}>
          {loading ? "Detecting..." : "Detect Objects"}
        </button>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label>
          Confidence: {Math.round(conf * 100)}%
          <input
            type="range"
            min="0.05"
            max="0.9"
            step="0.05"
            value={conf}
            onChange={(e) => setConf(parseFloat(e.target.value))}
            style={{ marginLeft: 8 }}
          />
        </label>
        <label style={{ marginLeft: 16 }}>
          <input
            type="checkbox"
            checked={useServerImage}
            onChange={(e) => setUseServerImage(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          Server-annotated image
        </label>
      </div>

      <div style={{ position: "relative", display: "inline-block" }}>
        {previewUrl && !useServerImage && (
          <>
            <img
              ref={imgRef}
              src={previewUrl}
              alt="preview"
              style={{ maxWidth: "600px", display: "block" }}
            />
            <canvas
              ref={canvasRef}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                pointerEvents: "none",
              }}
            />
          </>
        )}

        {previewUrl && useServerImage && (
          <img
            src={previewUrl}
            alt="server annotated"
            style={{ maxWidth: "600px", display: "block" }}
          />
        )}
      </div>

      {detections.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h3>Detections</h3>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {detections.map((d, i) => (
              <li key={i}>
                {d.label} — {d.confidence.toFixed(2)}%
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
