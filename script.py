import re

with open('static/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = r'<!-- 🎨 크리에이티브 스튜디오 뷰 -->'
end_marker = r'<!-- AI Analysis Modal \(팝업\) -->'

new_creative_view = """<!-- 🎨 크리에이티브 스튜디오 뷰 -->
            <div id="creativeView" class="hidden" style="display: flex; min-height: calc(100vh - 80px); width: 100%; background: var(--bg-base);">
                <!-- 스튜디오 좌측 서브 메뉴 -->
                <aside style="width: 250px; background: white; border-right: 1px solid var(--border-color); padding: 2rem 1rem; display: flex; flex-direction: column; gap: 0.5rem; flex-shrink: 0;">
                    <button class="nav-item active" style="background: var(--accent-blue); color: white; padding: 0.8rem 1rem; border-radius: 12px; border: none; font-weight: 700; font-family: var(--font-heading); display: flex; align-items: center; justify-content: space-between; cursor: pointer; text-align: left; width: 100%; margin-bottom: 1.5rem; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);">
                        <span><i class="fa-solid fa-wand-magic-sparkles"></i> Generate</span>
                        <i class="fa-solid fa-chevron-right" style="font-size: 0.8rem;"></i>
                    </button>
                    
                    <button style="background: transparent; border: none; padding: 0.8rem 1rem; display: flex; align-items: center; gap: 0.8rem; font-weight: 600; color: var(--text-main); cursor: pointer; border-radius: 8px; width: 100%; text-align: left; transition: background 0.2s;"><i class="fa-solid fa-star"></i> Brands</button>
                    <button style="background: transparent; border: none; padding: 0.8rem 1rem; display: flex; align-items: center; gap: 0.8rem; font-weight: 600; color: var(--text-main); cursor: pointer; border-radius: 8px; width: 100%; text-align: left; transition: background 0.2s;"><i class="fa-solid fa-folder-open"></i> Projects</button>
                    <button style="background: transparent; border: none; padding: 0.8rem 1rem; display: flex; align-items: center; gap: 0.8rem; font-weight: 600; color: var(--text-main); cursor: pointer; border-radius: 8px; width: 100%; text-align: left; transition: background 0.2s;"><i class="fa-solid fa-chart-line"></i> Analyze</button>
                </aside>

                <!-- 스튜디오 메인 뷰 -->
                <main style="flex: 1; padding: 2.5rem 3rem; overflow-y: auto;">
                    <section class="hero-section" style="margin-top: 0; margin-bottom: 2.5rem; text-align: left;">
                        <h1 style="font-size: 1.8rem; margin-bottom: 0.5rem;">Motiverse AI <span class="text-gradient">크리에이티브 스튜디오</span></h1>
                        <p style="color: var(--text-muted);">AI를 활용해 마케팅 전략을 세우고, 내 브랜드에 최적화된 맞춤형 광고 에셋을 생성하세요.</p>
                    </section>

                    <div style="max-width: 1200px; display: flex; flex-direction: column; gap: 1.5rem;">
                        
                        <!-- Step 1: Create Brand -->
                        <div class="panel-box" style="padding: 1.5rem;">
                            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
                                <div style="background: rgba(59, 130, 246, 0.1); color: var(--accent-blue); border-radius: 8px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; font-weight: 700;">1</div>
                                <div>
                                    <h3 style="font-family: var(--font-heading); font-size: 1.2rem; color: var(--text-main); margin: 0;">Create Your Brand <span style="font-size: 0.8rem; font-weight: 400; color: var(--text-muted); margin-left: 0.5rem; background: #f1f5f9; padding: 0.2rem 0.5rem; border-radius: 4px;">Step 1/3</span></h3>
                                </div>
                            </div>

                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; background: #f8fafc; padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border-color);">
                                <div>
                                    <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 0.5rem;">브랜드 사이트 로드 (AI 자동 스캔)</label>
                                    <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem;">
                                        <input type="text" placeholder="https://example.com" style="flex: 1; padding: 0.8rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.95rem; outline: none;" />
                                        <button class="btn" style="background: var(--text-main); color: white;">Scan Website</button>
                                    </div>

                                    <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 0.5rem;">브랜드 명</label>
                                    <input type="text" placeholder="Brand Name" style="width: 100%; padding: 0.8rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.95rem; outline: none; margin-bottom: 1.5rem;" />
                                    
                                    <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 0.5rem;">로고 업로드</label>
                                    <input type="file" accept="image/*" style="width: 100%; padding: 0.6rem; border: 1px dashed #94a3b8; border-radius: 8px; font-size: 0.85rem; background: white;" />
                                </div>
                                <div>
                                    <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 0.5rem;">브랜드 메인 컬러</label>
                                    <div style="display: flex; gap: 0.8rem; margin-bottom: 1.5rem;">
                                        <input type="color" value="#0f172a" style="width: 45px; height: 45px; border: none; border-radius: 8px; cursor: pointer; padding: 0;" />
                                        <input type="color" value="#3b82f6" style="width: 45px; height: 45px; border: none; border-radius: 8px; cursor: pointer; padding: 0;" />
                                    </div>

                                    <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 0.5rem;">대표 폰트 (TTF/OTF 업로드)</label>
                                    <div style="display: flex; gap: 0.5rem; align-items: center; background: white; border: 1px solid #cbd5e1; padding: 0.6rem; border-radius: 8px;">
                                        <input type="file" accept=".ttf,.otf" style="flex: 1; font-size: 0.85rem;" />
                                        <span style="font-size: 0.8rem; color: #94a3b8;">Default (Pretendard)</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Step 2: Select Creative Size -->
                        <div class="panel-box" style="padding: 1.5rem;">
                            <div style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
                                <div style="display: flex; align-items: center; gap: 1rem;">
                                    <div style="background: rgba(59, 130, 246, 0.1); color: var(--accent-blue); border-radius: 8px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; font-weight: 700;">2</div>
                                    <h3 style="font-family: var(--font-heading); font-size: 1.2rem; color: var(--text-main); margin: 0;">Select Creative Size</h3>
                                </div>
                                <i class="fa-solid fa-chevron-down" style="color: #94a3b8;"></i>
                            </div>

                            <div style="margin-top: 1.5rem;">
                                <h4 style="font-size: 0.95rem; color: var(--text-main); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">Social Media Sizes <span style="font-size: 0.8rem; font-weight: 400; color: var(--text-muted);">Most common sizes for social media advertising.</span></h4>
                                
                                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1rem;">
                                    <!-- 사이즈 카드 -->
                                    <div style="background: var(--text-main); color: white; border-radius: 8px; padding: 1.5rem 1rem; text-align: center; cursor: pointer; border: 2px solid var(--text-main);">
                                        <i class="fa-regular fa-image" style="font-size: 2rem; margin-bottom: 0.5rem;"></i>
                                        <div style="font-weight: 600; font-size: 0.95rem;">Post Size</div>
                                        <div style="font-size: 0.8rem; opacity: 0.7;">(1080x1080)</div>
                                    </div>
                                    <div style="background: white; color: var(--text-main); border-radius: 8px; padding: 1.5rem 1rem; text-align: center; cursor: pointer; border: 1px solid #e2e8f0; transition: all 0.2s;">
                                        <i class="fa-solid fa-image" style="font-size: 2rem; margin-bottom: 0.5rem; color: #94a3b8;"></i>
                                        <div style="font-weight: 600; font-size: 0.95rem;">Landscape Size</div>
                                        <div style="font-size: 0.8rem; color: #94a3b8;">(1200x628)</div>
                                    </div>
                                    <div style="background: white; color: var(--text-main); border-radius: 8px; padding: 1.5rem 1rem; text-align: center; cursor: pointer; border: 1px solid #e2e8f0; transition: all 0.2s;">
                                        <i class="fa-solid fa-mobile-screen" style="font-size: 2rem; margin-bottom: 0.5rem; color: #94a3b8;"></i>
                                        <div style="font-weight: 600; font-size: 0.95rem;">Story / Reels</div>
                                        <div style="font-size: 0.8rem; color: #94a3b8;">(1080x1920)</div>
                                    </div>
                                    <div style="background: white; color: var(--text-main); border-radius: 8px; padding: 1.5rem 1rem; text-align: center; cursor: pointer; border: 1px solid #e2e8f0; transition: all 0.2s;">
                                        <i class="fa-solid fa-pager" style="font-size: 2rem; margin-bottom: 0.5rem; color: #94a3b8;"></i>
                                        <div style="font-weight: 600; font-size: 0.95rem;">Kakao / Naver</div>
                                        <div style="font-size: 0.8rem; color: #94a3b8;">(Platform Specific)</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Step 3: Text & AI Generative -->
                        <div class="panel-box" style="padding: 1.5rem;">
                            <div style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
                                <div style="display: flex; align-items: center; gap: 1rem;">
                                    <div style="background: rgba(59, 130, 246, 0.1); color: var(--accent-blue); border-radius: 8px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; font-weight: 700;">3</div>
                                    <h3 style="font-family: var(--font-heading); font-size: 1.2rem; color: var(--text-main); margin: 0;">Text on Image & AI Strategy</h3>
                                </div>
                                <i class="fa-solid fa-chevron-down" style="color: #94a3b8;"></i>
                            </div>

                            <div style="margin-top: 1.5rem; background: #eff6ff; border: 1px solid #bfdbfe; padding: 1.5rem; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
                                <div style="display: flex; align-items: center; gap: 1rem;">
                                    <div style="width: 48px; height: 48px; background: var(--text-main); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white;">
                                        <i class="fa-solid fa-robot" style="font-size: 1.5rem;"></i>
                                    </div>
                                    <div>
                                        <div style="font-weight: 700; color: var(--text-main); font-size: 1.1rem; font-family: var(--font-heading);">Generate strategy & texts with AI</div>
                                        <div style="font-size: 0.9rem; color: var(--text-muted);">업로드된 레퍼런스와 내 브랜드를 분석하여 고효율 카피와 레이아웃 전략을 추천합니다.</div>
                                    </div>
                                </div>
                                <button class="btn" style="background: var(--text-main); color: white;"><i class="fa-solid fa-bolt text-gradient"></i> Generate AI Strategy</button>
                            </div>

                            <div style="margin-top: 2rem; display: flex; gap: 2rem;">
                                <div style="flex: 2;">
                                    <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--text-main); margin-bottom: 1rem;">On Image Texts</h4>
                                    
                                    <div style="display: flex; flex-direction: column; gap: 1.2rem; background: #f8fafc; padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border-color);">
                                        <div>
                                            <label style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600; margin-bottom: 0.5rem; display: block;">메인 카피 (Main Headline)</label>
                                            <div style="background: white; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0.8rem; display: flex; justify-content: space-between; align-items: center;">
                                                <input type="text" value="압도적인 퍼포먼스, 새로운 차원의 경험" style="border: none; outline: none; width: 100%; font-weight: 600; color: var(--text-main); font-size: 0.95rem;" />
                                                <i class="fa-solid fa-dice text-gradient" style="cursor: pointer; padding-left: 0.5rem;"></i>
                                            </div>
                                        </div>
                                        <div>
                                            <label style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600; margin-bottom: 0.5rem; display: block;">서브 카피 (Punchline / Sub)</label>
                                            <div style="background: white; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0.8rem; display: flex; justify-content: space-between; align-items: center;">
                                                <input type="text" value="지금 사전예약하고 특별한 혜택을 누리세요." style="border: none; outline: none; width: 100%; font-weight: 500; color: var(--text-main); font-size: 0.95rem;" />
                                                <i class="fa-solid fa-dice text-gradient" style="cursor: pointer; padding-left: 0.5rem;"></i>
                                            </div>
                                        </div>
                                        <div>
                                            <label style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600; margin-bottom: 0.5rem; display: block;">콜투액션 (Call to Action)</label>
                                            <div style="background: white; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0.8rem; display: flex; justify-content: space-between; align-items: center;">
                                                <input type="text" value="자세히 알아보기" style="border: none; outline: none; width: 100%; font-weight: 600; color: var(--text-main); font-size: 0.95rem;" />
                                                <i class="fa-solid fa-dice text-gradient" style="cursor: pointer; padding-left: 0.5rem;"></i>
                                            </div>
                                        </div>
                                        
                                        <!-- 레퍼런스 스타일 전이 (생성 모드) -->
                                        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 0.5rem 0;" />
                                        <div>
                                            <label style="font-size: 0.85rem; color: var(--accent-blue); font-weight: 600; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.4rem;"><i class="fa-solid fa-image"></i> AI 레퍼런스 스타일 전이 배경</label>
                                            <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem;">Motiverse 검색에서 가져온 레퍼런스의 배경과 톤을 내 제품에 맞게 합성합니다.</p>
                                            <button class="btn" style="width: 100%; text-align: center; justify-content: center; background: white; border: 1px solid #cbd5e1; color: var(--text-main);"><i class="fa-solid fa-plus"></i> 레퍼런스 선택 및 제품 컷 업로드</button>
                                        </div>
                                    </div>
                                </div>
                                
                                <div style="flex: 1; min-width: 300px;">
                                    <!-- 미리보기 캔버스 보드 -->
                                    <div style="background: white; border: 1px solid var(--border-color); border-radius: 12px; height: 100%; display: flex; flex-direction: column;">
                                        <div style="padding: 0.8rem 1rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">
                                            <span><i class="fa-solid fa-eye"></i> Live Preview</span>
                                            <span style="color: #ef4444;"><i class="fa-solid fa-circle-exclamation"></i> Safe Zone Check</span>
                                        </div>
                                        <!-- Fabric.js Canvas Container -->
                                        <div id="canvasWrapper" style="flex: 1; display: flex; align-items: center; justify-content: center; background: repeating-conic-gradient(#f1f5f9 0% 25%, transparent 0% 50%) 50% / 20px 20px; overflow: hidden; position: relative; padding: 1rem; min-height: 400px;">
                                            <canvas id="creativeCanvas" style="display: none; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); max-width: 100%; max-height: 100%;"></canvas>
                                            <div id="canvasEmptyState" style="text-align: center; color: var(--text-muted);">
                                                <i class="fa-solid fa-laptop-code" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;"></i><br>
                                                <span style="font-size: 0.9rem;">Generate 버튼을 눌러 에셋을 생성하세요</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- 하단 저장 및 렌더링 버튼 -->
                            <div style="text-align: right; margin-top: 2rem; border-top: 1px solid var(--border-color); padding-top: 1.5rem; display: flex; justify-content: flex-end; gap: 1rem;">
                                <select style="padding: 0.8rem 1.5rem; border-radius: 8px; border: 1px solid #cbd5e1; outline: none; font-weight: 600;">
                                    <option>Save to Project</option>
                                </select>
                                <button class="btn" style="background: var(--accent-blue); color: white; padding: 0.8rem 2.5rem; border-radius: 8px; font-weight: 600; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3); font-size: 1rem;">
                                    <i class="fa-solid fa-bolt"></i> Generate Creative
                                </button>
                            </div>
                        </div>

                    </div>
                </main>
            </div>
"""

new_content = re.sub(start_marker + r'.*?' + end_marker, new_creative_view + '\n\n    ' + end_marker, content, flags=re.DOTALL)

with open('static/index.html', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Done! Before length:", len(content), "After length:", len(new_content))
