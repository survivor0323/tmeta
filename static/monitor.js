document.addEventListener("DOMContentLoaded", () => {
    // Dropdown Toggle
    const addMonitorBtn = document.getElementById("addMonitorBtn");
    const addMonitorDropdown = document.getElementById("addMonitorDropdown");

    addMonitorBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        addMonitorDropdown?.classList.toggle("hidden");
    });

    // Close Dropdown on outside click
    document.addEventListener("click", (e) => {
        if (addMonitorDropdown && !addMonitorDropdown.contains(e.target) && e.target !== addMonitorBtn) {
            addMonitorDropdown.classList.add("hidden");
        }
    });

    // Modals
    const modalAddFolder = document.getElementById("modalAddFolder");
    const modalAddCompetitor = document.getElementById("modalAddCompetitor");

    let currentAddPlatform = "meta"; // "meta", "instagram", "google", "tiktok"

    function openCompetitorModal(platform, platformName, iconHtml, descText) {
        currentAddPlatform = platform;
        const titleEl = document.getElementById("competitorModalTitle");
        const descEl = document.getElementById("competitorModalDesc");
        if (titleEl) titleEl.innerHTML = `경쟁사 추가하기 - <span style="background:none; border:none; padding:0; display:inline-flex; align-items:center; gap:0.4rem;">${iconHtml} ${platformName}</span>`;
        if (descEl) descEl.innerText = descText;

        // Reset Search UI
        const input = document.getElementById("competitorSearchInput");
        if (input) input.value = '';
        const results = document.getElementById("competitorSearchResults");
        if (results) results.classList.add("hidden");
        const submitBtn = document.getElementById("submitCompetitorModalBtn");
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.style.background = "#e2e8f0";
            submitBtn.style.color = "#94a3b8";
        }

        addMonitorDropdown?.classList.add("hidden");
        modalAddCompetitor?.classList.remove("hidden");
    }

    // Open Folder Modal
    const addFolderMenu = document.getElementById("addFolderMenu");
    addFolderMenu?.addEventListener("click", () => {
        addMonitorDropdown?.classList.add("hidden");
        modalAddFolder?.classList.remove("hidden");
    });

    // Open Meta Modal
    document.getElementById("addMetaMenu")?.addEventListener("click", () => {
        openCompetitorModal("meta", "Meta 광고", `<i class="fa-brands fa-meta" style="color: #0668E1;"></i>`, "Instagram, Facebook 등 Meta 플랫폼에 게재된 광고 콘텐츠를 매일 자동으로 수집·저장합니다.");
    });
    // Open Instagram Modal
    document.getElementById("addInstagramMenu")?.addEventListener("click", () => {
        openCompetitorModal("instagram", "Instagram", `<i class="fa-brands fa-instagram" style="color: #e1306c;"></i>`, "최신 트렌드의 인스타그램 릴스와 콘텐츠 모음에서 추출한 브랜드나 제품 레퍼런스를 모니터링하세요.");
    });
    // Open Google Modal
    document.getElementById("addGoogleMenu")?.addEventListener("click", () => {
        openCompetitorModal("google", "Google Ads", `<i class="fa-brands fa-google" style="color: #ea4335;"></i>`, "구글 네트워크에 게재된 경쟁사의 검색광고, 디스플레이 등 관련 레퍼런스를 AI가 분석하고 저장합니다.");
    });
    // Open TikTok Modal
    document.getElementById("addTiktokMenu")?.addEventListener("click", () => {
        openCompetitorModal("tiktok", "TikTok", `<i class="fa-brands fa-tiktok" style="color: #000000;"></i>`, "젊고 트렌디한 틱톡 숏폼 콘텐츠를 스크랩하고, 전략적 크리에이티브를 모니터링 폴더에 저장합니다.");
    });

    // Close Button Logic
    document.getElementById("closeFolderModal")?.addEventListener("click", () => modalAddFolder?.classList.add("hidden"));
    document.getElementById("cancelFolderModal")?.addEventListener("click", () => modalAddFolder?.classList.add("hidden"));

    document.getElementById("closeCompetitorModal")?.addEventListener("click", () => modalAddCompetitor?.classList.add("hidden"));
    document.getElementById("cancelCompetitorModal")?.addEventListener("click", () => modalAddCompetitor?.classList.add("hidden"));

    // Close on outside click
    modalAddFolder?.addEventListener("click", (e) => {
        if (e.target === modalAddFolder) modalAddFolder.classList.add("hidden");
    });
    modalAddCompetitor?.addEventListener("click", (e) => {
        if (e.target === modalAddCompetitor) modalAddCompetitor.classList.add("hidden");
    });

    // Competitor Search Logic
    const competitorSearchInput = document.getElementById("competitorSearchInput");
    const competitorSearchBtn = document.getElementById("competitorSearchActionBtn");
    const competitorSearchResults = document.getElementById("competitorSearchResults");
    const submitCompetitorModalBtn = document.getElementById("submitCompetitorModalBtn");

    let tempFetchedAds = null;
    let tempBrandName = "";

    competitorSearchBtn?.addEventListener("click", async () => {
        const query = competitorSearchInput?.value.trim();
        if (!query) return;

        // Start loading state
        const originalBtnText = competitorSearchBtn.innerHTML;
        competitorSearchBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        competitorSearchBtn.disabled = true;

        if (competitorSearchResults) competitorSearchResults.style.display = 'block';
        if (competitorSearchResults) competitorSearchResults.classList.add("hidden");

        try {
            const headers = (typeof window.getAuthHeaders === 'function') ? window.getAuthHeaders() : { 'Content-Type': 'application/json' };

            // Search requests to the analyzer
            const requestBody = { query: query, platform: currentAddPlatform, country: "KR" };

            const res = await fetch("/api/v1/analyze", {
                method: "POST",
                headers: { ...headers, "Content-Type": "application/json" },
                body: JSON.stringify(requestBody)
            });

            const json = await res.json();

            if (res.ok && json.status === "success" && json.data && json.data.length > 0) {
                // Success: Extracted brand from first ad
                const rawBrandName = json.data[0].brand || query;
                const platformDisplay = currentAddPlatform.charAt(0).toUpperCase() + currentAddPlatform.slice(1);

                // Use heuristic to determine if it is a generic keyword search
                const isGenericKeyword = rawBrandName.toLowerCase() !== query.toLowerCase() &&
                    !rawBrandName.toLowerCase().includes(query.toLowerCase());

                const finalDisplayName = isGenericKeyword ? query : rawBrandName;
                tempFetchedAds = json.data;
                tempBrandName = finalDisplayName;
                window.tempIsKeyword = isGenericKeyword;

                // Populate search results dropdown
                if (competitorSearchResults) {
                    const match = finalDisplayName.match(/[A-Z가-힣0-9]/i);
                    const iconChar = match ? match[0] : 'K';

                    let bgCol = "#3b82f6";
                    if (currentAddPlatform === "instagram") bgCol = "#e1306c";
                    else if (currentAddPlatform === "tiktok") bgCol = "#000000";
                    else if (currentAddPlatform === "google") bgCol = "#ea4335";

                    let iconHtml = `<span style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; background: ${bgCol}; color: white; width: 100%; height: 100%; font-size: 1rem;">${iconChar}</span>`;
                    let titleHtml = `${finalDisplayName} <i class="fa-solid fa-circle-check" style="color: ${bgCol}; font-size: 0.8rem;"></i>`;

                    if (isGenericKeyword) {
                        iconHtml = `<i class="fa-solid fa-magnifying-glass" style="color: #64748b; font-size: 1rem; background: #f1f5f9; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;"></i>`;
                        titleHtml = `'${finalDisplayName}' 모니터링`;
                    }

                    competitorSearchResults.innerHTML = `
                        <div class="search-result-item" style="padding: 1rem; display: flex; align-items: center; gap: 1rem; cursor: pointer; border-bottom: 1px solid #f1f5f9; background: #f8fafc;"
                            onmouseover="this.style.background='#eff6ff'"
                            onmouseout="this.style.background='#f8fafc'">
                            <div style="width: 40px; height: 40px; border-radius: 50%; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; overflow: hidden; background: white; flex-shrink: 0;">
                                ${iconHtml}
                            </div>
                            <div style="line-height: 1.3;">
                                <div style="font-weight: 600; font-size: 0.85rem; color: var(--text-main); display: flex; align-items: center; gap: 0.3rem;">
                                    ${titleHtml}
                                    <span style="font-size: 0.65rem; color: #10b981; font-weight: 600; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 2px 4px; border-radius: 4px;">게재 레퍼런스 ${json.data.length}개</span>
                                </div>
                                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem;">
                                    모티버스 AI 분석 완료 · ${platformDisplay} 플랫폼
                                </div>
                            </div>
                        </div>
                    `;
                    competitorSearchResults.classList.remove("hidden");
                }
            } else {
                alert(json.message || "해당 키워드로 검색된 광고를 찾지 못했습니다.");
            }
        } catch (error) {
            console.error(error);
            alert("검색 중 오류가 발생했습니다.");
        } finally {
            competitorSearchBtn.innerHTML = originalBtnText;
            competitorSearchBtn.disabled = false;
        }
    });

    // Action: Pick search result 
    competitorSearchResults?.addEventListener("click", (e) => {
        const item = e.target.closest('div.search-result-item');
        if (item) {
            competitorSearchResults.classList.add("hidden");
            // Highlight the selection
            if (competitorSearchInput) competitorSearchInput.value = tempBrandName;

            // Enable submit button
            if (submitCompetitorModalBtn) {
                submitCompetitorModalBtn.disabled = false;
                submitCompetitorModalBtn.style.background = "#3b82f6";
                submitCompetitorModalBtn.style.color = "white";
                submitCompetitorModalBtn.style.cursor = "pointer";
            }
        }
    });

    window.addCompetitorDirectly = async function (brandName, platform, fetchedAds, isKeyword = false, dbData = null) {
        if (!brandName || !fetchedAds) return;

        // Duplicate check (only on UI directly adding)
        if (!dbData) {
            const existingItems = document.querySelectorAll('#monitorSidebarList .competitor-item');
            for (let i = 0; i < existingItems.length; i++) {
                if (existingItems[i].dataset.brand === brandName && existingItems[i].dataset.platform === platform) {
                    alert("이미 모니터링을 하고 있습니다.");
                    return;
                }
            }
        }

        // DB Insert if not loaded from DB
        let brandId = dbData?.id;
        let currentMemo = dbData?.memo || "";
        let currentFolderId = dbData?.folder_id || null;

        if (!dbData && window._motiverseSession && typeof window.saveMonitoredBrandDB === 'function') {
            const saved = await window.saveMonitoredBrandDB({
                brand_name: brandName,
                platform: platform,
                ads_data: fetchedAds,
                is_keyword: isKeyword,
                memo: '',
                folder_id: null
            });
            if (saved) brandId = saved.id;
        }

        // Update UI Sidebar to add this new search folder
        const monitorSidebarList = document.getElementById("monitorSidebarList");
        const monitorSidebarEmpty = document.getElementById("monitorSidebarEmpty");
        const monitorCountText = document.querySelector("#monitorView > div:nth-child(1) > div:nth-child(1) > div > span");

        if (monitorSidebarEmpty) monitorSidebarEmpty.classList.add("hidden");
        if (monitorSidebarList) monitorSidebarList.classList.remove("hidden");

        // UI builder for sidebar (Competitor Item)
        const newItemBlock = document.createElement('div');
        newItemBlock.classList.add('competitor-item');
        newItemBlock.dataset.brand = brandName;
        newItemBlock.dataset.platform = platform;
        newItemBlock.dataset.id = brandId;
        newItemBlock.style.cssText = "background: white; border: 1px solid #3b82f6; border-radius: 8px; padding: 0.8rem 1rem; margin-bottom: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem; cursor: pointer; position: relative;";

        // Save references before we clear the globals
        const savedBrandName = brandName;
        const savedFetchedAds = fetchedAds;

        function updateCompetitorCount() {
            const countNode = document.querySelector("#monitorView > div:nth-child(1) > div:nth-child(1) > div > span");
            if (countNode) {
                const count = document.querySelectorAll('#monitorSidebarList .competitor-item').length;
                countNode.innerText = `${count}개 경쟁사 모니터링 중`;
            }
        }

        // Let's add a click handler but be careful to not trigger when clicking the ellipsis
        newItemBlock.addEventListener('click', () => {
            window.showCompetitorDetail(savedBrandName, platform, savedFetchedAds, isKeyword);
        });

        // Determine icon based on platform
        let bgCol = "#3b82f6";
        let iconClass = "fa-brands fa-meta";
        if (platform === "instagram") { bgCol = "#e1306c"; iconClass = "fa-brands fa-instagram"; }
        else if (platform === "tiktok") { bgCol = "#000000"; iconClass = "fa-brands fa-tiktok"; }
        else if (platform === "google") { bgCol = "#ea4335"; iconClass = "fa-brands fa-google"; }

        let nameDisplay = `<span style="color:${bgCol}; font-weight: bold; font-family: sans-serif;">AD</span> ${savedBrandName}`;
        if (isKeyword) {
            nameDisplay = `<i class="fa-solid fa-magnifying-glass" style="color:#64748b;"></i> '${savedBrandName}'`;
        }

        newItemBlock.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
                 <div style="display: flex; flex-direction: column; gap: 0.3rem; flex: 1; min-width: 0;">
                     <span style="font-weight: 600; font-size: 0.9rem; color: var(--text-main); line-height: 1.3; overflow-wrap: break-word; word-break: break-all;">${nameDisplay}</span>
                     <span class="memo-display hidden" style="font-size: 0.75rem; color: #64748b; background: #f8fafc; padding: 4px 8px; border-radius: 4px; border: 1px dashed #cbd5e1; width: fit-content; text-align: left;"></span>
                 </div>
                 
                    <div style="display: flex; align-items: flex-start; gap: 0.3rem; flex-shrink: 0; padding-top: 2px;">
                        <span style="font-size: 0.7rem; color: #10b981; background: #ecfdf5; padding: 2px 6px; border-radius: 4px; font-weight: 600; white-space: nowrap;">+${savedFetchedAds.length}개</span>
                        <div class="monitor-options-btn" style="padding: 0 4px; color: var(--text-muted); z-index: 2; position: relative;" onclick="event.stopPropagation(); this.nextElementSibling.classList.toggle('hidden');">
                            <i class="fa-solid fa-ellipsis"></i>
                        </div>
                        <div class="competitor-dropdown hidden" style="position: absolute; left: calc(100% + 5px); top: 0px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); z-index: 99999; width: 170px; text-align: left;">
                            <div class="edit-memo-btn" style="padding: 0.6rem 1rem; cursor: pointer; font-size: 0.85rem; color: var(--text-main); display: flex; gap: 0.5rem; align-items: center;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                            <i class="fa-solid fa-pen" style="width: 14px; text-align: center; color: #64748b;"></i> 메모 수정
                         </div>
                         <div class="move-folder-btn" style="position: relative; padding: 0.6rem 1rem; cursor: pointer; font-size: 0.85rem; color: var(--text-main); display: flex; justify-content: space-between; align-items: center;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                            <div style="display: flex; gap: 0.5rem; align-items: center;"><i class="fa-regular fa-folder" style="width: 14px; text-align: center; color: #64748b;"></i> 폴더로 이동</div>
                            <i class="fa-solid fa-angle-right" style="color: #64748b; font-size: 0.75rem;"></i>
                            <div class="folder-list-sub hidden" style="position: absolute; right: 100%; top: 0; margin-right: 5px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); width: 150px; z-index: 999999; display: flex; flex-direction: column; overflow: hidden;">
                                <!-- Populated dynamically -->
                            </div>
                         </div>
                         <div class="remove-list-btn" style="padding: 0.6rem 1rem; cursor: pointer; font-size: 0.85rem; color: var(--text-main); display: flex; gap: 0.5rem; align-items: center; border-bottom: 1px solid #e2e8f0;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                            <i class="fa-solid fa-folder-minus" style="width: 14px; text-align: center; color: #64748b;"></i> 목록에서 제거
                         </div>
                         <div class="delete-competitor-btn" style="padding: 0.6rem 1rem; cursor: pointer; font-size: 0.85rem; color: #ef4444; display: flex; gap: 0.5rem; align-items: center;" onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='white'">
                            <i class="fa-regular fa-trash-can" style="width: 14px; text-align: center;"></i> 삭제
                         </div>
                     </div>
                 </div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem;">
                 <span><i class="fa-regular fa-clock"></i> 마지막 확인: 방금 <span style="background:#eff6ff; color:#3b82f6; padding: 1px 4px; border-radius: 4px; border: 1px solid #bfdbfe; margin-left:2px;">KR</span></span>
                 <i class="${iconClass}" style="color: ${bgCol}; font-size: 1rem;"></i>
            </div>
        `;

        let memoDisplay = newItemBlock.querySelector('.memo-display');
        if (currentMemo) {
            memoDisplay.innerText = currentMemo;
            memoDisplay.classList.remove('hidden');
        }

        newItemBlock.querySelector('.edit-memo-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            newItemBlock.querySelector('.competitor-dropdown').classList.add('hidden');
            const memo = prompt("경쟁사 메모를 수정하세요:", currentMemo || "작성된 메모가 없습니다.");
            if (memo !== null) { // User pressed OK, not Cancel
                currentMemo = memo.trim();
                if (currentMemo !== "" && currentMemo !== "작성된 메모가 없습니다.") {
                    memoDisplay.innerText = currentMemo;
                    memoDisplay.classList.remove('hidden');
                } else {
                    currentMemo = "";
                    memoDisplay.innerText = "";
                    memoDisplay.classList.add('hidden');
                }
                if (brandId && window._motiverseSession && typeof window.updateMonitoredBrandDB === 'function') {
                    await window.updateMonitoredBrandDB(brandId, { memo: currentMemo });
                }
            }
        });

        // Setup folder list submenu dynamically on mouse hover
        const moveFolderBtn = newItemBlock.querySelector('.move-folder-btn');
        moveFolderBtn.addEventListener('mouseenter', () => {
            const sub = moveFolderBtn.querySelector('.folder-list-sub');
            const folders = Array.from(document.querySelectorAll('#monitorSidebarList .folder-container'));
            if (folders.length === 0) {
                sub.innerHTML = '<div style="padding: 0.6rem 1rem; color: #94a3b8; font-size: 0.8rem;">생성된 폴더가 없습니다</div>';
            } else {
                sub.innerHTML = '';
                folders.forEach(f => {
                    const fname = f.querySelector('.folder-name-text').innerText;
                    const fbtn = document.createElement('div');
                    fbtn.innerText = fname;
                    fbtn.style.cssText = "padding: 0.6rem 1rem; font-size: 0.85rem; color: var(--text-main); cursor: pointer; border-bottom: 1px solid #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;";
                    fbtn.onmouseover = () => fbtn.style.background = '#f8fafc';
                    fbtn.onmouseout = () => fbtn.style.background = 'white';

                    fbtn.onclick = async (e) => {
                        e.stopPropagation();
                        // Close dropdowns
                        newItemBlock.querySelector('.competitor-dropdown').classList.add('hidden');
                        sub.classList.add('hidden');
                        // Move element to folderContent
                        const content = f.querySelector('.folder-content');
                        if (content) {
                            content.appendChild(newItemBlock);
                            // Open folder if it was closed
                            const icon = f.querySelector('.folder-toggle-icon');
                            content.classList.remove('hidden');
                            if (icon) {
                                icon.classList.remove('fa-angle-left');
                                icon.classList.add('fa-angle-down');
                            }
                            const targetFolderId = f.dataset.id;
                            if (brandId && targetFolderId && window._motiverseSession && typeof window.updateMonitoredBrandDB === 'function') {
                                await window.updateMonitoredBrandDB(brandId, { folder_id: targetFolderId });
                            }
                        }
                    };
                    sub.appendChild(fbtn);
                });
            }
            sub.classList.remove('hidden');
        });

        moveFolderBtn.addEventListener('mouseleave', () => {
            moveFolderBtn.querySelector('.folder-list-sub').classList.add('hidden');
        });

        // Remove from List (Move back to root if inside a folder)
        newItemBlock.querySelector('.remove-list-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            newItemBlock.querySelector('.competitor-dropdown').classList.add('hidden');
            const sidebarList = document.getElementById("monitorSidebarList");
            if (newItemBlock.parentElement && newItemBlock.parentElement.classList.contains('folder-content')) {
                // Ensure it gets inserted after folders or at top (let's prepend to main list)
                sidebarList.insertBefore(newItemBlock, sidebarList.firstChild);
                if (brandId && window._motiverseSession && typeof window.updateMonitoredBrandDB === 'function') {
                    await window.updateMonitoredBrandDB(brandId, { folder_id: null });
                }
            } else {
                alert("이미 최상위 목록에 있습니다. (어떤 폴더에도 속해있지 않습니다)");
            }
        });

        newItemBlock.querySelector('.delete-competitor-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            newItemBlock.querySelector('.competitor-dropdown').classList.add('hidden');
            if (confirm("정말 이 경쟁사를 삭제하시겠습니까? (삭제 시 함께 저장된 광고 데이터 연동이 해제될 수 있습니다)")) {
                if (brandId && window._motiverseSession && typeof window.deleteMonitoredBrandDB === 'function') {
                    await window.deleteMonitoredBrandDB(brandId);
                }
                newItemBlock.remove();
                if (monitorSidebarList.children.length === 0) {
                    monitorSidebarEmpty?.classList.remove("hidden");
                    monitorSidebarList?.classList.add("hidden");
                }
                updateCompetitorCount();
            }
        });

        // Close dropdown when clicking elsewhere
        document.addEventListener('click', function closeDropdown(e) {
            if (!newItemBlock.contains(e.target)) {
                const dropdown = newItemBlock.querySelector('.competitor-dropdown');
                if (dropdown) dropdown.classList.add('hidden');
            }
        });

        if (monitorSidebarList) monitorSidebarList.insertBefore(newItemBlock, monitorSidebarList.firstChild);

        // Update the count to accurately reflect reality
        updateCompetitorCount();

        if (!dbData) {
            // Display Detail View immediately only if it's a new UI direct add
            window.showCompetitorDetail(savedBrandName, platform, savedFetchedAds, isKeyword);
            // Force navigate to monitor tab
            document.getElementById('monitorBtn')?.click();
        }

        // Return the DOM block to appending helper
        return newItemBlock;
    };

    // Step 2: Add Competitor to List (Submit Form)
    submitCompetitorModalBtn?.addEventListener("click", async () => {
        if (!tempBrandName || !tempFetchedAds) return;

        window.addCompetitorDirectly(tempBrandName, currentAddPlatform, tempFetchedAds, window.tempIsKeyword);

        // Close Modal & Reset
        modalAddCompetitor?.classList.add("hidden");
        if (competitorSearchInput) competitorSearchInput.value = "";
        if (submitCompetitorModalBtn) {
            submitCompetitorModalBtn.disabled = true;
            submitCompetitorModalBtn.style.background = "#e2e8f0";
            submitCompetitorModalBtn.style.color = "#94a3b8";
        }
        if (competitorSearchResults) competitorSearchResults.innerHTML = '';

        // Clear temp vars
        tempFetchedAds = null;
        tempBrandName = "";
        window.tempIsKeyword = false;
    });

    // Create New Folder Logic
    const confirmFolderBtn = document.getElementById("confirmFolderBtn");
    const newFolderNameInput = document.getElementById("newFolderNameInput");
    const monitorSidebarList = document.getElementById("monitorSidebarList");
    const monitorSidebarEmpty = document.getElementById("monitorSidebarEmpty");
    const monitorCountText = document.querySelector("#monitorView > div:nth-child(1) > div:nth-child(1) > div > span");

    window.createFolderDirectly = async function (folderName, folderId = null) {
        monitorSidebarEmpty?.classList.add("hidden");
        monitorSidebarList?.classList.remove("hidden");

        const newFolderBlock = document.createElement('div');
        newFolderBlock.className = 'folder-container';
        newFolderBlock.style.cssText = "margin-bottom: 0.5rem;";

        let currentId = folderId;
        if (!currentId && window._motiverseSession && typeof window.saveMonitorFolderDB === 'function') {
            const saved = await window.saveMonitorFolderDB(folderName);
            if (saved) currentId = saved.id;
        }
        newFolderBlock.dataset.id = currentId;

        const folderHeader = document.createElement('div');
        folderHeader.style.cssText = "border: 1px solid #3b82f6; border-radius: 8px; padding: 0.8rem 1rem; background: white; display: flex; justify-content: space-between; align-items: center; cursor: pointer; color: #3b82f6; font-weight: 600; position: relative;";

        // Toggle folder open/close
        folderHeader.addEventListener('click', () => {
            const content = newFolderBlock.querySelector('.folder-content');
            const icon = folderHeader.querySelector('.folder-toggle-icon');
            if (content) {
                content.classList.toggle('hidden');
                if (content.classList.contains('hidden')) {
                    icon.classList.remove('fa-angle-down');
                    icon.classList.add('fa-angle-left');
                } else {
                    icon.classList.remove('fa-angle-left');
                    icon.classList.add('fa-angle-down');
                }
            }
        });

        folderHeader.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <i class="fa-solid fa-angle-left folder-toggle-icon"></i>
                <span class="folder-name-text">${folderName}</span>
            </div>
            <div class="folder-options-btn" style="padding: 0 5px;" onclick="event.stopPropagation(); this.nextElementSibling.classList.toggle('hidden');">
                <i class="fa-solid fa-ellipsis"></i>
            </div>
            <div class="folder-dropdown hidden" style="position: absolute; right: -100px; top: 30px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); z-index: 999; width: 120px; text-align: left;">
                <div class="rename-btn" style="padding: 0.5rem 1rem; cursor: pointer; font-size: 0.85rem; color: var(--text-main); border-bottom: 1px solid #e2e8f0;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">폴더명 변경</div>
                <div class="delete-btn" style="padding: 0.5rem 1rem; cursor: pointer; font-size: 0.85rem; color: #ef4444;" onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='white'">폴더 삭제</div>
            </div>
        `;

        const folderContent = document.createElement('div');
        folderContent.className = 'folder-content hidden';
        folderContent.style.cssText = "padding-left: 1rem; padding-top: 0.5rem; display: flex; flex-direction: column;";

        newFolderBlock.appendChild(folderHeader);
        newFolderBlock.appendChild(folderContent);

        newFolderBlock.querySelector('.rename-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            newFolderBlock.querySelector('.folder-dropdown').classList.add('hidden');
            const newName = prompt("새 폴더명을 입력하세요:", newFolderBlock.querySelector('.folder-name-text').innerText);
            if (newName && newName.trim() !== "") {
                newFolderBlock.querySelector('.folder-name-text').innerText = newName.trim();
                const fid = newFolderBlock.dataset.id;
                if (fid && window._motiverseSession && typeof window.renameMonitorFolderDB === 'function') {
                    await window.renameMonitorFolderDB(fid, newName.trim());
                }
            }
        });

        newFolderBlock.querySelector('.delete-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            newFolderBlock.querySelector('.folder-dropdown').classList.add('hidden');
            if (confirm("정말 이 폴더를 삭제하시겠습니까? 안의 항목들도 함께 삭제됩니다.")) {
                const fid = newFolderBlock.dataset.id;
                if (fid && window._motiverseSession && typeof window.deleteMonitorFolderDB === 'function') {
                    await window.deleteMonitorFolderDB(fid);
                }
                newFolderBlock.remove();
                if (monitorSidebarList.children.length === 0) {
                    monitorSidebarEmpty?.classList.remove("hidden");
                    monitorSidebarList?.classList.add("hidden");
                }
                const countNode = document.querySelector("#monitorView > div:nth-child(1) > div:nth-child(1) > div > span");
                if (countNode) {
                    const count = document.querySelectorAll('#monitorSidebarList .competitor-item').length;
                    countNode.innerText = `${count}개 경쟁사 모니터링 중`;
                }
            }
        });

        // Close dropdown when clicking elsewhere
        document.addEventListener('click', function closeDropdown(e) {
            if (!newFolderBlock.contains(e.target)) {
                const dropdown = newFolderBlock.querySelector('.folder-dropdown');
                if (dropdown) dropdown.classList.add('hidden');
            }
        });

        // Prepend to top
        monitorSidebarList.insertBefore(newFolderBlock, monitorSidebarList.firstChild);

        return newFolderBlock;
    };

    confirmFolderBtn?.addEventListener("click", () => {
        const folderName = newFolderNameInput?.value.trim() || '새로운 폴더';
        window.createFolderDirectly(folderName);

        // Close modal and clear input
        if (newFolderNameInput) newFolderNameInput.value = "";
        const modalAddFolder = document.getElementById("modalAddFolder");
        modalAddFolder?.classList.add("hidden");
    });

    window.loadMonitorState = async function () {
        if (!window._motiverseSession) return;

        const monitorSidebarList = document.getElementById("monitorSidebarList");
        const monitorSidebarEmpty = document.getElementById("monitorSidebarEmpty");

        // 1. Load Folders
        let folders = [];
        if (typeof window.loadMonitorFoldersDB === 'function') {
            folders = await window.loadMonitorFoldersDB();
        }

        const folderMap = {};
        for (const f of folders) {
            const folderEl = await window.createFolderDirectly(f.name, f.id);
            folderMap[f.id] = folderEl;
        }

        // 2. Load Competitors
        let items = [];
        if (typeof window.loadMonitoredBrandsDB === 'function') {
            items = await window.loadMonitoredBrandsDB();
        }

        for (const item of items) {
            let parsedAds = item.ads_data;
            if (typeof parsedAds === 'string') {
                try { parsedAds = JSON.parse(parsedAds); } catch (e) { parsedAds = []; }
            }
            const itemEl = await window.addCompetitorDirectly(
                item.brand_name,
                item.platform,
                parsedAds || [],
                item.is_keyword || false,
                item // Pass DB Data
            );

            if (item.folder_id && folderMap[item.folder_id]) {
                const fContent = folderMap[item.folder_id].querySelector('.folder-content');
                if (fContent) fContent.appendChild(itemEl);
            }
        }

        if (folders.length > 0 || items.length > 0) {
            if (monitorSidebarEmpty) monitorSidebarEmpty.classList.add("hidden");
            if (monitorSidebarList) monitorSidebarList.classList.remove("hidden");
        }

        const countNode = document.querySelector("#monitorView > div:nth-child(1) > div:nth-child(1) > div > span");
        if (countNode) {
            const count = document.querySelectorAll('#monitorSidebarList .competitor-item').length;
            countNode.innerText = `${count}개 경쟁사 모니터링 중`;
        }
    };
});

