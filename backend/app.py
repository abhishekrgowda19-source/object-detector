from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from ultralytics import YOLO

app = Flask(__name__)
CORS(app)

# Load YOLOv8 model
model = YOLO("yolov8n.pt")

@app.route("/", methods=["GET"])
def home():
    return jsonify({"message": "Backend is running! Use POST /detect to analyze images."})

@app.route("/detect", methods=["POST"])
def detect_objects():
    try:
        if "image" not in request.files:
            return jsonify({"error": "No image uploaded"}), 400

        file = request.files["image"]

        # Create upload folder if it doesn't exist
        os.makedirs("uploads", exist_ok=True)
        image_path = os.path.join("uploads", file.filename)
        file.save(image_path)

        # Run YOLOv8 detection
        results = model(image_path)
        detections = []

        for result in results:
            for box in result.boxes:
                cls = model.names[int(box.cls)]
                conf = float(box.conf)
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                detections.append({
                    "label": cls,
                    "confidence": round(conf * 100, 2),
                    "bbox": [x1, y1, x2, y2]
                })

        return jsonify({"detections": detections})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)
