const surnames = ["陳", "林", "黃", "張", "李", "王", "吳", "劉", "蔡"];
const names = ["大文", "小明", "志豪", "雅婷", "淑芬", "偉雄", "家豪", "怡君"];
const STORAGE_KEY = 'iHealth_Tree_Calc_v5_Final'; // 版本號更新

function getRandomName() { return surnames[Math.floor(Math.random() * surnames.length)] + names[Math.floor(Math.random() * names.length)]; }
function generateUserID() { return Math.floor(100000 + Math.random() * 900000).toString(); }

let treeData; let nodesCache = {}; let parentMap = {}; 

// Revenue Toggle State
let showRevenue = false;
let revenueData = { signup: 0, reship: 0, total: 0 };
let payoutValue = 0; 

function initData() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (parsed && parsed.id === 'root') { treeData = parsed; return; }
        } catch (e) { console.error(e); }
    }
    treeData = {
        id: 'root', userID: generateUserID(), name: '總店主', level: 'L4',
        sponsorId: null, pathA: null, pathB: null,
        rewards: initRewards(), totalBvA: 0, totalBvB: 0
    };
}

function initRewards() {
    return {
        referral: 0, product: 0, pairing: 0, lucky: 0, reship: 0, rank: 0, achievement: 0, dinner: 0
    };
}

function saveData() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(treeData)); showSaveStatus('已儲存'); } catch (e) { showSaveStatus('儲存失敗'); } }
function clearAllData() { if (confirm('確定要清除所有數據並重置嗎？')) { localStorage.removeItem(STORAGE_KEY); location.reload(); } }
function showSaveStatus(msg) { const el = document.getElementById('saveIndicator'); el.textContent = msg; setTimeout(() => { el.textContent = ''; }, 2000); }

