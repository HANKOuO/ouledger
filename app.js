// ==========================================
// 1. 全局狀態初始化與切頁控制
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const tabButtons = document.querySelectorAll('#tab-container button');
    const tabs = ['book', 'save', 'shared', 'wishlist', 'stats'];
    
    tabButtons.forEach((btn, index) => {
        btn.addEventListener('click', () => switchTab(tabs[index], btn));
    });
    
    const now = new Date();
    state.currentMonthFilter = now.getFullYear() + '.' + String(now.getMonth() + 1).padStart(2, '0');
});

if (!state.currentMonthFilter) {
    const now = new Date();
    state.currentMonthFilter = now.getFullYear() + '.' + String(now.getMonth() + 1).padStart(2, '0');
}
if (!state.wishlist) { state.wishlist = []; }

// 物理震動微反饋小工具
function triggerHaptic(ms = 15) {
    if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(ms);
    }
}

function switchTab(tabName, clickedButton) {
    triggerHaptic(12);
    state.currentTab = tabName;
    const tabButtons = document.querySelectorAll('#tab-container button');
    const floatBtn = document.getElementById('float-add-btn');
    
    tabButtons.forEach(btn => btn.className = "glass-panel text-slate-400 p-2 rounded-xl text-center flex flex-col items-center justify-center transition-all cursor-pointer text-xs");
    clickedButton.className = "active-tab text-pink-400 p-2 rounded-xl text-center flex flex-col items-center justify-center transition-all cursor-pointer text-xs";

    if (tabName === 'book') {
        floatBtn.classList.remove('hidden');
        renderBookPage();
    } else {
        floatBtn.classList.add('hidden');
        if (tabName === 'save') renderIncomeSavePage();
        else if (tabName === 'shared') renderSharedPoolPage();
        else if (tabName === 'wishlist') renderWishlistPage();
        else if (tabName === 'stats') renderStatsPage();
    }
}

// ==========================================
// 2. 雲端記帳數據撈取與分配
// ==========================================
async function fetchTransactions() {
    const { data, error } = await supabaseClient
        .from('transactions')
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        console.error('抓取雲端數據失敗:', error);
        alert('同步帳本資料失敗，請確認 RLS 權限。');
        return;
    }

    const allData = data || [];
    state.transactions = allData.filter(d => d.status !== 'wish');
    state.wishlist = allData.filter(d => d.status === 'wish');

    recalculateBalances();
    if (state.currentTab === 'book') renderBookPage();
    else if (state.currentTab === 'wishlist') renderWishlistPage();
    else if (state.currentTab === 'stats') renderStatsPage();
}

