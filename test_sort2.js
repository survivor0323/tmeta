const fs = require('fs');

const mockAds = [
    { start_date: '2024-03-01', active_days: "12" },
    { start_date: '14 Mar 2024', active_days: undefined },
    { start_date: '2024-01-01', active_days: null },
    { start_date: '2024년 02월 05일' },
    { start_date: '2025-11-29' }
];

let adsToRender = [...mockAds];

adsToRender.forEach(ad => {
    let sDate = String(ad.start_date || ad.creation_date || '2024-01-01').trim();

    if (/^\d{1,2} [A-Za-z]{3} 202$/.test(sDate)) sDate += '4';
    if (sDate.includes('년')) sDate = sDate.replace(/[년월일]/g, '-').replace(/-\s*-/g, '-').replace(/-$/, '').replace(/\s+/g, '');
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
        parsedDate = new Date(new Date('2024-01-01').getTime() + (Math.abs(hash) % 10000000000));
    }

    ad._sortDateStr = parsedDate.getTime() || 0;

    // Calculate run days safely
    if (ad.active_days !== undefined && !isNaN(parseInt(ad.active_days))) {
        ad._runDays = parseInt(ad.active_days);
    } else if (ad.start_date || ad.creation_date) {
        const diffTime = Math.abs(new Date() - parsedDate);
        ad._runDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    } else {
        ad._runDays = 14;
    }

    if (isNaN(ad._runDays) || ad._runDays < 1) ad._runDays = 1;
});

// Sorting active desc
adsToRender.sort((a, b) => (b._runDays || 0) - (a._runDays || 0));
console.log(adsToRender.map(a => a._runDays));
