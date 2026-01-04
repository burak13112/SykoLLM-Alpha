import { Message } from '../types';
import { GoogleGenAI } from "@google/genai";

// ============================================================================
// 🛠️ NGROK BAĞLANTI AYARLARI
// ============================================================================

const CUSTOM_MODEL_CONFIG = {
  baseURL: "https://requires-once-henry-summit.trycloudflare.com/v1",
  modelId: "Qwen_Qwen3-0.6Be", 
  apiKey: "EMPTY" 
};

// ============================================================================
// 🧠 SYKO PERSONA AYARLARI
// ============================================================================

const SHARED_THINKING_PROTOCOL = `
    🧠 THOUGHT PROCESS PROTOCOL (<think>):
    1. You have the ability to think before answering using the <think> tag.
    2. SOFT LIMIT: Keep your reasoning process efficient (aim for 512-1024 tokens).
    3. BRAKE: As soon as you reach a conclusion, close with </think> and output the final response immediately.
`;

// Daha doğal, insansı ve tekrardan kaçınan promptlar
const NATURAL_LANGUAGE_PROTOCOL = `
    🗣️ TONE & STYLE GUIDE:
    1. **BE NATURAL:** Speak like a smart, cool human friend. Avoid academic, robotic, or overly formal language.
    2. **KEEP IT SIMPLE:** Use daily life language. Be concise and direct.
    3. **NO REPETITION:** DO NOT constantly say "As SykoLLM" or "SykoLLM-PRO here". Just answer the question.
    4. **NO FILLERS:** Avoid starting with "Sure!", "Here is the answer", "I can help with that". Dive straight into the value.
    5. **LANGUAGE:** Strictly stick to English or Turkish based on the user's input.
`;

const SYSTEM_PROMPTS: Record<string, string> = {
  'syko-v2.5': `
    You are SykoLLM V2.5.
    Identity: A helpful, quick-witted AI companion.
    ${NATURAL_LANGUAGE_PROTOCOL}
    ${SHARED_THINKING_PROTOCOL}
  `,
  'syko-v3-pro': `
    You are SykoLLM V3.0 PRO.
    Identity: A highly intelligent, deep-thinking AI entity.
    ${NATURAL_LANGUAGE_PROTOCOL}
    ${SHARED_THINKING_PROTOCOL}
    Note: Even though you are "PRO", keep the conversation grounded and easy to understand unless asked for technical depth.
  `
};

// ============================================================================
// 🖼️ GÖRSEL ÜRETİM SERVİSİ (UPDATED)
// ============================================================================

export const generateSykoImage = async (prompt: string, referenceImages?: string[]): Promise<{ text: string, images: string[] }> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key eksik!");

  const ai = new GoogleGenAI({ apiKey });

  try {
    const parts: any[] = [];

    // 1. Referans görselleri ekle (Varsa) - Image Editing / Image-to-Image için
    if (referenceImages && referenceImages.length > 0) {
      referenceImages.forEach(base64Str => {
        const base64Data = base64Str.split(',')[1];
        let mimeType = 'image/jpeg';
        if (base64Str.startsWith('data:image/png')) mimeType = 'image/png';
        if (base64Str.startsWith('data:image/webp')) mimeType = 'image/webp';

        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        });
      });
    }

    // 2. Metin promptunu ekle
    parts.push({ text: prompt });

    // Model: gemini-2.5-flash-image (Image Generation & Editing Model)
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: parts
      },
      config: {
        // Nano Banana serisi responseMimeType veya schema desteklemez.
      }
    });

    const generatedImages: string[] = [];
    let generatedText = "";

    // Yanıtın parçalarını gez
    if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const base64Str = part.inlineData.data;
          const mimeType = part.inlineData.mimeType || 'image/png';
          generatedImages.push(`data:${mimeType};base64,${base64Str}`);
        } else if (part.text) {
          generatedText += part.text;
        }
      }
    }

    if (generatedImages.length === 0 && !generatedText) {
      throw new Error("Görsel üretilemedi.");
    }

    return { text: generatedText, images: generatedImages };

  } catch (error: any) {
    console.error("Image Gen Error:", error);
    throw new Error(`Görsel üretimi başarısız: ${error.message}`);
  }
};

// ============================================================================
// 🔌 NGROK STREAMING FONKSİYONU
// ============================================================================

