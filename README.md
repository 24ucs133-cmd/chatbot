# ChatGPT • n8n Intelligent Assistant UI

An ultra-modern, production-grade ChatGPT clone interface built with vanilla **HTML, CSS, and JavaScript**, pre-connected to your **n8n AI Cloud Webhook**:
`https://sathya14.app.n8n.cloud/webhook/chat`

---

## 🚀 Quick Start

### Option 1: Via Local Server (Recommended)
The project comes with a built-in zero-dependency Node.js server:
```bash
npm start
```
or
```bash
node server.js
```
Then open your browser at: **[http://localhost:3000](http://localhost:3000)**

### Option 2: Direct File Open
You can also directly double-click or open [index.html](file:///c:/Users/Student/Desktop/chatbot/index.html) in Google Chrome or any modern browser.

---

## ✨ Features & Capabilities

1. **ChatGPT Aesthetics & Experience**:
   - **Collapsible Sidebar**: Categorized history ("Today", "Yesterday", "Previous 7 Days", "Older"), inline rename, and delete actions.
   - **Prompt Suggestion Cards**: Quick click-to-ask cards for ICICI Credit Card application, required documents, card comparisons, and banking security.
   - **Typewriter Streaming Animation**: Live word-by-word streaming effect with blinking green cursor.
   - **Live Thinking Timer**: Displays animated bouncing dots and real-time elapsed seconds (e.g. `Thinking... 4.8s`) while n8n is processing.

2. **n8n Cloud Webhook Integration**:
   - Sends clean JSON payloads with `chatInput`, `message`, `prompt`, and `sessionId`.
   - Built-in **Settings Modal** to test your n8n webhook connection live with real-time ping latency.
   - Resilient response parsing: effortlessly handles Markdown text, JSON objects (`text`, `output`, `response`), and arrays.

3. **Rich Markdown & Code Rendering**:
   - Full formatting: Headings, blockquotes, bold/italic, lists, tables, and sanitized external links.
   - Syntax-highlighted code blocks with language indicator and **"Copy code"** button with checkmark animation.

4. **Interactive Message Actions**:
   - 📋 **Copy message**: Copy entire AI response with 1 click.
   - 🔄 **Regenerate**: Resend the last prompt.
   - 🔊 **Read Aloud**: Web Speech API Text-to-Speech with customizable voice selection.
   - 👍 / 👎 **Feedback**: Instant thumbs-up / thumbs-down ratings.
   - ⚡ **Latency Badge**: Displays response timing (e.g., `⚡ 14.2s`).

5. **Voice Input & File Attachments**:
   - 🎙️ **Voice Dictation**: Click the microphone to speak your prompt using speech recognition.
   - 📎 **File Attachments**: Attach `.txt`, `.json`, `.csv`, `.md`, or `.pdf` files to provide context to the chatbot.

6. **Customization & Persistence**:
   - 🌙 / ☀️ **Dark & Light Mode Toggle**: Seamless theme transition saved to `localStorage`.
   - 💾 **Multi-Chat Storage**: All conversations persist in browser storage.
   - 📤 **Export Chat**: Export any conversation as **Markdown (.md)**, **JSON (.json)**, or **Plain Text (.txt)**.
   - 🔔 **Acoustic Sound Effects**: Synthesized audio chimes on send & receive (toggleable in Settings).
