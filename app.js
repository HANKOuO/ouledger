// ==========================================
// 1. 頁面加載初始化
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const tabButtons = document.querySelectorAll('#tab-container button');
    const tabs = ['book', 'save', 'shared', 'stats'];
    
    tabButtons.forEach((btn, index) => {
        btn.addEventListener('click', () => switchTab(tabs[index], btn));
    });
});

// ==========================================
// 2. 全局切頁導覽控制
// ==========================================
function switchTab(tabName, clickedButton) {
    state.currentTab = tabName;
    const tabButtons = document.querySelectorAll('#tab-container button');
    const floatBtn = document.getElementById('float-add-btn');
    
    tabButtons.forEach(btn => btn.className = "glass-panel text-slate-400 p-3 rounded-2xl text-center flex flex-col items-center justify-center transition-all cursor-pointer hover:bg-white/5");
    clickedButton.className = "active-tab text-pink-400 p-3 rounded-2xl text-center flex flex-col items-center justify-center transition-all cursor-pointer";

    if (tabName === 'book') {
        floatBtn.classList.remove('hidden');
        renderBookPage();
    } else {
        floatBtn.classList.add('hidden');
        if (tabName === 'save') renderIncomeSavePage();
        else if (tabName === 'shared') renderSharedPoolPage();
        else if (tabName === 'stats') renderStatsPage();
    }
}

// ==========================================
// 3. 雲端記帳數據撈取與渲染
// ==========================================
async function fetchTransactions() {
    const { data, error } = await supabaseClient
        .from('transactions')
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        console.error('抓取雲端數據失敗:', error);
        alert('同步帳本資料失敗，請確認 transactions 的 RLS 權限。');
        return;
    }

    state.transactions = data || [];
    recalculateBalances();
    renderBookPage();
}