// ==========================================
// 3. 核心：帳本明細分頁渲染 (🔥 Bug 徹底修正防死鎖版)
// ==========================================
function renderBookPage() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    const filteredList = state.transactions.filter(item => {
        if (state.filterType === 'all') return true;
        return item.type === state.filterType;
    });

    let htmlContent = `
        <div class="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/5 text-[11px] font-medium card-animate">
            <button onclick="setBookFilter('all')" class="flex-1 py-1.5 rounded-lg text-center cursor-pointer transition-all ${state.filterType === 'all' ? 'bg-white/10 text-slate-200' : 'text-slate-500'}">全部</button>
            <button onclick="setBookFilter('personal')" class="flex-1 py-1.5 rounded-lg text-center cursor-pointer transition-all ${state.filterType === 'personal' ? 'bg-white/10 text-slate-200' : 'text-slate-500'}">個人</button>
            <button onclick="setBookFilter('shared')" class="flex-1 py-1.5 rounded-lg text-center cursor-pointer transition-all ${state.filterType === 'shared' ? 'bg-white/10 text-slate-200' : 'text-slate-500'}">共同</button>
        </div>
    `;

    const hasVisibleExpenses = filteredList.some(item => item.type !== 'income');

    if (!hasVisibleExpenses) {
        htmlContent += `<div class="text-center py-12 text-slate-600 text-xs tracking-wider card-animate">尚無明細數據</div>`;
    } else {
        filteredList.forEach(item => {
            if (item.type === 'income') return; 

            const isMyTx = (state.userRole === 'boyfriend' && item.by === '男友') || (state.userRole === 'girlfriend' && item.by === '女友');
            const isDisapproved = item.status === 'disapproved';
            const txAmount = parseFloat(item.amount) || 0;

            let amountDisplay = `<span class="text-slate-200 font-mono text-sm tracking-tight">-NT$${txAmount.toLocaleString()}</span>`;

            let commentsListHtml = '';
            if (Array.isArray(item.comments) && item.comments.length > 0) {
                commentsListHtml = `<div class="mt-1 space-y-1.5 bg-white/5 p-3 rounded-xl border border-white/5 text-[11px]">`;
                item.comments.forEach(c => {
                    const isBf = c.author === '男友';
                    commentsListHtml += `
                        <div class="leading-relaxed flex items-start gap-1">
                            <span class="${isBf ? 'text-blue-400' : 'text-pink-400'} font-medium shrink-0">${c.author}：</span>
                            <span class="text-slate-300 break-all">${c.text}</span>
                        </div>
                    `;
                });
                commentsListHtml += `</div>`;
            }

            // 🚀 修正點：精準使用 item.title，徹底消滅崩潰錯誤！
            let aaButtonHtml = '';
            if (isMyTx && !item.title.includes('🤖 AA')) {
                aaButtonHtml = `
                    <div class="text-right mt-1">
                        <button onclick="splitAATransaction('${item.id}')" class="text-[9px] text-emerald-400 border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-0.5 rounded-full cursor-pointer hover:bg-emerald-500/10 transition-colors">
                            ➗ AA拆帳
                        </button>
                    </div>
                `;
            }

            let actionButtonsHtml = '';
            if (isMyTx) {
                actionButtonsHtml = `
                    <button onclick="openTransactionModal('${item.id}')" class="text-[9px] text-slate-400 border border-white/5 bg-white/5 px-2.5 py-0.5 rounded-full cursor-pointer hover:bg-white/10">編輯</button>
                    <button onclick="deleteTransaction('${item.id}')" class="text-[9px] text-rose-400/80 border border-rose-500/10 bg-rose-500/5 px-2.5 py-0.5 rounded-full cursor-pointer hover:rose-500/10">刪除</button>
                `;
            } else {
                actionButtonsHtml = `
                    <button onclick="toggleQuickReject('${item.id}')" class="text-[10px] px-3 py-1 rounded-full font-medium cursor-pointer transition-all duration-200 border ${
                        isDisapproved 
                        ? 'bg-rose-500/30 text-rose-300 border-rose-500/50 shadow-md shadow-rose-500/20' 
                        : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'
                    }">
                        ${isDisapproved ? '已駁回' : '駁回'}
                    </button>
                `;
            }

            const categoryIcons = { "早餐": "🍔", "午餐": "🍱", "晚餐": "🍜", "宵夜": "🌙", "飲料": "🧋", "零食": "🍪", "交通": "🚗", "購物": "🛍️", "娛樂": "🎬", "水電": "⚡", "電信": "📱", "其他": "📦" };
            const currentIcon = categoryIcons[item.category] || "📝";

            htmlContent += `
                <div class="glass-panel p-4 rounded-2xl space-y-3 relative card-animate press-effect ${isDisapproved ? 'border-l-2 border-rose-500/60 bg-rose-950/5' : ''}">
                    <div class="flex justify-between items-start">
                        <div class="space-y-1 pr-4">
                            <div class="flex items-center gap-2 flex-wrap">
                                <span class="text-xs">${currentIcon}</span>
                                <span class="text-sm font-light text-slate-200 tracking-wide">${item.title}</span>
                                <span class="text-[8px] px-1.5 py-0.2 rounded-md ${item.type === 'shared' ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'}">
                                    ${item.type === 'shared' ? '共同' : '個人'}
                                </span>
                                ${isDisapproved ? '<div class="text-[8px] bg-rose-500/10 text-rose-400 px-1.5 py-0.5 rounded font-medium">⚠️ 未認同消費</div>' : ''}
                            </div>
                            <p class="text-[10px] text-slate-500 font-mono tracking-wider">${item.date} // 記錄者：${item.by}</p>
                        </div>
                        <div class="shrink-0 text-right">
                            <div>${amountDisplay}</div>
                            ${aaButtonHtml}
                        </div>
                    </div>
                    ${commentsListHtml}
                    <div class="flex justify-between items-center pt-2 border-t border-white/5 gap-3">
                        <div class="flex-1 flex gap-1.5">
                            <input type="text" id="comment-input-${item.id}" placeholder="留下訊息..." class="flex-1 bg-white/5 border border-white/5 rounded-lg px-2.5 py-1 text-[10px] text-slate-300 focus:outline-none focus:border-pink-500/20">
                            <button onclick="addComment('${item.id}')" class="text-[9px] bg-white/5 text-slate-400 px-2.5 rounded-lg hover:bg-white/10 cursor-pointer">發送</button>
                        </div>
                        <div class="flex gap-1.5 shrink-0 items-center">${actionButtonsHtml}</div>
                    </div>
                </div>
            `;
        });
    }
    mainContent.innerHTML = htmlContent;
}

window.setBookFilter = function(type) { state.filterType = type; renderBookPage(); };