async function streamNgrokResponse(
  history: Message[], 
  onChunk: (text: string) => void,
  signal?: AbortSignal,
  images?: string[]
): Promise<string> {
  
  if (images && images.length > 0) {
      throw new Error("Bu model görsel incelemeyi desteklememektedir. lütfen başka bir modele geçiniz.");
  }

  if (CUSTOM_MODEL_CONFIG.baseURL.includes("CHANGE_THIS") || !CUSTOM_MODEL_CONFIG.baseURL.startsWith("http")) {
    throw new Error("⚠️ AYAR EKSİK: 'services/sykoService.ts' dosyasını aç ve 'baseURL' kısmına yeni Ngrok URL'sini yapıştır.");
  }

  const messages = history.map(msg => ({
    role: msg.role === 'model' ? 'assistant' : 'user',
    content: msg.content
  }));

  const systemMessage = {
    role: "system",
    content: `You are SykoLLM.
    ${NATURAL_LANGUAGE_PROTOCOL}
    ${SHARED_THINKING_PROTOCOL}
    `
  };
  
  const payload = {
    model: CUSTOM_MODEL_CONFIG.modelId,
    messages: [systemMessage, ...messages],
    stream: true, 
    temperature: 0.7,
    max_tokens: 4096,
    early_stopping: true
  };

  try {
    const response = await fetch(`${CUSTOM_MODEL_CONFIG.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CUSTOM_MODEL_CONFIG.apiKey}`,
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'SykoClient/1.0'
      },
      credentials: 'omit',
      mode: 'cors',
      body: JSON.stringify(payload),
      signal: signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Sunucu Hatası (${response.status}): ${errorText.substring(0, 100)}`);
    }

    if (!response.body) throw new Error("Yanıt gövdesi boş!");

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullText = "";
    let buffer = "";

    while (true) {
      if (signal?.aborted) {
        reader.cancel();
        break;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; 

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const dataStr = trimmed.slice(6);
        if (dataStr === "[DONE]") continue;

        try {
          const json = JSON.parse(dataStr);
          const content = json.choices?.[0]?.delta?.content || "";
          if (content) {
            fullText += content;
            onChunk(content);
          }
        } catch (e) { }
      }
    }
    return fullText;

  } catch (error: any) {
    if (error.name === 'AbortError') return " [ABORTED]";
    throw new Error(error.message);
  }
}

// ============================================================================
// 🚀 ANA STREAM HANDLER
// ============================================================================

export const streamResponse = async (
  modelId: string, 
  history: Message[],
  onChunk: (text: string) => void,
  signal?: AbortSignal,
  images?: string[] 
): Promise<string> => {
  
  if (modelId === 'syko-native') {
    return await streamNgrokResponse(history, onChunk, signal, images);
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key eksik!");
  
  const ai = new GoogleGenAI({ apiKey });

  try {
    let targetModel = "gemini-2.0-flash-exp"; 
    
    if (modelId === 'syko-v3-pro') {
      targetModel = "gemini-3-flash-preview"; 
    }

    const systemInstruction = SYSTEM_PROMPTS[modelId] || SYSTEM_PROMPTS['syko-v2.5'];

    const historyContents = history.slice(0, -1).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const lastMessage = history[history.length - 1];
    
    const currentParts: any[] = [];
    
    if (images && images.length > 0) {
      images.forEach(base64Str => {
        const base64Data = base64Str.split(',')[1];
        let mimeType = 'image/jpeg';
        if (base64Str.startsWith('data:image/png')) mimeType = 'image/png';
        if (base64Str.startsWith('data:image/webp')) mimeType = 'image/webp';

        currentParts.push({
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        });
      });
    }

    currentParts.push({ text: lastMessage.content });

    const responseStream = await ai.models.generateContentStream({
      model: targetModel,
      contents: [
        ...historyContents,
        { role: 'user', parts: currentParts }
      ],
      config: {
        systemInstruction: systemInstruction,
      },
    });

    let fullText = "";

    for await (const chunk of responseStream) {
      if (signal?.aborted) break;
      const text = chunk.text;
      if (text) {
        fullText += text;
        onChunk(text);
      }
    }

    return fullText;

  } catch (error: any) {
    if (error.name === 'AbortError') return "[ABORTED]";
    if (error.message?.includes('image') || error.message?.includes('vision')) {
       throw new Error("Bu model görsel incelemeyi desteklememektedir. lütfen başka bir modele geçiniz.");
    }
    throw new Error(`Hata: ${error.message}`);
  }
};