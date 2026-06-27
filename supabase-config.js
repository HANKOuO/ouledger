// ==========================================
// 1. Supabase 雲端基礎配置
// ==========================================
const SUPABASE_URL = "https://kqkzcxfcirrarlftmdvl.supabase.co/rest/v1/";
const SUPABASE_KEY = "sb_publishable_rE3TcOeDodvIqCQLY9FFYA_MRgkdxTi"; // 👈 貼上你真實的 sb_publishable... 開頭密鑰

// 全域共用的 Supabase 連線實例
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// 2. 系統全局資料狀態共享中心
// ==========================================
let state = {
    userRole: '',              // 登入成功後動態儲存 ('boyfriend' 或 'girlfriend')
    currentTab: 'book',        
    filterType: 'all',         
    personalIncomes: { boyfriend: 45000, girlfriend: 38000 }, // 初始預設收入
    balances: { boyfriend: 0, girlfriend: 0, shared: 0 },
    transactions: [], 
    incomeLogs: []    
};

let statsDimension = 'all';