function toggleStats() { document.getElementById('statsBar').classList.toggle('expanded'); }
function toggleBonusDetails() {
    const block = document.getElementById('bonusInfoBlock');
    const btn = document.getElementById('bonusDetailBtn');
    block.classList.toggle('show'); btn.classList.toggle('active');
    if(block.classList.contains('show')) { setTimeout(() => { block.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100); }
}

// --- GLOBAL STATS & REVENUE ---
function calculateGlobalStats() {
    let totalMembers = 0; let maxDepth = 0; let totalPayout = 0; 
    let cntL1 = 0, cntL2 = 0, cntL3 = 0, cntL4 = 0;
    
    let totalSignupRev = 0;
    let totalReshipRev = 0;

    function traverse(node, currentDepth) {
        if (!node) return;
        totalMembers++;
        if (currentDepth > maxDepth) maxDepth = currentDepth;
        
        const r = node.rewards;
        const nodeTotal = r.referral + r.pairing + r.lucky + r.reship + r.rank + r.achievement + r.dinner;
        totalPayout += nodeTotal;
        
        if (node.level === 'L1') {
            cntL1++;
        } else {
            if (node.level === 'L2') { cntL2++; totalSignupRev += 150; }
            else if (node.level === 'L3') { cntL3++; totalSignupRev += 1100; }
            else if (node.level === 'L4') { cntL4++; totalSignupRev += 2200; }
            totalReshipRev += 150;
        }

        traverse(node.pathA, currentDepth + 1); 
        traverse(node.pathB, currentDepth + 1);
    }
    traverse(treeData, 1);

    revenueData = { signup: totalSignupRev, reship: totalReshipRev, total: totalSignupRev + totalReshipRev };
    payoutValue = totalPayout;

    // Generation Stats
    let sponsorMap = {}; let allNodeIds = Object.keys(nodesCache);
    allNodeIds.forEach(id => {
        const node = nodesCache[id];
        if (node.sponsorId) { if (!sponsorMap[node.sponsorId]) sponsorMap[node.sponsorId] = []; sponsorMap[node.sponsorId].push(node.id); }
    });
    let genCounts = [0, 0, 0, 0, 0, 0, 0, 0, 0]; let queue = [{ id: treeData.id, gen: 0 }];
    while (queue.length > 0) {
        let curr = queue.shift();
        if (curr.gen > 0 && curr.gen <= 8) genCounts[curr.gen]++;
        if (curr.gen < 8) { let recruits = sponsorMap[curr.id] || []; recruits.forEach(childId => { queue.push({ id: childId, gen: curr.gen + 1 }); }); }
    }

    document.getElementById('statCount').textContent = totalMembers;
    
    const rootR = treeData.rewards;
    const rootTotal = rootR.referral + rootR.pairing + rootR.lucky + rootR.reship + rootR.rank + rootR.achievement + rootR.dinner;
    document.getElementById('statRootBonus').textContent = '$' + rootTotal.toLocaleString();
    
    document.getElementById('statDepth').textContent = maxDepth;
    document.getElementById('cntL1').textContent = cntL1; document.getElementById('cntL2').textContent = cntL2; document.getElementById('cntL3').textContent = cntL3; document.getElementById('cntL4').textContent = cntL4;

    const tbody = document.getElementById('genTableBody'); tbody.innerHTML = '';
    for (let i = 1; i <= 4; i++) {
        const tr = document.createElement('tr');
        const leftGen = i; const rightGen = i + 4;
        const leftCount = genCounts[leftGen] || 0; const rightCount = genCounts[rightGen] || 0;
        tr.innerHTML = `<td>第 ${leftGen} 代</td><td style="color:${leftCount>0?'var(--btn-primary)':'inherit'}">${leftCount}</td><td>第 ${rightGen} 代</td><td style="color:${rightCount>0?'var(--btn-primary)':'inherit'}">${rightCount}</td>`;
        tbody.appendChild(tr);
    }

    updatePayoutDisplay();
}

function updatePayoutDisplay() {
    const labelEl = document.getElementById('payoutLabel');
    const valEl = document.getElementById('statTotalPayout');
    
    if (showRevenue) {
        labelEl.textContent = '總公司營收 (復購 + 開店)';
        labelEl.style.color = '#f59e0b';
        valEl.textContent = `$${revenueData.total.toLocaleString()} ($${revenueData.reship.toLocaleString()} + $${revenueData.signup.toLocaleString()})`;
        valEl.style.fontSize = '0.9rem';
    } else {
        labelEl.textContent = '總發放獎金 (長按看營收)';
        labelEl.style.color = 'inherit';
        valEl.textContent = '$' + payoutValue.toLocaleString();
        valEl.style.fontSize = '1.1rem';
    }
}

// --- REVENUE TOGGLE HOLD LOGIC ---
const payoutBox = document.getElementById('payoutBox');
const progress = document.getElementById('holdProgress');
let holdDuration = 3000; 
let startTime = 0;
let animationFrame = null;

function startHold(e) {
    if (e.type === 'touchstart') e.preventDefault(); 
    startTime = Date.now();
    showRevenue = false; 
    updatePayoutDisplay();
    
    function animate() {
        let elapsed = Date.now() - startTime;
        let pct = Math.min((elapsed / holdDuration) * 100, 100);
        progress.style.width = pct + '%';
        
        if (elapsed >= holdDuration) {
            showRevenue = true;
            updatePayoutDisplay();
            if (navigator.vibrate) navigator.vibrate(100);
            return;
        }
        animationFrame = requestAnimationFrame(animate);
    }
    animationFrame = requestAnimationFrame(animate);
}

function endHold() {
    cancelAnimationFrame(animationFrame);
    progress.style.width = '0%';
    showRevenue = false;
    updatePayoutDisplay();
}

payoutBox.addEventListener('mousedown', startHold);
payoutBox.addEventListener('touchstart', startHold);
payoutBox.addEventListener('mouseup', endHold);
payoutBox.addEventListener('mouseleave', endHold);
payoutBox.addEventListener('touchend', endHold);


function getNodeBaseBV(level) { if (level === 'L2') return 80; if (level === 'L3') return 500; if (level === 'L4') return 1000; return 0; }
function getSponsorReward(level) {
    if (level === 'L2') return { cash: 16, bv: 80, card: 0 };
    if (level === 'L3') return { cash: 100, bv: 500, card: 100 };
    if (level === 'L4') return { cash: 200, bv: 1000, card: 200 };
    return { cash: 0, bv: 0, card: 0 };
}
function collectAllDescendants(startNode, list) { if (!startNode) return; list.push(startNode); collectAllDescendants(startNode.pathA, list); collectAllDescendants(startNode.pathB, list); }

// --- CORE CALCULATION ENGINE ---
function calculateBonuses() {
    resetRewards(treeData); 
    nodesCache = {}; parentMap = {}; 
    buildCache(treeData, null);
    const allNodes = Object.values(nodesCache);
    
    // 1. BV Calculation (Placement Tree) - CORRECTED
    allNodes.forEach(node => {
        let leftSubtreeNodes = []; collectAllDescendants(node.pathA, leftSubtreeNodes);
        let validLeftBV = 0; 
        leftSubtreeNodes.forEach(child => { 
            if (child.level !== 'L1') {
                validLeftBV += (getNodeBaseBV(child.level) + 40); 
            }
        });
        node.totalBvA = validLeftBV;

        let rightSubtreeNodes = []; collectAllDescendants(node.pathB, rightSubtreeNodes);
        let validRightBV = 0; 
        rightSubtreeNodes.forEach(child => { 
            if (child.level !== 'L1') {
                validRightBV += (getNodeBaseBV(child.level) + 40); 
            }
        });
        node.totalBvB = validRightBV;
    });

    // 2. Pairing Bonus
    calculatePairingBonus(treeData);

    // 3. Unilevel Cash Bonuses
    allNodes.forEach(node => {
        let curr = node; let generation = 1;
        let tempSponsor = nodesCache[curr.sponsorId];
        
        while(tempSponsor && generation <= 8) {
            if (generation === 1 && tempSponsor.level !== 'L1') {
                const rw = getSponsorReward(node.level);
                tempSponsor.rewards.referral += rw.cash;
                tempSponsor.rewards.product += rw.card;
            }
            if (tempSponsor.level !== 'L1' && node.level !== 'L1') {
                    if (generation === 1) tempSponsor.rewards.reship += 16;
                    else tempSponsor.rewards.reship += 4;
            }
            if (node.rewards.pairing > 0) { 
                tempSponsor.rewards.lucky += (node.rewards.pairing * 0.1); 
            }
            if (tempSponsor.sponsorId) tempSponsor = nodesCache[tempSponsor.sponsorId]; else tempSponsor = null;
            generation++;
        }
    });

    // 4. Rank & Other Bonuses
    allNodes.forEach(node => {
        let teamCount = 0; let stack = [];
        if(node.pathA) stack.push(node.pathA); if(node.pathB) stack.push(node.pathB);
        while(stack.length > 0) { let c = stack.pop(); teamCount++; if(c.pathA) stack.push(c.pathA); if(c.pathB) stack.push(c.pathB); }
        
        if (teamCount >= 2000) node.rewards.rank = 2000;
        else if (teamCount >= 1000) node.rewards.rank = 1000;
        else if (teamCount >= 500) node.rewards.rank = 500;
        else if (teamCount >= 300) node.rewards.rank = 300;
        else if (teamCount >= 100) node.rewards.rank = 100;

        let ach = 0;
        if (teamCount >= 100) ach += 1000; if (teamCount >= 300) ach += 3000; if (teamCount >= 500) ach += 5000; if (teamCount >= 1000) ach += 10000; if (teamCount >= 2000) ach += 20000;
        node.rewards.achievement = ach;
        
        let din = 0;
        if (teamCount >= 1000) din = 1200; else if (teamCount >= 500) din = 1000; else if (teamCount >= 300) din = 800; else if (teamCount >= 100) din = 600;
        node.rewards.dinner = din;
    });

    calculateGlobalStats(); 
    saveData();
}

function calculatePairingBonus(node) { if (!node) return; const pairVolume = Math.min(node.totalBvA, node.totalBvB); if (pairVolume > 0) node.rewards.pairing = Math.round(pairVolume * 0.15 * 100) / 100; calculatePairingBonus(node.pathA); calculatePairingBonus(node.pathB); }
function buildCache(node, parent) { if (!node) return; nodesCache[node.id] = node; if(parent) parentMap[node.id] = parent; buildCache(node.pathA, node); buildCache(node.pathB, node); }
function resetRewards(node) { if (!node) return; node.rewards = initRewards(); node.totalBvA = 0; node.totalBvB = 0; resetRewards(node.pathA); resetRewards(node.pathB); }
function calculateAndRender(render = true) { calculateBonuses(); if(render) renderTree(false); }

// --- BULK ADD LOGIC ---
function bulkAdd(count) {
    let added = 0;
    for (let i = 0; i < count; i++) {
        let allNodes = [];
        collectAllDescendants(treeData, allNodes);
        let candidates = allNodes.filter(n => !n.pathA || !n.pathB);
        if (candidates.length === 0) break;
        
        let parent = candidates[Math.floor(Math.random() * candidates.length)];
        let pathKey = '';
        if (!parent.pathA && !parent.pathB) pathKey = Math.random() > 0.5 ? 'pathA' : 'pathB';
        else if (!parent.pathA) pathKey = 'pathA';
        else pathKey = 'pathB';
        
        parent[pathKey] = {
            id: Date.now().toString() + Math.random().toString().substr(2, 5),
            userID: generateUserID(),
            name: getRandomName(),
            level: 'L4', 
            sponsorId: parent.id,
            pathA: null, pathB: null,
            rewards: initRewards(), totalBvA: 0, totalBvB: 0
        };
        added++;
    }
    calculateAndRender();
}

function updateNodeData(id, key, value) { 
    const node = findNode(treeData, id); 
    if (node) { 
        node[key] = value; 
        if (key === 'level') {
            calculateAndRender(true); 
        } else {
            saveData();
        }
    } 
}

let currentSelectingNodeId = null;
function openSponsorModal(nodeId) {
    currentSelectingNodeId = nodeId; const container = document.getElementById('nodeListContainer'); container.innerHTML = '';
    nodesCache = {}; parentMap = {}; buildCache(treeData, null);
    
    let validSponsors = [];
    let curr = nodesCache[nodeId];
    let parent = parentMap[curr.id];
    
    // PUBLIC LINE LOGIC
    while(parent) {
        validSponsors.push(parent);
        if (parent.pathB && parent.pathB.id === curr.id) {
            break;
        }
        curr = parent;
        parent = parentMap[curr.id];
    }

    if (validSponsors.length === 0) { container.innerHTML = '<div style="padding:10px;text-align:center;opacity:0.6;">無可選推薦人</div>'; } 
    else {
        validSponsors.forEach(n => {
            const item = document.createElement('div'); item.className = 'node-list-item';
            item.innerHTML = `<div class="node-list-info"><span class="node-list-name">${n.name}</span><span class="node-list-id">ID: ${n.userID || '---'}</span></div><span class="node-list-level">${n.level}</span>`;
            item.onclick = () => setSponsor(n.id); container.appendChild(item);
        });
    }
    document.getElementById('sponsorModal').classList.add('open');
}
function closeSponsorModal() { document.getElementById('sponsorModal').classList.remove('open'); }
function setSponsor(sponsorId) { const node = nodesCache[currentSelectingNodeId]; if (node) { node.sponsorId = sponsorId; calculateAndRender(); } closeSponsorModal(); }
function getSponsorName(id) { if (!id) return "無"; if (nodesCache[id]) return nodesCache[id].name; return "未知"; }

const treeRootEl = document.getElementById('treeRoot');
function findNode(root, id) { if (!root) return null; if (root.id === id) return root; return findNode(root.pathA, id) || findNode(root.pathB, id); }
function findParent(root, childId) { if (!root) return null; if ((root.pathA && root.pathA.id === childId) || (root.pathB && root.pathB.id === childId)) return root; return findParent(root.pathA, childId) || findParent(root.pathB, childId); }

function addNode(parentId, pathKey) {
    const parent = findNode(treeData, parentId);
    if (parent) {
        parent[pathKey] = {
            id: Date.now().toString(), userID: generateUserID(), name: getRandomName(), level: 'L4',
            sponsorId: parent.id, pathA: null, pathB: null,
            rewards: initRewards(), totalBvA: 0, totalBvB: 0
        }; calculateAndRender(); 
    }
}
function deleteNode(nodeId) { if(nodeId === 'root' || !confirm("確定刪除？")) return; const parent = findParent(treeData, nodeId); if (parent) { if (parent.pathA && parent.pathA.id === nodeId) parent.pathA = null; else if (parent.pathB && parent.pathB.id === nodeId) parent.pathB = null; calculateAndRender(); } }

function renderTree(centerView = true) {
    nodesCache = {}; parentMap = {}; buildCache(treeData, null);
    treeRootEl.innerHTML = ''; treeRootEl.appendChild(createNodeElement(treeData));
}

function createNodeElement(nodeData) {
    const wrapper = document.createElement('div'); wrapper.className = 'node-wrapper';
    const card = document.createElement('div'); card.className = 'node-card'; card.setAttribute('data-level', nodeData.level); card.id = `card-${nodeData.id}`;
    attachLongPress(card, () => { document.querySelectorAll('.node-card.edit-mode').forEach(el => el.classList.remove('edit-mode')); card.classList.add('edit-mode'); });
    if (nodeData.id !== 'root') {
        const delBtn = document.createElement('div'); delBtn.className = 'delete-btn'; delBtn.textContent = '×';
        delBtn.ontouchstart = (e) => e.stopPropagation(); delBtn.onclick = (e) => { e.stopPropagation(); deleteNode(nodeData.id); }; card.appendChild(delBtn);
        const spBtn = document.createElement('div'); spBtn.className = 'sponsor-btn'; spBtn.innerHTML = '🔗';
        spBtn.ontouchstart = (e) => e.stopPropagation(); spBtn.onclick = (e) => { e.stopPropagation(); openSponsorModal(nodeData.id); }; card.appendChild(spBtn);
        const spLabel = document.createElement('div'); spLabel.className = 'sponsor-label'; spLabel.textContent = `推: ${getSponsorName(nodeData.sponsorId)}`; card.appendChild(spLabel);
    }
    const header = document.createElement('div'); header.className = 'node-header';
    const nameInput = document.createElement('input'); nameInput.type = 'text'; nameInput.className = 'node-name-input'; nameInput.value = nodeData.name;
    nameInput.oninput = (e) => updateNodeData(nodeData.id, 'name', e.target.value); nameInput.ontouchstart = (e) => e.stopPropagation(); header.appendChild(nameInput);
    const idInput = document.createElement('input'); idInput.type = 'text'; idInput.className = 'node-userid-input'; idInput.value = nodeData.userID || ''; idInput.placeholder = 'ID';
    idInput.oninput = (e) => updateNodeData(nodeData.id, 'userID', e.target.value); idInput.ontouchstart = (e) => e.stopPropagation(); header.appendChild(idInput);
    const levelSelect = document.createElement('select'); levelSelect.className = 'node-level-select';
    ['L1', 'L2', 'L3', 'L4'].forEach(lvl => { const opt = document.createElement('option'); opt.value = lvl; opt.textContent = lvl; if (nodeData.level === lvl) opt.selected = true; levelSelect.appendChild(opt); });
    levelSelect.onchange = (e) => updateNodeData(nodeData.id, 'level', e.target.value); levelSelect.ontouchstart = (e) => e.stopPropagation(); header.appendChild(levelSelect);
    card.appendChild(header);

    const bonusList = document.createElement('div'); bonusList.className = 'bonus-list';
    const r = nodeData.rewards;
    const addRow = (label, val, typeClass) => { if (val <= 0) return; bonusList.innerHTML += `<div class="bonus-row"><div class="bonus-label"><span class="badge ${typeClass}">${label}</span></div><span class="bonus-val">$${Math.round(val).toLocaleString()}</span></div>`; };
    addRow('直推', r.referral, 'b-onetime'); addRow('對碰', r.pairing, 'b-daily'); addRow('幸運', r.lucky, 'b-daily'); addRow('復購', r.reship, 'b-monthly'); addRow('晉級', r.rank, 'b-monthly'); addRow('成就', r.achievement, 'b-monthly');
    card.appendChild(bonusList);
    const total = r.referral + r.pairing + r.lucky + r.reship + r.rank + r.achievement + r.dinner;
    const footer = document.createElement('div'); footer.className = 'total-row'; footer.innerHTML = `<span class="total-label">總獎金</span><span class="total-val">$${Math.round(total).toLocaleString()}</span>`; card.appendChild(footer);
    wrapper.appendChild(card);
    const childrenContainer = document.createElement('div'); childrenContainer.className = 'children-container';
    const branchA = createBranch(nodeData, 'pathA'); if (nodeData.pathA || nodeData.totalBvA > 0) { const bvTagA = document.createElement('div'); bvTagA.className = 'line-bv-tag'; bvTagA.textContent = `${nodeData.totalBvA} BV`; branchA.appendChild(bvTagA); } childrenContainer.appendChild(branchA);
    const branchB = createBranch(nodeData, 'pathB'); if (nodeData.pathB || nodeData.totalBvB > 0) { const bvTagB = document.createElement('div'); bvTagB.className = 'line-bv-tag'; bvTagB.textContent = `${nodeData.totalBvB} BV`; branchB.appendChild(bvTagB); } childrenContainer.appendChild(branchB);
    wrapper.appendChild(childrenContainer); return wrapper;
}

function createBranch(parentNode, pathKey) {
    const branch = document.createElement('div'); branch.className = 'branch';
    const content = document.createElement('div'); content.className = 'branch-content';
    if (parentNode[pathKey]) content.appendChild(createNodeElement(parentNode[pathKey]));
    else { const addBtn = document.createElement('button'); addBtn.className = 'add-btn'; addBtn.textContent = '+'; addBtn.onclick = () => addNode(parentNode.id, pathKey); addBtn.ontouchstart = (e) => e.stopPropagation(); content.appendChild(addBtn); }
    branch.appendChild(content); return branch;
}

function attachLongPress(element, callback) { let timer; const start = () => { if (element.classList.contains('edit-mode')) return; timer = setTimeout(() => { callback(); if (navigator.vibrate) navigator.vibrate(50); }, 600); }; const cancel = () => { clearTimeout(timer); }; element.addEventListener('touchstart', start, {passive: true}); element.addEventListener('touchend', cancel); element.addEventListener('touchmove', cancel); element.addEventListener('mousedown', start); element.addEventListener('mouseup', cancel); element.addEventListener('mouseleave', cancel); }
document.addEventListener('touchstart', (e) => { if (!e.target.closest('.node-card')) document.querySelectorAll('.node-card.edit-mode').forEach(el => el.classList.remove('edit-mode')); });
document.addEventListener('mousedown', (e) => { if (!e.target.closest('.node-card')) document.querySelectorAll('.node-card.edit-mode').forEach(el => el.classList.remove('edit-mode')); });

// --- PERFORMANCE OPTIMIZED DRAG LOGIC ---
const viewport = document.getElementById('viewport'); 
const panLayer = document.getElementById('panLayer');
let scale = 1, translateX = 0, translateY = 0, isDragging = false, startX, startY;
let startDist = 0, startScale = 1, startCenterX = 0, startCenterY = 0, startTranslateX = 0, startTranslateY = 0;
let clickCount = 0; let clickTimer = null;
let rafId = null;

function handleTripleClick() { 
    clickCount++; 
    if (clickCount === 1) { 
        clickTimer = setTimeout(() => { clickCount = 0; }, 400); 
    } else if (clickCount === 3) { 
        clearTimeout(clickTimer); clickCount = 0; resetView(); 
        if (navigator.vibrate) navigator.vibrate([50, 30, 50]); 
    } 
}

function updateTransform() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
        panLayer.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`;
        rafId = null;
    });
}

function resetView() { 
    scale = 1; panLayer.classList.add('smooth-move'); 
    const layerWidth = panLayer.offsetWidth; const viewWidth = viewport.clientWidth; 
    translateX = (viewWidth - layerWidth) / 2; translateY = 40; 
    panLayer.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(1)`; 
    document.getElementById('statsBar').classList.remove('expanded'); 
    setTimeout(() => panLayer.classList.remove('smooth-move'), 300); 
}

