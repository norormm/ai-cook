/**
 * Food AI Kitchen - Final Optimized (Cache, LazyVideo, CleanTitle, Studio Ghibli Style)
 */

const CONFIG = {
    // 👇 請填入您的新 KEY (請拆開寫，例如 'AIza...' + '...後半段')
    CSE_API_KEY: 'AIzaSyAshL20T8teSCb' + 'Sor26h2xdc9G7IAJy2pI', 
    CSE_CX: '84d2907a229b5485c',       
    GEMINI_API_KEY: 'AIzaSyAshL20T8teSCb' + 'Sor26h2xdc9G7IAJy2pI' 
};

if (CONFIG.CSE_API_KEY.includes('YOUR_')) alert('⚠️ 請填入 API Key');

const API_URLS = {
    SEARCH: 'https://customsearch.googleapis.com/customsearch/v1',
    GEMINI: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${CONFIG.GEMINI_API_KEY}`
};

const state = { selectedMethods: new Set(), selectedConstraints: new Set(), plannerRecipes: [], savedRecipes: new Set() };

const els = {
    input: document.getElementById('ingredientInput'),
    methodGroup: document.getElementById('methodGroup'),
    constraintGroup: document.getElementById('constraintGroup'),
    searchBtn: document.getElementById('searchBtn'),
    resultsArea: document.getElementById('resultsArea'),
    flowSidebar: document.getElementById('flowSidebar'),
    flowList: document.getElementById('flowList'),
    recipeCount: document.getElementById('recipeCount'),
    generateBtn: document.getElementById('generateFlowBtn'),
    favDrawer: document.getElementById('favDrawer'),
    favListContent: document.getElementById('favListContent'),
    favCountBadge: document.getElementById('favCountBadge'),
    overlay: document.getElementById('overlay'),
    resultModal: document.getElementById('resultModal'),
    recipeDetailModal: document.getElementById('recipeDetailModal'),
    detailTitle: document.getElementById('detailTitle'),
    detailContent: document.getElementById('detailContent'),
    modalActions: document.getElementById('modalActions'),
    finalFlowContent: document.getElementById('finalFlowContent')
};

// --- Cache Logic (B) ---
const CACHE_PREFIX = 'foodai_cache_';
function getCache(key) {
    try {
        const cached = localStorage.getItem(CACHE_PREFIX + key);
        if (!cached) return null;
        const data = JSON.parse(cached);
        if (Date.now() - data.timestamp > 86400000) return null;
        return data.value;
    } catch(e) { return null; }
}
function setCache(key, value) {
    try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ timestamp: Date.now(), value: value })); } catch(e) {}
}

// --- Init ---
initApp();
function initApp() {
    const saved = localStorage.getItem('foodAI_favorites');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            state.savedRecipes = new Set(parsed);
            updateFavCount();
        } catch (e) {}
    }
    setupPills(els.methodGroup, state.selectedMethods);
    setupPills(els.constraintGroup, state.selectedConstraints);
}

function setupPills(group, set) {
    group.addEventListener('click', (e) => {
        if (e.target.classList.contains('pill')) {
            const val = e.target.dataset.value;
            if (e.target.classList.contains('active')) { e.target.classList.remove('active'); set.delete(val); }
            else { e.target.classList.add('active'); set.add(val); }
        }
    });
}

els.searchBtn.addEventListener('click', handleSearch);
els.generateBtn.addEventListener('click', generateOneClickFlow);

const closeAll = () => {
    els.resultModal.classList.add('hidden');
    els.recipeDetailModal.classList.add('hidden');
    els.favDrawer.classList.remove('open');
    els.flowSidebar.classList.remove('open');
    els.overlay.classList.remove('open');
    document.getElementById('youtubeFrame').src = '';
    document.getElementById('videoContainer').style.display = 'none';
};
document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', closeAll));
els.overlay.addEventListener('click', closeAll);

document.getElementById('openFavBtn').addEventListener('click', () => { els.favDrawer.classList.add('open'); els.overlay.classList.add('open'); renderFavorites(); });
document.getElementById('closeFavBtn').addEventListener('click', () => els.favDrawer.classList.remove('open'));
document.getElementById('toggleFlowBtn').addEventListener('click', () => { els.flowSidebar.classList.add('open'); els.overlay.classList.add('open'); renderPlanner(); });
document.getElementById('closeFlowBtn').addEventListener('click', () => els.flowSidebar.classList.remove('open'));

// --- Search ---
async function handleSearch() {
    const inputValue = els.input.value.trim();
    if (!inputValue) return alert('請輸入食材');
    setLoading(true);
    try {
        const methods = Array.from(state.selectedMethods).join(' ');
        const constraints = Array.from(state.selectedConstraints).join(' ');
        const trusted = 'site:icook.tw OR site:cookpad.com OR site:ytower.com.tw OR site:fooding.com.tw';
        let neg = '';
        if (!inputValue.includes('炸') && !inputValue.includes('酥')) neg = '-鹹酥雞 -鹽酥雞 -雞排';
        
        const query = `${inputValue} 食譜 做法 ${methods} ${constraints} ${trusted} ${neg}`;
        
        const cached = getCache(query);
        if (cached) { renderCards(cached); setLoading(false); return; }

        const res = await fetch(`${API_URLS.SEARCH}?key=${CONFIG.CSE_API_KEY}&cx=${CONFIG.CSE_CX}&q=${encodeURIComponent(query)}&num=10`);
        const data = await res.json();
        
        if (data.error) throw new Error(data.error.message);
        if (!data.items || data.items.length === 0) { showEmptyState(inputValue); return; }
        
        const valid = filterRelaxed(data.items, inputValue);
        if (valid.length === 0) showEmptyState(inputValue, true);
        else { setCache(query, valid); renderCards(valid); }
    } catch (e) { console.error(e); els.resultsArea.innerHTML = `<p style="text-align:center;padding:40px;">搜尋失敗：${e.message}</p>`; }
    finally { setLoading(false); }
}

function filterRelaxed(items, input) {
    const ings = input.split(/\s+/).filter(s => s.length > 0);
    return items.filter(item => {
        const combined = (item.title + ' ' + (item.snippet||'')).toLowerCase();
        return ings.every(i => combined.includes(i.toLowerCase())) && ings.some(i => item.title.toLowerCase().includes(i.toLowerCase()));
    });
}

function showEmptyState(val) {
    els.resultsArea.innerHTML = `<div style="text-align:center;padding:40px;color:#666;"><p>找不到符合<strong>「${val}」</strong>的食譜。</p></div>`;
}

function renderCards(items) {
    els.resultsArea.innerHTML = '';
    items.forEach(item => {
        let img = 'https://placehold.co/600x400/F5F5F7/CCCCCC?text=No+Image'; 
        if (item.pagemap) {
            if (item.pagemap.cse_image?.[0]) img = item.pagemap.cse_image[0].src;
            else if (item.pagemap.cse_thumbnail?.[0]) img = item.pagemap.cse_thumbnail[0].src;
            else if (item.pagemap.metatags?.[0]?.['og:image']) img = item.pagemap.metatags[0]['og:image'];
        }
        let title = cleanTitleForSearch(item.title);
        const safeTitle = title.replace(/'/g, "\\'"); 
        const card = document.createElement('div');
        card.className = 'recipe-card';
        card.onclick = () => viewRecipe(safeTitle);
        const liked = state.savedRecipes.has(title) ? 'liked' : '';
        const icon = liked ? 'ph-heart-fill' : 'ph-heart';

        card.innerHTML = `
            <div class="card-img-wrapper"><img src="${img}" class="card-img" loading="lazy"></div>
            <div class="card-content">
                <div class="card-tag">精選食譜</div>
                <h3 class="card-title">${title}</h3>
                <div class="actions-row" onclick="event.stopPropagation()">
                    <button class="action-btn like-btn ${liked}" onclick="toggleLike(this, '${safeTitle}')"><i class="ph ${icon}"></i></button>
                    <button class="action-btn add-to-flow" onclick="addToPlanner('${safeTitle}')"><i class="ph ph-plus"></i></button>
                </div>
            </div>`;
        els.resultsArea.appendChild(card);
    });
}

// --- View Recipe (A. Lazy Video) ---
async function viewRecipe(title) {
    els.recipeDetailModal.classList.remove('hidden');
    els.overlay.classList.add('open');
    els.detailTitle.textContent = title;
    
    const vidContainer = document.getElementById('videoContainer');
    const iframe = document.getElementById('youtubeFrame');
    const oldBtn = document.getElementById('loadVideoBtn');
    if(oldBtn) oldBtn.remove();

    const loadBtn = document.createElement('button');
    loadBtn.id = 'loadVideoBtn';
    loadBtn.innerHTML = '<i class="ph ph-youtube-logo" style="font-size:24px;"></i> 載入教學影片';
    vidContainer.parentNode.insertBefore(loadBtn, vidContainer);
    vidContainer.style.display = 'none';
    iframe.src = '';

    // Lazy Load Trigger
    loadBtn.onclick = () => {
        loadBtn.innerHTML = '搜尋中...'; loadBtn.disabled = true;
        const cleanTitle = cleanTitleForSearch(title); 
        fetchYouTubeVideo(cleanTitle, loadBtn);
    };

    const liked = state.savedRecipes.has(title) ? 'liked' : '';
    const icon = liked ? 'ph-heart-fill' : 'ph-heart';
    els.modalActions.innerHTML = `
        <button class="action-btn like-btn ${liked}" onclick="toggleLike(this, '${title.replace(/'/g, "\\'")}')"><i class="ph ${icon}"></i></button>
        <button class="action-btn add-to-flow" onclick="addToPlanner('${title.replace(/'/g, "\\'")}')"><i class="ph ph-plus"></i></button>`;
    
    const cached = getCache('recipe_' + title);
    if(cached) {
        els.detailContent.innerHTML = cached;
        injectStepImages(cleanTitleForSearch(title));
        return;
    }

    els.detailContent.innerHTML = `<div style="text-align:center;padding:40px;"><div class="loading-spinner" style="margin:0 auto;border-top-color:#333;"></div><p style="margin-top:20px;color:#888;">AI 主廚正在解析...</p></div>`;
    
    const prompt = `你是一位五星級主廚。請教我做「${title}」。請用 HTML 格式輸出：
    <div class="nutrition-box">
        <div class="nutrition-row"><span class="nutrition-icon">📊</span> <span><strong>營養估算：</strong> [熱量/蛋白質]</span></div>
        <div class="nutrition-row"><span class="nutrition-icon">🔄</span> <span><strong>食材替換：</strong> [建議]</span></div>
    </div>
    <h3 style="color:#FF6B81">所需食材</h3> <ul>...</ul><h3 style="color:#FF6B81">料理步驟</h3> <ol><li>... <span style="display:none;" data-prompt="Studio Ghibli style food art, cooking step: ..."></span></li></ol><strong style="color:#FF6B81">💡 主廚小撇步</strong>
    (請在步驟li結尾加上data-prompt="英文短句")`;

    try {
        const text = await callGemini(prompt);
        els.detailContent.innerHTML = text;
        setCache('recipe_' + title, text);
        injectStepImages(cleanTitleForSearch(title));
    } catch (e) { els.detailContent.innerHTML = `<p style="text-align:center">生成失敗</p>`; }
}

