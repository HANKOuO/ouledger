// ==========================================
// 1. Supabase 雲端基礎配置
// ==========================================
const SUPABASE_URL = "https://kqkzcxfcirrarlftmdvl.supabase.co";
const SUPABASE_KEY = "sb_publishable_rE3TcOeDodvIqCQLY9FFYA_MRgkdxTi"; // 👈 貼上你真實的 sb_publishable... 開頭密鑰

// 全域共用的 Supabase 連線實例
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// 2. 系統全局資料狀態共享中心
// ==========================================
let state = {
    userRole: '',              
    currentTab: 'book',        
    filterType: 'all',         
    personalIncomes: { boyfriend: 0, girlfriend: 0 }, // 👈 把這裡改為 0
    balances: { boyfriend: 0, girlfriend: 0, shared: 0 },
    transactions: [], 
    incomeLogs: []    
};

let statsDimension = 'all';
