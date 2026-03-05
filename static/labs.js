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
                    image_b64: imageB64
                })
            });

            const result = await response.json();

            if (response.ok && result.status === "success") {
                const data = result.data;

                // JSON 표시
                labsResultJson.textContent = JSON.stringify(data.creative_direction, null, 2);

                // Gemini 프롬프트 표시
                labsPromptDisplay.innerHTML = `<strong>생성 프롬프트:</strong><br><span style="color: #475569;">${data.gemini_prompt}</span>`;

                // 이미지 표시
                if (data.generated_image_b64) {
                    labsGeneratedImg.src = data.generated_image_b64;
                    labsGeneratedImg.style.display = "block";
                    labsCanvasEmptyState.style.display = "none";
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