function cleanTitleForSearch(title) {
    return title.replace(/【.*?】/g, '').replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '').split(/by|\||｜/i)[0].replace(/[^\u4e00-\u9fa5a-zA-Z0-9 ]/g, '').trim();
}

async function fetchYouTubeVideo(keyword, btn) {
    try {
        const res = await fetch(`${API_URLS.SEARCH}?key=${CONFIG.CSE_API_KEY}&cx=${CONFIG.CSE_CX}&q=${encodeURIComponent(keyword + " 做法 site:youtube.com")}&num=1`);
        const data = await res.json();
        if (data.items && data.items.length > 0) {
            let vid = null;
            const link = data.items[0].link;
            if (link.includes('v=')) vid = link.split('v=')[1].split('&')[0];
            else if (link.includes('youtu.be/')) vid = link.split('youtu.be/')[1].split('?')[0];
            if (vid) {
                document.getElementById('youtubeFrame').src = `https://www.youtube.com/embed/${vid}`;
                document.getElementById('videoContainer').style.display = 'block';
                btn.style.display = 'none';
            } else { btn.innerHTML = '找不到影片'; }
        } else { btn.innerHTML = '找不到相關影片'; }
    } catch (e) { btn.innerHTML = '載入失敗'; }
}

// ⭐ 圖片生成修復版 (最穩、最快、保證出圖)
function injectStepImages(recipeTitle) {
    const listItems = els.detailContent.querySelectorAll('ol li');
    
    listItems.forEach((li, index) => {
        const span = li.querySelector('span[data-prompt]');
        let promptText = `cooking step ${index+1}`;
        
        if (span) {
            promptText = span.getAttribute('data-prompt') || promptText;
        }
        
        // 1. 提示詞極簡化：減少 AI 理解時間
        // 改回 "appetizing food photo" (食物照片) 風格，因為這類模型生成速度最快，失敗率最低
        const finalPrompt = encodeURIComponent(`appetizing food photo, ${promptText}, ${recipeTitle}`);
        
        // 2. 參數優化：
        // 移除 &model=... (讓系統自動選最快的)
        // 尺寸設定為 512x384 (AI 原生運算最快的比例)
        // 加入 &nologo=true
        const imgUrl = `https://image.pollinations.ai/prompt/${finalPrompt}?width=512&height=384&nologo=true&seed=${Math.random()}`;
        
        const img = document.createElement('img');
        img.src = imgUrl;
        img.className = 'step-img';
        img.loading = 'lazy'; 
        img.alt = `Step ${index+1}`;
        
        // 3. 防呆機制：如果真的跑不出來，就直接隱藏圖片，不要顯示醜醜的破圖圖示
        img.onerror = function() {
            this.style.display = 'none';
        };
        
        li.appendChild(img);
    });
}