viewport.addEventListener('wheel', (e) => { 
    e.preventDefault(); 
    panLayer.classList.remove('smooth-move'); 
    const newScale = Math.min(Math.max(0.2, scale + (-e.deltaY) * 0.001), 3); 
    const rect = panLayer.getBoundingClientRect(); 
    const ratio = newScale / scale; 
    translateX -= (e.clientX - rect.left) * (ratio - 1); 
    translateY -= (e.clientY - rect.top) * (ratio - 1); 
    scale = newScale; 
    updateTransform(); 
}, { passive: false });

viewport.addEventListener('mousedown', (e) => { 
    if (['INPUT','SELECT','BUTTON'].includes(e.target.tagName) || e.target.closest('.node-card')) return; 
    handleTripleClick(); 
    panLayer.classList.remove('smooth-move'); 
    viewport.classList.add('moving');
    isDragging = true; 
    startX = e.clientX - translateX; 
    startY = e.clientY - translateY; 
    viewport.style.cursor = 'grabbing'; 
});

window.addEventListener('mousemove', (e) => { 
    if (!isDragging) return; 
    e.preventDefault(); 
    translateX = e.clientX - startX; 
    translateY = e.clientY - startY; 
    updateTransform(); 
});

window.addEventListener('mouseup', () => { 
    isDragging = false; 
    viewport.classList.remove('moving');
    viewport.style.cursor = 'grab'; 
});