// ==========================================
// 4. 核心：許願便簽牆分頁渲染模組 (🚀 精簡雙選項版)
// ==========================================
function renderWishlistPage() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    let wishCardsHtml = '';
    state.wishlist.forEach(wish => {
        const categoryIcons = { "想吃甚麼": "🍿", "想做甚麼": "✨" };
        wishCardsHtml += `
            <div class="glass-panel p-4 rounded-xl flex justify-between items-center card-animate press-effect border-l-2 border-pink-500/30">
                <div class="space-y-1">
                    <div class="flex items-center gap-1.5">
                        <span class="text-xs">${categoryIcons[wish.category] || '✨'}</span>
                        <span class="text-sm font-light text-slate-200">${wish.title}</span>
                    </div>
                    <p class="text-[9px] text-slate-500 font-mono">// 許願人：${wish.by}</p>
                </div>
                <div class="flex gap-2 shrink-0">
                    <button onclick="convertWishToReal('${wish.id}')" class="text-[9px] bg-pink-500/20 text-pink-300 px-3 py-1 rounded-full border border-pink-500/30 cursor-pointer hover:bg-pink-500/30 transition-all">🍕 去吃了/轉記帳</button>
                    <button onclick="deleteTransaction('${wish.id}')" class="text-[9px] text-slate-600 hover:text-rose-400 px-1 font-mono cursor-pointer">X</button>
                </div>
            </div>
        `;
    });

    mainContent.innerHTML = `
        <div class="glass-panel p-5 rounded-2xl space-y-4 card-animate">
            <p class="text-[11px] text-pink-400 font-medium tracking-wider">🔮 下次想吃 / 想做的清單便簽</p>
            <div class="flex flex-col gap-3">
                <div class="grid grid-cols-2 gap-2">
                    <select id="wish-category" class="w-full bg-white/5 border border-white/5 px-3 py-2 rounded-xl text-xs text-slate-400 focus:outline-none bg-[#121826]">
                        <option value="想吃甚麼">🍿 想吃甚麼</option>
                        <option value="想做甚麼">✨ 想做甚麼</option>
                    </select>
                    <input type="text" id="wish-title" placeholder="目的地或食物名稱..." class="w-full bg-white/5 border border-white/5 px-3 py-2 rounded-xl text-xs text-slate-200 focus:outline-none">
                </div>
                <button onclick="submitWishItem()" class="w-full py-2 bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-pink-300 border border-pink-500/20 text-xs rounded-xl cursor-pointer hover:from-pink-500/30 transition-all font-mono tracking-widest">寫入心願牆</button>
            </div>
        </div>
        <div class="space-y-2.5">
            <p class="text-[10px] text-slate-500 font-mono tracking-widest">// 目前累積的悄悄話心願</p>
            ${state.wishlist.length === 0 ? '<p class="text-center py-8 text-slate-600 text-xs card-animate">目前空空如也，快去許願！</p>' : wishCardsHtml}
        </div>
    `;
}

window.submitWishItem = async function() {
    const title = document.getElementById('wish-title').value.trim();
    const category = document.getElementById('wish-category').value;
    const currentBy = state.userRole === 'boyfriend' ? '男友' : '女友';
    if (!title) return alert('請填寫願望名稱。');

    triggerHaptic(25);

    const { error } = await supabaseClient
        .from('transactions')
        .insert([{
            title: title, amount: 0, date: '心願牆', by: currentBy,
            type: 'personal', category: category, status: 'wish', comments: []
        }]);

    if (error) return alert('許願失敗: ' + error.message);
    await fetchTransactions();
};

window.convertWishToReal = function(id) {
    triggerHaptic(15);
    const wish = state.wishlist.find(w => String(w.id) === String(id));
    if (!wish) return;

    document.getElementById('transaction-modal').classList.remove('hidden');
    document.getElementById('modal-title').innerText = "// 願望實現！轉為明細";
    document.getElementById('edit-id').value = wish.id; 
    document.getElementById('tx-title').value = wish.title;
    document.getElementById('tx-category').value = wish.category === '想吃甚麼' ? '宵夜' : '娛樂'; // 自動適度對齊支出類別
    document.getElementById('tx-amount').value = "";
    document.getElementById('tx-account-type').value = "shared";
};