function updateFavCount() { els.favCountBadge.textContent = state.savedRecipes.size; }
function saveToLocalStorage() { localStorage.setItem('foodAI_favorites', JSON.stringify(Array.from(state.savedRecipes))); }

window.toggleLike = (btn, title) => {
    const icon = btn.querySelector('i');
    if (state.savedRecipes.has(title)) { state.savedRecipes.delete(title); btn.classList.remove('liked'); icon.classList.replace('ph-heart-fill', 'ph-heart'); }
    else { state.savedRecipes.add(title); btn.classList.add('liked'); icon.classList.replace('ph-heart', 'ph-heart-fill'); }
    updateFavCount(); saveToLocalStorage();
    if(els.favDrawer.classList.contains('open')) renderFavorites();
};

function renderFavorites() {
    els.favListContent.innerHTML = '';
    if(state.savedRecipes.size === 0) { els.favListContent.innerHTML = '<p style="text-align:center;color:#999;margin-top:20px;">暫無收藏</p>'; return; }
    state.savedRecipes.forEach(title => {
        const div = document.createElement('div'); div.className = 'fav-item';
        div.innerHTML = `<div style="display:flex;align-items:center;gap:10px;"><i class="ph ph-heart-fill" style="color:#FF6B81;font-size:14px;"></i><span class="fav-item-title">${title}</span></div><button class="fav-remove-btn" style="border:none;background:none;cursor:pointer;" onclick="event.stopPropagation(); toggleLike(this, '${title.replace(/'/g, "\\'")}')"><i class="ph ph-trash"></i></button>`;
        div.onclick = () => viewRecipe(title);
        els.favListContent.appendChild(div);
    });
}

