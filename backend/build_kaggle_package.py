import os
import zipfile
import pandas as pd
from pathlib import Path

def main():
    print("Building Kaggle Package...")
    manifest_path = "backend/data/processed/mixed_training/model_b_manifest.csv"
    zip_path = "backend/kaggle_model_b_training.zip"
    
    df = pd.read_csv(manifest_path)
    
    # We need to zip up:
    # 1. The manifest
    # 2. All files referenced in the manifest
    # 3. Training script
    # 4. Old checkpoint (if it exists)
    
    files_to_zip = set()
    files_to_zip.add(manifest_path)
    
    qr4_count = 0
    karthik_count = 0
    missing_files = []
    
    train_count = len(df[df['split'] == 'train'])
    val_count = len(df[df['split'] == 'val'])
    test_count = len(df[df['split'] == 'test'])
    
    for path in df['path']:
        if os.path.exists(path):
            files_to_zip.add(path)
            if 'qr4change' in path:
                qr4_count += 1
            elif 'karthik' in path:
                karthik_count += 1
        else:
            missing_files.append(path)
            
    print(f"Manifest counts -> Train: {train_count}, Val: {val_count}, Test: {test_count}")
    print(f"QR4Change: {qr4_count}, Karthik: {karthik_count}")
    
    if missing_files:
        print(f"ERROR: {len(missing_files)} missing files! First 5: {missing_files[:5]}")
        return
        
    # Write a simple training script to be included
    script_path = "backend/train_model_b_kaggle.py"
    script_code = """
import torch
import torch.nn as nn
import torch.optim as optim
import pandas as pd
from torchvision import models

# Placeholder for Kaggle training script
print("Training Model B on Kaggle...")
"""
    with open(script_path, "w") as f:
        f.write(script_code)
    files_to_zip.add(script_path)
    
    ckpt_path = "backend/data/models/resnet50_pothole_finetuned_layer4.pth"
    if os.path.exists(ckpt_path):
        files_to_zip.add(ckpt_path)
        
    print(f"Total files to zip: {len(files_to_zip)}")
    
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for f in files_to_zip:
            zf.write(f, arcname=f)
            
    size_mb = os.path.getsize(zip_path) / (1024 * 1024)
    print(f"Created {zip_path} ({size_mb:.2f} MB)")
    
    # Write Manifest
    report = f"""# Kaggle Model B Package Manifest

- **ZIP Size**: {size_mb:.2f} MB
- **Total Images**: {qr4_count + karthik_count}
- **QR4Change Images**: {qr4_count}
- **Karthik Images**: {karthik_count}
- **External 596 Images Included**: NO
- **Old Model Checkpoint Included**: {'YES' if os.path.exists(ckpt_path) else 'NO'}

## Splits
- **Train**: {train_count}
- **Validation**: {val_count}
- **Test (Internal)**: {test_count}
"""
    with open("backend/data/metadata/KAGGLE_MODEL_B_PACKAGE_MANIFEST.md", "w") as f:
        f.write(report)
        
if __name__ == "__main__":
    main()