function renderBookPage() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    const filteredList = state.transactions.filter(item => {
        if (state.filterType === 'all') return true;
        return item.type === state.filterType;
    });

    let htmlContent = `
        <div class="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/5 text-[11px] font-medium">
            <button onclick="setBookFilter('all')" class="flex-1 py-1.5 rounded-lg text-center cursor-pointer transition-all ${state.filterType === 'all' ? 'bg-white/10 text-slate-200' : 'text-slate-500'}">全部</button>
            <button onclick="setBookFilter('personal')" class="flex-1 py-1.5 rounded-lg text-center cursor-pointer transition-all ${state.filterType === 'personal' ? 'bg-white/10 text-slate-200' : 'text-slate-500'}">個人</button>
            <button onclick="setBookFilter('shared')" class="flex-1 py-1.5 rounded-lg text-center cursor-pointer transition-all ${state.filterType === 'shared' ? 'bg-white/10 text-slate-200' : 'text-slate-500'}">共同</button>
        </div>
    `;

    if (filteredList.length === 0) {
        htmlContent += `<div class="text-center py-12 text-slate-600 text-xs tracking-wider">尚無數據明細</div>`;
    } else {
        filteredList.forEach(item => {
            const isMyTx = (state.userRole === 'boyfriend' && item.by === '男友') || (state.userRole === 'girlfriend' && item.by === '女友');
            const isDisapproved = item.status === 'disapproved';

            let actionButtonsHtml = isMyTx ? `
                <button onclick="openTransactionModal('${item.id}')" class="text-[9px] text-slate-400 border border-white/5 bg-white/5 px-2.5 py-0.5 rounded-full cursor-pointer hover:bg-white/10">編輯</button>
                <button onclick="deleteTransaction('${item.id}')" class="text-[9px] text-rose-400/80 border border-rose-500/10 bg-rose-500/5 px-2.5 py-0.5 rounded-full cursor-pointer hover:bg-rose-500/10">刪除</button>
            ` : `
                <button onclick="toggleQuickReject('${item.id}')" class="text-[10px] ${isDisapproved ? 'text-rose-400 bg-rose-500/10 border-rose-500/30' : 'text-amber-400/90 border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10'} px-3 py-0.5 rounded-full font-bold cursor-pointer transition-all">${isDisapproved ? '(?)[已點]' : '[?]'}</button>
            `;

            // 🌟 在 renderBookPage 的迴圈內，產生卡片 HTML 的地方加上這段：
let commentsListHtml = '';
if (Array.isArray(item.comments) && item.comments.length > 0) {
    commentsListHtml = `<div class="mt-2 space-y-1 bg-white/5 p-2 rounded-xl border border-white/5 text-[11px]">`;
    item.comments.forEach(c => {
        const isBf = c.author === '男友';
        commentsListHtml += `
            <div class="leading-relaxed">
                <span class="${isBf ? 'text-blue-400' : 'text-pink-400'} font-medium">${c.author}：</span>
                <span class="text-slate-300">${c.text}</span>
            </div>
        `;
    });
    commentsListHtml += `</div>`;
}

// 接著把 ${commentsListHtml} 塞進你卡片 HTML 想顯示的地方即可！

            htmlContent += `
                <div class="glass-panel p-4 rounded-2xl space-y-3 relative transition-all duration-300 ${isDisapproved ? 'border-l-2 border-red-500/40' : ''}">
                    <div class="flex justify-between items-start">
                        <div class="space-y-1">
                            <div class="flex items-center gap-2">
                                <span class="text-sm font-light text-slate-200 tracking-wide">${item.title}</span>
                                <span class="text-[8px] px-1.5 py-0.2 rounded-md ${item.type === 'shared' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}">${item.type === 'shared' ? '共同' : '個人'}</span>
                                ${isDisapproved ? '<div class="text-[8px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded">未認同消費</div>' : ''}
                            </div>
                            <p class="text-[10px] text-slate-500 font-mono tracking-wider">${item.date} // 記錄者：${item.by}</p>
                        </div>
                        <p class="font-mono text-sm text-slate-200 tracking-tight">-NT$${parseFloat(item.amount).toLocaleString()}</p>
                    </div>
                    <div class="flex justify-between items-center pt-2 border-t border-white/5 gap-3">
                        <div class="flex-1 flex gap-1.5">
                            <input type="text" id="comment-input-${item.id}" placeholder="留下訊息..." class="flex-1 bg-white/5 border border-white/5 rounded-lg px-2.5 py-1 text-[10px] text-slate-300 focus:outline-none">
                            <button onclick="addComment('${item.id}')" class="text-[9px] bg-white/5 text-slate-400 px-2.5 rounded-lg hover:bg-white/10">發送</button>
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

window.openTransactionModal = function(id = null) {
    document.getElementById('transaction-modal').classList.remove('hidden');
    if (id) {
        // 🔥 升級這行：強制轉字串比對，徹底消滅 undefined 錯誤
        const tx = state.transactions.find(t => String(t.id) === String(id));
        
        if (!tx) {
            console.error("找不到該筆交易紀錄，傳入的 id 為:", id);
            return;
        }

        document.getElementById('modal-title').innerText = "// 編輯明細";
        document.getElementById('edit-id').value = tx.id;
        document.getElementById('tx-title').value = tx.title;
        document.getElementById('tx-amount').value = tx.amount;
        document.getElementById('tx-account-type').value = tx.type;
    } else {
        document.getElementById('modal-title').innerText = "// 新增明細";
        document.getElementById('edit-id').value = "";
        document.getElementById('tx-title').value = "";
        document.getElementById('tx-amount').value = "";
        document.getElementById('tx-account-type').value = "personal";
    }
};

window.closeTransactionModal = function() { document.getElementById('transaction-modal').classList.add('hidden'); };

window.saveTransaction = async function() {
    const id = document.getElementById('edit-id').value;
    const title = document.getElementById('tx-title').value.trim();
    const amount = parseFloat(document.getElementById('tx-amount').value);
    const type = document.getElementById('tx-account-type').value;
    const currentBy = state.userRole === 'boyfriend' ? '男友' : '女友';

    if (!title || isNaN(amount) || amount <= 0) return alert('// 請填寫項目與金額');

    if (id) {
        const { error } = await supabaseClient
            .from('transactions')
            .update({ title: title, amount: amount, type: type })
            .eq('id', id);
        if (error) return alert('修改失敗: ' + error.message);
    } else {
        const { error } = await supabaseClient
            .from('transactions')
            .insert([{
                title: title,
                amount: amount,
                date: new Date().toLocaleDateString('zh-TW', {month: '2-digit', day: '2-digit'}).replace('/', '.'),
                by: currentBy,
                type: type,
                status: 'approved',
                comments: []
            }]);
        if (error) return alert('寫入雲端失敗: ' + error.message);
    }

    closeTransactionModal();
    await fetchTransactions();
};

window.deleteTransaction = async function(id) {
    if (confirm('確定要刪除明細嗎？')) {
        const { error } = await supabaseClient
            .from('transactions')
            .delete()
            .eq('id', id);
        if (error) return alert('刪除失敗: ' + error.message);
        await fetchTransactions();
    }
};

// ==========================================
// 4. 個人收入模組
// ==========================================
function renderIncomeSavePage() {
    const mainContent = document.getElementById('main-content');
    const currentBy = state.userRole === 'boyfriend' ? '男友' : '女友';

    let logsHtml = '';
    state.incomeLogs.forEach(log => {
        const isHer = log.by === '女友';
        logsHtml += `
            <div class="flex justify-between items-center p-3 bg-white/2 rounded-xl border border-white/5">
                <div>
                    <p class="text-xs text-slate-200 font-light">${log.title}</p>
                    <p class="text-[9px] text-slate-500 font-mono">${log.date} // ${log.by}</p>
                </div>
                <p class="text-xs font-mono font-medium ${isHer ? 'text-pink-400' : 'text-blue-400'}">+NT$${log.amount.toLocaleString()}</p>
            </div>
        `;
    });

    mainContent.innerHTML = `
        <div class="grid grid-cols-2 gap-3">
            <div class="glass-panel p-4 rounded-xl text-left border-l-2 border-blue-400/50">
                <p class="text-[9px] text-slate-500">男友現有收入</p>
                <p class="text-base font-semibold text-blue-200 font-mono mt-1">NT$${state.personalIncomes.boyfriend.toLocaleString()}</p>
            </div>
            <div class="glass-panel p-4 rounded-xl text-left border-l-2 border-pink-400/50">
                <p class="text-[9px] text-slate-500">女友現有收入</p>
                <p class="text-base font-semibold text-pink-200 font-mono mt-1">NT$${state.personalIncomes.girlfriend.toLocaleString()}</p>
            </div>
        </div>
        <div class="glass-panel p-4 rounded-2xl space-y-3">
            <p class="text-[11px] text-pink-400 font-medium tracking-wider">✍️ 登記收入 (${currentBy}視角)</p>
            <div class="flex gap-2">
                <input type="text" id="income-title" placeholder="來源說明..." class="flex-2 bg-white/5 border border-white/5 px-3 py-2 rounded-xl text-xs text-slate-200 focus:outline-none">
                <input type="number" id="income-amount" placeholder="金額" class="flex-1 bg-white/5 border border-white/5 px-3 py-2 rounded-xl text-xs text-slate-200 focus:outline-none">
                <button onclick="submitIncome()" class="px-4 bg-pink-500/20 text-pink-300 border border-pink-500/30 text-xs rounded-xl">登記</button>
            </div>
        </div>
        <div class="space-y-2">
            <p class="text-[10px] text-slate-500 tracking-widest">歷史收入清單</p>
            ${state.incomeLogs.length === 0 ? '<p class="text-center py-6 text-slate-600 text-xs">尚無收入紀錄</p>' : logsHtml}
        </div>
    `;
}

window.submitIncome = async function() {
    const title = document.getElementById('income-title').value.trim();
    const amount = parseFloat(document.getElementById('income-amount').value);
    const currentBy = state.userRole === 'boyfriend' ? '男友' : '女友';

    if (!title || isNaN(amount) || amount <= 0) return alert('// 請填入項目與金額');

    // 🚀 升級：直接把收入寫進雲端 transactions 資料表，型態標記為 'income'
    const { error } = await supabaseClient
        .from('transactions')
        .insert([{
            title: `💰 收入：${title}`,
            amount: amount,
            date: new Date().toLocaleDateString('zh-TW', {month: '2-digit', day: '2-digit'}).replace('/', '.'),
            by: currentBy,
            type: 'income', // 🔥 核心：標記為收入型態
            status: 'approved',
            comments: []
        }]);

    if (error) {
        console.error('收入寫入雲端失敗:', error);
        return alert('登記收入失敗: ' + error.message);
    }

    // 成功後清空輸入框，並重新向雲端抓取最新數據
    document.getElementById('income-title').value = '';
    document.getElementById('income-amount').value = '';
    await fetchTransactions(); // 這會觸發重新計算與刷新畫面
    
    // 如果此時在收入頁面，順便重新渲染該頁
    if (state.currentTab === 'save') renderIncomeSavePage();
};

// ==========================================
// 5. 共同公帳池提撥模組
// ==========================================
function renderSharedPoolPage() {
    const mainContent = document.getElementById('main-content');

    mainContent.innerHTML = `
        <div class="glass-panel p-6 rounded-2xl text-center relative border border-emerald-500/10">
            <p class="text-[11px] text-emerald-400 font-medium tracking-wider">共同帳戶總餘額</p>
            <p class="text-2xl font-semibold text-emerald-300 tracking-tight mt-2">NT$${state.balances.shared.toLocaleString()}</p>
        </div>
        <div class="glass-panel p-5 rounded-2xl space-y-4">
            <div class="space-y-2">
                <label class="text-[10px] text-slate-500 tracking-widest">扣款來源</label>
                <select class="w-full bg-white/10 border border-white/5 px-4 py-2.5 rounded-xl text-xs text-slate-300 cursor-not-allowed" disabled>
                    <option>從 我的收入 提撥扣除 (現有: NT$${state.personalIncomes[state.userRole].toLocaleString()})</option>
                </select>
            </div>
            <div class="space-y-1.5">
                <label class="text-[10px] text-slate-500 tracking-widest">提撥金額</label>
                <input type="number" id="pool-amount" placeholder="輸入金額 (NT$)" class="w-full bg-white/5 border border-white/5 px-4 py-3 rounded-xl text-sm text-slate-200 focus:outline-none">
            </div>
            <div class="space-y-1.5">
                <label class="text-[10px] text-slate-500 tracking-widest">摘要說明</label>
                <input type="text" id="pool-note" placeholder="定期存入公金..." class="w-full bg-white/5 border border-white/5 px-4 py-3 rounded-xl text-sm text-slate-200 focus:outline-none">
            </div>
            <button onclick="submitPoolTransaction()" class="w-full py-3 rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-medium text-xs tracking-widest">確認從個人收入提撥</button>
        </div>
    `;
}

window.submitPoolTransaction = async function() {
    const amount = parseFloat(document.getElementById('pool-amount').value);
    const note = document.getElementById('pool-note').value.trim() || '共同基金提撥';

    if (isNaN(amount) || amount <= 0) return alert('// 請輸入有效金額');

    const source = state.userRole; 
    if (state.personalIncomes[source] < amount) return alert('// 錯誤：你的個人現有收入不足！');

    state.personalIncomes[source] -= amount;

    const { error } = await supabaseClient
        .from('transactions')
        .insert([{
            amount: amount, 
            title: `📥 提撥：${note}`,
            date: new Date().toLocaleDateString('zh-TW', {month: '2-digit', day: '2-digit'}).replace('/', '.'),
            by: state.userRole === 'boyfriend' ? '男友' : '女友', 
            type: 'shared', 
            status: 'approved',
            comments: []
        }]);

    if (error) return alert('提撥同步雲端失敗: ' + error.message);

    await fetchTransactions();
    renderSharedPoolPage();
};

// ==========================================
// 6. 財務計算核心引擎與統計
// ==========================================
function recalculateBalances() {
    // 初始金額全部從 0 開始
    let bfIncome = 0, gfIncome = 0;
    let bfSpent = 0, gfSpent = 0;
    let sharedExpenses = 0, sharedDeposits = 0;
    
    // 清空歷史收入紀錄，準備從雲端重新撈取分類
    state.incomeLogs = [];

    state.transactions.forEach(tx => {
        const txAmount = parseFloat(tx.amount) || 0;
        
        // A. 處理雲端收入
        if (tx.type === 'income') {
            // 把這筆雲端收入塞進歷史清單顯示
            state.incomeLogs.push(tx);
            
            if (tx.by === '男友') bfIncome += txAmount;
            if (tx.by === '女友') gfIncome += txAmount;
        } 
        // B. 處理共同公帳（提撥 or 共同消費）
        else if (tx.type === 'shared') {
            if (tx.title.includes('📥')) sharedDeposits += txAmount; 
            else sharedExpenses += txAmount; 
        } 
        // C. 處理個人日常消費
        else if (tx.status !== 'disapproved') {
            if (tx.by === '男友') bfSpent += txAmount;
            if (tx.by === '女友') gfSpent += txAmount;
        }
    });

    // 核心財務公式
    state.personalIncomes.boyfriend = bfIncome;
    state.personalIncomes.girlfriend = gfIncome;

    state.balances.boyfriend = bfIncome - bfSpent;
    state.balances.girlfriend = gfIncome - gfSpent;
    state.balances.shared = sharedDeposits - sharedExpenses;

    // 將數字同步渲染到美美的前端介面上
    document.getElementById('bfd-balance').innerText = `NT$${state.balances.boyfriend.toLocaleString()}`;
    document.getElementById('gfd-balance').innerText = `NT$${state.balances.girlfriend.toLocaleString()}`;
    document.getElementById('shared-balance').innerText = `NT$${state.balances.shared.toLocaleString()}`;
}

// ==========================================
// 核心統計頁面渲染（精準分離 共同 / 男友 / 女友 支出）
// ==========================================
function renderStatsPage() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    let totalExpense = 0;

    state.transactions.forEach(tx => {
        const txAmount = parseFloat(tx.amount) || 0;
        
        // ❌ 過濾掉收入 (income) 與 公帳提撥 (📥)，我們只統計真正的「消費支出」
        if (tx.type === 'income' || tx.title.includes('📥')) return;
        if (tx.status === 'disapproved') return; // 如果被對方點了「未認同」，也不納入統計

        // 🌟 核心分流邏輯
        if (statsDimension === 'all') {
            // A. 當切換到「共同」：只計算 type 是共同公帳的消費
            if (tx.type === 'shared') {
                totalExpense += txAmount;
            }
        } else if (statsDimension === 'boyfriend') {
            // B. 當切換到「男友」：只計算男友個人的專屬消費
            if (tx.by === '男友' && tx.type === 'personal') {
                totalExpense += txAmount;
            }
        } else if (statsDimension === 'girlfriend') {
            // C. 當切換到「女友」：只計算女友個人的專屬消費
            if (tx.by === '女友' && tx.type === 'personal') {
                totalExpense += txAmount;
            }
        }
    });

    // 重新刷寫統計頁面的 HTML 結構
    mainContent.innerHTML = `
        <div class="grid grid-cols-3 gap-2 p-1 bg-white/5 rounded-xl text-[11px] font-medium border border-white/5">
            <button onclick="setStatsDimension('all')" class="py-2 rounded-lg text-center cursor-pointer transition-all ${statsDimension === 'all' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-500'}">共同支出</button>
            <button onclick="setStatsDimension('boyfriend')" class="py-2 rounded-lg text-center cursor-pointer transition-all ${statsDimension === 'boyfriend' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-slate-500'}">男友個人</button>
            <button onclick="setStatsDimension('girlfriend')" class="py-2 rounded-lg text-center cursor-pointer transition-all ${statsDimension === 'girlfriend' ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20' : 'text-slate-500'}">女友個人</button>
        </div>

        <div class="glass-panel p-6 rounded-2xl text-center relative overflow-hidden">
            <p class="text-[10px] font-mono tracking-widest text-slate-500">// 數據分類統計</p>
            <h3 class="text-xs font-light text-slate-300 mt-2">
                ${statsDimension === 'all' ? '👥 雙人共同公帳總流出' : statsDimension === 'boyfriend' ? '🙋‍♂️ 男友個人生活總花費' : '🙋‍♀️ 女友個人生活總花費'}
            </h3>
            <p class="text-3xl font-light text-slate-200 mt-4 tracking-tight">
                NT$ <span class="font-medium ${statsDimension === 'all' ? 'text-emerald-400' : statsDimension === 'boyfriend' ? 'text-blue-400' : 'text-pink-400'}">${totalExpense.toLocaleString()}</span>
            </p>
        </div>
    `;
}
window.setStatsDimension = function(dimension) { statsDimension = dimension; renderStatsPage(); };

window.toggleQuickReject = async function(id) {
    const tx = state.transactions.find(t => t.id === id);
    const nextStatus = tx.status === 'disapproved' ? 'approved' : 'disapproved';
    await supabaseClient.from('transactions').update({ status: nextStatus }).eq('id', id);
    await fetchTransactions();
};

// ==========================================
// 🚀 全新升級：留言同步寫入 Supabase 雲端資料庫
// ==========================================
window.addComment = async function(id) {
    const inputEl = document.getElementById(`comment-input-${id}`);
    if (!inputEl || !inputEl.value.trim()) return;

    const commentText = inputEl.value.trim();
    const currentAuthor = state.userRole === 'boyfriend' ? '男友' : '女友';

    // 1. 先從當前本地 state 找到這一筆交易紀錄
    const tx = state.transactions.find(t => t.id === id);
    if (!tx) return;

    // 2. 確保它有留言陣列結構（如果雲端原本是 null 就初始化成空陣列）
    const currentComments = Array.isArray(tx.comments) ? tx.comments : [];

    // 3. 把新留言塞進這個陣列裡
    const updatedComments = [
        ...currentComments,
        { 
            author: currentAuthor, 
            text: commentText,
            time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
        }
    ];

    try {
        // 4. 關鍵：直接發送 UPDATE 請求到 Supabase
        const { error } = await supabaseClient
            .from('transactions')
            .update({ comments: updatedComments }) // 🔥 更新 jsonb 欄位
            .eq('id', id);

        if (error) {
            console.error('留言同步雲端失敗:', error);
            return alert('留言失敗: ' + error.message);
        }

        // 5. 成功後清空輸入框，並重新拉取最新數據刷新畫面
        inputEl.value = '';
        await fetchTransactions();

    } catch (err) {
        console.error('留言程序崩潰：', err);
        alert('留言發生未知異常。');
    }
};

window.purgeData = function() { if (confirm('確定要清除所有暫存？')) { state.transactions = []; state.incomeLogs = []; recalculateBalances(); if (state.currentTab === 'book') renderBookPage(); alert('資料已抹除'); } };
