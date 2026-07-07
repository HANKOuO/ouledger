// ==========================================
// 1. 頁面加載初始化
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const tabButtons = document.querySelectorAll('#tab-container button');
    const tabs = ['book', 'save', 'shared', 'stats'];
    
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
// 4. 核心：帳本明細頁面渲染（全面整合一鍵 AA 拆帳按鈕）
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
            // 🚀 核心升級：如果是自己的「個人消費」，加碼提供「➗ AA拆帳」按鈕
            let aaButtonHtml = '';
            if (item.type === 'personal' && isMyTx && !tx.title.includes('🤖 AA公帳報銷')) {
                aaButtonHtml = `<button onclick="splitAATransaction('${item.id}')" class="text-[9px] text-emerald-400 border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 rounded-full cursor-pointer hover:bg-emerald-500/10">➗ AA拆帳</button>`;
            }

            if (isMyTx) {
                actionButtonsHtml = `
                    ${aaButtonHtml}
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

            const categoryIcons = { "早餐": "🍔", "午餐": "🍱", "晚餐": "🍜", "宵夜": "🌙", "飲料": "🧋", "零食": "🍪", "交通": "🚗", "購物": "🛍️", "娛樂": "🎬", "其他": "📦" };
            const currentIcon = categoryIcons[item.category] || "📝";

            htmlContent += `
                <div class="glass-panel p-4 rounded-2xl space-y-3 relative transition-all duration-300 ${isDisapproved ? 'border-l-2 border-rose-500/60 bg-rose-950/5' : ''}">
                    <div class="flex justify-between items-start">
                        <div class="space-y-1">
                            <div class="flex items-center gap-2">
                                <span class="text-xs">${currentIcon}</span>
                                <span class="text-sm font-light text-slate-200 tracking-wide">${item.title}</span>
                                <span class="text-[8px] px-1.5 py-0.2 rounded-md ${item.type === 'shared' ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'}">
                                    ${item.type === 'shared' ? '共同' : '個人'}
                                </span>
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

// 🚀 核心功能：一鍵 AA 拆帳自動報銷處理函數
window.splitAATransaction = async function(id) {
    const tx = state.transactions.find(t => String(t.id) === String(id));
    if (!tx) return;
    
    const halfAmount = Math.round((parseFloat(tx.amount) || 0) / 2);
    if (halfAmount <= 0) return alert('金額過低，無法進行拆帳。');

    if (!confirm(`// 🚀 啟動 AA 拆帳計算機\n此項目原金額為 NT$${tx.amount}\n系統將自動從【共同帳戶】轉出平分金額 NT$${halfAmount} 還給您，確定要執行嗎？`)) {
        return;
    }

    // 1. 在背景自動產生一筆從「共同公帳」流出的平分扣款，用來還給墊款人
    const { error } = await supabaseClient
        .from('transactions')
        .insert([{
            title: `🤖 AA公帳報銷：平分【${tx.title}】`,
            amount: halfAmount,
            date: tx.date, // 沿用原始消費日期，確保統計月份精準不亂套
            by: tx.by, // 記錄是誰代墊、誰收回這筆錢
            type: 'shared', // 類型歸屬為「共同公帳流出」
            category: tx.category || '其他',
            status: 'approved',
            comments: [{ author: '系統通知', text: `已成功平分此筆個人代墊消費，由共同帳戶扣除 NT$${halfAmount} 還給${tx.by}。` }]
        }]);

    if (error) {
        return alert('拆帳失敗，請檢查網路連線：' + error.message);
    }

    alert(`// 拆帳數據寫入成功！✓\n已從共同帳戶提撥 NT$${halfAmount} 還給您的個人收入結餘。`);
    await fetchTransactions();
};

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

    if (isNaN(amount) || amount <= 0) return alert('// 請填寫項目與金額');
    if (!title) title = category;

    let formattedDate = inputDate ? inputDate.replace(/-/g, '.') : '';
    if(!formattedDate) {
        const now = new Date();
        formattedDate = now.getFullYear() + '.' + String(now.getMonth() + 1).padStart(2, '0') + '.' + String(now.getDate()).padStart(2, '0');
    }

    if (id) {
        const { error } = await supabaseClient
            .from('transactions')
            .update({ title: title, amount: amount, type: type, category: category, date: formattedDate })
            .eq('id', id);
        if (error) return alert('修改失敗: ' + error.message);
    } else {
        const { error } = await supabaseClient
            .from('transactions')
            .insert([{
                title: title, amount: amount, date: formattedDate, by: currentBy,
                type: type, category: category, status: 'approved', comments: []
            }]);
        if (error) return alert('寫入雲端失敗: ' + error.message);
    }

    closeTransactionModal();
    await fetchTransactions();
};

