// ==========================================
// 1. 頁面加載初始化
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const tabButtons = document.querySelectorAll('#tab-container button');
    const tabs = ['book', 'save', 'shared', 'stats'];
    
    tabButtons.forEach((btn, index) => {
        btn.addEventListener('click', () => switchTab(tabs[index], btn));
    });
    
    // 初始化時自動設定為當前月份（格式如：07）
    const now = new Date();
    state.currentMonthFilter = now.toLocaleDateString('zh-TW', {month: '2-digit'});
});

// 全局額外狀態擴充
if (!state.currentMonthFilter) {
    state.currentMonthFilter = new Date().toLocaleDateString('zh-TW', {month: '2-digit'});
}

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
        alert('同步帳本資料失敗，請確認 RLS 權限。');
        return;
    }

    state.transactions = data || [];
    recalculateBalances();
    if (state.currentTab === 'book') renderBookPage();
    else if (state.currentTab === 'stats') renderStatsPage();
}

// ==========================================
// 4. 核心：帳本明細頁面渲染
// ==========================================
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

    const hasVisibleExpenses = filteredList.some(item => item.type !== 'income');

    if (!hasVisibleExpenses) {
        htmlContent += `<div class="text-center py-12 text-slate-600 text-xs tracking-wider">尚無明細數據</div>`;
    } else {
        filteredList.forEach(item => {
            const isIncome = item.type === 'income';
            if (isIncome) return;

            const isMyTx = (state.userRole === 'boyfriend' && item.by === '男友') || (state.userRole === 'girlfriend' && item.by === '女友');
            const isDisapproved = item.status === 'disapproved';
            const txAmount = parseFloat(item.amount) || 0;

            let amountDisplay = `<span class="text-slate-200 font-mono text-sm tracking-tight">-NT$${txAmount.toLocaleString()}</span>`;

            // 💬 歷史留言渲染區塊
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

            let actionButtonsHtml = '';
            if (isMyTx) {
                actionButtonsHtml = `
                    <button onclick="openTransactionModal('${item.id}')" class="text-[9px] text-slate-400 border border-white/5 bg-white/5 px-2.5 py-0.5 rounded-full cursor-pointer hover:bg-white/10">編輯</button>
                    <button onclick="deleteTransaction('${item.id}')" class="text-[9px] text-rose-400/80 border border-rose-500/10 bg-rose-500/5 px-2.5 py-0.5 rounded-full cursor-pointer hover:bg-rose-500/10">刪除</button>
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

            htmlContent += `
                <div class="glass-panel p-4 rounded-2xl space-y-3 relative transition-all duration-300 ${isDisapproved ? 'border-l-2 border-rose-500/60 bg-rose-950/5' : ''}">
                    <div class="flex justify-between items-start">
                        <div class="space-y-1">
                            <div class="flex items-center gap-2">
                                <span class="text-sm font-light text-slate-200 tracking-wide">${item.title}</span>
                                <span class="text-[8px] px-1.5 py-0.2 rounded-md ${item.type === 'shared' ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'}">
                                    ${item.type === 'shared' ? '共同' : '個人'}
                                </span>
                                ${item.category ? `<span class="text-[8px] px-1.5 py-0.2 rounded-md bg-white/10 text-pink-400/90 font-mono">${item.category}</span>` : ''}
                                ${isDisapproved ? '<div class="text-[8px] bg-rose-500/10 text-rose-400 px-1.5 py-0.5 rounded font-medium">⚠️ 未認同消費</div>' : ''}
                            </div>
                            <p class="text-[10px] text-slate-500 font-mono tracking-wider">${item.date} // 記錄者：${item.by}</p>
                        </div>
                        <div>${amountDisplay}</div>
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
    } else {
        document.getElementById('modal-title').innerText = "// 新增明細";
        document.getElementById('edit-id').value = "";
        document.getElementById('tx-title').value = "";
        document.getElementById('tx-category').value = "早餐"; 
        document.getElementById('tx-amount').value = "";
        document.getElementById('tx-account-type').value = "personal";
    }
};

window.closeTransactionModal = function() { document.getElementById('transaction-modal').classList.add('hidden'); };

window.saveTransaction = async function() {
    const id = document.getElementById('edit-id').value;
    let title = document.getElementById('tx-title').value.trim(); // 拿掉 const 改成 let
    const amount = parseFloat(document.getElementById('tx-amount').value);
    const type = document.getElementById('tx-account-type').value;
    const category = document.getElementById('tx-category').value;
    const currentBy = state.userRole === 'boyfriend' ? '男友' : '女友';

    // 🚀 核心改動 1：金額為空或小於等於 0 依然要阻擋
    if (isNaN(amount) || amount <= 0) return alert('// 請填寫有效的金額');

    // 🚀 核心改動 2：如果備註說明沒填，自動把類別填進去（例如變成了項目叫「早餐」）
    if (!title) {
        title = category;
    }

    // 生成跨年格式如：2026.07.06
    const now = new Date();
    const formattedDate = now.getFullYear() + '.' + 
        now.toLocaleDateString('zh-TW', {month: '2-digit'}) + '.' + 
        now.toLocaleDateString('zh-TW', {day: '2-digit'});

    if (id) {
        const { error } = await supabaseClient
            .from('transactions')
            .update({ title: title, amount: amount, type: type, category: category })
            .eq('id', id);
        if (error) return alert('修改失敗: ' + error.message);
    } else {
        const { error } = await supabaseClient
            .from('transactions')
            .insert([{
                title: title,
                amount: amount,
                date: formattedDate,
                by: currentBy,
                type: type,
                category: category, 
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
// 5. 收入頁面渲染
// ==========================================
function renderIncomeSavePage() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    
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
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="glass-panel p-4 rounded-xl text-left border-l-2 border-blue-400/50">
                <p class="text-[9px] text-slate-500">男友現有收入</p>
                <p class="text-base font-semibold text-blue-200 font-mono mt-1">NT$${state.personalIncomes.boyfriend.toLocaleString()}</p>
            </div>
            <div class="glass-panel p-4 rounded-xl text-left border-l-2 border-pink-400/50">
                <p class="text-[9px] text-slate-500">女友現有收入</p>
                <p class="text-base font-semibold text-pink-200 font-mono mt-1">NT$${state.personalIncomes.girlfriend.toLocaleString()}</p>
            </div>
        </div>
        <div class="glass-panel p-5 rounded-2xl space-y-4">
            <p class="text-[11px] text-pink-400 font-medium tracking-wider">✍️ 登記收入 (${currentBy}視角)</p>
            <div class="flex flex-col sm:flex-row gap-3">
                <input type="text" id="income-title" placeholder="來源說明 (如:薪水、打工)..." class="w-full sm:flex-2 bg-white/5 border border-white/5 px-4 py-2.5 rounded-xl text-xs text-slate-200 focus:outline-none">
                <input type="number" id="income-amount" placeholder="金額" class="w-full sm:flex-1 bg-white/5 border border-white/5 px-4 py-2.5 rounded-xl text-xs text-slate-200 focus:outline-none">
                <button onclick="submitIncome()" class="w-full sm:w-auto px-6 py-2.5 bg-pink-500/20 text-pink-300 border border-pink-500/30 text-xs rounded-xl cursor-pointer">登記</button>
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

    const now = new Date();
    const formattedDate = now.toLocaleDateString('zh-TW', {month: '2-digit', day: '2-digit'}).replace('/', '.');

    const { error } = await supabaseClient
        .from('transactions')
        .insert([{
            title: `💰 收入：${title}`, amount: amount,
            date: formattedDate,
            by: currentBy, type: 'income', status: 'approved', comments: []
        }]);

    if (error) return alert('登記收入失敗: ' + error.message);

    await fetchTransactions();
    if (state.currentTab === 'save') renderIncomeSavePage();
};

// ==========================================
// 6. 共同公帳池提撥模組
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
    if (state.personalIncomes[state.userRole] < amount) return alert('// 錯誤：你的個人現有收入不足！');

    const now = new Date();
    const formattedDate = now.toLocaleDateString('zh-TW', {month: '2-digit', day: '2-digit'}).replace('/', '.');

    const { error } = await supabaseClient
        .from('transactions')
        .insert([{
            amount: amount, title: `📥 提撥：${note}`,
            date: formattedDate,
            by: state.userRole === 'boyfriend' ? '男友' : '女友', type: 'shared', status: 'approved', comments: []
        }]);

    if (error) return alert('提撥失敗: ' + error.message);
    await fetchTransactions();
    renderSharedPoolPage();
};

// ==========================================
// 7. 財務計算核心引擎
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

    state.personalIncomes.boyfriend = bfIncome;
    state.personalIncomes.girlfriend = gfIncome;
    state.balances.boyfriend = bfIncome - bfSpent;
    state.balances.girlfriend = gfIncome - gfSpent;
    state.balances.shared = sharedDeposits - sharedExpenses;

    document.getElementById('bfd-balance').innerText = `NT$${state.balances.boyfriend.toLocaleString()}`;
    document.getElementById('gfd-balance').innerText = `NT$${state.balances.girlfriend.toLocaleString()}`;
    document.getElementById('shared-balance').innerText = `NT$${state.balances.shared.toLocaleString()}`;
}

// ==========================================
// 8. 核心：統計頁面渲染（跨年自動生成 YYYY.MM 選單）
// ==========================================
function renderStatsPage() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    
    let totalExpense = 0;
    
    // ⭕ 升級：精準提取 YYYY.MM 格式 (例如把 "2026.07.06" 切出 "2026.07")
    const availableMonths = [...new Set(state.transactions
        .filter(tx => tx.date && tx.date.includes('.'))
        .map(tx => {
            const parts = tx.date.split('.');
            // 如果原本舊資料是 "07.06" 就補上 2026，如果是新資料 "2026.07.06" 就取前兩段
            return parts[0].length === 4 ? `${parts[0]}.${parts[1]}` : `2026.${parts[0]}`;
        })
    )].sort((a, b) => b.localeCompare(a)); // 降序排列，最新年份月份在最上面

    // 確保預設篩選值符合 YYYY.MM 格式
    if (!state.currentMonthFilter || !state.currentMonthFilter.includes('.')) {
        const now = new Date();
        state.currentMonthFilter = now.getFullYear() + '.' + String(now.getMonth() + 1).padStart(2, '0');
    }

    if (!availableMonths.includes(state.currentMonthFilter) && availableMonths.length > 0) {
        state.currentMonthFilter = availableMonths[0];
    }

    state.transactions.forEach(tx => {
        const txAmount = parseFloat(tx.amount) || 0;
        if (tx.type === 'income' || tx.title.includes('📥') || tx.status === 'disapproved') return;

        // 轉換當前帳目的年月份進行比對
        const parts = tx.date ? tx.date.split('.') : [];
        const txYearMonth = parts[0] && parts[0].length === 4 ? `${parts[0]}.${parts[1]}` : `2026.${parts[0]}`;
        
        if (txYearMonth !== state.currentMonthFilter) return;

        if (statsDimension === 'all' && tx.type === 'shared') totalExpense += txAmount;
        else if (statsDimension === 'boyfriend' && tx.by === '男友' && tx.type === 'personal') totalExpense += txAmount;
        else if (statsDimension === 'girlfriend' && tx.by === '女友' && tx.type === 'personal') totalExpense += txAmount;
    });

    let monthOptionsHtml = availableMonths.map(m => 
        `<option value="${m}" ${state.currentMonthFilter === m ? 'selected' : ''}>${m.replace('.', '年 ')}月份</option>`
    ).join('');
    
    if (availableMonths.length === 0) {
        monthOptionsHtml = `<option value="">尚無數據</option>`;
    }

    mainContent.innerHTML = `
        <!-- 月份選擇篩選器 -->
        <div class="glass-panel p-3 rounded-xl flex justify-between items-center border border-white/5">
            <span class="text-[10px] text-slate-500 font-mono uppercase tracking-widest">// 選擇統計月份</span>
            <select id="stats-month-select" onchange="changeStatsMonth(this.value)" class="bg-white/5 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none bg-[#121826]">
                ${monthOptionsHtml}
            </select>
        </div>

        <!-- 三分流切換按鈕 -->
        <div class="grid grid-cols-3 gap-2 p-1 bg-white/5 rounded-xl text-[11px] font-medium border border-white/5">
            <button onclick="changeStatsDimension('all')" class="py-2 rounded-lg text-center cursor-pointer transition-all ${statsDimension === 'all' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-500'}">共同支出</button>
            <button onclick="changeStatsDimension('boyfriend')" class="py-2 rounded-lg text-center cursor-pointer transition-all ${statsDimension === 'boyfriend' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-slate-500'}">男友個人</button>
            <button onclick="changeStatsDimension('girlfriend')" class="py-2 rounded-lg text-center cursor-pointer transition-all ${statsDimension === 'girlfriend' ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20' : 'text-slate-500'}">女友個人</button>
        </div>

        <!-- 數據面板 -->
        <div class="glass-panel p-6 rounded-2xl text-center relative overflow-hidden">
            <p class="text-[10px] font-mono tracking-widest text-slate-500">// ${state.currentMonthFilter.replace('.', '年 ')}月份 數據分類統計</p>
            <h3 class="text-xs font-light text-slate-300 mt-2">
                ${statsDimension === 'all' ? '👥 雙人共同公帳總流出' : statsDimension === 'boyfriend' ? '🙋‍♂️ 男友個人生活總花費' : '🙋‍♀️ 女友個人生活總花費'}
            </h3>
            <p class="text-3xl font-light text-slate-200 mt-4 tracking-tight">NT$ <span class="font-medium ${statsDimension === 'all' ? 'text-emerald-400' : statsDimension === 'boyfriend' ? 'text-blue-400' : 'text-pink-400'}">${totalExpense.toLocaleString()}</span></p>
        </div>
    `;
}

// ==========================================
// 9. 互動與按鈕全域綁定控制
// ==========================================
window.changeStatsDimension = function(dimension) { 
    statsDimension = dimension; 
    renderStatsPage(); 
};

window.changeStatsMonth = function(selectedMonth) {
    state.currentMonthFilter = selectedMonth;
    renderStatsPage();
};

window.toggleQuickReject = async function(id) {
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

    const currentComments = Array.isArray(tx.comments) ? tx.comments : [];
    const updatedComments = [
        ...currentComments,
        { author: currentAuthor, text: commentText }
    ];

    const { error } = await supabaseClient
        .from('transactions')
        .update({ comments: updatedComments })
        .eq('id', id);

    if (error) return alert('留言失敗: ' + error.message);

    inputEl.value = '';
    await fetchTransactions();
};

window.purgeData = function() { if (confirm('確定要清除所有暫存？')) { state.transactions = []; state.incomeLogs = []; recalculateBalances(); if (state.currentTab === 'book') renderBookPage(); alert('資料已抹除'); } };
