import os
import json
import pandas as pd
import torch
import torch.nn as nn
from PIL import Image
from torch.utils.data import Dataset, DataLoader
from torchvision import models, transforms
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
    classification_report
)

BASE = "backend/data/external_online/extracted"
MANIFEST = "backend/data/external_online/metadata/external_test_manifest.csv"
CHECKPOINT = "backend/data/models/resnet50_qr4change_karthik_best.pth"

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

df = pd.read_csv(MANIFEST)

# Use ONLY the frozen 596-image manifest.
df = df[df["eligible_for_external_test"].astype(str).str.upper() == "TRUE"].copy()

assert len(df) == 596
assert df["class"].value_counts().to_dict() == {"Plain": 300, "Pothole": 296}

class_to_label = {
    "Plain": 0,
    "Pothole": 1
}

df["label"] = df["class"].map(class_to_label)

def resolve_path(relative_path):
    return os.path.join(
        BASE,
        str(relative_path).replace("\\", "/")
    )

df["resolved_path"] = df["relative_path"].apply(resolve_path)

missing = df[~df["resolved_path"].map(os.path.isfile)]

if len(missing) > 0:
    raise RuntimeError(
        f"Missing {len(missing)} frozen benchmark images. "
        f"First: {missing['resolved_path'].tolist()[:5]}"
    )

print("============================================================")
print("PHASE 6.4 — FROZEN EXTERNAL EVALUATION")
print("============================================================")
print("Device:", device)
print("Frozen manifest rows:", len(df))
print("Plain:", int((df["label"] == 0).sum()))
print("Pothole:", int((df["label"] == 1).sum()))
print("Missing files:", len(missing))

class ExternalDataset(Dataset):
    def __init__(self, frame, transform):
        self.frame = frame.reset_index(drop=True)
        self.transform = transform

    def __len__(self):
        return len(self.frame)

    def __getitem__(self, idx):
        row = self.frame.iloc[idx]
        image = Image.open(row["resolved_path"]).convert("RGB")
        image = self.transform(image)
        return image, int(row["label"])

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        [0.485, 0.456, 0.406],
        [0.229, 0.224, 0.225]
    )
])

dataset = ExternalDataset(df, transform)

loader = DataLoader(
    dataset,
    batch_size=32,
    shuffle=False,
    num_workers=2,
    pin_memory=torch.cuda.is_available()
)

model = models.resnet50(weights=None)
model.fc = nn.Linear(model.fc.in_features, 2)

checkpoint = torch.load(
    CHECKPOINT,
    map_location=device
)

state = checkpoint["model_state_dict"]
model.load_state_dict(state)
model = model.to(device)
model.eval()

y_true = []
y_pred = []
y_prob = []

with torch.no_grad():
    for images, labels in loader:
        images = images.to(device)

        outputs = model(images)
        probabilities = torch.softmax(outputs, dim=1)
        predictions = probabilities.argmax(dim=1)

        y_true.extend(labels.numpy())
        y_pred.extend(predictions.cpu().numpy())
        y_prob.extend(probabilities[:, 1].cpu().numpy())

accuracy = accuracy_score(y_true, y_pred)
precision = precision_score(y_true, y_pred, zero_division=0)
recall = recall_score(y_true, y_pred, zero_division=0)
f1 = f1_score(y_true, y_pred, zero_division=0)
roc_auc = roc_auc_score(y_true, y_prob)

cm = confusion_matrix(y_true, y_pred)

print("\n============================================================")
print("FINAL FROZEN EXTERNAL RESULTS")
print("============================================================")

print(f"Accuracy : {accuracy:.4f}")
print(f"Precision: {precision:.4f}")
print(f"Recall   : {recall:.4f}")
print(f"F1       : {f1:.4f}")
print(f"ROC-AUC  : {roc_auc:.4f}")

print("\nConfusion Matrix:")
print(cm)

print("\nClassification Report:")
print(
    classification_report(
        y_true,
        y_pred,
        target_names=["Plain", "Pothole"],
        zero_division=0
    )
)

results = {
    "experiment": "Model B - Frozen External Evaluation",
    "checkpoint": CHECKPOINT,
    "samples": 596,
    "plain": 300,
    "pothole": 296,
    "accuracy": accuracy,
    "precision": precision,
    "recall": recall,
    "f1": f1,
    "roc_auc": roc_auc,
    "confusion_matrix": cm.tolist(),
    "external_test_used_for_training": False,
    "threshold": 0.5
}

os.makedirs("backend/results", exist_ok=True)

with open(
    "backend/results/model_b_external_evaluation.json",
    "w"
) as f:
    json.dump(results, f, indent=2)

print("\n? External evaluation complete")
print("596-image frozen benchmark evaluated")
print("Training data modified: NO")
print("Frozen dataset modified: NO")
print("Results saved to:")
print("backend/results/model_b_external_evaluation.json")