document.addEventListener('DOMContentLoaded', () => {

    const monitorBtn = document.getElementById('monitorBtn');
    const analyzeBtn = document.getElementById('analyzeBtn'); // 레퍼런스 탐색 탭 버튼
    const mainView = document.getElementById('mainView');
    const monitorView = document.getElementById('monitorView');

    window.switchMonitorTab = function (tabId) {
        // 모든 탭 스타일 초기화
        document.querySelectorAll('.monitor-tab').forEach(tab => {
            tab.style.borderBottom = '2px solid transparent';
            tab.style.color = 'var(--text-muted)';
            tab.style.fontWeight = '600';
            tab.classList.remove('active');
        });

        // 탭 콘텐츠 숨기기
        document.getElementById('monitorAdsView')?.classList.add('hidden');
        document.getElementById('monitorHistoryView')?.classList.add('hidden');
        document.getElementById('monitorTimelineView')?.classList.add('hidden');
        document.getElementById('monitorDashboardView')?.classList.add('hidden');

        // 선택된 탭 활성화
        const selectedTab = document.getElementById(`monitorTab${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);
        if (selectedTab) {
            selectedTab.style.borderBottom = '2px solid #3b82f6';
            selectedTab.style.color = '#3b82f6';
            selectedTab.style.fontWeight = '700';
            selectedTab.classList.add('active');
        }

        // 선택된 콘텐츠 보여주기
        const selectedView = document.getElementById(`monitor${tabId.charAt(0).toUpperCase() + tabId.slice(1)}View`);
        if (selectedView) {
            selectedView.classList.remove('hidden');
        }
    };

    if (monitorBtn) {
        // This part of the original code was not provided in the instruction,
        // so I'm leaving it as is, assuming it's part of the existing DOMContentLoaded.
        // The instruction only provided the new function and its surrounding context.
        // The `if (monitorBtn)` block is likely part of the existing DOMContentLoaded.
        // Since the instruction explicitly put `if (monitorBtn)` inside the *new* DOMContentLoaded,
        // I will place it there.
    }
    // 북마크 토글 기능
    const bookmarkToggleBtn = document.getElementById('bookmarkToggleBtn');
    if (bookmarkToggleBtn) {
        bookmarkToggleBtn.addEventListener('click', () => {
            const mode = bookmarkToggleBtn.dataset.mode;
            if (mode === 'all') {
                bookmarkToggleBtn.dataset.mode = 'bookmarked';
                bookmarkToggleBtn.querySelector('.btn-text').innerText = '모두 보기';
                bookmarkToggleBtn.style.background = '#eef2ff'; // Slightly highlighted
                bookmarkToggleBtn.style.borderColor = '#c7d2fe';
            } else {
                bookmarkToggleBtn.dataset.mode = 'all';
                bookmarkToggleBtn.querySelector('.btn-text').innerText = '북마크';
                bookmarkToggleBtn.style.background = 'white';
                bookmarkToggleBtn.style.borderColor = '#e2e8f0';
            }
            if (typeof window.renderMonitorAds === 'function') {
                window.renderMonitorAds();
            }
        });
    }

    // 정렬 기능
    const monitorSortSelect = document.getElementById('monitorSortSelect');
    if (monitorSortSelect) {
        monitorSortSelect.addEventListener('change', () => {
            if (typeof window.renderMonitorAds === 'function') {
                window.renderMonitorAds();
            }
        });
    }

});

window.renderMonitorAds = function (page = 1) {
    if (typeof page === 'number') {
        window._currentMonitorPage = page;
    } else {
        window._currentMonitorPage = 1;
    }

    const adGrid = document.getElementById("monitorAdGrid");
    if (!adGrid) return;
    adGrid.innerHTML = '';

    let adsToRender = [...(window._currentMonitorAds || [])];
    const platform = window._currentMonitorPlatform;
    const sortVal = document.getElementById('monitorSortSelect')?.value;
    const bookmarkBtn = document.getElementById('bookmarkToggleBtn');
    const showOnlyBookmarked = bookmarkBtn?.dataset.mode === 'bookmarked';

    if (showOnlyBookmarked) {
        // Supposing bookmarked status is stored in supabase or locally via features.js bookmark mapping
        // We can check if `bookmarkBtnMap` or `is_bookmarked` applies, or just lookup UI state.
        // Currently, without a specific map, we'll try to find if there's any global map from auth.js or features.js.
        // We'll rely on global `window.userBookmarks` which might be managed by auth.js.
        adsToRender = adsToRender.filter(ad => {
            if (ad.is_bookmarked) return true;
            if (window.userBookmarks && window.userBookmarks.includes(ad.ad_id_for_db || ad.ad_id)) return true;
            // Also fallback checking the DOM dataset if the card was ever rendered and marked (optional)
            return false;
        });
    }

    // Pre-calculate derived fields for sorting if missing
    adsToRender.forEach(ad => {
        // Start Date fallback
        let sDate = String(ad.start_date || ad.creation_date || '2024-01-01').trim();

        // Fix broken Meta dates from previous truncated cache (e.g. "14 Mar 202" -> "14 Mar 2024")
        if (/^\d{1,2} [A-Za-z]{3} 202$/.test(sDate)) {
            sDate += '4';
        }
        // Fix Korean format
        if (sDate.includes('년')) {
            sDate = sDate.replace(/[년월일]/g, '-').replace(/-\s*-/g, '-').replace(/-$/, '').replace(/\s+/g, '');
        }
        // Fix Unix timestamp string
        if (/^\d{10,13}$/.test(sDate)) {
            let t = parseInt(sDate);
            if (sDate.length === 10) t *= 1000;
            sDate = t;
        }

        let parsedDate = new Date(sDate);
        if (isNaN(parsedDate.getTime())) {
            let hash = 0;
            const str = ad.ad_id || "fallback";
            for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
            parsedDate = new Date(new Date('2024-01-01').getTime() + (hash % 10000000000));
        }
        ad._sortDateStr = parsedDate.getTime();

        // Active days
        if (ad._runDays === undefined) {
            if (ad.active_days !== undefined) {
                ad._runDays = parseInt(ad.active_days) || 1;
            } else if (ad.start_date) {
                const diffTime = Math.abs(new Date() - parsedDate);
                ad._runDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
            } else {
                ad._runDays = 14;
            }
        }
    });

    // Sorting
    if (sortVal === 'active_desc') {
        adsToRender.sort((a, b) => b._runDays - a._runDays);
    } else if (sortVal === 'date_desc' || sortVal === 'date_asc') {
        adsToRender.sort((a, b) => {
            return sortVal === 'date_desc' ? b._sortDateStr - a._sortDateStr : a._sortDateStr - b._sortDateStr;
        });
    } else if (sortVal === 'likes_desc') {
        adsToRender.sort((a, b) => (parseInt(b.likes) || 0) - (parseInt(a.likes) || 0));
    } else if (sortVal === 'comments_desc') {
        adsToRender.sort((a, b) => (parseInt(b.comments) || 0) - (parseInt(a.comments) || 0));
    } else if (sortVal === 'views_desc') {
        adsToRender.sort((a, b) => (parseInt(b.views) || 0) - (parseInt(a.views) || 0));
    }

    // Stats update locally for this view
    let imagesCount = 0;
    let videosCount = 0;
    adsToRender.forEach(ad => {
        const mediaType = ad.media_type ? ad.media_type.toLowerCase() : 'image';
        if (mediaType === "video") videosCount++;
        else imagesCount++;
    });

    const statsContainer = document.getElementById("monitorCompetitorStats");
    if (statsContainer) {
        statsContainer.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.4rem;"><span style="color: #10b981;">●</span> 수집된 광고 ${adsToRender.length}개</div>
            <div style="display: flex; align-items: center; gap: 0.4rem;"><i class="fa-regular fa-image"></i> 이미지 ${imagesCount}개</div>
            <div style="display: flex; align-items: center; gap: 0.4rem;"><i class="fa-solid fa-layer-group"></i> 캐러셀 0개</div>
            <div style="display: flex; align-items: center; gap: 0.4rem;"><i class="fa-brands fa-youtube" style="color:#ef4444;"></i> 영상 ${videosCount}개</div>
            <div style="display: flex; align-items: center; gap: 0.4rem;"><i class="fa-solid fa-share-nodes"></i> DCO / DPA 0개</div>
        `;
    }

    if (adsToRender.length === 0) {
        if (showOnlyBookmarked) {
            adGrid.innerHTML = '<div style="text-align:center;width:100%;grid-column:1 / -1;padding:3rem;color:#64748b;font-weight:600;"><i class="fa-regular fa-bookmark fa-2x" style="margin-bottom:1rem;color:#cbd5e1;display:block;"></i>현재 검색/상태에서 북마크된 항목이 없습니다.</div>';
        } else {
            adGrid.innerHTML = '<div style="text-align:center;width:100%;grid-column:1 / -1;padding:3rem;color:#64748b;">조건에 맞는 레퍼런스를 찾지 못했습니다.</div>';
        }
        return;
    }

    const PAGE_SIZE = 24;
    const currentPage = window._currentMonitorPage || 1;
    const totalPages = Math.ceil(adsToRender.length / PAGE_SIZE);
    const paginatedAds = adsToRender.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    paginatedAds.forEach(ad => {
        const card = window.createAdCard(ad);
        adGrid.appendChild(card);
    });

    if (totalPages > 1) {
        const paginationContainer = document.createElement('div');
        paginationContainer.style.gridColumn = '1 / -1';
        paginationContainer.style.display = 'flex';
        paginationContainer.style.justifyContent = 'center';
        paginationContainer.style.gap = '0.5rem';
        paginationContainer.style.marginTop = '2rem';
        paginationContainer.style.marginBottom = '2rem';

        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement('button');
            btn.innerText = i;
            btn.style.padding = '0.5rem 1rem';
            btn.style.borderRadius = '8px';
            btn.style.border = '1px solid #e2e8f0';
            btn.style.cursor = 'pointer';
            btn.style.fontWeight = '600';
            btn.style.transition = 'all 0.2s';

            if (i === currentPage) {
                btn.style.background = '#3b82f6';
                btn.style.color = 'white';
                btn.style.borderColor = '#3b82f6';
            } else {
                btn.style.background = 'white';
                btn.style.color = '#64748b';
                btn.onmouseover = () => { btn.style.background = '#f8fafc'; };
                btn.onmouseout = () => { btn.style.background = 'white'; };
            }
            btn.onclick = () => {
                window.renderMonitorAds(i);
                // Scroll to top of grid
                document.getElementById('monitorTabAds')?.scrollIntoView({ behavior: 'smooth' });
            };
            paginationContainer.appendChild(btn);
        }
        adGrid.appendChild(paginationContainer);
    }
};

window.showCompetitorDetail = function (brandName, platform, adsData = null, isKeywordParam = null) {
    const welcomeSection = document.getElementById("monitorWelcomeSection");
    const detailSection = document.getElementById("monitorCompetitorDetail");
    const titleEl = document.getElementById("monitorCompetitorTitle");
    const adGrid = document.getElementById("monitorAdGrid");

    if (welcomeSection) welcomeSection.classList.add("hidden");
    if (detailSection) detailSection.classList.remove("hidden");

    // AI 인사이트 탭 내용 초기화 및 이전 리포트 불러오기
    const aiInsightContent = document.getElementById('aiInsightContent');
    if (aiInsightContent) {
        aiInsightContent.innerHTML = `
            <div style="text-align: center; color: #94a3b8; padding: 3rem 0;">
                <i class="fa-solid fa-robot fa-3x" style="margin-bottom: 1rem; color: #cbd5e1;"></i>
                <p style="font-weight: 600;">상단 'AI 리포트 생성하기' 버튼을 눌러보세요.</p>
                <p style="font-size: 0.85rem;">현재 수집된 소재들을 분석하여 성과 패턴과 당사 적용 전략을 제안합니다.</p>
            </div>
        `;
    }
    const cleanBrandNameForStorage = (brandName || "").replace(/['"]/g, '');
    if (typeof window.loadAndRenderAiReports === 'function') {
        window.loadAndRenderAiReports(cleanBrandNameForStorage, platform);
    }

    let isKeyword = false;
    let cleanName = brandName || "";
    if (brandName) {
        cleanName = brandName.replace(/['"]/g, '');
        if (isKeywordParam !== null && isKeywordParam !== undefined && typeof isKeywordParam === 'boolean') {
            isKeyword = isKeywordParam;
        } else {
            let isHeuristicKeyword = false;
            // Known brands that are purely Korean words
            const knownCoreBrands = ["LG유플러스", "식봄", "아모레퍼시픽", "삼성전자", "현대자동차", "동원F&B"];
            if (/^[가-힣]+$/.test(cleanName) && !knownCoreBrands.includes(cleanName)) {
                isHeuristicKeyword = true;
            }
            isKeyword = brandName !== brandName.replace(/['"]/g, '') || window.tempIsKeyword || brandName.includes(' ') || isHeuristicKeyword;
        }
    }

    if (titleEl) {
        let bgCol = "#3b82f6";
        if (platform === "instagram") bgCol = "#e1306c";
        else if (platform === "tiktok") bgCol = "#000000";
        else if (platform === "google") bgCol = "#ea4335";

        let platformBadge = `<span style="background: ${bgCol}; color: white; border-radius: 12px; padding: 4px 10px; font-size: 0.75rem; font-weight: 600;">${platform === 'meta' ? '대한민국(KR)' : platform.charAt(0).toUpperCase() + platform.slice(1)}</span>`;

        if (isKeyword) {
            titleEl.innerHTML = `
                <div style="width: 40px; height: 40px; border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; overflow: hidden; margin-right: 0.5rem;">
                    <i class="fa-solid fa-magnifying-glass" style="color: #64748b; font-size: 1.2rem;"></i>
                </div> 
                <span style="font-weight:700;">'${cleanName}'</span> <span style="font-size: 1rem; color: #64748b; font-weight: 600; margin-left:0.2rem; margin-right: 0.5rem;">모니터링</span>
                ${platformBadge} <span style="font-size: 0.75rem; color: #94a3b8; font-weight: 500; margin-left: 0.5rem;"><i class="fa-solid fa-rotate"></i> 방금 업데이트됨</span>
            `;
        } else {
            const match = cleanName.match(/[A-Z가-힣0-9]/i);
            const iconChar = match ? match[0] : 'B';

            let customSpan = `<div style="display: flex; align-items: center; justify-content: center; background: ${bgCol}; color: white; width: 40px; height: 40px; border-radius: 50%; font-size: 1.2rem; font-weight: bold; margin-right: 0.5rem; font-family: sans-serif;">${iconChar}</div>`;
            if (cleanName.toLowerCase().includes("lguplus") || cleanName.includes("LG유플러스")) {
                customSpan = `<span style="color:#ec4899; font-family: sans-serif; font-weight: 800; font-size: 1.2rem; margin-right: 0.5rem;">U+</span>`;
            }

            titleEl.innerHTML = `
                ${customSpan} 
                <span style="font-weight:700;">${cleanName}</span> 
                <span style="margin-left: 0.5rem;">${platformBadge}</span> 
                <span style="font-size: 0.75rem; color: #94a3b8; font-weight: 500; margin-left: 0.5rem;"><i class="fa-solid fa-rotate"></i> 방금 업데이트됨</span>
            `;
        }
    }

    if (adGrid && typeof window.createAdCard === 'function') {
        adGrid.innerHTML = '';

        // If data is passed directly (real API search)
        let targetAds = adsData;

        // If not passed, we are clicking on the dummy sidebar items
        if (!targetAds || targetAds.length === 0) {
            targetAds = [];
            for (let i = 0; i < 6; i++) {
                targetAds.push({
                    ad_id: "monitor_dummy_" + i,
                    brand: cleanName,
                    platform: platform,
                    media_type: "image",
                    media_url: "", // empty so it generates gradient
                    hashtags: ["통신", "혜택"],
                    active_days: 30 + i
                });
            }
        }

        // --- Calculate Stats ---
        const totalAds = targetAds.length;
        let imagesCount = 0;
        let videosCount = 0;

        targetAds.forEach(ad => {
            const mediaType = ad.media_type ? ad.media_type.toLowerCase() : 'image';
            if (mediaType === "video") videosCount++;
            else imagesCount++;
        });

        // Try to update stats on the page if the container exists
        const statsContainer = document.getElementById("monitorCompetitorStats");
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.4rem;"><span style="color: #10b981;">●</span> 수집된 광고 ${totalAds}개</div>
                <div style="display: flex; align-items: center; gap: 0.4rem;"><i class="fa-regular fa-image"></i> 이미지 ${imagesCount}개</div>
                <div style="display: flex; align-items: center; gap: 0.4rem;"><i class="fa-solid fa-layer-group"></i> 캐러셀 0개</div>
                <div style="display: flex; align-items: center; gap: 0.4rem;"><i class="fa-brands fa-youtube" style="color:#ef4444;"></i> 영상 ${videosCount}개</div>
                <div style="display: flex; align-items: center; gap: 0.4rem;"><i class="fa-solid fa-share-nodes"></i> DCO / DPA 0개</div>
            `;
        }

        // 글로벌 상태로 저장하여 렌더링 함수에서 참조할 수 있게 함
        window._currentMonitorPlatform = platform;
        window._currentMonitorAds = targetAds;
        window._currentMonitorBrand = cleanName;

        const sortSelect = document.getElementById('monitorSortSelect');
        if (sortSelect) {
            sortSelect.innerHTML = '';
            if (platform === 'meta') {
                sortSelect.innerHTML = '<option value="active_desc">↓ 게재 기간순</option><option value="date_desc">최신순</option><option value="date_asc">오래된 순</option>';
            } else if (platform === 'instagram' || platform === 'tiktok') {
                sortSelect.innerHTML = '<option value="likes_desc">↓ 좋아요순</option><option value="date_desc">최신순</option><option value="date_asc">오래된 순</option><option value="comments_desc">댓글순</option><option value="views_desc">조회수 순</option>';
            } else { // google 등
                sortSelect.innerHTML = '<option value="date_desc">↓ 최신순</option><option value="date_asc">오래된 순</option>';
            }
            sortSelect.value = sortSelect.options[0].value;
        }

        const bookmarkToggleBtn = document.getElementById('bookmarkToggleBtn');
        if (bookmarkToggleBtn) {
            bookmarkToggleBtn.dataset.mode = 'all';
            bookmarkToggleBtn.querySelector('.btn-text').innerText = '북마크';
            bookmarkToggleBtn.style.background = 'white';
            bookmarkToggleBtn.style.borderColor = '#e2e8f0';
        }

        window.renderMonitorAds();

        // --- 게재 히스토리 탭 제어 ---
        const historyTab = document.getElementById('monitorTabHistory');
        const historyView = document.getElementById('monitorHistoryView');

        if (historyTab) {
            // 메타 플랫폼만 게재 히스토리 활성화
            if (platform === 'meta') {
                historyTab.style.display = 'flex';
                // 탭 스위치(Ads)로 초기화
                window.switchMonitorTab('ads');
            } else {
                historyTab.style.display = 'none';
            }
        }

        if (historyView && platform === 'meta') {
            historyView.innerHTML = '';

            // 데이터 그룹화 (날짜 기준)
            const groupedAds = {};
            targetAds.forEach(ad => {
                // 시작일 파싱 (더미 날짜 생성 방어 코드 포함)
                let sDate = new Date();
                if (ad.start_date) {
                    sDate = new Date(ad.start_date);
                } else if (ad.creation_date) {
                    sDate = new Date(ad.creation_date);
                } else {
                    // 더미인 경우 랜덤하게 최근 3일 중 하나로
                    const randomDaysAgo = Math.floor(Math.random() * 3);
                    sDate.setDate(sDate.getDate() - randomDaysAgo);
                }

                const dayStr = ["일", "월", "화", "수", "목", "금", "토"][sDate.getDay()];
                const dateKey = `${sDate.getFullYear()}년 ${sDate.getMonth() + 1}월 ${sDate.getDate()}일 (${dayStr})`;

                if (!groupedAds[dateKey]) {
                    groupedAds[dateKey] = {
                        dateStr: dateKey,
                        activeAds: [],
                        inactiveAds: []
                    };
                }

                // 임의로 상태 구분 (is_active 프로퍼티 사용)
                if (ad.is_active === false || ad.status === 'INACTIVE') {
                    groupedAds[dateKey].inactiveAds.push(ad);
                } else {
                    groupedAds[dateKey].activeAds.push(ad);
                }
            });

            // 날짜 내림차순 정렬
            const sortedDates = Object.keys(groupedAds).sort((a, b) => {
                return b.localeCompare(a); // 간단한 로케일 비교
            });

            sortedDates.forEach(dateKey => {
                const group = groupedAds[dateKey];
                const totalRunning = group.activeAds.length;

                const groupEl = document.createElement('div');
                groupEl.style.cssText = "margin-bottom: 2rem; border: 1px solid #f1f5f9; background: white; border-radius: 12px; padding: 1.5rem;";

                const headerHtml = `
                    <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom: 1.5rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.8rem;">
                        <span style="font-weight: 700; font-size: 1.15rem; color: var(--text-main);">${dateKey}</span>
                        ${totalRunning > 0 ? `<span style="background: #eff6ff; color: #3b82f6; font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; font-weight: 600;">${totalRunning}개 게재 중</span>` : ''}
                    </div>
                `;

                groupEl.innerHTML = headerHtml;

                // 게재 시작된 광고 영역
                const activeSection = document.createElement('div');
                activeSection.style.marginBottom = '2rem';
                activeSection.innerHTML = `
                    <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom: 1rem;">
                        <span style="color: #10b981; font-size: 0.6rem;">●</span>
                        <span style="font-weight: 600; font-size: 0.9rem; color: var(--text-main);">게재 시작된 광고</span>
                        <span style="background: #ecfdf5; color: #10b981; font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; font-weight: 600;">${group.activeAds.length}개</span>
                    </div>
                `;

                const activeGrid = document.createElement('div');
                activeGrid.style.cssText = "display: flex; gap: 1rem; overflow-x: auto; padding-bottom: 0.5rem;";
                if (group.activeAds.length > 0) {
                    group.activeAds.forEach(ad => {
                        const card = window.createAdCard(ad);
                        card.style.minWidth = '250px';
                        card.style.width = '280px';
                        card.style.maxWidth = '280px';
                        card.style.flexShrink = '0';
                        activeGrid.appendChild(card);
                    });
                } else {
                    activeGrid.innerHTML = `<div style="font-size:0.85rem; color:#94a3b8; width:100%; padding:1rem 0;">해당 내역이 없습니다.</div>`;
                }
                activeSection.appendChild(activeGrid);
                groupEl.appendChild(activeSection);

                // 구분선
                const divider = document.createElement('div');
                divider.style.cssText = 'height: 1px; background: #e2e8f0; border-top: 1px dashed #cbd5e1; margin: 1.5rem 0;';
                groupEl.appendChild(divider);

                // 게재 중단된 광고 영역
                const inactiveSection = document.createElement('div');
                inactiveSection.innerHTML = `
                    <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom: 1rem;">
                        <span style="color: #f59e0b; font-size: 0.6rem;">●</span>
                        <span style="font-weight: 600; font-size: 0.9rem; color: var(--text-main);">게재 중단된 광고</span>
                        <span style="background: #fef3c7; color: #f59e0b; font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; font-weight: 600;">${group.inactiveAds.length}개</span>
                    </div>
                `;

                const inactiveGrid = document.createElement('div');
                inactiveGrid.style.cssText = "display: flex; gap: 1rem; overflow-x: auto; padding-bottom: 0.5rem;";
                if (group.inactiveAds.length > 0) {
                    group.inactiveAds.forEach(ad => {
                        const card = window.createAdCard(ad);
                        card.style.minWidth = '250px';
                        card.style.width = '280px';
                        card.style.maxWidth = '280px';
                        card.style.flexShrink = '0';
                        // 중단된 느낌을 주도록 오버레이 처리 가능
                        const wrapper = card.querySelector('.ad-media-wrapper');
                        if (wrapper) {
                            const stopBadge = document.createElement('div');
                            stopBadge.style.cssText = "position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); background:rgba(0,0,0,0.6); color:white; padding:8px 16px; border-radius:20px; font-weight:bold; font-size:0.8rem; border:1px solid rgba(255,255,255,0.2);";
                            stopBadge.innerText = "게재 중단";
                            wrapper.appendChild(stopBadge);
                        }
                        inactiveGrid.appendChild(card);
                    });
                } else {
                    inactiveGrid.innerHTML = `<div style="font-size:0.85rem; color:#94a3b8; width:100%; padding:1rem 0;">해당 내역이 없습니다.</div>`;
                }
                inactiveSection.appendChild(inactiveGrid);
                groupEl.appendChild(inactiveSection);

                historyView.appendChild(groupEl);
            });
        }

        // --- 게재 타임라인 제어 ---
        const timelineView = document.getElementById('monitorTimelineView');
        if (timelineView) {
            timelineView.innerHTML = '';

            // 최근 30일 날짜 배열 생성
            const today = new Date();
            const dateList = [];
            for (let i = 29; i >= 0; i--) {
                let d = new Date(today);
                d.setDate(today.getDate() - i);
                dateList.push(d);
            }

            const daysStr = ["일", "월", "화", "수", "목", "금", "토"];

            // 타임라인 컨테이너
            const tlContainer = document.createElement('div');
            tlContainer.style.cssText = "border: 1px solid #e2e8f0; border-radius: 8px; background: white; min-width: 1000px; display: flex; flex-direction: column;";

            // 헤더(날짜 행) 생성
            const headerRow = document.createElement('div');
            headerRow.style.cssText = "display: flex; border-bottom: 2px solid #e2e8f0; padding: 0.5rem 0; position: sticky; top: 0; background: white; z-index: 10;";

            const leftHeader = document.createElement('div');
            leftHeader.style.cssText = "width: 250px; min-width: 250px; font-weight: bold; font-size: 0.9rem; color: #475569; display: flex; align-items: center; justify-content: center; border-right: 1px solid #e2e8f0;";
            leftHeader.innerText = "광고목록";
            headerRow.appendChild(leftHeader);

            const datesContainer = document.createElement('div');
            datesContainer.style.cssText = "flex: 1; display: flex; position: relative;";

            dateList.forEach((d, idx) => {
                const isToday = idx === 29;
                const dCol = document.createElement('div');
                dCol.style.cssText = `flex: 1; display: flex; flex-direction: column; align-items: center; font-size: 0.75rem; color: ${d.getDay() === 0 ? '#ef4444' : (d.getDay() === 6 ? '#3b82f6' : '#64748b')}; min-width: 30px;`;

                const daySpan = document.createElement('span');
                daySpan.innerText = daysStr[d.getDay()];
                const dateSpan = document.createElement('span');
                dateSpan.style.cssText = isToday ? "background: #3b82f6; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-weight: bold;" : "font-weight: 600;";
                dateSpan.innerText = d.getDate();

                dCol.appendChild(daySpan);
                dCol.appendChild(dateSpan);
                datesContainer.appendChild(dCol);
            });
            headerRow.appendChild(datesContainer);
            tlContainer.appendChild(headerRow);

            // 각 광고별 게재 일수(_runDays) 사전 계산 (최신순 정렬 및 랜더링 통일용)
            targetAds.forEach(ad => {
                if (ad._runDays === undefined) {
                    ad._runDays = ad.active_days !== undefined ? ad.active_days : Math.floor(Math.random() * 30) + 1;
                    if (ad._runDays < 0) ad._runDays = 1;
                }
            });

            // 본문(광고 행) 생성 - 게재 기간이 짧은 순(최신) 정렬 후 전체 출력
            const displayAds = [...targetAds].sort((a, b) => a._runDays - b._runDays);

            if (displayAds.length === 0) {
                const emptyRow = document.createElement('div');
                emptyRow.style.cssText = "padding: 2rem; text-align: center; color: #94a3b8; font-size: 0.9rem;";
                emptyRow.innerText = "타임라인 데이터가 없습니다.";
                tlContainer.appendChild(emptyRow);
            }

            displayAds.forEach(ad => {
                const row = document.createElement('div');
                row.style.cssText = "display: flex; border-bottom: 1px solid #f1f5f9;";

                const infoCol = document.createElement('div');
                infoCol.style.cssText = "width: 250px; min-width: 250px; padding: 0.6rem 1rem; border-right: 1px solid #e2e8f0; display: flex; gap: 0.5rem; align-items: center;";

                // 썸네일
                const thumb = document.createElement('div');
                thumb.style.cssText = "width: 40px; height: 40px; border-radius: 4px; background: #e2e8f0; flex-shrink: 0; overflow: hidden; display: flex; align-items: center; justify-content: center;";
                if (ad.media_url) {
                    if (ad.media_type === 'video') {
                        thumb.innerHTML = `<video src="${ad.media_url}" style="width:100%; height:100%; object-fit:cover;" muted></video>`;
                    } else {
                        thumb.innerHTML = `<img src="${ad.media_url}" style="width:100%; height:100%; object-fit:cover;" />`;
                    }
                } else {
                    thumb.innerHTML = `<i class="fa-regular fa-image" style="color:#94a3b8"></i>`;
                }

                const txtDetail = document.createElement('div');
                txtDetail.style.cssText = "display: flex; flex-direction: column; overflow: hidden;";

                const titleStr = ad.analysis_report?.hook || "수집된 광고 소재";
                const titleSpan = document.createElement('span');
                titleSpan.style.cssText = "font-size: 0.8rem; font-weight: 600; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;";
                titleSpan.innerText = titleStr;

                const statusSpan = document.createElement('span');
                const isRunning = ad.is_active !== false && ad.status !== 'INACTIVE';
                const runDays = ad._runDays;
                statusSpan.style.cssText = `font-size: 0.7rem; font-weight: 500; color: ${isRunning ? '#10b981' : '#f59e0b'}`;
                statusSpan.innerText = `${isRunning ? '게재중' : '게재종료'} · ${runDays}일간 게재`;

                txtDetail.appendChild(titleSpan);
                txtDetail.appendChild(statusSpan);
                infoCol.appendChild(thumb);
                infoCol.appendChild(txtDetail);
                row.appendChild(infoCol);

                // 간트 차트 막대 영역
                const barCol = document.createElement('div');
                barCol.style.cssText = "flex: 1; display: flex; position: relative; align-items: center; border-left: 1px solid #3b82f6;"; // 오늘선(파란선) 기준으로 임시 시각효과

                // 단순화된 막대 로직 (최근 ~ 시작일)
                // runDays 일수만큼 막대 길이를 잡고 끝을 오른쪽(오늘 혹은 중단일)에 맞춤
                const maxCells = 30; // 30일치 데이터
                let blockWidthPercent = (runDays / maxCells) * 100;
                if (blockWidthPercent > 100) blockWidthPercent = 100;

                const barSpan = document.createElement('div');
                // 만약 게재 종료면 opacity를 줄이거나 색상을 다르게
                barSpan.style.cssText = `height: 20px; border-radius: 4px; background: ${isRunning ? '#10b981' : '#94a3b8'}; width: ${blockWidthPercent}%; margin-left: auto; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.65rem; font-weight: bold;`;
                barSpan.innerText = `${runDays}일`;

                barCol.appendChild(barSpan);
                row.appendChild(barCol);

                tlContainer.appendChild(row);
            });

            timelineView.appendChild(tlContainer);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const generateAiInsightBtn = document.getElementById('generateAiInsightBtn');
    const aiInsightContent = document.getElementById('aiInsightContent');

    if (generateAiInsightBtn) {
        generateAiInsightBtn.addEventListener('click', async () => {
            const adsData = window._currentMonitorAds || [];
            const platform = window._currentMonitorPlatform || 'meta';
            const queryName = window._currentMonitorBrand || document.getElementById('monitorCompetitorTitle')?.innerText.trim() || '선택된 검색어';

            if (adsData.length === 0) {
                alert("현재 표시할 수집된 광고 데이터가 없습니다.");
                return;
            }

            // Show loading state
            generateAiInsightBtn.disabled = true;
            generateAiInsightBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 분석 리포트 생성 중...';
            generateAiInsightBtn.style.background = '#9ca3af';

            if (aiInsightContent) {
                aiInsightContent.innerHTML = `
                    <div style="text-align: center; color: #8b5cf6; padding: 4rem 0;">
                        <i class="fa-solid fa-circle-notch fa-spin fa-3x" style="margin-bottom: 1.5rem;"></i>
                        <p style="font-size: 1.1rem; font-weight: 700;">Motiverse AI가 데이터를 심층 분석 중입니다...</p>
                        <p style="font-size: 0.9rem; color: #64748b; margin-top: 0.5rem;">이 작업은 최대 30~60초 정도 소요될 수 있습니다. (GPT-4o Vision API 연동)</p>
                    </div>
                `;
            }

            try {
                const headers = typeof window.getAuthHeaders === 'function' ? window.getAuthHeaders() : { 'Content-Type': 'application/json' };
                const res = await fetch("/api/v1/generate-insights", {
                    method: 'POST',
                    headers: { ...headers, "Content-Type": "application/json" },
                    body: JSON.stringify({
                        ads_data: adsData,
                        query: queryName,
                        platform: platform
                    })
                });

                const json = await res.json();
                if (res.ok && json.status === "success" && aiInsightContent) {
                    let markdownText = json.data;
                    let renderedHtml = markdownText;
                    if (window.marked && typeof window.marked.parse === 'function') {
                        renderedHtml = window.marked.parse(markdownText);
                    }
                    aiInsightContent.innerHTML = `
                        <div class="ai-insight-result" style="line-height: 1.7; font-size: 0.95rem; color: #1e293b;">
                            ${renderedHtml}
                        </div>
                    `;

                    // History is automatically saved by backend backend. Update history list
                    if (typeof window.loadAndRenderAiReports === 'function') {
                        window.loadAndRenderAiReports(queryName, platform);
                    }

                    // Basic styling for rendered markdown table/headers
                    const resultDiv = aiInsightContent.querySelector('.ai-insight-result');
                    if (resultDiv) {
                        const tables = resultDiv.querySelectorAll('table');
                        tables.forEach(t => {
                            t.style.width = '100%';
                            t.style.borderCollapse = 'collapse';
                            t.style.marginBottom = '1.5rem';
                            t.querySelectorAll('th, td').forEach(cell => {
                                cell.style.border = '1px solid #e2e8f0';
                                cell.style.padding = '0.75rem';
                            });
                            t.querySelectorAll('th').forEach(th => {
                                th.style.background = '#f8fafc';
                                th.style.fontWeight = '600';
                            });
                        });
                        resultDiv.querySelectorAll('h2, h3').forEach(h => {
                            h.style.color = '#0f172a';
                            h.style.marginTop = '1.5rem';
                            h.style.marginBottom = '1rem';
                            h.style.borderBottom = '1px solid #e2e8f0';
                            h.style.paddingBottom = '0.5rem';
                        });
                    }
                } else if (aiInsightContent) {
                    alert('인사이트 리포트 생성 중 오류가 발생했습니다: ' + (json.message || '알 수 없는 오류'));
                    aiInsightContent.innerHTML = `<div style="padding:2rem;text-align:center;color:#ef4444;"><i class="fa-solid fa-triangle-exclamation fa-2x mb-4"></i><p>생성 실패: ${json.message}</p></div>`;
                }
            } catch (e) {
                console.error(e);
                alert("네트워크 또는 서버 오류가 발생했습니다.");
                if (aiInsightContent) {
                    aiInsightContent.innerHTML = `<div style="padding:2rem;text-align:center;color:#ef4444;"><i class="fa-solid fa-triangle-exclamation fa-2x mb-4"></i><p>네트워크 오류</p></div>`;
                }
            } finally {
                generateAiInsightBtn.disabled = false;
                generateAiInsightBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> AI 리포트 생성하기';
                generateAiInsightBtn.style.background = '#8b5cf6';
            }
        });
    }
});

window.loadAndRenderAiReports = async function (brandName, platform) {
    const container = document.getElementById('aiPreviousReportsContainer');
    const list = document.getElementById('aiPreviousReportsList');
    if (!container || !list) return;

    try {
        const res = await fetch(`/api/v1/ai-insights?brand=${encodeURIComponent(brandName)}&platform=${encodeURIComponent(platform)}`, {
            headers: window.getAuthHeaders ? window.getAuthHeaders() : {}
        });

        if (!res.ok) throw new Error("API 요청 실패");

        const json = await res.json();
        let existing = [];
        if (json.status === "success" && Array.isArray(json.data)) {
            existing = json.data;
        }

        if (existing.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        list.innerHTML = '';

        existing.forEach(report => {
            const dt = new Date(report.created_at);
            const dateStr = `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getDate()).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;

            const btn = document.createElement('button');
            btn.innerHTML = `<i class="fa-regular fa-file-lines" style="color: #64748b;"></i> ${dateStr}`;
            btn.style.cssText = "padding: 0.5rem 1rem; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.85rem; font-weight: 500; cursor: pointer; color: #475569; background: white; white-space: nowrap; transition: all 0.2s;";

            btn.onmouseover = () => { btn.style.background = '#f8fafc'; };
            btn.onmouseout = () => { btn.style.background = 'white'; };

            btn.onclick = () => {
                const aiInsightContent = document.getElementById('aiInsightContent');
                if (!aiInsightContent) return;

                let renderedHtml = report.report_content;
                if (window.marked && typeof window.marked.parse === 'function') {
                    renderedHtml = window.marked.parse(report.report_content);
                }

                aiInsightContent.innerHTML = `
                    <div class="ai-insight-result" style="line-height: 1.7; font-size: 0.95rem; color: #1e293b;">
                        ${renderedHtml}
                    </div>
                `;

                // Styling
                const resultDiv = aiInsightContent.querySelector('.ai-insight-result');
                if (resultDiv) {
                    const tables = resultDiv.querySelectorAll('table');
                    tables.forEach(t => {
                        t.style.width = '100%';
                        t.style.borderCollapse = 'collapse';
                        t.style.marginBottom = '1.5rem';
                        t.querySelectorAll('th, td').forEach(cell => {
                            cell.style.border = '1px solid #e2e8f0';
                            cell.style.padding = '0.75rem';
                        });
                        t.querySelectorAll('th').forEach(th => {
                            th.style.background = '#f8fafc';
                            th.style.fontWeight = '600';
                        });
                    });
                    resultDiv.querySelectorAll('h2, h3').forEach(h => {
                        h.style.color = '#0f172a';
                        h.style.marginTop = '1.5rem';
                        h.style.marginBottom = '1rem';
                        h.style.borderBottom = '1px solid #e2e8f0';
                        h.style.paddingBottom = '0.5rem';
                    });
                    resultDiv.querySelectorAll('img').forEach(img => {
                        if (img.width > 300) img.style.width = '300px';
                        img.style.borderRadius = '8px';
                    });
                }
            };

            list.appendChild(btn);
        });
    } catch (err) {
        console.error("Failed to load AI reports from DB", err);
    }
};
