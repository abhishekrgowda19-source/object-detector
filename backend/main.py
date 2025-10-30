from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO
import os
from PIL import Image

app = Flask(__name__)
CORS(app)

# Load YOLO model (downloads automatically first time)
model = YOLO("yolov8n.pt")

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route("/detect", methods=["POST"])
def detect_objects():
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    file = request.files["image"]
    file_path = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(file_path)

    # Run YOLO inference
    results = model(file_path)

    # Extract object names
    detected_objects = []
    for result in results:
        for box in result.boxes:
            cls_id = int(box.cls[0])
            detected_objects.append(model.names[cls_id])

    # Return unique object names + count
    return jsonify({
        "count": len(detected_objects),
        "objects": list(set(detected_objects))
    })

if __name__ == "__main__":
    app.run(port=5000)
