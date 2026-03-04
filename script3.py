import re

with open('static/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Add IDs to text inputs
html = html.replace(
    '<input type="text" value="압도적인 퍼포먼스, 새로운 차원의 경험"',
    '<input type="text" id="copyMain" value="압도적인 퍼포먼스, 새로운 차원의 경험"'
)

html = html.replace(
    '<input type="text" value="지금 사전예약하고 특별한 혜택을 누리세요."',
    '<input type="text" id="copySub" value="지금 사전예약하고 특별한 혜택을 누리세요."'
)

html = html.replace(
    '<input type="text" value="자세히 알아보기"',
    '<input type="text" id="copyCta" value="자세히 알아보기"'
)

# 2. Add Safe Zone overlay to the canvas wrapper
old_canvas_block = """<!-- Fabric.js Canvas Container -->
                                        <div id="canvasWrapper"
                                            style="flex: 1; display: flex; align-items: center; justify-content: center; background: repeating-conic-gradient(#f1f5f9 0% 25%, transparent 0% 50%) 50% / 20px 20px; overflow: hidden; position: relative; padding: 1rem; min-height: 400px;">
                                            <canvas id="creativeCanvas"
                                                style="display: none; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); max-width: 100%; max-height: 100%;"></canvas>
                                            <div id="canvasEmptyState"
                                                style="text-align: center; color: var(--text-muted);">
                                                <i class="fa-solid fa-laptop-code"
                                                    style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;"></i><br>
                                                <span style="font-size: 0.9rem;">Generate 버튼을 눌러 에셋을 생성하세요</span>
                                            </div>
                                        </div>"""

new_canvas_block = """<!-- Fabric.js Canvas Container -->
                                        <div id="canvasWrapper"
                                            style="flex: 1; display: flex; align-items: center; justify-content: center; background: repeating-conic-gradient(#f1f5f9 0% 25%, transparent 0% 50%) 50% / 20px 20px; overflow: hidden; position: relative; padding: 1rem; min-height: 400px;">
                                            <canvas id="creativeCanvas"
                                                style="display: none; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); max-width: 100%; max-height: 100%; position: absolute; z-index: 1;"></canvas>
                                            
                                            <!-- Safe Zone 가이드라인 오버레이 (Fabric 캔버스와 동일한 위치, 크기로 동기화 됨) -->
                                            <div id="safeZoneOverlay" style="display: none; position: absolute; z-index: 2; pointer-events: none; border: 2px dashed rgba(239, 68, 68, 0.7); box-shadow: inset 0 0 0 1000px rgba(239, 68, 68, 0.1);">
                                                <div style="position: absolute; top: -25px; left: 0; background: rgba(239, 68, 68, 0.9); color: white; padding: 2px 8px; font-size: 0.7rem; border-radius: 4px; font-weight: bold;">
                                                    <i class="fa-solid fa-triangle-exclamation"></i> Danger Zone
                                                </div>
                                            </div>

                                            <div id="canvasEmptyState"
                                                style="text-align: center; color: var(--text-muted); z-index: 0;">
                                                <i class="fa-solid fa-laptop-code"
                                                    style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;"></i><br>
                                                <span style="font-size: 0.9rem;">Generate 버튼을 눌러 에셋을 생성하세요</span>
                                            </div>
                                        </div>"""

html = html.replace(old_canvas_block, new_canvas_block)

# 3. Add ID to Generate Creative Button
html = html.replace(
    '<button class="btn"\n                                    style="background: var(--accent-blue); color: white; padding: 0.8rem 2.5rem; border-radius: 8px; font-weight: 600; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3); font-size: 1rem;">\n                                    <i class="fa-solid fa-bolt"></i> Generate Creative\n                                </button>',
    '<button class="btn" id="btnPreviewRender"\n                                    style="background: var(--accent-blue); color: white; padding: 0.8rem 2.5rem; border-radius: 8px; font-weight: 600; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3); font-size: 1rem;">\n                                    <i class="fa-solid fa-bolt"></i> Preview Render\n                                </button>'
)

with open('static/index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Updated index.html elements")
