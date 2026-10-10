import pandas as pd
import numpy as np
import os
import joblib
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, accuracy_score

def main():
    print("Loading dataset...")
    dataset_path = Path(__file__).resolve().parent.parent / 'datasets' / 'farmer_advisor_dataset.csv'
    df = pd.read_csv(dataset_path)
    
    # We want to predict 'Crop_Type' based on soil and weather parameters
    print("Preparing data...")
    # Select features
    features = ['Soil_pH', 'Soil_Moisture', 'Temperature_C', 'Rainfall_mm']
    target = 'Crop_Type'
    
    # Handle missing values if any
    df = df.dropna(subset=features + [target])
    
    X = df[features]
    y = df[target]
    
    print(f"Total samples: {len(X)}")
    print(f"Target classes: {y.unique()}")
    
    # Split into train and test
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    # Scale features
    print("Scaling features...")
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Train the Random Forest model
    print("Training RandomForestClassifier...")
    rf_model = RandomForestClassifier(n_estimators=100, random_state=42)
    rf_model.fit(X_train_scaled, y_train)
    
    # Evaluate
    print("Evaluating model...")
    y_pred = rf_model.predict(X_test_scaled)
    acc = accuracy_score(y_test, y_pred)
    print(f"\nAccuracy: {acc:.4f}\n")
    print("Classification Report:")
    print(classification_report(y_test, y_pred))
    
    # Save the model and scaler
    model_dir = Path(__file__).resolve().parent.parent / 'backend' / 'models'
    os.makedirs(model_dir, exist_ok=True)
    
    model_path = os.path.join(model_dir, 'crop_predictor_rf.pkl')
    scaler_path = os.path.join(model_dir, 'crop_scaler.pkl')
    
    joblib.dump(rf_model, model_path)
    joblib.dump(scaler, scaler_path)
    
    print(f"Model saved to: {model_path}")
    print(f"Scaler saved to: {scaler_path}")

if __name__ == '__main__':
    main()
