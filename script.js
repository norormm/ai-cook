/**
 * Food AI Kitchen - Final Long Screenshot Fix
 */

const CONFIG = {
    // 👇 請確認 Key 是否正確
    CSE_API_KEY: 'AIzaSyCJ0nUvquBgmP487GqRkBhDH4S5MQWdTzk', 
    CSE_CX: '84d2907a229b5485c',       
    GEMINI_API_KEY: 'AIzaSyCJ0nUvquBgmP487GqRkBhDH4S5MQWdTzk' 
};

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

// --- Initialization ---
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

// Close Logic
const closeAll = () => {
    els.resultModal.classList.add('hidden');
    els.recipeDetailModal.classList.add('hidden');
    els.favDrawer.classList.remove('open');
    els.flowSidebar.classList.remove('open');
    els.overlay.classList.remove('open');
};
document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', closeAll));
els.overlay.addEventListener('click', closeAll);

document.getElementById('openFavBtn').addEventListener('click', () => { els.favDrawer.classList.add('open'); els.overlay.classList.add('open'); renderFavorites(); });
document.getElementById('closeFavBtn').addEventListener('click', () => els.favDrawer.classList.remove('open'));
document.getElementById('toggleFlowBtn').addEventListener('click', () => { els.flowSidebar.classList.add('open'); els.overlay.classList.add('open'); renderPlanner(); });
document.getElementById('closeFlowBtn').addEventListener('click', () => els.flowSidebar.classList.remove('open'));

// --- Search Logic ---
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
        const res = await fetch(`${API_URLS.SEARCH}?key=${CONFIG.CSE_API_KEY}&cx=${CONFIG.CSE_CX}&q=${encodeURIComponent(query)}&num=10`);
        const data = await res.json();
        
        if (data.error) throw new Error(data.error.message);
        if (!data.items || data.items.length === 0) { showEmptyState(inputValue); return; }
        
        const valid = filterRelaxed(data.items, inputValue);
        if (valid.length === 0) showEmptyState(inputValue, true);
        else renderCards(valid);
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

function showEmptyState(val, strict=false) {
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
        let title = item.title.replace(/ - 愛料理.*/, '').replace(/ - Cookpad.*/, '').split(/[-|:–]/)[0].trim();
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

async function viewRecipe(title) {
    els.recipeDetailModal.classList.remove('hidden');
    els.overlay.classList.add('open');
    els.detailTitle.textContent = title;
    const liked = state.savedRecipes.has(title) ? 'liked' : '';
    const icon = liked ? 'ph-heart-fill' : 'ph-heart';
    els.modalActions.innerHTML = `
        <button class="action-btn like-btn ${liked}" onclick="toggleLike(this, '${title.replace(/'/g, "\\'")}')"><i class="ph ${icon}"></i></button>
        <button class="action-btn add-to-flow" onclick="addToPlanner('${title.replace(/'/g, "\\'")}')"><i class="ph ph-plus"></i></button>`;
    els.detailContent.innerHTML = `<div style="text-align:center;padding:40px;"><div class="loading-spinner" style="margin:0 auto;border-top-color:#333;"></div><p style="margin-top:20px;color:#888;">AI 主廚正在解析...</p></div>`;
    try {
        const text = await callGemini(`你是一位五星級主廚。請教我做「${title}」。請用 HTML 格式輸出：<h3 style="color:#FF6B81">所需食材</h3> <ul>...</ul><h3 style="color:#FF6B81">料理步驟</h3> <ol>...</ol><strong style="color:#FF6B81">💡 主廚小撇步</strong>`);
        els.detailContent.innerHTML = text;
    } catch (e) { els.detailContent.innerHTML = `<p style="text-align:center">生成失敗</p>`; }
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
    
    // 紅點修正
    const badge = document.querySelector('.fab-flow-toggle .badge-dot');
    if(badge) {
        badge.textContent = state.plannerRecipes.length;
        badge.style.display = state.plannerRecipes.length > 0 ? 'flex' : 'none';
    }
    
    if (state.plannerRecipes.length === 0) { els.flowList.innerHTML = `<div class="empty-state" style="text-align:center;color:#ccc;margin-top:50px;"><i class="ph ph-list-plus" style="font-size:32px;"></i><p>點擊 ＋ 加入待辦料理</p></div>`; return; }
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
    if(data.error) throw new Error(data.error.message);
    return data.candidates[0].content.parts[0].text.replace(/```html|```/g, '');
}

// --- Tools & Screenshot Logic (REBUILT) ---

bindTools('btnShare', 'btnCopy', 'btnScreenshot', 'btnLine', 'finalFlowContent', 'captureTarget', '今日主廚流程');
bindTools('btnShareRecipe', 'btnCopyRecipe', 'btnScreenshotRecipe', 'btnLineRecipe', 'detailContent', 'captureRecipeTarget', '料理食譜');

function bindTools(shareId, copyId, shotId, lineId, contentId, captureId, titleText) {
    const share = document.getElementById(shareId);
    const copy = document.getElementById(copyId);
    const shot = document.getElementById(shotId);
    const line = document.getElementById(lineId);

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

    // ⭐ 暴力長截圖邏輯 (Reconstructed)
    if(shot) shot.addEventListener('click', () => {
        const origin = shot.innerHTML;
        shot.innerHTML = '<div class="loading-spinner" style="width:16px;height:16px;border-width:2px;border-top-color:#333;"></div>';
        
        // 1. 抓取內容元件 (不抓整個 Modal 框，只抓標題和內容)
        const modalEl = document.getElementById(captureId);
        const headerEl = modalEl.querySelector('.modal-header-banner').cloneNode(true);
        const contentEl = modalEl.querySelector('.modal-scroll-area').cloneNode(true);
        
        // 2. 清理 Header 裡的按鈕 (我們不截按鈕)
        const tools = headerEl.querySelector('.modal-tools'); if(tools) tools.remove();
        const actions = headerEl.querySelector('.modal-actions'); if(actions) actions.remove();
        const close = headerEl.querySelector('.close-modal'); if(close) close.remove();
        
        // 3. 建立一個全新的乾淨容器
        const wrapper = document.createElement('div');
        wrapper.style.cssText = `
            position: absolute; top: -9999px; left: 0; width: 800px;
            background: #ffffff; padding: 0; z-index: -1;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        `;
        
        // 4. 設定內容樣式 (強制展開、白底黑字)
        headerEl.style.cssText = `padding: 30px 40px; border-bottom: 1px solid #eee; background: #fafafa;`;
        contentEl.style.cssText = `padding: 40px; overflow: visible; height: auto; color: #1d1d1f;`;
        
        wrapper.appendChild(headerEl);
        wrapper.appendChild(contentEl);
        document.body.appendChild(wrapper);

        // 5. 截圖
        html2canvas(wrapper, { 
            scale: 2, 
            backgroundColor: '#ffffff', 
            useCORS: true 
        }).then(canvas => {
            const link = document.createElement('a');
            link.download = `FoodAI_${Date.now()}.jpg`;
            link.href = canvas.toDataURL('image/jpg');
            link.click();
            document.body.removeChild(wrapper);
            shot.innerHTML = origin;
        }).catch(err => {
            console.error(err);
            alert('截圖失敗');
            document.body.removeChild(wrapper);
            shot.innerHTML = origin;
        });
    });
}

function copyToClipboard(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
        if(btn) { const origin = btn.innerHTML; btn.innerHTML = '<i class="ph ph-check" style="color:#10B981"></i>'; setTimeout(() => btn.innerHTML = origin, 2000); }
    });
}
