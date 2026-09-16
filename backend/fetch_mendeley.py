import requests

url = "https://data.mendeley.com/public-api/datasets/zndzygc3p3/2"
res = requests.get(url, headers={"Accept": "application/json"})
if res.ok:
    print(res.json())
else:
    print("Failed to get dataset API details")