// ==========================================
// 5. 核心：自訂金額 AA 自由拆帳器
// ==========================================
window.splitAATransaction = async function(id) {
    const tx = state.transactions.find(t => String(t.id) === String(id));
    if (!tx) return;
    
    const originalAmount = parseFloat(tx.amount) || 0;
    const defaultHalf = Math.round(originalAmount / 2);
    const targetPartner = state.userRole === 'boyfriend' ? '女友個人' : '男友個人';

    const dialogOverlay = document.createElement('div');
    dialogOverlay.className = "fixed inset-0 bg-[#070a13]/90 backdrop-blur-md z-[60] flex items-center justify-center p-6 card-animate";
    
    dialogOverlay.innerHTML = `
        <div class="glass-panel w-full max-w-sm p-6 rounded-3xl space-y-5 border border-white/10 text-left">
            <div>
                <h3 class="text-xs font-mono tracking-widest text-slate-400">// ➗ 拆帳計算機</h3>
                <p class="text-[10px] text-slate-500 font-mono mt-0.5">原項目總金額：NT$${originalAmount.toLocaleString()}</p>
            </div>
            <div class="space-y-3.5">
                <div class="space-y-1">
                    <label class="text-[10px] text-slate-500 font-mono px-1">// 1. 選擇拆帳對象</label>
                    <select id="aa-target-account" class="w-full bg-white/5 border border-white/5 px-4 py-2.5 rounded-xl text-sm text-slate-300 focus:outline-none bg-[#121826]">
                        <option value="shared">👥 拆給【共同帳戶】</option>
                        <option value="personal">🙋‍♀️ 拆給【${targetPartner}】</option>
                    </select>
                </div>
                <div class="space-y-1">
                    <label class="text-[10px] text-slate-500 font-mono px-1">// 2. 輸入拆帳金額 (NT$)</label>
                    <input type="number" id="aa-split-amount" value="${defaultHalf}" class="w-full bg-white/5 border border-white/5 px-4 py-2.5 rounded-xl text-sm text-slate-200 focus:outline-none">
                </div>
            </div>
            <div class="grid grid-cols-2 gap-3 pt-2">
                <button id="aa-cancel-btn" class="py-2.5 rounded-xl border border-white/5 bg-white/5 text-slate-400 text-xs font-medium uppercase cursor-pointer hover:bg-white/10 transition-all text-center">取消</button>
                <button id="aa-confirm-btn" class="py-2.5 rounded-xl bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-pink-300 border border-pink-500/30 text-xs font-medium uppercase cursor-pointer hover:from-pink-500/30 transition-all text-center">確認寫入</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialogOverlay);
    dialogOverlay.querySelector('#aa-cancel-btn').addEventListener('click', () => dialogOverlay.remove());

    dialogOverlay.querySelector('#aa-confirm-btn').addEventListener('click', async () => {
        const targetType = dialogOverlay.querySelector('#aa-target-account').value;
        const splitAmount = Math.round(parseFloat(dialogOverlay.querySelector('#aa-split-amount').value));

        if (isNaN(splitAmount) || splitAmount <= 0) return alert('// 請輸入有效的拆帳金額。');
        if (splitAmount >= originalAmount) return alert(`// 警告：拆帳金額必須小於原總額。`);

        triggerHaptic(40);
        dialogOverlay.remove();

        let insertBy = tx.by; 
        let insertTitle = '';
        if (targetType === 'personal') {
            insertBy = state.userRole === 'boyfriend' ? '女友' : '男友'; 
            insertTitle = `🤖 AA拆帳扣款：平分【${tx.title}】給${tx.by}`;
        } else {
            insertTitle = `🤖 AA公帳報銷：【${tx.title}】的拆帳份額`;
        }

        const { error: insErr } = await supabaseClient.from('transactions').insert([{
            title: insertTitle, amount: splitAmount, date: tx.date, by: insertBy, type: targetType,
            category: tx.category || '其他', status: 'approved', comments: [{ author: '系統通知', text: `已成功拆帳！扣除 NT$${splitAmount}。` }]
        }]);
        if (insErr) return alert('拆帳失敗：' + insErr.message);

        const newAmt = originalAmount - splitAmount;
        await supabaseClient.from('transactions').update({ amount: newAmt, title: `${tx.title} (已AA)` }).eq('id', tx.id);
        
        alert(`// 拆帳數據成功！✓\n原明細已扣減為 NT$${newAmt}。`);
        await fetchTransactions();
    });
};

