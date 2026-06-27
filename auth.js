// ==========================================
// 處理帳密登入與驗證邏輯
// ==========================================
window.handleLogin = async function() {
    const userIn = document.getElementById('login-username').value.trim();
    const passIn = document.getElementById('login-password').value.trim();

    if (!userIn || !passIn) {
        return alert('請填寫名字與密碼');
    }

    try {
        // 發送請求到 users 資料表進行條件比對
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('username', userIn)
            .eq('password', passIn);

        // 如果連線報錯（如 RLS 擋下、網路錯誤）
        if (error) {
            console.error("Supabase 查詢錯誤詳細資訊：", error);
            return alert('登入連線失敗: ' + error.message + '\n提示：請檢查 RLS Policy 是否開啟且為 true');
        }

        // 如果成功撈到相符的資料
        if (data && data.length > 0) {
            const matchedUser = data[0];
            state.userRole = matchedUser.role; // 取得 'boyfriend' 或 'girlfriend'

            // 解鎖！隱藏登入遮罩視窗
            document.getElementById('login-overlay').classList.add('hidden');

            // 動態更新頂部導覽列的身分標籤
            const roleBadge = document.getElementById('role-badge');
            if (roleBadge) {
                roleBadge.innerText = state.userRole === 'boyfriend' ? '🙋‍♂️ 男友視角' : '🙋‍♀️ 女友視角';
                roleBadge.parentElement.className = `text-[9px] bg-white/5 ${state.userRole === 'boyfriend' ? 'text-blue-300 border-blue-500/20' : 'text-pink-300 border-pink-500/20'} border font-medium px-3 py-1 rounded-full tracking-widest`;
            }

            // 登入成功，呼叫記帳模組去加載雲端帳本資料 (定義在 app.js 中)
            if (typeof fetchTransactions === 'function') {
                fetchTransactions();
            }
        } else {
            alert('❌ 名字或密碼錯誤，請重新確認！\n提示：請確認資料庫 users 表內有對應的資料。');
        }
    } catch (catchErr) {
        console.error("代碼執行崩潰：", catchErr);
        alert("登入程序發生未知異常，請打開瀏覽器 Console 查看錯誤。");
    }
};