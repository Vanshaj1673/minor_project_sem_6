from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import pandas as pd
import joblib
from werkzeug.utils import secure_filename

# For chatbot model
import re
import nltk
from nltk.corpus import stopwords
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

# ------------- Flask Setup ----------------
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}

app = Flask(__name__)
CORS(app)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ------------- Helper Function ----------------
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# ------------- Load ML Yield Model ----------------
model = joblib.load('yield_model.pkl')
crop_encoder = joblib.load('crop_encoder.pkl')
soil_encoder = joblib.load('soil_encoder.pkl')

# ------------- Load & Train Chatbot Model ----------------
nltk.download('stopwords')

def preprocess_text(text):
    text = re.sub(r'\W', ' ', text)
    text = text.lower()
    stop_words = set(stopwords.words('english'))
    return ' '.join([word for word in text.split() if word not in stop_words])

# Load chatbot dataset
df = pd.read_csv(r'../datasets/crop_yield_dataset.csv')
df['symptoms'] = df.iloc[:, 1:].apply(lambda row: ' '.join(row.dropna().astype(str)), axis=1)
df_cleaned = df[[df.columns[0], 'symptoms']].copy()
df_cleaned.columns = ['diagnosis', 'symptoms']
df_cleaned['symptoms'] = df_cleaned['symptoms'].apply(preprocess_text)

# ✅ LIMIT dataset to 1000 rows for memory optimization
df_cleaned = df_cleaned[:1000]

# Train chatbot model
X = df_cleaned['symptoms']
y = df_cleaned['diagnosis']

# ✅ Reduce max_features to 1000 to reduce RAM usage
tfidf_vectorizer = TfidfVectorizer(max_features=1000)
X_tfidf = tfidf_vectorizer.fit_transform(X)
chatbot_model = LogisticRegression()
chatbot_model.fit(X_tfidf, y)

# ------------- Predefined Soil Info ----------------
initial_info = (
    "The soil in this region is rich in nitrogen and potassium, ideal for wheat and barley. "
    "Ensure the pH remains between 6.0 and 7.5 for optimal crop yield. Regular composting and "
    "monitoring of micronutrients like zinc and magnesium is also recommended."
)

# ------------- Predict Yield ----------------
@app.route('/predict_yield', methods=['POST'])
def predict_yield():
    data = request.json
    try:
        crop = data['Crop_Type']
        soil = data['Soil_Type']

        crop_encoded = crop_encoder.transform([crop])[0]
        soil_encoded = soil_encoder.transform([soil])[0]

        input_features = [
            crop_encoded,
            soil_encoded,
            data['Soil_pH'],
            data['Temperature'],
            data['Humidity'],
            data['Wind_Speed'],
            data['N'],
            data['P'],
            data['K'],
            data['Soil_Quality']
        ]

        input_df = pd.DataFrame([input_features], columns=[
            "Crop_Type", "Soil_Type", "Soil_pH", "Temperature", "Humidity",
            "Wind_Speed", "N", "P", "K", "Soil_Quality"
        ])

        prediction = model.predict(input_df)[0]
        return jsonify({'predicted_yield': round(float(prediction), 2)})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ------------- Chatbot Endpoint ----------------
@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        user_input = data.get('message', '')

        if not user_input:
            return jsonify({'error': 'Please provide a question.'}), 400

        if user_input.strip().lower() in ["soil info", "soil content", "initial", "start"]:
            return jsonify({'reply': initial_info})

        cleaned = preprocess_text(user_input)
        vector = tfidf_vectorizer.transform([cleaned])
        prediction = chatbot_model.predict(vector)

        return jsonify({'reply': f"{prediction[0]}"})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ------------- Image Upload ----------------
@app.route('/upload', methods=['POST'])
def upload_image():
    if 'image' not in request.files:
        return jsonify({'error': 'No image part'}), 400
    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(path)
        return jsonify({'message': 'Image uploaded successfully.', 'filepath': path}), 200
    else:
        return jsonify({'error': 'Invalid file type'}), 400

# ------------- Home ----------------
@app.route('/')
def home():
    return "✅ Crop Yield + Chatbot API is running!"

# ------------- Run Server ----------------
if __name__ == '__main__':
    app.run(debug=True)