// ==========================================
// 6. 收入登記與公帳提撥
// ==========================================
function renderIncomeSavePage() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    const currentBy = state.userRole === 'boyfriend' ? '男友' : '女友';
    let logsHtml = '';
    state.incomeLogs.forEach(log => {
        logsHtml += `
            <div class="flex justify-between items-center p-3 bg-white/2 rounded-xl border border-white/5 card-animate">
                <div>
                    <p class="text-xs text-slate-200 font-light">${log.title}</p>
                    <p class="text-[9px] text-slate-500 font-mono">${log.date} // ${log.by}</p>
                </div>
                <p class="text-xs font-mono font-medium ${log.by === '女友' ? 'text-pink-400' : 'text-blue-400'}">+NT$${log.amount.toLocaleString()}</p>
            </div>
        `;
    });

    mainContent.innerHTML = `
        <div class="grid grid-cols-2 gap-3 card-animate">
            <div class="glass-panel p-4 rounded-xl border-l-2 border-blue-400/50">
                <p class="text-[9px] text-slate-500">男友現有收入</p>
                <p class="text-base font-semibold text-blue-200 font-mono mt-1">NT$${state.personalIncomes.boyfriend.toLocaleString()}</p>
            </div>
            <div class="glass-panel p-4 rounded-xl border-l-2 border-pink-400/50">
                <p class="text-[9px] text-slate-500">女友現有收入</p>
                <p class="text-base font-semibold text-pink-200 font-mono mt-1">NT$${state.personalIncomes.girlfriend.toLocaleString()}</p>
            </div>
        </div>
        <div class="glass-panel p-5 rounded-2xl space-y-4 card-animate">
            <p class="text-[11px] text-pink-400 font-medium tracking-wider">✍️ 登記收入 (${currentBy}視角)</p>
            <div class="flex flex-col gap-3">
                <input type="text" id="income-title" placeholder="來源說明 (如:薪水、打工)..." class="w-full bg-white/5 border border-white/5 px-4 py-2.5 rounded-xl text-xs text-slate-200 focus:outline-none">
                <input type="number" id="income-amount" placeholder="金額" class="w-full bg-white/5 border border-white/5 px-4 py-2.5 rounded-xl text-xs text-slate-200 focus:outline-none">
                <button onclick="submitIncome()" class="w-full py-2.5 bg-pink-500/20 text-pink-300 border border-pink-500/30 text-xs rounded-xl cursor-pointer">登記</button>
            </div>
        </div>
        <div class="space-y-2">
            <p class="text-[10px] text-slate-500 tracking-widest">// 歷史收入清單</p>
            ${state.incomeLogs.length === 0 ? '<p class="text-center py-6 text-slate-600 text-xs card-animate">尚無收入紀錄</p>' : logsHtml}
        </div>
    `;
}

window.submitIncome = async function() {
    const title = document.getElementById('income-title').value.trim();
    const amount = parseFloat(document.getElementById('income-amount').value);
    const currentBy = state.userRole === 'boyfriend' ? '男友' : '女友';
    if (!title || isNaN(amount) || amount <= 0) return alert('// 請填入項目與金額');

    triggerHaptic(30);
    const now = new Date();
    const formattedDate = now.getFullYear() + '.' + String(now.getMonth() + 1).padStart(2, '0') + '.' + String(now.getDate()).padStart(2, '0');

    const { error } = await supabaseClient.from('transactions').insert([{ title: `💰 收入：${title}`, amount: amount, date: formattedDate, by: currentBy, type: 'income', status: 'approved', comments: [] }]);
    if (error) return alert('登記收入失敗: ' + error.message);
    await fetchTransactions();
    if (state.currentTab === 'save') renderIncomeSavePage();
};

