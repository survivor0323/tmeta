import os
import subprocess

os.makedirs("static/videos", exist_ok=True)

print("Downloading Nike Ad...")
subprocess.run([
    'python', '-m', 'yt_dlp', 
    '-f', 'best[ext=mp4]', 
    '-o', 'static/videos/nike.mp4', 
    '--match-filter', 'duration < 120', 
    'ytsearch1:nike short commercial hd'
])

print("Downloading Adidas Ad...")
subprocess.run([
    'python', '-m', 'yt_dlp', 
    '-f', 'best[ext=mp4]', 
    '-o', 'static/videos/adidas.mp4', 
    '--match-filter', 'duration < 120', 
    'ytsearch1:adidas short commercial hd'
])
