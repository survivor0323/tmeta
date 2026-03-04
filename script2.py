import re

# 1. Update index.html
with open('static/index.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

start_marker = r'<h4\s*style="font-size: 0\.95rem; color: var\(--text-main\); margin-bottom: 1rem; display: flex; align-items: center; gap: 0\.5rem;">\s*Social Media Sizes.*?'
end_marker = r'</div>\s*</div>\s*<!-- Step 3'

new_size_section = """<h4 style="font-size: 0.95rem; color: var(--text-main); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                                    Advertising Platforms <span style="font-size: 0.8rem; font-weight: 400; color: var(--text-muted);">Select a target platform to view specific sizes and Safe Zone rules.</span></h4>

                                <div id="creativePlatformTabs" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1rem;">
                                    <!-- Naver Card -->
                                    <div class="tab-chip platform-card active" data-platform="naver" style="cursor: pointer;">
                                        <i class="fa-solid fa-n" style="font-size: 2rem; margin-bottom: 0.5rem; color: #03c75a;"></i>
                                        <div style="font-weight: 600; font-size: 0.95rem;">Naver GFA</div>
                                        <div style="font-size: 0.8rem; opacity: 0.8;">Feed & Native</div>
                                    </div>
                                    <!-- Kakao Card -->
                                    <div class="tab-chip platform-card" data-platform="kakao" style="cursor: pointer;">
                                        <i class="fa-solid fa-k" style="font-size: 2rem; margin-bottom: 0.5rem; color: #fae100;"></i>
                                        <div style="font-weight: 600; font-size: 0.95rem;">Kakao Moment</div>
                                        <div style="font-size: 0.8rem; opacity: 0.8;">Bizboard & Display</div>
                                    </div>
                                    <!-- Meta Card -->
                                    <div class="tab-chip platform-card" data-platform="meta" style="cursor: pointer;">
                                        <i class="fa-brands fa-meta" style="font-size: 2rem; margin-bottom: 0.5rem; color: #0668E1;"></i>
                                        <div style="font-weight: 600; font-size: 0.95rem;">Meta (FB/IG)</div>
                                        <div style="font-size: 0.8rem; opacity: 0.8;">Feed & Reels</div>
                                    </div>
                                </div>
                                
                                <div style="margin-top: 1.5rem; display: flex; flex-direction: column; gap: 0.8rem;">
                                    <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-main);">Target Dimensions</label>
                                    <select id="canvasSizeSelect" style="padding: 0.8rem 1rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.95rem; outline: none; box-shadow: 0 1px 2px rgba(0,0,0,0.05); cursor: pointer;">
                                        <!-- Options will be populated by JS, initializing with Naver -->
                                        <option value="1200x628">피드 및 네이티브 (1200x628)</option>
                                        <option value="600x600">스퀘어 썸네일 (600x600)</option>
                                        <option value="342x228">PC 스마트채널 (342x228)</option>
                                        <option value="1200x1800">세로형 피드 (1200x1800)</option>
                                    </select>
                                    <div id="creativeRuleWarning" style="background: #fff1f2; color: #e11d48; padding: 0.8rem; border-radius: 8px; font-size: 0.85rem; font-weight: 600; display: flex; align-items: center; border: 1px solid #ffe4e6;">
                                        <i class="fa-solid fa-circle-exclamation" style="margin-right:0.4rem;"></i> <span>텍스트 면적 20% 이내 (단색 배경 불가)</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Step 3"""

new_html_content = re.sub(start_marker + r'.*?' + end_marker, new_size_section, html_content, flags=re.DOTALL)

with open('static/index.html', 'w', encoding='utf-8') as f:
    f.write(new_html_content)

# 2. Update styles.css
with open('static/styles.css', 'r', encoding='utf-8') as f:
    css_content = f.read()

if '.platform-card' not in css_content:
    new_styles = """
/* Creative Studio Platform Cards */
.platform-card {
    background: white;
    color: var(--text-main);
    border-radius: 8px;
    padding: 1.5rem 1rem;
    text-align: center;
    border: 1px solid #e2e8f0;
    transition: all 0.2s;
}

.platform-card.active {
    background: var(--text-main);
    color: white;
    border: 2px solid var(--text-main);
}
"""
    with open('static/styles.css', 'a', encoding='utf-8') as f:
        f.write(new_styles)

# 3. Update creative.js
with open('static/creative.js', 'r', encoding='utf-8') as f:
    js_content = f.read()

# Uncomment updateSizeOptionsByPlatform in click listener
js_content = js_content.replace('// updateSizeOptionsByPlatform(platform);', 'updateSizeOptionsByPlatform(platform);')

# Also change warning style for 'meta' to make sure background reflects correctly
# And add initialization for default platform
with open('static/creative.js', 'w', encoding='utf-8') as f:
    f.write(js_content)

print("Updates applied to index.html, styles.css, creative.js")
