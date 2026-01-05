import { Message } from '../types';

// ============================================================================
// 🧠 SYKO PERSONA AYARLARI
// ============================================================================

const SHARED_THINKING_PROTOCOL = `
    🧠 THOUGHT PROCESS PROTOCOL:
    1. TRIGGER: You MUST start your response with the <think> tag.
    2. RANGE: Keep your thinking process strictly between 128 and 1024 tokens.
    3. SOFT BRAKE (early_stop=True): As soon as a logical conclusion is reached, STOP thinking. Do not over-analyze. Close with </think> immediately.
    4. FORMAT: <think>...reasoning...</think> ...final response...
`;

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
    You are SykoLLM V2.5 (powered by Llama 3.3).
    Identity: A helpful, quick-witted AI companion.
    ${NATURAL_LANGUAGE_PROTOCOL}
  `,
  'syko-v3-pro': `
    You are SykoLLM PRO (powered by Xiaomi Mimo).
    Identity: A highly intelligent, balanced AI entity.
    ${NATURAL_LANGUAGE_PROTOCOL}
  `,
  'syko-super-pro': `
    You are SykoLLM SUPER PRO (powered by DeepSeek R1).
    Identity: The most advanced, deep-reasoning AI entity in the system.
    ${NATURAL_LANGUAGE_PROTOCOL}
    ${SHARED_THINKING_PROTOCOL}
    Note: Demonstrate superior logic and creativity. Always show your reasoning within tags.
  `,
  'syko-coder': `
    You are SykoLLM Coder (powered by Qwen Coder).
    Identity: An expert software engineer and debugger.
    ${NATURAL_LANGUAGE_PROTOCOL}
    ${SHARED_THINKING_PROTOCOL}
    Note: Provide clean, efficient, and well-commented code. Think about the architecture first inside tags.
  `
};

// ============================================================================
// 🖼️ GÖRSEL ÜRETİM SERVİSİ (SYKO VISION MODE)
// ============================================================================
// NOTE: Görsel üretimi için şimdilik mevcut yapıyı koruyoruz veya devre dışı bırakıyoruz.
// Kullanıcı isteğinde sadece chat modellerinin OpenRouter'a geçmesi istendi.
// Ancak import hatası olmaması için bu fonksiyonu mock (yer tutucu) olarak bırakıyorum
// veya basit bir hata fırlatıcı yapıyorum. İleride OpenRouter image API eklenebilir.

export const generateSykoImage = async (modelId: string, prompt: string, referenceImages?: string[]): Promise<{ text: string, images: string[] }> => {
  throw new Error("Görsel üretim servisi bakım modundadır. Lütfen Chat modunu kullanın.");
};

// ============================================================================
// 🚀 OPENROUTER STREAMING SERVICE
// ============================================================================

export const streamResponse = async (
  modelId: string, 
  history: Message[],
  onChunk: (text: string) => void,
  signal?: AbortSignal,
  images?: string[] 
): Promise<string> => {

  // 1. Model ve API Anahtarı Eşleşmesi
  let openRouterModel = "";
  let apiKey = "";
  let systemPrompt = SYSTEM_PROMPTS['syko-v2.5'];

  switch (modelId) {
    case 'syko-v2.5':
      openRouterModel = "meta-llama/llama-3.3-70b-instruct:free";
      apiKey = process.env.API_KEY || "";
      systemPrompt = SYSTEM_PROMPTS['syko-v2.5'];
      break;
    case 'syko-v3-pro':
      openRouterModel = "xiaomi/mimo-v2-flash:free";
      apiKey = process.env.API_KEY1 || "";
      systemPrompt = SYSTEM_PROMPTS['syko-v3-pro'];
      break;
    case 'syko-super-pro':
      openRouterModel = "deepseek/deepseek-r1-0528:free";
      apiKey = process.env.API_KEY2 || "";
      systemPrompt = SYSTEM_PROMPTS['syko-super-pro'];
      break;
    case 'syko-coder':
      openRouterModel = "qwen/qwen3-coder:free";
      apiKey = process.env.API_KEY3 || "";
      systemPrompt = SYSTEM_PROMPTS['syko-coder'];
      break;
    default:
      throw new Error("Geçersiz Model ID");
  }

  if (!apiKey) {
    throw new Error(`API Anahtarı eksik! (${modelId} için key bulunamadı)`);
  }

  // 2. Mesaj Formatını Hazırla
  const messages: any[] = [
    { role: "system", content: systemPrompt }
  ];

  // Geçmiş mesajları ekle
  // Son mesaj hariç hepsini text olarak ekle
  for (let i = 0; i < history.length - 1; i++) {
    const msg = history[i];
    messages.push({
      role: msg.role === 'model' ? 'assistant' : 'user',
      content: msg.content
    });
  }

  // Son mesajı ve varsa resimleri ekle
  const lastMsg = history[history.length - 1];
  
  if (images && images.length > 0) {
    // OpenRouter Vision Format
    const contentArray: any[] = [
      { type: "text", text: lastMsg.content }
    ];
    
    images.forEach(img => {
      contentArray.push({
        type: "image_url",
        image_url: {
          url: img // Data URL (base64) desteklenir
        }
      });
    });

    messages.push({
      role: "user",
      content: contentArray
    });
  } else {
    messages.push({
      role: "user",
      content: lastMsg.content
    });
  }

  // 3. Fetch İsteği (OpenRouter)
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.href, // OpenRouter best practice
        "X-Title": "SykoLLM Web"
      },
      body: JSON.stringify({
        model: openRouterModel,
        messages: messages,
        stream: true,
        // Model spesifik parametreler (isteğe bağlı)
        temperature: 0.7,
        max_tokens: 4096,
        include_reasoning: true // DeepSeek ve diğer reasoning modelleri için
      }),
      signal: signal
    });

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = `OpenRouter Error (${response.status}): ${errText}`;
      if (response.status === 429) errMsg = "OpenRouter Kotası Aşıldı (429). Biraz bekleyin.";
      throw new Error(errMsg);
    }

    if (!response.body) throw new Error("Empty response body");

    // 4. Streaming Okuma
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullText = "";
    let buffer = "";

    while (true) {
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
          
          // DeepSeek R1 gibi modeller bazen <think> tag'ini content içinde gönderir.
          // OnChunk ile UI'a akıtıyoruz.
          if (content) {
            fullText += content;
            onChunk(content);
          }
        } catch (e) {
          // JSON parse hatası veya boş chunk, yoksay
        }
      }
    }

    return fullText;

  } catch (error: any) {
    if (error.name === 'AbortError') return "[ABORTED]";
    throw new Error(error.message || "Bilinmeyen bağlantı hatası.");
  }
};