function renderSharedPoolPage() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <div class="glass-panel p-6 rounded-2xl text-center border border-emerald-500/10 card-animate">
            <p class="text-[11px] text-emerald-400 font-medium tracking-wider">共同帳戶總餘額</p>
            <p class="text-2xl font-semibold text-emerald-300 tracking-tight mt-2">NT$${state.balances.shared.toLocaleString()}</p>
        </div>
        <div class="glass-panel p-5 rounded-2xl space-y-4 card-animate">
            <input type="number" id="pool-amount" placeholder="輸入提撥金額 (NT$)" class="w-full bg-white/5 border border-white/5 px-4 py-3 rounded-xl text-sm text-slate-200 focus:outline-none">
            <input type="text" id="pool-note" placeholder="定期存入公金..." class="w-full bg-white/5 border border-white/5 px-4 py-3 rounded-xl text-sm text-slate-200 focus:outline-none">
            <button onclick="submitPoolTransaction()" class="w-full py-3 rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-xs tracking-widest font-mono">確認從個人收入提撥</button>
        </div>
    `;
}

window.submitPoolTransaction = async function() {
    const amount = parseFloat(document.getElementById('pool-amount').value);
    const note = document.getElementById('pool-note').value.trim() || '共同基金提撥';
    if (isNaN(amount) || amount <= 0) return alert('// 請輸入有效金額');
    if (state.personalIncomes[state.userRole] < amount) return alert('// 錯誤：你的個人現有收入不足！');

    triggerHaptic(35);
    const now = new Date();
    const formattedDate = now.getFullYear() + '.' + String(now.getMonth() + 1).padStart(2, '0') + '.' + String(now.getDate()).padStart(2, '0');

    const { error } = await supabaseClient.from('transactions').insert([{ amount: amount, title: `📥 提撥：${note}`, date: formattedDate, by: state.userRole === 'boyfriend' ? '男友' : '女友', type: 'shared', status: 'approved', comments: [] }]);
    if (error) return alert('提撥失敗: ' + error.message);
    await fetchTransactions();
    renderSharedPoolPage();
};

// ==========================================
// 7. 財務加總計算與萬用圓餅圖統計分析
// ==========================================
function recalculateBalances() {
    let bfIncome = 0, gfIncome = 0, bfSpent = 0, gfSpent = 0, sharedExpenses = 0, sharedDeposits = 0;
    state.incomeLogs = [];

    state.transactions.forEach(tx => {
        const txAmount = parseFloat(tx.amount) || 0;
        if (tx.type === 'income') {
            state.incomeLogs.push(tx);
            if (tx.by === '男友') bfIncome += txAmount;
            if (tx.by === '女友') gfIncome += txAmount;
        } else if (tx.type === 'shared') {
            if (tx.title.includes('📥')) sharedDeposits += txAmount; 
            else sharedExpenses += txAmount; 
        } else if (tx.status !== 'disapproved') {
            if (tx.by === '男友') bfSpent += txAmount;
            if (tx.by === '女友') gfSpent += txAmount;
        }
    });

    state.personalIncomes.boyfriend = bfIncome; state.personalIncomes.girlfriend = gfIncome;
    state.balances.boyfriend = bfIncome - bfSpent; state.balances.girlfriend = gfIncome - gfSpent;
    state.balances.shared = sharedDeposits - sharedExpenses;

    document.getElementById('bfd-balance').innerText = `NT$${state.balances.boyfriend.toLocaleString()}`;
    document.getElementById('gfd-balance').innerText = `NT$${state.balances.girlfriend.toLocaleString()}`;
    document.getElementById('shared-balance').innerText = `NT$${state.balances.shared.toLocaleString()}`;
}

function renderStatsPage() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    
    let totalExpense = 0;
    let categoryMap = {};
    
    const normalizeYearMonth = (dateStr) => {
        if (!dateStr) return "";
        const cleanStr = dateStr.replace(/\s+/g, '');
        const parts = cleanStr.split('.');
        if (parts.length < 2) return "";
        if (parts[0].length === 4) return `${parts[0]}.${parts[1]}`;
        return `2026.${parts[0]}`;
    };

    const availableMonths = [...new Set(state.transactions
        .filter(tx => tx.date)
        .map(tx => normalizeYearMonth(tx.date))
        .filter(ym => ym !== "")
    )].sort((a, b) => b.localeCompare(a)); 

    if (state.currentMonthFilter.length !== 7 || !availableMonths.includes(state.currentMonthFilter)) {
        if (availableMonths.length > 0) state.currentMonthFilter = availableMonths[0];
    }

    state.transactions.forEach(tx => {
        const txAmount = parseFloat(tx.amount) || 0;
        if (tx.type === 'income' || tx.title.includes('📥') || tx.status === 'disapproved') return;

        const txYearMonth = normalizeYearMonth(tx.date);
        if (txYearMonth !== state.currentMonthFilter) return;

        let isMatch = false;
        if (statsDimension === 'all' && tx.type === 'shared') isMatch = true;
        else if (statsDimension === 'boyfriend' && tx.by === '男友' && tx.type === 'personal') isMatch = true;
        else if (statsDimension === 'girlfriend' && tx.by === '女友' && tx.type === 'personal') isMatch = true;

        if (isMatch) {
            totalExpense += txAmount;
            const cat = tx.category || "其他";
            categoryMap[cat] = (categoryMap[cat] || 0) + txAmount;
        }
    });

    let monthOptionsHtml = availableMonths.map(m => 
        `<option value="${m}" ${state.currentMonthFilter === m ? 'selected' : ''}>${m.replace('.', '年 ')}</option>`
    ).join('');
    if (availableMonths.length === 0) monthOptionsHtml = `<option value="">尚無月份數據</option>`;

    const categoryColors = { "早餐": "#38bdf8", "午餐": "rgb(96, 165, 250)", "晚餐": "#818cf8", "宵夜": "#a78bfa", "飲料": "#f472b6", "零食": "#fb7185", "交通": "#fb923c", "購物": "#fbbf24", "娛樂": "#34d399", "水電": "#06b6d4", "電信": "#ec4899", "其他": "#94a3b8" };
    const categoryIcons = { "早餐": "🍔", "午餐": "🍱", "晚餐": "🍜", "宵夜": "🌙", "飲料": "🧋", "零食": "🍪", "交通": "🚗", "購物": "🛍️", "娛樂": "🎬", "水電": "⚡", "電信": "📱", "其他": "📦" };

    const sortedCategories = Object.keys(categoryMap).map(cat => ({
        name: cat, amount: categoryMap[cat], icon: categoryIcons[cat] || "📝", color: categoryColors[cat] || "#64748b",
        percentage: totalExpense > 0 ? Math.round((categoryMap[cat] / totalExpense) * 100) : 0
    })).sort((a, b) => b.amount - a.amount);

    let rankListHtml = '';
    if(sortedCategories.length === 0) {
        rankListHtml = `<div class="text-center py-12 text-slate-600 text-xs card-animate">// 當月尚無消費數據</div>`;
    } else {
        sortedCategories.forEach(c => {
            rankListHtml += `
                <div class="flex justify-between items-center text-xs py-1.5 border-b border-white/2 card-animate">
                    <div class="flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full" style="background-color: ${c.color}"></span>
                        <span class="text-slate-400 font-light">${c.icon} ${c.name}</span>
                        <span class="text-[9px] text-slate-600 font-mono">(${c.percentage}%)</span>
                    </div>
                    <span class="font-mono text-slate-300 font-medium">NT$${c.amount.toLocaleString()}</span>
                </div>
            `;
        });
    }

    mainContent.innerHTML = `
        <div class="glass-panel p-3 rounded-xl flex justify-between items-center border border-white/5 card-animate">
            <span class="text-[10px] text-slate-500 font-mono uppercase tracking-widest">// 選擇統計月份</span>
            <select id="stats-month-select" onchange="changeStatsMonth(this.value)" class="bg-white/5 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none bg-[#121826]">
                ${monthOptionsHtml}
            </select>
        </div>
        <div class="grid grid-cols-3 gap-2 p-1 bg-white/5 rounded-xl text-[11px] font-medium border border-white/5 card-animate">
            <button onclick="changeStatsDimension('all')" class="py-2 rounded-lg text-center cursor-pointer transition-all ${statsDimension === 'all' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-500'}">共同支出</button>
            <button onclick="changeStatsDimension('boyfriend')" class="py-2 rounded-lg text-center cursor-pointer transition-all ${statsDimension === 'boyfriend' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-slate-500'}">男友個人</button>
            <button onclick="changeStatsDimension('girlfriend')" class="py-2 rounded-lg text-center cursor-pointer transition-all ${statsDimension === 'girlfriend' ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20' : 'text-slate-500'}">女友個人</button>
        </div>
        <div class="glass-panel p-5 rounded-2xl border border-white/5 card-animate space-y-4">
            <p class="text-[10px] text-slate-500 font-mono tracking-widest uppercase">// 比例圖表分析</p>
            <div class="flex flex-col items-center justify-center py-2 gap-6 sm:flex-row">
                ${totalExpense > 0 ? `
                    <div class="relative w-40 h-40 flex items-center justify-center shrink-0">
                        <canvas id="statsPieChart" width="160" height="160" class="w-40 h-40"></canvas>
                        <div class="absolute w-[84px] h-[84px] bg-[#070a13]/90 rounded-full border border-white/5 flex flex-col items-center justify-center backdrop-blur-sm pointer-events-none shadow-inner">
                            <span class="text-[9px] text-slate-500 font-mono uppercase">Total</span>
                            <span class="text-xs font-mono font-bold text-slate-200 mt-0.5">NT$${totalExpense.toLocaleString()}</span>
                        </div>
                    </div>
                ` : ''}
                <div class="flex-1 w-full space-y-1">${rankListHtml}</div>
            </div>
        </div>
    `;

    if (totalExpense > 0) {
        const canvas = document.getElementById('statsPieChart');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            let startAngle = -Math.PI / 2;
            sortedCategories.forEach(c => {
                const sliceAngle = (c.amount / totalExpense) * (2 * Math.PI);
                ctx.beginPath(); ctx.moveTo(80, 80); ctx.arc(80, 80, 76, startAngle, startAngle + sliceAngle); ctx.closePath();
                ctx.fillStyle = c.color; ctx.fill(); ctx.strokeStyle = '#070a13'; ctx.lineWidth = 2; ctx.stroke();
                startAngle += sliceAngle;
            });
        }
    }
}

