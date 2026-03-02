import requests
import os

api_key = "ovCs3Wr4SdXERWu6tJb63MH0nFB2"
headers = {"x-api-key": api_key}

# 1. Search endpoint
url_search = "https://api.scrapecreators.com/v1/facebook/adLibrary/search?query=nike"
print("Testing Search Endpoint:", url_search)
res_search = requests.get(url_search, headers=headers)
print("Status:", res_search.status_code)
print(res_search.text[:500])

# 2. Add another potential search endpoint
url_search_2 = "https://api.scrapecreators.com/v1/facebook/adLibrary/search/ads?query=nike"
print("\nTesting Search Endpoint 2:", url_search_2)
res_search_2 = requests.get(url_search_2, headers=headers)
print("Status:", res_search_2.status_code)
print(res_search_2.text[:500])

# 3. Profile endpoint
url_profile = "https://api.scrapecreators.com/v1/facebook/adLibrary/profile?handle=nike"
print("\nTesting Profile Endpoint:", url_profile)
res_profile = requests.get(url_profile, headers=headers)
print("Status:", res_profile.status_code)
print(res_profile.text[:500])
