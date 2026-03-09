import re

with open('static/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Locate main blocks
step1_start = html.find('<!-- Step 1: Create Brand -->')
step2_start = html.find('<!-- Step 2: Select Creative Size -->')
step3_start = html.find('<!-- Step 3: Text & AI Generative -->')
step3_end = html.find('<!-- AI Analysis Modal')

if step1_start == -1 or step2_start == -1 or step3_start == -1:
    print("Could not find steps")
    exit(1)

step1_html = html[step1_start:step2_start].strip()
step2_html = html[step2_start:step3_start].strip()
step3_html = html[step3_start:step3_end].strip()

# We need to refine where step3_html actually ends (before </div>\n                </main>)
step3_end_real = step3_html.rfind('</div>\n                </main>')
if step3_end_real != -1:
    step3_html = step3_html[:step3_end_real].strip()

# Split step 3 into two parts: inputs and canvas.
# The split happens at: <div style="flex: 1; min-width: 300px;">
canvas_split_idx = step3_html.find('<div style="flex: 1; min-width: 300px;">')
buttons_split_idx = step3_html.find('<!-- 하단 저장 및 렌더링 버튼 -->')

step3_header = step3_html[:step3_html.find('<div style="margin-top: 2rem; display: flex; gap: 2rem;">')]
step3_inputs = step3_html[step3_html.find('<div style="flex: 2;">') : canvas_split_idx]
# clean up inputs closing tags - it needs </div> because we stripped the wrapper
step3_inputs = step3_inputs.replace('<div style="flex: 2;">', '<div style="display: flex; flex-direction: column;">')
step3_inputs += "</div>" # close the flex: column div

step3_canvas = step3_html[canvas_split_idx : buttons_split_idx]
step3_canvas = step3_canvas.replace('<div style="flex: 1; min-width: 300px;">', '<div style="flex: 1;">')

step3_buttons = step3_html[buttons_split_idx:step3_html.rfind('</div>')] # omit the last </div> of panel-box

# Left Column HTML
left_column = f"""
                        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                            {step1_html}
                            <div class="panel-box" style="padding: 1.5rem;">
                                {step3_header}
                                {step3_inputs}
                            </div>
                        </div>
"""

# Right Column HTML
right_column = f"""
                        <div style="display: flex; flex-direction: column; gap: 1.5rem; height: 100%;">
                            {step2_html}
                            <div class="panel-box" style="padding: 1.5rem; display: flex; flex-direction: column; flex: 1;">
                                {step3_canvas}
                                {step3_buttons}
                            </div>
                        </div>
"""

# Replace the layout
old_layout_start = html.find('<div style="max-width: 1200px; display: flex; flex-direction: column; gap: 1.5rem;">')
old_layout_end = html.find('</main>', old_layout_start)

new_layout = f"""
                    <div style="max-width: 1400px; display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; align-items: stretch;">
{left_column}
{right_column}
                    </div>
"""

# Also fix the top menu
aside_start = html.find('<aside\n                    style="width: 250px;')
aside_end = html.find('</aside>') + 8

top_menu = """
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
"""

html = html[:aside_start] + top_menu + html[aside_end:old_layout_start] + new_layout + "\n                " + html[old_layout_end:]

# Fix script.js querySelector bug
try:
    with open('static/script.js', 'r', encoding='utf-8') as fs:
        script_js = fs.read()
    script_js = script_js.replace(
        'const platformTabs = document.querySelectorAll(".tab-chip[data-platform]");',
        'const platformTabs = document.querySelectorAll("#platformFilters .tab-chip[data-platform]");'
    )
    with open('static/script.js', 'w', encoding='utf-8') as fs:
        fs.write(script_js)
    print("Fixed script.js")
except Exception as e:
    pass

# Fix icon hiding in creative.js
try:
    with open('static/creative.js', 'r', encoding='utf-8') as fc:
        creative_js = fc.read()
    if 'document.getElementById(\'monitorBtn\')?.classList.add(\'hidden\');' not in creative_js:
        hide_icons = """
        creativeView.classList.remove("hidden");
        referenceView.classList.add("hidden");

        document.getElementById('monitorBtn')?.classList.add('hidden');
        document.getElementById('boardsBtn')?.classList.add('hidden');
        document.getElementById('historyBtn')?.classList.add('hidden');
        document.getElementById('bookmarkBtn')?.classList.add('hidden');"""

        show_icons = """
        referenceView.classList.remove("hidden");
        creativeView.classList.add("hidden");

        if (!document.getElementById('userInfo')?.classList.contains('hidden')) {
            document.getElementById('monitorBtn')?.classList.remove('hidden');
            document.getElementById('boardsBtn')?.classList.remove('hidden');
            document.getElementById('historyBtn')?.classList.remove('hidden');
            document.getElementById('bookmarkBtn')?.classList.remove('hidden');
        }"""
        
        creative_js = creative_js.replace('creativeView.classList.remove("hidden");\n        referenceView.classList.add("hidden");', hide_icons)
        creative_js = creative_js.replace('referenceView.classList.remove("hidden");\n        creativeView.classList.add("hidden");', show_icons)
        
        with open('static/creative.js', 'w', encoding='utf-8') as fc:
            fc.write(creative_js)
        print("Fixed creative.js")
except Exception as e:
    pass

with open('static/index.html', 'w', encoding='utf-8') as f:
    f.write(html)
print("Updated index.html")