window.changeStatsDimension = function(dimension) { statsDimension = dimension; renderStatsPage(); };
window.changeStatsMonth = function(selectedMonth) { state.currentMonthFilter = selectedMonth; renderStatsPage(); };

// ==========================================
// 8. 彈窗呼叫與資料儲存/刪除/留言核心
// ==========================================
window.openTransactionModal = function(id = null) {
    document.getElementById('transaction-modal').classList.remove('hidden');
    if (id) {
        const tx = state.transactions.find(t => String(t.id) === String(id));
        if (!tx) return;
        document.getElementById('modal-title').innerText = "// 編輯明細";
        document.getElementById('edit-id').value = tx.id;
        document.getElementById('tx-title').value = tx.title;
        document.getElementById('tx-category').value = tx.category || "早餐";
        document.getElementById('tx-amount').value = tx.amount;
        document.getElementById('tx-account-type').value = tx.type;
        if(tx.date && tx.date.split('.').length === 3) {
            const dParts = tx.date.split('.');
            document.getElementById('tx-date').value = `${dParts[0]}-${dParts[1]}-${dParts[2]}`;
        }
    } else {
        document.getElementById('modal-title').innerText = "// 新增明細";
        document.getElementById('edit-id').value = "";
        document.getElementById('tx-title').value = "";
        document.getElementById('tx-category').value = "早餐"; 
        document.getElementById('tx-amount').value = "";
        document.getElementById('tx-account-type').value = "personal";
        const today = new Date();
        document.getElementById('tx-date').value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }
};