function getDistance(touches) { return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY); }
function getCenter(touches) { return { x: (touches[0].clientX + touches[1].clientX) / 2, y: (touches[0].clientY + touches[1].clientY) / 2 }; }

viewport.addEventListener('touchstart', (e) => { 
    if (e.target.closest('input') || e.target.closest('select') || e.target.closest('button')) return; 
    panLayer.classList.remove('smooth-move'); 
    
    if (e.touches.length === 1) { 
        handleTripleClick(); 
        viewport.classList.add('moving');
        isDragging = true; 
        startX = e.touches[0].clientX - translateX; 
        startY = e.touches[0].clientY - translateY; 
    } else if (e.touches.length === 2) { 
        isDragging = false; 
        viewport.classList.add('moving');
        startDist = getDistance(e.touches); 
        startScale = scale; 
        const center = getCenter(e.touches); 
        startCenterX = center.x; startCenterY = center.y; 
        startTranslateX = translateX; startTranslateY = translateY; 
    } 
}, { passive: false });

viewport.addEventListener('touchmove', (e) => { 
    e.preventDefault(); 
    if (e.touches.length === 1 && isDragging) { 
        translateX = e.touches[0].clientX - startX; 
        translateY = e.touches[0].clientY - startY; 
        updateTransform(); 
    } else if (e.touches.length === 2) { 
        const currDist = getDistance(e.touches); 
        const currCenter = getCenter(e.touches); 
        let newScale = Math.min(Math.max(0.2, startScale * (currDist / startDist)), 5); 
        const ratio = newScale / startScale; 
        translateX = currCenter.x - (startCenterX - startTranslateX) * ratio; 
        translateY = currCenter.y - (startCenterY - startTranslateY) * ratio; 
        scale = newScale; 
        updateTransform(); 
    } 
}, { passive: false });