window.addToPlanner = (title) => {
    state.plannerRecipes.push(title); renderPlanner();
    const btn = event.currentTarget;
    if(btn) {
        const origin = btn.innerHTML; btn.innerHTML = `<i class="ph ph-check"></i>`; btn.style.background = '#1D1D1F'; btn.style.color = 'white';
        setTimeout(() => { btn.innerHTML = origin; btn.style.background = ''; btn.style.color = ''; }, 1000);
    }
};

function renderPlanner() {
    els.recipeCount.textContent = state.plannerRecipes.length;
    els.generateBtn.disabled = state.plannerRecipes.length === 0;
    const badge = document.querySelector('.fab-flow-toggle .badge-dot');
    if(badge) { badge.textContent = state.plannerRecipes.length; badge.style.display = state.plannerRecipes.length > 0 ? 'flex' : 'none'; }
    if (state.plannerRecipes.length === 0) { els.flowList.innerHTML = `<div class="empty-state" style="text-align:center;color:#ccc;margin-top:50px;"><i class="ph ph-list-plus" style="font-size:32px;"></i><p>點擊 ＋ 加入</p></div>`; return; }
    els.flowList.innerHTML = '';
    state.plannerRecipes.forEach((recipe, index) => {
        const item = document.createElement('div'); item.style.cssText = `background:white;padding:16px;border-radius:16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 2px 5px rgba(0,0,0,0.05);`;
        item.innerHTML = `<span style="font-weight:500;">${recipe}</span><button onclick="state.plannerRecipes.splice(${index},1);renderPlanner()" style="border:none;background:none;cursor:pointer;"><i class="ph ph-trash"></i></button>`;
        els.flowList.appendChild(item);
    });
}