window.deleteTransaction = async function(id) {
    if (confirm('確定要刪除明細嗎？')) {
        const { error } = await supabaseClient.from('transactions').delete().eq('id', id);
        if (error) return alert('刪除失敗: ' + error.message);
        await fetchTransactions();
    }
};

// ==========================================
// 5. 收入頁面與提撥
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
    const formattedDate = now.getFullYear() + '.' + String(now.getMonth() + 1).padStart(2, '0') + '.' + String(now.getDate()).padStart(2, '0');

    const { error } = await supabaseClient.from('transactions').insert([{ title: `💰 收入：${title}`, amount: amount, date: formattedDate, by: currentBy, type: 'income', status: 'approved', comments: [] }]);
    if (error) return alert('登記收入失敗: ' + error.message);
    await fetchTransactions();
    if (state.currentTab === 'save') renderIncomeSavePage();
};

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
    const formattedDate = now.toLocaleDateString('zh-TW', {year: 'numeric', month: '2-digit', day: '2-digit'}).replace(/\//g, '.');

    const { error } = await supabaseClient.from('transactions').insert([{ amount: amount, title: `📥 提撥：${note}`, date: formattedDate, by: state.userRole === 'boyfriend' ? '男友' : '女友', type: 'shared', status: 'approved', comments: [] }]);
    if (error) return alert('提撥失敗: ' + error.message);
    await fetchTransactions();
    renderSharedPoolPage();
};

