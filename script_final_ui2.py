import re
import subprocess
subprocess.run(["git", "checkout", "5962b4e", "--", "static/index.html"])

with open('static/index.html', 'r', encoding='utf-8') as f:
    clean_html = f.read()

start_creative_idx = clean_html.find('<div id="creativeView"')
end_creative_idx = clean_html.find('<!-- AI Analysis Modal')

top_html = clean_html[:start_creative_idx]
bottom_html = clean_html[end_creative_idx:]

c_html = clean_html[start_creative_idx:end_creative_idx]

# Precise slice by string find instead of arbitrary regex
s1_start = c_html.find('<!-- Step 1: Create Brand -->')
s2_start = c_html.find('<!-- Step 2: Select Creative Size -->')
s3_start = c_html.find('<!-- Step 3: Text & AI Generative -->')

step1 = c_html[s1_start : s2_start].strip()
step2 = c_html[s2_start : s3_start].strip()
step3 = c_html[s3_start : ].replace('</div>\n\n                    </div>\n                </main>\n            </div>', '').strip()

canvas_start = step3.find('<div style="flex: 1; min-width: 300px;">')
step3_inputs = step3[:canvas_start].strip()

# format inputs
step3_inputs = step3_inputs.replace('<div style="margin-top: 2rem; display: flex; gap: 2rem;">', '', 1)
step3_inputs = step3_inputs.replace('<div style="flex: 2;">', '<div style="display: flex; flex-direction: column;">', 1)
step3_inputs += "\n                            </div>"

step3_canvas = step3[canvas_start:]
step3_canvas = step3_canvas.replace('<div style="flex: 1; min-width: 300px;">', '<div style="flex: 1; display: flex; flex-direction: column;">', 1)

new_creative_view = f"""<div id="creativeView" class="hidden"
                style="display: flex; min-height: calc(100vh - 80px); width: 100%; background: var(--bg-base); flex-direction: column;">
                
                <!-- 스튜디오 메인 뷰 -->
                <main style="flex: 1; padding: 2.5rem 3rem; overflow-y: auto;">
                    
                    <!-- 스튜디오 상단 가로 서브 메뉴 -->
                    <div style="display: flex; gap: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 2rem;">
                        <button class="nav-item active" style="background: var(--accent-blue); color: white; padding: 0.6rem 1.5rem; border-radius: 8px; border: none; font-weight: 700; display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <i class="fa-solid fa-wand-magic-sparkles"></i> Generate
                        </button>
                        <button style="background: transparent; border: none; padding: 0.6rem 1.5rem; font-weight: 600; color: var(--text-main); cursor: pointer; border-radius: 8px; display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fa-solid fa-star"></i> Brands
                        </button>
                        <button style="background: transparent; border: none; padding: 0.6rem 1.5rem; font-weight: 600; color: var(--text-main); cursor: pointer; border-radius: 8px; display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fa-solid fa-folder-open"></i> Projects
                        </button>
                        <button style="background: transparent; border: none; padding: 0.6rem 1.5rem; font-weight: 600; color: var(--text-main); cursor: pointer; border-radius: 8px; display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fa-solid fa-chart-line"></i> Analyze
                        </button>
                    </div>

                    <section class="hero-section" style="margin-top: 0; margin-bottom: 2.5rem; text-align: left;">
                        <h1 style="font-size: 1.8rem; margin-bottom: 0.5rem;">Motiverse AI <span
                                class="text-gradient">크리에이티브 스튜디오</span></h1>
                        <p style="color: var(--text-muted);">AI를 활용해 마케팅 전략을 세우고, 내 브랜드에 최적화된 맞춤형 광고 에셋을 생성하세요.</p>
                    </section>
                    
                    <div style="max-width: 1400px; display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; align-items: stretch;">
                        
                        <!-- LEFT COLUMN -->
                        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                            {step1}
                            {step3_inputs}
                        </div>
                        
                        <!-- RIGHT COLUMN -->
                        <div style="display: flex; flex-direction: column; gap: 1.5rem; height: 100%;">
                            {step2}
                            <div class="panel-box" style="padding: 1.5rem; display: flex; flex-direction: column; flex: 1;">
                                {step3_canvas}
                            </div>
                        </div>

                    </div>
                </main>
            </div>
            
            """

with open('static/index.html', 'w', encoding='utf-8') as f:
    f.write(top_html + new_creative_view + bottom_html)
