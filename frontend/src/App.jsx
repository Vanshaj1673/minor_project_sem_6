from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import joblib

app = Flask(__name__)
CORS(app)

model = joblib.load('yield_model.pkl')
crop_encoder = joblib.load('crop_encoder.pkl')
soil_encoder = joblib.load('soil_encoder.pkl')

question_flow = [
    ("Crop_Type", "Enter Crop Type (e.g., Wheat, Rice, Corn):"),
    ("Soil_Type", "Enter Soil Type (e.g., Sandy, Loamy, Peaty):"),
    ("Soil_pH", "Enter Soil pH value (e.g., 5.5, 6.2):"),
    ("Temperature", "Enter Temperature (°C):"),
    ("Humidity", "Enter Humidity (%):"),
    ("Wind_Speed", "Enter Wind Speed (km/h):"),
    ("N", "Enter Nitrogen (N) level:"),
    ("P", "Enter Phosphorus (P) level:"),
    ("K", "Enter Potassium (K) level:"),
    ("Soil_Quality", "Enter Soil Quality Score:")
]

user_sessions = {}

@app.route('/chat', methods=['POST'])
def chat():
    user_id = "default"
    data = request.get_json()
    message = data.get("message", "").strip()

    if user_id not in user_sessions:
        user_sessions[user_id] = {"answers": {}, "step": 0, "intro": True}

    session = user_sessions[user_id]

    if session.get("intro"):
        session["intro"] = False
        return jsonify({"reply": "👋 Welcome to the Crop Yield Prediction Chatbot!\nAnswer the following questions to predict crop yield.\n\n" + question_flow[0][1]})

    if session["step"] > 0 and session["step"] <= len(question_flow):
        key, _ = question_flow[session["step"] - 1]
        session["answers"][key] = message

    if session["step"] == len(question_flow):
        try:
            ans = session["answers"]

            if ans["Crop_Type"] not in crop_encoder.classes_:
                session["step"] -= 1
                return jsonify({"reply": "❌ Unknown crop type. Please re-enter a valid crop name:"})
            if ans["Soil_Type"] not in soil_encoder.classes_:
                session["step"] -= 1
                return jsonify({"reply": "❌ Unknown soil type. Please re-enter a valid soil type:"})

            crop = crop_encoder.transform([ans["Crop_Type"]])[0]
            soil = soil_encoder.transform([ans["Soil_Type"]])[0]

            features = [
                crop, soil,
                float(ans["Soil_pH"]),
                float(ans["Temperature"]),
                float(ans["Humidity"]),
                float(ans["Wind_Speed"]),
                float(ans["N"]),
                float(ans["P"]),
                float(ans["K"]),
                float(ans["Soil_Quality"])
            ]

            input_df = pd.DataFrame([features], columns=[
                "Crop_Type", "Soil_Type", "Soil_pH", "Temperature", "Humidity",
                "Wind_Speed", "N", "P", "K", "Soil_Quality"
            ])

            predicted_yield = model.predict(input_df)[0]

            # Prepare bottom 3 crop predictions for same inputs
            all_crops = list(crop_encoder.classes_)
            predictions = []
            for crop_name in all_crops:
                try:
                    encoded_crop = crop_encoder.transform([crop_name])[0]
                    input_df["Crop_Type"] = encoded_crop
                    pred = model.predict(input_df)[0]
                    predictions.append((crop_name, pred))
                except:
                    continue

            bottom3 = sorted(predictions, key=lambda x: x[1])[:3]
            bottom_msg = "\n\nCrops with the Lowest Predicted Yield:\n" + "\n".join(
                [f"- {name}: {round(val, 2)} tons/ha" for name, val in bottom3])

            final_reply = f"✅ Predicted Crop Yield: {round(predicted_yield, 2)} tons per hectare." + bottom_msg

            user_sessions.pop(user_id)
            return jsonify({"reply": final_reply})

        except Exception as e:
            user_sessions.pop(user_id)
            return jsonify({"reply": f"❌ Error during prediction: {str(e)}"})

    _, next_question = question_flow[session["step"]]
    session["step"] += 1
    return jsonify({"reply": next_question})

@app.route('/')
def home():
    return "✅ Crop Yield Chatbot API is running!"

if __name__ == '__main__':
    app.run(debug=True)
