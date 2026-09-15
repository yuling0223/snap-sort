"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("receipt");
  const [data, setData] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false); 

  // 🚀 升級功能：圖片自動壓縮引擎 (解決 413 錯誤與 AI 崩潰問題)
  const compressImage = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        // 設定適合 AI 辨識的最大解析度 (1280px 足夠清晰且檔案極小)
        const MAX_WIDTH = 1280;
        const MAX_HEIGHT = 1280;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        
        // 強制轉為 JPEG 格式，並以 0.8 的品質壓縮
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.8);
        resolve(compressedBase64);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });

  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    setData(null);
    
    // 使用自動壓縮功能，瞬間將幾 MB 的照片縮小
    const compressedBase64 = await compressImage(file);
    setPreview(compressedBase64);
  };

  const handleAnalyze = async () => {
    if (!selectedFile || !preview) {
      alert("請先選擇照片！");
      return;
    }

    setLoading(true);
    setData(null);

    try {
      // 擷取 Base64 的純資料段
      const base64Data = preview.split(",")[1];
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base64Image: base64Data,
          mimeType: "image/jpeg", // 壓縮時已統一轉為 jpeg
          targetCategory: selectedCategory
        })
      });
      const result = await response.json();
      
      setData({
        category: selectedCategory,
        title: result.title || "",
        summary: result.summary || "",
        full_text: result.full_text || "",
        merchant: result.merchant || "",
        date: result.date || "",
        total_amount: result.total_amount ?? "",
        items: result.items || [],
        brand: result.brand || "",
        product_name: result.product_name || "",
        price: result.price ?? "",
        features: result.features || [],
        tasks: result.tasks || []
      });
    } catch (error) {
      console.error("前端解析錯誤:", error);
      alert("解析發生錯誤，請手動填寫欄位");
      setData({
        category: selectedCategory,
        title: "",
        summary: "",
        full_text: "",
        items: [],
        features: [],
        tasks: []
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      let tableName = "";
      let insertData = {};

      if (data.category === "receipt") {
        tableName = "receipts";
        insertData = { date: data.date, merchant: data.merchant, total_amount: Number(data.total_amount) || 0, items: data.items };
      } else if (data.category === "whiteboard") {
        tableName = "whiteboard_tasks";
        insertData = { title: data.title, tasks: data.tasks };
      } else if (data.category === "handwritten_note" || data.category === "other") {
        tableName = "handwritten_notes";
        insertData = { title: data.title, summary: data.summary, full_text: data.full_text };
      } else if (data.category === "product") {
        tableName = "product_wishlist";
        insertData = { brand: data.brand, product_name: data.product_name, price: Number(data.price) || 0, features: data.features };
      }

      const { error } = await supabase.from(tableName).insert([insertData]);
      if (error) throw error;
      
      alert("儲存成功！");
      setData(null);
      setPreview(null);
      setSelectedFile(null);
    } catch (error) {
      alert("儲存失敗：" + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans relative flex flex-col">
      {/* 頂部導覽列與側邊欄開關按鈕 */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <button 
          onClick={() => setSidebarOpen(true)} 
          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm flex items-center gap-2 transition"
        >
          📂 <span>專案資料夾</span>
        </button>
        <h1 className="text-lg font-bold text-gray-900">SnapSort 📸</h1>
        <div className="w-16"></div> {/* 佔位保持標題置中 */}
      </header>

      {/* 滑動式側邊欄 (Drawer) 與遮罩 */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* 半透明遮罩，點擊即可關閉 */}
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
            onClick={() => setSidebarOpen(false)}
          ></div>

          {/* 側邊欄本體 */}
          <div className="relative w-72 bg-white h-full shadow-2xl z-10 flex flex-col p-5 transform transition-transform duration-300">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200 mb-4">
              <h2 className="font-bold text-lg text-gray-800">📂 專案資料夾</h2>
              <button 
                onClick={() => setSidebarOpen(false)}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-500 font-bold px-2"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-3 text-sm text-gray-700">
              <div className="font-semibold text-gray-500 uppercase text-xs tracking-wider">我的分類</div>
              <ul className="space-y-1">
                <li className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer transition">📄 全部紀錄</li>
                <li className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer transition">🧾 收據 / 發票</li>
                <li className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer transition">📝 待辦清單</li>
                <li className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer transition">🛍️ 商品願望清單</li>
                <li className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer transition">📓 筆記</li>
                <li className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer transition">📁 其他</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 主畫面內容 */}
      <main className="flex-1 max-w-xl w-full mx-auto p-4 sm:p-6 space-y-6">
        
        {/* 上傳照片區塊 */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-3">
          <label className="block text-sm font-semibold text-gray-800">1. 選擇或拍攝照片</label>
          <input 
            type="file" accept="image/*"
            onChange={handleImageSelect} 
            className="block w-full border border-gray-300 p-2.5 rounded-xl bg-gray-50 text-black text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-black file:text-white hover:file:bg-gray-800 cursor-pointer"
          />
        </div>

        {/* 預覽與類別選擇區塊 */}
        {preview && (
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4">
            <img src={preview} alt="預覽" className="w-full h-auto object-contain rounded-xl border bg-black/5 max-h-80 mx-auto" />
            
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">2. 選擇這份資料的類別</label>
              <select 
                value={selectedCategory} 
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-xl bg-white text-black font-medium focus:ring-2 focus:ring-black focus:outline-none"
              >
                <option value="receipt">收據 / 發票</option>
                <option value="whiteboard">待辦清單</option>
                <option value="product">商品</option>
                <option value="handwritten_note">筆記</option>
                <option value="other">其他</option>
              </select>
            </div>

            <button 
              onClick={handleAnalyze} 
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3.5 rounded-xl hover:bg-blue-700 transition font-semibold shadow-md flex items-center justify-center disabled:opacity-50"
            >
              {loading ? "✨ AI 深度分析中..." : "✨ 開始 AI 分析"}
            </button>
          </div>
        )}

        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
            <p className="text-blue-600 font-medium mt-2">圖片已壓縮，AI 正在超速辨識中...</p>
          </div>
        )}

        {/* 分析結果與編輯表單 */}
        {data && !loading && (
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 border-b pb-2">3. 確認與編輯萃取結果</h2>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">標題</label>
              <input 
                type="text" 
                placeholder="請輸入標題..." 
                value={data.title || ""} 
                onChange={e => setData({...data, title: e.target.value})} 
                className="w-full p-3 border border-gray-300 rounded-xl text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black" 
              />
            </div>

            {data.category === "receipt" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">商家名稱</label>
                  <input type="text" placeholder="例：全聯福利中心" value={data.merchant || ""} onChange={e => setData({...data, merchant: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">日期</label>
                  <input type="date" value={data.date || ""} onChange={e => setData({...data, date: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl text-black focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">總金額</label>
                  <input type="number" placeholder="0" value={data.total_amount ?? ""} onChange={e => setData({...data, total_amount: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
              </div>
            )}

            {data.category === "whiteboard" && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">待辦事項 (每行一項)</label>
                <textarea placeholder="輸入待辦項目..." value={(data.tasks || []).join("\n")} onChange={e => setData({...data, tasks: e.target.value.split("\n")})} className="w-full p-3 border border-gray-300 rounded-xl h-32 text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black" />
              </div>
            )}

            {(data.category === "handwritten_note" || data.category === "other") && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">摘要</label>
                  <input type="text" placeholder="簡單摘要..." value={data.summary || ""} onChange={e => setData({...data, summary: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">完整內容</label>
                  <textarea placeholder="完整文字內容..." value={data.full_text || ""} onChange={e => setData({...data, full_text: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl h-40 text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
              </div>
            )}

            {data.category === "product" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">品牌</label>
                  <input type="text" placeholder="品牌名稱" value={data.brand || ""} onChange={e => setData({...data, brand: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">商品名稱</label>
                  <input type="text" placeholder="商品名稱" value={data.product_name || ""} onChange={e => setData({...data, product_name: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">價格</label>
                  <input type="number" placeholder="0" value={data.price ?? ""} onChange={e => setData({...data, price: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
              </div>
            )}

            <button onClick={handleSave} className="mt-4 w-full bg-black text-white py-3.5 rounded-xl hover:bg-gray-800 transition font-semibold shadow-md">
              確認無誤並儲存至資料庫
            </button>
          </div>
        )}
      </main>
    </div>
  );
}