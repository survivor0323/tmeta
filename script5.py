import re

# We will apply updates to three files.

# 1. script.js - Fix platformTabs query selector
try:
    with open('static/script.js', 'r', encoding='utf-8') as f:
        script_js = f.read()
    
    script_js = script_js.replace(
        'const platformTabs = document.querySelectorAll(".tab-chip[data-platform]");',
        'const platformTabs = document.querySelectorAll("#platformFilters .tab-chip[data-platform]");'
    )
    
    with open('static/script.js', 'w', encoding='utf-8') as f:
        f.write(script_js)
    print("Fixed platformTabs selector in script.js")
except Exception as e:
    print(f"Error updating script.js: {e}")

# 2. creative.js - Hide/Show icons
try:
    with open('static/creative.js', 'r', encoding='utf-8') as f:
        creativeJs = f.read()

    hide_icons_code = """
        creativeView.classList.remove("hidden");
        referenceView.classList.add("hidden");

        // Hide icons
        document.getElementById('monitorBtn')?.classList.add('hidden');
        document.getElementById('boardsBtn')?.classList.add('hidden');
        document.getElementById('historyBtn')?.classList.add('hidden');
        document.getElementById('bookmarkBtn')?.classList.add('hidden');"""

    show_icons_code = """
        referenceView.classList.remove("hidden");
        creativeView.classList.add("hidden");

        // Show icons if user is logged in
        if (!document.getElementById('userInfo')?.classList.contains('hidden')) {
            document.getElementById('monitorBtn')?.classList.remove('hidden');
            document.getElementById('boardsBtn')?.classList.remove('hidden');
            document.getElementById('historyBtn')?.classList.remove('hidden');
            document.getElementById('bookmarkBtn')?.classList.remove('hidden');
        }"""
        
    creativeJs = creativeJs.replace(
        'creativeView.classList.remove("hidden");\n        referenceView.classList.add("hidden");',
        hide_icons_code
    )
    
    creativeJs = creativeJs.replace(
        'referenceView.classList.remove("hidden");\n        creativeView.classList.add("hidden");',
        show_icons_code
    )
    
    with open('static/creative.js', 'w', encoding='utf-8') as f:
        f.write(creativeJs)
    print("Fixed icon visibility in creative.js")
except Exception as e:
    print(f"Error updating creative.js: {e}")

# 3. index.html - Layout rewrite
try:
    with open('static/index.html', 'r', encoding='utf-8') as f:
        html = f.read()

    # Step 1 Content
    step1_match = re.search(r'(<!-- Step 1: Create Brand -->.*?</div>\s*</div>\s*</div>)', html, re.DOTALL)
    step1_html = step1_match.group(1) if step1_match else ""

    # Step 2 Content
    step2_match = re.search(r'(<!-- Step 2: Select Creative Size -->.*?</div>\s*</div>)', html, re.DOTALL)
    step2_html = step2_match.group(1) if step2_match else ""

    # Step 3 Content - Strategy Box
    step3_strategy_match = re.search(r'(<div[^>]*?>\s*<div style="display: flex; align-items: center; gap: 1rem;">\s*<div[^>]*?>\s*<i class="fa-solid fa-robot".*?</div>)', html, re.DOTALL)
    # The whole strategy box is a bit complex to regex directly. Let's just find sections by key strings.
    # We want: Generate strategy AI box, On image texts box, and then we want Live Preview.
    
    # Let's extract manually
    
    # 1. On Image Texts (including AI generate box)
    step3_inputs_start = html.find('<!-- Step 3: Text on Image & AI Strategy -->')
    step3_canvas_start = html.find('<div style="flex: 1; min-width: 300px;">', step3_inputs_start)
    
    step3_inputs_html = html[step3_inputs_start:step3_canvas_start]
    
    # We need to close the div that started with <div style="flex: 2;"> in step3_inputs
    step3_inputs_html = step3_inputs_html.replace('<div style="margin-top: 2rem; display: flex; gap: 2rem;">\n                                <div style="flex: 2;">', '<div style="margin-top: 2rem; display: flex; flex-direction: column;">\n                                <div>')

    # 2. Canvas & Render buttons
    canvas_end = html.find('<!-- 하단 저장 및 렌더링 버튼 -->', step3_canvas_start)
    canvas_html = html[step3_canvas_start:canvas_end]
    # Remove the wrapper div that makes it flex: 1
    canvas_html = canvas_html.replace('<div style="flex: 1; min-width: 300px;">', '<div style="flex: 1;">')

    button_end = html.find('</div>\n\n                    </div>\n                </main>', canvas_end)
    button_html = html[canvas_end:button_end] + "</div>"

    # Now let's assemble the new creativeView HTML
    new_creative_view = """<!-- 🎨 크리에이티브 스튜디오 뷰 -->
            <div id="creativeView" class="hidden"
                style="display: flex; flex-direction: column; min-height: calc(100vh - 80px); width: 100%; background: var(--bg-base);">
                
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

                    <!-- 2-Column Layout -->
                    <div style="max-width: 1400px; display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                        
                        <!-- LEFT COLUMN (Step 1 + Step 3 inputs) -->
                        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                            {step1}
                            <div class="panel-box" style="padding: 1.5rem;">
                            {step3_inputs}
                            </div>
                        </div>
                        
                        <!-- RIGHT COLUMN (Step 2 + Live Preview) -->
                        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                            {step2}
                            
                            <div class="panel-box" style="padding: 1.5rem; display: flex; flex-direction: column; flex: 1;">
                                {canvas}
                                {button}
                            </div>
                        </div>
                    </div>
                </main>
            </div>""".replace('{step1}', step1_html).replace('{step2}', step2_html).replace('{step3_inputs}', step3_inputs_html).replace('{canvas}', canvas_html).replace('{button}', button_html)

    # Replace the old creativeView completely
    old_creative_view_start = html.find('<!-- 🎨 크리에이티브 스튜디오 뷰 -->')
    old_creative_view_end = html.find('</div>\n    <script src="/static/script.js"></script>') - 1 # end of main-content-wrapper roughly
    
    # to be safer, find the end of creativeView accurately.
    # It has <main ...> </main> </div>.
    old_end_search = html.find('                </main>\n            </div>', old_creative_view_start) + len('                </main>\n            </div>')
    
    full_new_html = html[:old_creative_view_start] + new_creative_view + html[old_end_search:]
    
    with open('static/index.html', 'w', encoding='utf-8') as f:
        f.write(full_new_html)
    
    print("Fixed layout in index.html")
except Exception as e:
    print(f"Error updating index.html: {e}")

