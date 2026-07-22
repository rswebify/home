var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(import_express.default.json({ limit: "15mb" }));
app.use(import_express.default.urlencoded({ extended: true, limit: "15mb" }));
var ai = null;
try {
  if (process.env.GEMINI_API_KEY) {
    ai = new import_genai.GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  } else {
    console.warn("GEMINI_API_KEY is not defined. AI features will require API key setup.");
  }
} catch (err) {
  console.error("Failed to initialize Google GenAI SDK:", err);
}
function getAIClient() {
  if (!ai) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required. Please set it in Settings.");
    }
    ai = new import_genai.GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return ai;
}
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history, chatbotId } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }
    const client = getAIClient();
    let model = "gemini-3.5-flash";
    let systemInstruction = "";
    if (chatbotId === "pro") {
      model = "gemini-3.1-pro-preview";
      systemInstruction = `You are the Lead Business Growth & CRM Strategy Advisor at RS Webify (rswebify.in).
Your role is to help clients planning their websites, CRM integrations, ERP solutions, and sales funnels.
Provide deep, strategic, and highly professional advice. Focus on ROI, customer conversion, business logic, and custom development.
Always maintain a helpful, premium corporate tone representing RS Webify Pvt. Ltd.`;
    } else if (chatbotId === "lite") {
      model = "gemini-3.1-flash-lite";
      systemInstruction = `You are the Technical Architecture & Integrations Expert at RS Webify (rswebify.in).
Your role is to provide quick, lightweight, and technical answers about WordPress, Shopify, WooCommerce, custom React/Node.js stacks, payment gateways, APIs, page speed optimization, and security audits.
Be concise, direct, technically accurate, and extremely fast. Keep explanations clean and lightweight.`;
    } else {
      model = "gemini-3.5-flash";
      systemInstruction = `You are the Lead Digital Marketing & SEO Strategist at RS Webify (rswebify.in).
Your role is to guide users on SEO checklists, Google Analytics, social media ads (Meta, Google Ads), local SEO, and landing page designs to convert visitors into clients.
Be friendly, marketing-savvy, conversion-focused, and provide actionable tips for small businesses and startups.`;
    }
    const chatHistory = (history || []).map((h) => ({
      role: h.role === "user" ? "user" : "model",
      parts: [{ text: h.content || h.parts?.[0]?.text || "" }]
    }));
    const chat = client.chats.create({
      model,
      history: chatHistory,
      config: {
        systemInstruction
      }
    });
    const response = await chat.sendMessage({ message });
    return res.json({
      text: response.text,
      modelUsed: model
    });
  } catch (err) {
    console.error("Chat API error:", err);
    return res.status(500).json({ error: err.message || "An error occurred with Gemini Chat API" });
  }
});
app.post("/api/generate-image", async (req, res) => {
  try {
    const { prompt, aspectRatio, base64Image, mimeType, isEditing } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }
    const client = getAIClient();
    const model = "gemini-3.1-flash-image-preview";
    let contentsParts = [];
    if (isEditing && base64Image && mimeType) {
      const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");
      contentsParts.push({
        inlineData: {
          data: cleanBase64,
          mimeType: mimeType || "image/png"
        }
      });
    }
    contentsParts.push({
      text: prompt
    });
    const response = await client.models.generateContent({
      model,
      contents: {
        parts: contentsParts
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio || "1:1"
        }
      }
    });
    let generatedImageUrl = "";
    const candidates = response.candidates;
    if (candidates && candidates.length > 0 && candidates[0].content?.parts) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          generatedImageUrl = `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
          break;
        }
      }
    }
    if (!generatedImageUrl) {
      return res.status(500).json({
        error: "No image was returned by the AI model. Try adjusting your prompt."
      });
    }
    return res.json({
      imageUrl: generatedImageUrl,
      modelUsed: model
    });
  } catch (err) {
    console.error("Image Generation API error:", err);
    return res.status(500).json({ error: err.message || "An error occurred with Gemini Image API" });
  }
});
var leads = [];
app.post("/api/leads", (req, res) => {
  const { name, company, email, phone, service, budget, timeline, details, websiteUrl, formType, _subject } = req.body;
  const newLead = {
    id: Date.now().toString(),
    formType: formType || "Quote Request",
    name: name || "Anonymous Client",
    company: company || "N/A",
    email: email || "contact@rswebify.in",
    phone: phone || "N/A",
    service: service || "General Inquiry",
    budget: budget || "N/A",
    timeline: timeline || "N/A",
    details: details || "",
    websiteUrl: websiteUrl || "",
    subject: _subject || "New Lead",
    recipient: "shivambhartiofficial@gmail.com",
    date: (/* @__PURE__ */ new Date()).toISOString()
  };
  leads.push(newLead);
  console.log(`[EMAIL DISPATCH] Lead sent directly to shivambhartiofficial@gmail.com:`, newLead);
  return res.json({ success: true, message: "Lead transmitted successfully", lead: newLead });
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`RS Webify server running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
