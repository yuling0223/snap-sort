"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// 分類代號 -> 對應的資料表與額外篩選條件
const CATEGORY_MAP = {
  all: { label: "全部紀錄", table: null },
  receipt: { label: "收據 / 發票", table: "receipts" },
  whiteboard: { label: "待辦清單", table: "whiteboard_tasks" },
  product: { label: "商品願望清單", table: "product_wishlist" },
  handwritten_note: { label: "筆記", table: "handwritten_notes", filter: { category: "handwritten_note" } },
  other: { label: "其他", table: "handwritten_notes", filter: { category: "other" } },
};

const ALL_TABLES = ["receipts", "whiteboard_tasks", "product_wishlist", "handwritten_notes"];

export default function FolderPage() {
  const params = useParams();
  const categorySlug = params?.category;
  const config = CATEGORY_MAP[categorySlug] || CATEGORY_MAP.all;

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      setLoading(true);
      try {
        if (!config.table) {
          // "全部紀錄"：把四張表都撈出來合併，依建立時間排序
          const results = await Promise.all(
            ALL_TABLES.map((t) => supabase.from(t).select("*").order("created_at", { ascending: false }))
          );
          const merged = results.flatMap((r, i) =>
            (r.data || []).map((row) => ({ ...row, __table: ALL_TABLES[i] }))
          );
          merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          if (isMounted) setRecords(merged);
        } else {
          let query = supabase.from(config.table).select("*").order("created_at", { ascending: false });
          if (config.filter) {
            Object.entries(config.filter).forEach(([key, value]) => {
              query = query.eq(key, value);
            });
          }
          const { data, error } = await query;
          if (error) throw error;
          if (isMounted) setRecords((data || []).map((row) => ({ ...row, __table: config.table })));
        }
      } catch (error) {
        console.error("讀取資料夾資料失敗:", error);
        if (isMounted) setRecords([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    return () => { isMounted = false; };
  }, [categorySlug]);

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link href="/" className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium">
          ← 返回
        </Link>
        <h1 className="text-lg font-bold text-gray-900">{config.label}</h1>
      </header>

      <main className="max-w-xl mx-auto p-4 sm:p-6 space-y-4">
        {loading && <p className="text-center text-gray-500 py-8">載入中...</p>}

        {!loading && records.length === 0 && (
          <p className="text-center text-gray-400 py-8">這個分類目前還沒有資料</p>
        )}

        {!loading && records.map((r) => (
          <div key={`${r.__table}-${r.id}`} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex gap-3">
            {r.image_url && (
              <img src={r.image_url} alt="" className="w-20 h-20 object-cover rounded-xl flex-shrink-0 bg-gray-100" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 truncate">
                {r.title || r.merchant || r.product_name || "未命名"}
              </p>

              {r.__table === "receipts" && (
                <p className="text-sm text-gray-500">{r.merchant || "—"} · ${r.total_amount ?? 0}</p>
              )}
              {r.__table === "whiteboard_tasks" && (
                <p className="text-sm text-gray-500">{(r.tasks || []).length} 項待辦</p>
              )}
              {r.__table === "product_wishlist" && (
                <p className="text-sm text-gray-500">{r.brand || "—"} · ${r.price ?? 0}</p>
              )}
              {r.__table === "handwritten_notes" && (
                <p className="text-sm text-gray-500 truncate">{r.summary || "—"}</p>
              )}

              {r.created_at && (
                <p className="text-xs text-gray-400 mt-1">{new Date(r.created_at).toLocaleDateString()}</p>
              )}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}