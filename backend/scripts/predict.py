import sys
import json
import joblib
from pathlib import Path
import warnings

def main():
    warnings.filterwarnings("ignore")
    try:
        # Read JSON string from argument
        input_data = json.loads(sys.argv[1])
        
        # Load model and scaler
        models_dir = Path(__file__).resolve().parent.parent / 'models'
        rf_model = joblib.load(models_dir / 'crop_predictor_rf.pkl')
        scaler = joblib.load(models_dir / 'crop_scaler.pkl')
        
        # Prepare feature vector ['Soil_pH', 'Soil_Moisture', 'Temperature_C', 'Rainfall_mm']
        features = [[
            input_data['ph'], 
            input_data['moisture'], 
            input_data['temperature'], 
            input_data['rainfall']
        ]]
        
        # Scale and predict
        features_scaled = scaler.transform(features)
        prediction = rf_model.predict(features_scaled)[0]
        
        # Output prediction as JSON
        print(json.dumps({'success': True, 'prediction': prediction}))
        
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))

if __name__ == "__main__":
    main()