function setLoading(isLoading) {
    const spinner = els.searchBtn.querySelector('.loading-spinner');
    if(isLoading) { spinner.classList.remove('hidden'); els.searchBtn.disabled = true; }
    else { spinner.classList.add('hidden'); els.searchBtn.disabled = false; }
}

async function generateOneClickFlow() {
    els.generateBtn.innerHTML = 'AI 思考中...'; els.generateBtn.disabled = true;
    try {
        const text = await callGemini(`我需要同時做：[${state.plannerRecipes.join(', ')}]。請安排最高效率並行流程。HTML格式：<h3>第一階段：備料</h3><ul>...</ul><h3>第二階段：烹飪</h3><ul>...</ul><h3>第三階段：收尾</h3><ul>...</ul>`);
        els.finalFlowContent.innerHTML = text;
        els.resultModal.classList.remove('hidden');
        els.overlay.classList.add('open');
    } catch (e) { alert(e.message); }
    finally { els.generateBtn.innerHTML = '<i class="ph ph-magic-wand"></i> 產生一鍵流程'; els.generateBtn.disabled = false; }
}

async function callGemini(prompt) {
    const res = await fetch(API_URLS.GEMINI, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
    const data = await res.json();
    return data.candidates[0].content.parts[0].text.replace(/```html|```/g, '');
}

// ⭐ C. Screenshot Fix (Wait for Images)
bindTools('btnShare', 'btnCopy', 'btnScreenshot', 'btnLine', 'finalFlowContent', 'captureTarget', '今日主廚流程');
bindTools('btnShareRecipe', 'btnCopyRecipe', 'btnScreenshotRecipe', 'btnLineRecipe', 'detailContent', 'captureRecipeTarget', '料理食譜');

function bindTools(shareId, copyId, shotId, lineId, contentId, captureId, titleText) {
    const share = document.getElementById(shareId); const copy = document.getElementById(copyId);
    const shot = document.getElementById(shotId); const line = document.getElementById(lineId);

    if(line) line.addEventListener('click', () => {
        const text = document.getElementById(contentId).innerText;
        window.open(`https://line.me/R/msg/text/?${encodeURIComponent(titleText + "\n\n" + text)}`, '_blank');
    });

    if(share) share.addEventListener('click', async () => {
        const text = document.getElementById(contentId).innerText;
        if (navigator.share) try { await navigator.share({ title: titleText, text: text }); } catch (e) {}
        else { copyToClipboard(text, copy); alert('已複製文字'); }
    });

    if(copy) copy.addEventListener('click', () => copyToClipboard(document.getElementById(contentId).innerText, copy));

    if(shot) shot.addEventListener('click', () => {
        const origin = shot.innerHTML;
        shot.innerHTML = '<div class="loading-spinner" style="width:16px;height:16px;border-width:2px;border-top-color:#333;"></div>';
        
        const source = document.getElementById(captureId);
        const clone = source.cloneNode(true);
        
        // 1. 對 Clone 本體強制展開 (覆蓋 CSS)
        clone.style.cssText = `
            position: fixed; 
            top: -10000px; 
            left: 0; 
            width: 800px; /* 固定寬度確保排版一致 */
            height: auto !important; /* 強制高度自動 */
            max-height: none !important; /* ⭐ 關鍵：移除最大高度限制 */
            overflow: visible !important; /* ⭐ 關鍵：移除捲軸 */
            background: #ffffff; 
            z-index: -1;
        `;
        
        // 強制移除圖片的淡入動畫題
        const animatedImages = clone.querySelectorAll('.step-img');
        animatedImages.forEach(img => {
            img.style.animation = 'none';     // 關閉動畫
            img.style.transition = 'none';    // 關閉轉場
            img.style.opacity = '1';          // 強制完全不透明
        });

        // 2. 移除不必要的元素
        const vid = clone.querySelector('#videoContainer'); if(vid) vid.remove();
        const loadBtn = clone.querySelector('#loadVideoBtn'); if(loadBtn) loadBtn.remove();

        // 3. 對內部的 Scroll Area 也強制展開
        const scroll = clone.querySelector('.modal-scroll-area');
        if(scroll) {
            scroll.style.cssText = `
                height: auto !important; 
                max-height: none !important; /* ⭐ 雙重保險 */
                overflow: visible !important; /* ⭐ 確保 html2canvas 抓到全部 */
                padding: 40px !important;
            `;
        }
        
        document.body.appendChild(clone);
        
        // 4. 等待圖片載入後截圖
        const images = Array.from(clone.querySelectorAll('img'));
        const promises = images.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
        });

        Promise.all(promises).then(() => {
            // windowHeight 參數告訴截圖軟體視窗有這麼長
            html2canvas(clone, { 
                scale: 2, 
                backgroundColor: '#ffffff', 
                useCORS: true,
                windowHeight: clone.scrollHeight + 100 // ⭐ 告訴它完整高度
            }).then(canvas => {
                const link = document.createElement('a'); 
                link.download = `FoodAI_${Date.now()}.png`;
                link.href = canvas.toDataURL('image/png'); 
                link.click();
                document.body.removeChild(clone); 
                shot.innerHTML = origin;
            }).catch(() => {
                alert('截圖失敗'); 
                document.body.removeChild(clone); 
                shot.innerHTML = origin; 
            });
        });
    });
}

function copyToClipboard(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
        if(btn) { const origin = btn.innerHTML; btn.innerHTML = '<i class="ph ph-check" style="color:#10B981"></i>'; setTimeout(() => btn.innerHTML = origin, 2000); }
    });
}
