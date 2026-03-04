import requests
import os
import json

api_key = "AIzaSyAWSGuHPLIhb42ljHc3ofaqqus6XOKykkY"

r = requests.get(f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}")
models = r.json().get('models', [])

for m in models:
    if 'imagen' in m['name']:
        print(m['name'])
        print(m.get('supportedGenerationMethods', []))