window.closeTransactionModal = function() { document.getElementById('transaction-modal').classList.add('hidden'); };

window.saveTransaction = async function() {
    const id = document.getElementById('edit-id').value;
    let title = document.getElementById('tx-title').value.trim();
    const amount = parseFloat(document.getElementById('tx-amount').value);
    const type = document.getElementById('tx-account-type').value;
    const category = document.getElementById('tx-category').value;
    const inputDate = document.getElementById('tx-date').value;
    const currentBy = state.userRole === 'boyfriend' ? '男友' : '女友';

    if (isNaN(amount) || amount <= 0) return alert('// 請填寫有效的金額');
    if (!title) title = category;

    triggerHaptic(30);

    let formattedDate = inputDate ? inputDate.replace(/-/g, '.') : '';
    if(!formattedDate) {
        const now = new Date();
        formattedDate = now.getFullYear() + '.' + String(now.getMonth() + 1).padStart(2, '0') + '.' + String(now.getDate()).padStart(2, '0');
    }

    const isFromWish = state.wishlist && state.wishlist.some(w => String(w.id) === String(id));

    if (id && !isFromWish) {
        const { error } = await supabaseClient.from('transactions').update({ title: title, amount: amount, type: type, category: category, date: formattedDate }).eq('id', id);
        if (error) return alert('修改失敗: ' + error.message);
    } else if (id && isFromWish) {
        const { error } = await supabaseClient.from('transactions').update({ title: title, amount: amount, type: type, category: category, date: formattedDate, status: 'approved', by: currentBy }).eq('id', id);
        if (error) return alert('實現願望失敗: ' + error.message);
    } else {
        const { error } = await supabaseClient.from('transactions').insert([{ title: title, amount: amount, date: formattedDate, by: currentBy, type: type, category: category, status: 'approved', comments: [] }]);
        if (error) return alert('寫入雲端失敗: ' + error.message);
    }

    closeTransactionModal();
    await fetchTransactions();
};

window.deleteTransaction = async function(id) {
    if (confirm('確定要刪除項目嗎？')) {
        triggerHaptic(20);
        const { error } = await supabaseClient.from('transactions').delete().eq('id', id);
        if (error) return alert('刪除失敗: ' + error.message);
        await fetchTransactions();
    }
};

window.toggleQuickReject = async function(id) {
    triggerHaptic(20);
    const tx = state.transactions.find(t => String(t.id) === String(id));
    if (!tx) return;
    const nextStatus = tx.status === 'disapproved' ? 'approved' : 'disapproved';
    await supabaseClient.from('transactions').update({ status: nextStatus }).eq('id', id);
    await fetchTransactions();
};

window.addComment = async function(id) {
    const inputEl = document.getElementById(`comment-input-${id}`);
    if (!inputEl || !inputEl.value.trim()) return;
    const commentText = inputEl.value.trim();
    const currentAuthor = state.userRole === 'boyfriend' ? '男友' : '女友';
    const tx = state.transactions.find(t => String(t.id) === String(id));
    if (!tx) return;

    triggerHaptic(15);
    const currentComments = Array.isArray(tx.comments) ? tx.comments : [];
    const updatedComments = [...currentComments, { author: currentAuthor, text: commentText }];
    await supabaseClient.from('transactions').update({ comments: updatedComments }).eq('id', id);
    inputEl.value = '';
    await fetchTransactions();
};

window.purgeData = function() { if (confirm('確定抹除？')) { state.transactions = []; recalculateBalances(); renderBookPage(); } };
