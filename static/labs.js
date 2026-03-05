// labs.js
document.addEventListener("DOMContentLoaded", () => {
    const btnLabsGenerate = document.getElementById("btnLabsGenerate");
    const labsBrandName = document.getElementById("labsBrandName");
    const labsProductUrl = document.getElementById("labsProductUrl");
    const labsProductImage = document.getElementById("labsProductImage");

    const labsResultJson = document.getElementById("labsResultJson");
    const labsGeneratedImg = document.getElementById("labsGeneratedImg");
    const labsCanvasEmptyState = document.getElementById("labsCanvasEmptyState");
    const labsPromptDisplay = document.getElementById("labsPromptDisplay");

    if (!btnLabsGenerate) return;

    btnLabsGenerate.addEventListener("click", async () => {
        const brandName = labsBrandName.value.trim();
        const productUrl = labsProductUrl.value.trim();

        if (!brandName || !productUrl) {
            alert("브랜드명과 제품 URL/설명을 모두 입력해주세요.");
            return;
        }

        let imageB64 = null;
        if (labsProductImage.files && labsProductImage.files[0]) {
            const file = labsProductImage.files[0];
            try {
                imageB64 = await toBase64(file);
            } catch (error) {
                alert("이미지 처리 중 오류가 발생했습니다.");
                return;
            }
        }

        // 실사 모델 포함 여부 확인
        const humanModelRadio = document.querySelector('input[name="labsHumanModel"]:checked');
        const includeHumanModel = humanModelRadio ? (humanModelRadio.value === "true") : false;

        // 로딩 상태 표시
        const originalBtnText = btnLabsGenerate.innerHTML;
        btnLabsGenerate.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> 생성 중... (최대 1분 소요)`;
        btnLabsGenerate.disabled = true;
        labsResultJson.textContent = "방향성 기획 및 이미지를 생성 중입니다...";
        labsPromptDisplay.innerHTML = "생성 진행 중...";
        labsGeneratedImg.style.display = "none";
        labsCanvasEmptyState.style.display = "block";

        try {
            const response = await fetch("/api/v1/labs/generate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${window.localStorage.getItem('motiverse_session') || ''}`
                },
                body: JSON.stringify({
                    brand_name: brandName,
                    product_url: productUrl,
                    image_b64: imageB64,
                    include_human_model: includeHumanModel
                })
            });

            const result = await response.json();

            if (response.ok && result.status === "success") {
                const data = result.data;

                // JSON 표시
                labsResultJson.textContent = JSON.stringify(data.creative_direction, null, 2);

                // Gemini 프롬프트 표시
                labsPromptDisplay.innerHTML = `<strong>생성 프롬프트:</strong><br><span style="color: #475569;">${data.gemini_prompt}</span>`;

                // 이미지 표시 결합 부
                if (data.generated_image_b64) {
                    if (data.product_cutout_b64) {
                        labsResultJson.textContent = "가져온 제품 이미지에서 배경을 제거하는 중입니다... (약 10~20초 소요, 서버 스케일 확장 방지)\n\n" + labsResultJson.textContent;

                        try {
                            const { removeBackground } = await import('https://unpkg.com/@imgly/background-removal@1.4.5/dist/imgly-background-removal.js');
                            const fgBlob = await fetch(data.product_cutout_b64).then(res => res.blob());
                            const imageWithoutBackground = await removeBackground(fgBlob);
                            const productCutoutB64 = await toBase64(imageWithoutBackground);

                            const tempCanvas = document.createElement('canvas');
                            const ctx = tempCanvas.getContext('2d');
                            const bgImg = new Image();
                            bgImg.crossOrigin = "anonymous";

                            bgImg.onload = () => {
                                tempCanvas.width = bgImg.width;
                                tempCanvas.height = bgImg.height;
                                ctx.drawImage(bgImg, 0, 0);

                                const fgImg = new Image();
                                fgImg.onload = () => {
                                    // 제품 이미지 적절한 비율로 리사이징 및 배치 (가운데 약간 하단)
                                    const max_fg_height = tempCanvas.height * 0.55;
                                    const max_fg_width = tempCanvas.width * 0.55;
                                    let fg_w = fgImg.width;
                                    let fg_h = fgImg.height;

                                    const ratio = Math.min(max_fg_width / fg_w, max_fg_height / fg_h, 1.0);
                                    fg_w *= ratio;
                                    fg_h *= ratio;

                                    const x = (tempCanvas.width - fg_w) / 2;
                                    let y = (tempCanvas.height - fg_h) / 2 + (tempCanvas.height * 0.1);

                                    // 빛 반사, 그림자 효과 약간 추가 (디테일)
                                    ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
                                    ctx.shadowBlur = 20;
                                    ctx.shadowOffsetX = 0;
                                    ctx.shadowOffsetY = 10;

                                    ctx.drawImage(fgImg, x, y, fg_w, fg_h);

                                    // 출력 이미지를 캔버스를 통해 최종 업데이트
                                    labsGeneratedImg.src = tempCanvas.toDataURL('image/png');
                                    labsGeneratedImg.style.display = "block";
                                    labsCanvasEmptyState.style.display = "none";
                                    labsResultJson.textContent = labsResultJson.textContent.replace("가져온 제품 이미지에서 배경을 제거하는 중입니다... (약 10~20초 소요, 서버 스케일 확장 방지)\n\n", "");
                                };
                                fgImg.src = productCutoutB64;
                            };
                            bgImg.src = data.generated_image_b64;
                        } catch (err) {
                            console.error("클라이언트 딴 누끼제거 실패. 원본 합성:", err);
                            // 누끼 제거 실패 시 원본 사용 (fallthrough)
                            const tempCanvas = document.createElement('canvas');
                            // [코드 생략, 이전 원본 합성 로직과 동일하거나 여기서 바로 generated_image_b64 렌더 수행 가능합니다]
                            labsGeneratedImg.src = data.generated_image_b64;
                            labsGeneratedImg.style.display = "block";
                            labsCanvasEmptyState.style.display = "none";
                        }
                    } else {
                        // 제품 컷아웃이 실패했거나 없는 경우 원래 생성된 이미지만 렌더링
                        labsGeneratedImg.src = data.generated_image_b64;
                        labsGeneratedImg.style.display = "block";
                        labsCanvasEmptyState.style.display = "none";
                    }
                } else {
                    labsCanvasEmptyState.innerHTML = `<i class="fa-solid fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 0.5rem; color:#ef4444;"></i><br><span>이미지 생성에 실패했습니다.</span>`;
                }

            } else {
                alert(`오류: ${result.message || "알 수 없는 오류가 발생했습니다."}`);
                labsResultJson.textContent = "오류 발생";
            }
        } catch (error) {
            console.error("Labs Generate Error:", error);
            alert("서버 연결에 실패했습니다.");
            labsResultJson.textContent = "연결 실패";
        } finally {
            btnLabsGenerate.innerHTML = originalBtnText;
            btnLabsGenerate.disabled = false;
        }
    });

    // Helper: File to Base64
    function toBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }
});
