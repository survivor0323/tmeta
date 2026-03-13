import schedule
import time
import logging
from anti_gravity_ads_logic import (
    fetch_competitor_ads_batch, 
    extract_winning_creatives, 
    analyze_creatives_with_ai
)

logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - SCHEDULER - %(message)s',
    handlers=[
        logging.FileHandler("scheduler.log", encoding='utf-8'),
        logging.StreamHandler()
    ]
)

# 분석을 희망하는 타겟 경쟁사 배포 리스트 (중복 등록 테스트 포함)
COMPETITORS = ["Brand_Nike", "Brand_Adidas", "Brand_Puma", "Brand_Nike"]

def daily_anti_gravity_batch_job():
    logging.info("🚀 [안티그래비티] 자정 배치: 경쟁사 광고 자동 수집 및 분석을 시작합니다.")
    
    try:
        # 1. 광고 수집 (중복 제거 및 배치 실행 처리됨)
        ads_by_brand = fetch_competitor_ads_batch(COMPETITORS)
        
        for brand, ads in ads_by_brand.items():
            if not ads:
                logging.info(f"[{brand}] 현재 활성화된 메타 광고가 없습니다.")
                continue
                
            # 2. 위닝 소재 발굴 (3개월 - 90일 이상 켜져있는 소재 추출)
            winning_ads = extract_winning_creatives(ads, min_months_active=3)
            logging.info(f"[{brand}] 총 {len(ads)}개 광고 중 {len(winning_ads)}개의 장기 게재 위닝 소재 발굴 성공.")
            
            # 3. AI 분석 실행 (비디오 멀티모달 배치 분석 및 프롬프트 주입)
            if winning_ads:
                logging.info(f"[{brand}] 위닝 소재에 대한 AI 심층(Hook-Body-CTA) 구조 분석을 시작합니다.")
                analyze_creatives_with_ai(winning_ads)
                
                # TODO: 심층 분석이 끝난 winning_ads를 자사의 영구 캐시/아카이브 DB로 전송
                # cache_database.bulk_insert(winning_ads)
                
        logging.info("✅ 일일 징후 파악 배치 스크립트가 성공적으로 완료되었습니다.")
        
    except Exception as e:
        logging.error(f"❌ 배치 작업 중 치명적인 오류가 발생했습니다: {e}")

if __name__ == "__main__":
    # 매일 자정에 배치 스케줄 등록
    schedule.every().day.at("00:00").do(daily_anti_gravity_batch_job)
    
    logging.info("스케줄러가 활성화되었습니다. 예약된 메타 광고 모니터링 작업을 대기합니다...")
    
    # 개발 및 테스트 목적이라면 아래 주석을 해제하여 즉시 강제 1회 실행해 볼 수 있습니다.
    # daily_anti_gravity_batch_job()
    
    while True:
        schedule.run_pending()
        time.sleep(60) # 1분 주기로 스케줄 트리거 검사
