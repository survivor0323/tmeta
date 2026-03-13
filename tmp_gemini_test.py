import asyncio
from httpx import AsyncClient
import os
import json
from dotenv import load_dotenv

load_dotenv()

async def test_gemini():
    api_key_gemini = os.environ.get("GEMINI_API_KEY")
    text_model_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key_gemini}"
    
    # 1x1 transparent png
    tiny_img_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" 
    
    user_msg = "사용자 기획 의도: 이 이미지가 뭔지 한글로 짧게 설명해봐\n[설정된 옵션]\n- Vibe: 자동"
    
    parts_list = []
    # Test our format
    parts_list.append({"text": "[1번 이미지]"})
    parts_list.append({"inlineData": {"mimeType": "image/png", "data": tiny_img_b64}})
    parts_list.append({"text": user_msg})
    
    text_payload = {
        "systemInstruction": {"parts": [{"text": "CF 감독"}]},
        "contents": [{"parts": parts_list}],
        "generationConfig": {
            "responseMimeType": "application/json"
        }
    }
    
    async with AsyncClient(timeout=30) as client:
        resp = await client.post(text_model_url, json=text_payload)
        print("Status", resp.status_code)
        try:
            print("Content", json.dumps(resp.json(), ensure_ascii=False, indent=2))
        except:
            print("Content", resp.text)

if __name__ == "__main__":
    asyncio.run(test_gemini())