viewport.addEventListener('touchend', (e) => { 
    isDragging = false; 
    if (e.touches.length === 0) viewport.classList.remove('moving');
    if (e.touches.length < 2) startDist = 0; 
});

const themeToggleBtn = document.getElementById('themeToggle'); const themes = ['auto', 'light', 'dark']; let currentThemeIndex = 0;
function applyTheme(t) { document.documentElement.removeAttribute('data-theme'); let sys = window.matchMedia('(prefers-color-scheme: dark)').matches; themeToggleBtn.textContent = `外觀: ${t === 'auto' ? '自動' : (t === 'light' ? '淺色' : '深色')}`; if (t === 'dark' || (t === 'auto' && sys)) document.documentElement.setAttribute('data-theme', 'dark'); else document.documentElement.setAttribute('data-theme', 'light'); }
themeToggleBtn.addEventListener('click', () => { currentThemeIndex = (currentThemeIndex + 1) % themes.length; applyTheme(themes[currentThemeIndex]); });

function downloadJSON() { const a = document.createElement('a'); a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(treeData, null, 2)); a.download = "iHealth_tree_v5_final.json"; document.body.appendChild(a); a.click(); a.remove(); }
function importJSON(input) { const f = input.files[0]; if(!f) return; const r = new FileReader(); r.onload = (e) => { try { const d = JSON.parse(e.target.result); const fix = (n) => { if(!n)return; if(n.userID===undefined)n.userID=generateUserID(); if(n.sponsorId===undefined)n.sponsorId=null; if(n.totalBvA===undefined)n.totalBvA=0; if(n.totalBvB===undefined)n.totalBvB=0; if(n.rewards.pairing===undefined)n.rewards=initRewards(); fix(n.pathA); fix(n.pathB); }; fix(d); treeData = d; calculateAndRender(); input.value = ''; } catch(err) { alert('JSON Error'); } }; r.readAsText(f); }

applyTheme('auto'); initData(); calculateAndRender(); window.onload = function() { setTimeout(resetView, 100); };