// ==========================================
// 7. 財務計算與統計
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
    
    const availableMonths = [...new Set(state.transactions
        .filter(tx => tx.date && tx.date.split('.').length >= 2)
        .map(tx => {
            const parts = tx.date.split('.');
            return parts[0].length === 4 ? `${parts[0]}.${parts[1]}` : `2026.${parts[0]}`;
        })
    )].sort((a, b) => b.localeCompare(a)); 

    if (!availableMonths.includes(state.currentMonthFilter) && availableMonths.length > 0) {
        state.currentMonthFilter = availableMonths[0];
    }

    state.transactions.forEach(tx => {
        const txAmount = parseFloat(tx.amount) || 0;
        if (tx.type === 'income' || tx.title.includes('📥') || tx.status === 'disapproved') return;

        if (!tx.date) return;
        const parts = tx.date.split('.');
        const txYearMonth = parts[0].length === 4 ? `${parts[0]}.${parts[1]}` : `2026.${parts[0]}`;

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
        `<option value="${m}" ${state.currentMonthFilter === m ? 'selected' : ''}>${m.replace('.', '年 ')}月</option>`
    ).join('');
    
    if (availableMonths.length === 0) monthOptionsHtml = `<option value="">尚無月份數據</option>`;

    const categoryIcons = { "早餐": "🍔", "午餐": "🍱", "晚餐": "🍜", "宵夜": "🌙", "飲料": "🧋", "零食": "🍪", "交通": "🚗", "購物": "🛍️", "娛樂": "🎬", "其他": "📦" };
    const sortedCategories = Object.keys(categoryMap).map(cat => ({
        name: cat,
        amount: categoryMap[cat],
        icon: categoryIcons[cat] || "📝",
        percentage: totalExpense > 0 ? Math.round((categoryMap[cat] / totalExpense) * 100) : 0
    })).sort((a, b) => b.amount - a.amount);

    let rankListHtml = '';
    if(sortedCategories.length === 0) {
        rankListHtml = `<div class="text-center py-6 text-slate-600 text-xs">// 當月尚無消費明細</div>`;
    } else {
        sortedCategories.forEach(c => {
            rankListHtml += `
                <div class="space-y-1.5">
                    <div class="flex justify-between items-center text-xs">
                        <div class="flex items-center gap-1.5">
                            <span>${c.icon}</span>
                            <span class="text-slate-300 font-light">${c.name}</span>
                            <span class="text-[9px] text-slate-500 font-mono">(${c.percentage}%)</span>
                        </div>
                        <span class="font-mono text-slate-400 font-medium">NT$${c.amount.toLocaleString()}</span>
                    </div>
                    <div class="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div class="h-full rounded-full bg-gradient-to-r from-pink-500/80 to-purple-500/80 transition-all duration-500" style="width: ${c.percentage}%"></div>
                    </div>
                </div>
            `;
        });
    }

    mainContent.innerHTML = `
        <div class="glass-panel p-3 rounded-xl flex justify-between items-center border border-white/5">
            <span class="text-[10px] text-slate-500 font-mono uppercase tracking-widest">// 選擇統計月份</span>
            <select id="stats-month-select" onchange="changeStatsMonth(this.value)" class="bg-white/5 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none bg-[#121826]">
                ${monthOptionsHtml}
            </select>
        </div>

        <div class="grid grid-cols-3 gap-2 p-1 bg-white/5 rounded-xl text-[11px] font-medium border border-white/5">
            <button onclick="changeStatsDimension('all')" class="py-2 rounded-lg text-center cursor-pointer transition-all ${statsDimension === 'all' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-500'}">共同支出</button>
            <button onclick="changeStatsDimension('boyfriend')" class="py-2 rounded-lg text-center cursor-pointer transition-all ${statsDimension === 'boyfriend' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-slate-500'}">男友個人</button>
            <button onclick="changeStatsDimension('girlfriend')" class="py-2 rounded-lg text-center cursor-pointer transition-all ${statsDimension === 'girlfriend' ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20' : 'text-slate-500'}">女友個人</button>
        </div>

        <div class="glass-panel p-6 rounded-2xl text-center relative overflow-hidden">
            <p class="text-[10px] font-mono tracking-widest text-slate-500">// ${state.currentMonthFilter.replace('.', '年 ')}月 數據總覽</p>
            <h3 class="text-xs font-light text-slate-300 mt-2">
                ${statsDimension === 'all' ? '👥 雙人共同公帳總流出' : statsDimension === 'boyfriend' ? '🙋‍♂️ 男友個人生活總花費' : '🙋‍♀️ 女友個人生活總花費'}
            </h3>
            <p class="text-3xl font-light text-slate-200 mt-4 tracking-tight">NT$ <span class="font-medium ${statsDimension === 'all' ? 'text-emerald-400' : statsDimension === 'boyfriend' ? 'text-blue-400' : 'text-pink-400'}">${totalExpense.toLocaleString()}</span></p>
        </div>

        <div class="glass-panel p-5 rounded-2xl space-y-4">
            <p class="text-[10px] text-slate-500 font-mono tracking-widest uppercase">// 類別消費排行比例分析</p>
            <div class="space-y-4">${rankListHtml}</div>
        </div>
    `;
}

window.changeStatsDimension = function(dimension) { statsDimension = dimension; renderStatsPage(); };
window.changeStatsMonth = function(selectedMonth) { state.currentMonthFilter = selectedMonth; renderStatsPage(); };

// ==========================================
// 9. 互動與按鈕全域控制
// ==========================================
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
    const updatedComments = [...currentComments, { author: currentAuthor, text: commentText }];
    const { error } = await supabaseClient.from('transactions').update({ comments: updatedComments }).eq('id', id);
    if (error) return alert('留言失敗: ' + error.message);
    inputEl.value = '';
    await fetchTransactions();
};

window.purgeData = function() { if (confirm('確定要清除所有暫存？')) { state.transactions = []; state.incomeLogs = []; recalculateBalances(); if (state.currentTab === 'book') renderBookPage(); alert('資料已抹除'); } };
