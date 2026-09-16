import argparse
import csv
import sys
from pathlib import Path

# Add backend directory to sys.path so we can import app modules
root = Path(__file__).resolve().parents[1]
if str(root) not in sys.path:
    sys.path.insert(0, str(root))

from app.gemini_classifier import classify_civic_image

def main():
    parser = argparse.ArgumentParser(description="Evaluate Gemini 2.5 Flash Civic Classifier")
    parser.add_argument("--manifest", type=str, required=True, help="Path to CSV manifest (image_path, ground_truth)")
    parser.add_argument("--output", type=str, default="predictions.csv", help="Output predictions CSV")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of images to evaluate")
    args = parser.parse_args()

    manifest_path = Path(args.manifest)
    if not manifest_path.exists():
        print(f"Error: Manifest {manifest_path} not found.")
        sys.exit(1)

    with open(manifest_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    if args.limit:
        rows = rows[:args.limit]

    results = []
    correct_count = 0
    total_count = len(rows)

    print(f"Evaluating {total_count} images...")

    for i, row in enumerate(rows):
        image_path = Path(row["image_path"])
        ground_truth = row["ground_truth"]
        
        if not image_path.exists():
            print(f"[{i+1}/{total_count}] Skip: Image {image_path} not found.")
            continue
            
        content = image_path.read_bytes()
        
        prediction = "ERROR"
        confidence = 0.0
        uncertain = True
        provider = "gemini"
        error_msg = ""
        
        try:
            category, conf, evidence = classify_civic_image(content)
            prediction = category
            confidence = conf
            uncertain = conf < 0.5 # rudimentary uncertainty
        except Exception as e:
            error_msg = str(e)
            provider = "error"
            
        is_correct = (prediction == ground_truth)
        if is_correct:
            correct_count += 1
            
        print(f"[{i+1}/{total_count}] {image_path.name} | GT: {ground_truth} | Pred: {prediction} | Correct: {is_correct}")

        results.append({
            "image_path": str(image_path),
            "ground_truth": ground_truth,
            "prediction": prediction,
            "confidence": confidence,
            "uncertain": uncertain,
            "correct": is_correct,
            "provider": provider,
            "model": "gemini-2.5-flash",
            "error": error_msg
        })

    with open(args.output, "w", newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=[
            "image_path", "ground_truth", "prediction", "confidence", 
            "uncertain", "correct", "provider", "model", "error"
        ])
        writer.writeheader()
        writer.writerows(results)

    print("\n--- Evaluation Summary ---")
    print(f"Total: {total_count}")
    print(f"Correct: {correct_count}")
    accuracy = correct_count / total_count if total_count > 0 else 0
    print(f"Accuracy: {accuracy:.2%}")
    print(f"Predictions saved to {args.output}")

if __name__ == "__main__":
    main()
