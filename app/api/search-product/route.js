import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 空的回傳格式，統一使用
const EMPTY_RESULT = { brand: "", product_name: "", price: "", features: [] };

export async function POST(req) {
  try {
    const { title, brand, product_name } = await req.json();

    // 沒有任何可用的商品線索就不用搜尋了，直接回傳空欄位
    const queryHint = [brand, product_name, title].filter(Boolean).join(" ").trim();
    if (!queryHint) {
      return NextResponse.json(EMPTY_RESULT);
    }

    // 使用 Google Search grounding，讓模型能實際上網查詢再回答
    const model = genAI.getGenerativeModel({
      model: "gemini-3.6-flash",
      tools: [{ googleSearch: {} }],
    });

    const prompt = `請上網搜尋以下商品的公開資訊："${queryHint}"。

只使用你實際搜尋到、確實存在的資料，絕對不要虛構任何數據；找不到的欄位請填空字串 "" 或空陣列 []。

請「只」回傳一個合法的 JSON 物件，不要加上任何說明文字、不要使用 markdown code block，格式必須是：
{
  "brand": "品牌名稱",
  "product_name": "完整商品名稱／型號",
  "price": 數字（新台幣參考售價，找不到就填 null）,
  "features": ["特色或規格1", "特色或規格2"]
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Google Search grounding 有時仍會包一層 ```json ... ```，先清乾淨再解析
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json({
      brand: parsed.brand || "",
      product_name: parsed.product_name || "",
      price: parsed.price ?? "",
      features: Array.isArray(parsed.features) ? parsed.features : [],
    });
  } catch (error) {
    console.error("商品線上搜尋發生例外狀況:", error);
    // 搜尋失敗就回傳空欄位，前端會維持原本的空白，不會擋住使用者儲存
    return NextResponse.json(EMPTY_RESULT);
  }
}