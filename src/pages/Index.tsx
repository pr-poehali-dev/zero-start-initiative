import { useState, useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";

const TNVED_URL = "https://functions.poehali.dev/994fd2c9-108e-4056-90a9-210779d76ddd";

interface TnvedResult {
  code: string;
  name: string;
  group_name: string;
  url: string;
}

interface TnvedData {
  query: string;
  results: TnvedResult[];
  source: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  tnved?: TnvedData;
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
}

interface Settings {
  tone: "formal" | "friendly" | "concise";
  maxLength: "short" | "medium" | "long";
}

const TONE_LABELS = { formal: "Официальный", friendly: "Дружелюбный", concise: "Краткий" };
const LENGTH_LABELS = { short: "Короткие", medium: "Средние", long: "Развёрнутые" };

const DEMO_RESPONSES: Record<string, string> = {
  formal: "Благодарю за ваш запрос. Я готов предоставить необходимую информацию и помочь в решении данного вопроса.",
  friendly: "Отличный вопрос! Давай разберём это вместе. Я здесь, чтобы помочь тебе с любой задачей 😊",
  concise: "Понял. Отвечаю по существу.",
};

const TNVED_TRIGGERS = [
  "тн вэд", "tnved", "тнвэд", "код товара", "таможенный код",
  "классификационный код", "номенклатура", "код тн", "тарифный код",
];

function isTnvedQuery(text: string): boolean {
  const lower = text.toLowerCase();
  return TNVED_TRIGGERS.some((t) => lower.includes(t));
}

function extractTnvedQuery(text: string): string {
  const lower = text.toLowerCase();
  const patterns = [
    /(?:найди|найти|подбери|подобрать|дай|дать|покажи|показать|узнай|определи)\s+(?:код\s+)?(?:тн\s?вэд|tnved|тнвэд|тарифный\s+код|таможенный\s+код)?\s+(?:для\s+|на\s+)?(.+)/i,
    /(?:тн\s?вэд|tnved|тнвэд|код|коды|таможенный\s+код)\s+(?:для\s+|на\s+|товара\s+)?(.+)/i,
    /(.+)\s+(?:тн\s?вэд|tnved|тнвэд|код|таможенный\s+код)/i,
  ];
  for (const p of patterns) {
    const m = lower.match(p);
    if (m && m[1] && m[1].trim().length > 2) return m[1].trim();
  }
  return text.replace(/тн\s?вэд|tnved|тнвэд|код товара|таможенный код|найди|дай|покажи|для|на/gi, "").trim();
}

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(date: Date) {
  const today = new Date();
  const diff = today.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Сегодня";
  if (days === 1) return "Вчера";
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function exportChat(chat: Chat) {
  const lines = [`# ${chat.title}`, `Дата: ${chat.createdAt.toLocaleDateString("ru-RU")}`, ""];
  chat.messages.forEach((m) => {
    lines.push(`**${m.role === "user" ? "Вы" : "Ассистент"}** [${formatTime(m.timestamp)}]`);
    lines.push(m.content);
    if (m.tnved?.results?.length) {
      lines.push("");
      lines.push("Коды ТН ВЭД:");
      m.tnved.results.forEach((r) => lines.push(`  ${r.code} — ${r.name}${r.group_name ? ` (${r.group_name})` : ""}`));
    }
    lines.push("");
  });
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${chat.title.replace(/\s+/g, "_")}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function TnvedCard({ data }: { data: TnvedData }) {
  if (!data.results?.length) {
    return (
      <div className="mt-3 p-3 rounded-xl border border-amber-100 bg-amber-50 text-sm text-amber-700">
        По запросу «{data.query}» коды ТН ВЭД не найдены. Попробуйте уточнить название товара.
      </div>
    );
  }
  return (
    <div className="mt-3 rounded-xl border border-gray-200 overflow-hidden bg-white">
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
        <Icon name="Package" size={13} className="text-gray-400" />
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          ТН ВЭД — «{data.query}»
        </span>
        <span className="ml-auto text-xs text-gray-400">alta.ru</span>
      </div>
      <div className="divide-y divide-gray-50">
        {data.results.map((r) => (
          <a
            key={r.code}
            href={`https://www.alta.ru/tnved/?search=${encodeURIComponent(data.query)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors group"
          >
            <span className="font-mono text-sm font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded-md flex-shrink-0 group-hover:bg-gray-200 transition-colors">
              {r.code}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800 capitalize leading-snug">{r.name}</p>
              {r.group_name && (
                <p className="text-xs text-gray-400 mt-0.5 truncate">{r.group_name}</p>
              )}
            </div>
            <Icon name="ExternalLink" size={12} className="text-gray-300 group-hover:text-gray-500 flex-shrink-0 mt-1 transition-colors" />
          </a>
        ))}
      </div>
      <div className="px-3 py-2 border-t border-gray-100">
        <a
          href={`https://www.alta.ru/tnved/?search=${encodeURIComponent(data.query)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-400 hover:text-gray-700 transition-colors flex items-center gap-1"
        >
          <Icon name="Search" size={11} />
          Открыть полный поиск на alta.ru
        </a>
      </div>
    </div>
  );
}

export default function Index() {
  const [chats, setChats] = useState<Chat[]>([
    {
      id: "welcome",
      title: "Добро пожаловать",
      createdAt: new Date(),
      messages: [
        {
          id: "w1",
          role: "assistant",
          content:
            "Привет! Я ваш ИИ-ассистент. Задайте любой вопрос — или спросите код ТН ВЭД для любого товара. Например: «Найди ТН ВЭД для ноутбука».",
          timestamp: new Date(),
        },
      ],
    },
  ]);
  const [activeChatId, setActiveChatId] = useState("welcome");
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>({ tone: "friendly", maxLength: "medium" });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeChat = chats.find((c) => c.id === activeChatId)!;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat?.messages, isTyping]);

  function createNewChat() {
    const chat: Chat = {
      id: generateId(),
      title: "Новый диалог",
      createdAt: new Date(),
      messages: [],
    };
    setChats((prev) => [chat, ...prev]);
    setActiveChatId(chat.id);
    setSettingsOpen(false);
  }

  function deleteChat(id: string) {
    const remaining = chats.filter((c) => c.id !== id);
    setChats(remaining);
    if (activeChatId === id) setActiveChatId(remaining[0]?.id || "");
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || isTyping) return;

    const userMsg: Message = {
      id: generateId(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== activeChatId) return c;
        return {
          ...c,
          title: c.messages.length === 0 ? text.slice(0, 45) : c.title,
          messages: [...c.messages, userMsg],
        };
      })
    );
    setInput("");
    setIsTyping(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    let tnvedData: TnvedData | undefined;
    let aiText = "";

    if (isTnvedQuery(text)) {
      const query = extractTnvedQuery(text);
      try {
        const resp = await fetch(TNVED_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });
        tnvedData = await resp.json();
        const count = tnvedData?.results?.length || 0;
        if (count > 0) {
          aiText = `Нашёл ${count} кодов ТН ВЭД для «${query}». Нажмите на код, чтобы открыть подробности на сайте Alta.ru.`;
        } else {
          aiText = `По запросу «${query}» ничего не найдено. Попробуйте уточнить название товара — например, укажите более конкретный термин.`;
        }
      } catch {
        aiText = "Не удалось получить данные с Alta.ru. Проверьте соединение и попробуйте снова.";
      }
    } else {
      await new Promise((r) => setTimeout(r, 1000 + Math.random() * 600));
      const base = DEMO_RESPONSES[settings.tone];
      const suffix =
        settings.maxLength === "long"
          ? " Давайте рассмотрим этот вопрос подробнее. Существует несколько важных аспектов, которые стоит учесть."
          : settings.maxLength === "short"
          ? ""
          : " Если нужны подробности — уточните вопрос.";
      aiText = base + suffix;
    }

    const aiMsg: Message = {
      id: generateId(),
      role: "assistant",
      content: aiText,
      timestamp: new Date(),
      tnved: tnvedData,
    };

    setChats((prev) =>
      prev.map((c) =>
        c.id === activeChatId ? { ...c, messages: [...c.messages, aiMsg] } : c
      )
    );
    setIsTyping(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function adjustTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }

  return (
    <div className="flex h-screen bg-white font-sans overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`flex flex-col border-r border-gray-100 bg-gray-50 transition-all duration-300 ${
          sidebarOpen ? "w-72" : "w-0 overflow-hidden"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <span className="font-semibold text-gray-900 text-sm tracking-wide">Диалоги</span>
          <button
            onClick={createNewChat}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition-colors"
            title="Новый диалог"
          >
            <Icon name="Plus" size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-2">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={`group flex items-start gap-2 px-3 py-2.5 rounded-xl mb-1 cursor-pointer transition-all animate-slide-in ${
                chat.id === activeChatId
                  ? "bg-white shadow-sm border border-gray-200"
                  : "hover:bg-white hover:shadow-sm"
              }`}
              onClick={() => { setActiveChatId(chat.id); setSettingsOpen(false); }}
            >
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-sm font-medium text-gray-800 truncate leading-tight">{chat.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{formatDate(chat.createdAt)}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); deleteChat(chat.id); }}
                className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-md hover:bg-red-50 text-gray-300 hover:text-red-400 transition-all mt-0.5 flex-shrink-0"
              >
                <Icon name="Trash2" size={13} />
              </button>
            </div>
          ))}
        </div>

        <div className="px-3 py-3 border-t border-gray-100 space-y-1">
          <div className="px-3 py-2 rounded-xl bg-blue-50 border border-blue-100">
            <p className="text-xs text-blue-600 font-medium flex items-center gap-1.5">
              <Icon name="Package" size={12} />
              ТН ВЭД поиск активен
            </p>
            <p className="text-xs text-blue-400 mt-0.5">Спросите код для любого товара</p>
          </div>
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all ${
              settingsOpen ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-200 hover:text-gray-800"
            }`}
          >
            <Icon name="Settings2" size={15} />
            <span className="font-medium">Настройки ИИ</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 bg-white">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <Icon name={sidebarOpen ? "PanelLeftClose" : "PanelLeftOpen"} size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-gray-900 truncate">
              {settingsOpen ? "Настройки" : activeChat?.title || ""}
            </h1>
            {!settingsOpen && (
              <p className="text-xs text-gray-400 leading-tight">
                {activeChat?.messages.length || 0} сообщений
              </p>
            )}
          </div>
          {!settingsOpen && activeChat?.messages.length > 0 && (
            <button
              onClick={() => exportChat(activeChat)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Icon name="Download" size={13} />
              Экспорт
            </button>
          )}
        </header>

        {settingsOpen ? (
          <div className="flex-1 overflow-y-auto px-8 py-10 animate-fade-in">
            <div className="max-w-lg mx-auto space-y-8">
              <div>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Тон общения</h2>
                <div className="grid grid-cols-3 gap-2">
                  {(["formal", "friendly", "concise"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setSettings((s) => ({ ...s, tone: t }))}
                      className={`py-3 px-4 rounded-xl text-sm font-medium border transition-all ${
                        settings.tone === t
                          ? "bg-gray-900 text-white border-gray-900"
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                      }`}
                    >
                      {TONE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Длина ответов</h2>
                <div className="grid grid-cols-3 gap-2">
                  {(["short", "medium", "long"] as const).map((l) => (
                    <button
                      key={l}
                      onClick={() => setSettings((s) => ({ ...s, maxLength: l }))}
                      className={`py-3 px-4 rounded-xl text-sm font-medium border transition-all ${
                        settings.maxLength === l
                          ? "bg-gray-900 text-white border-gray-900"
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                      }`}
                    >
                      {LENGTH_LABELS[l]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-xs text-gray-500 leading-relaxed">
                  <span className="font-semibold text-gray-700">Предпросмотр:</span>{" "}
                  {DEMO_RESPONSES[settings.tone]}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="max-w-2xl mx-auto space-y-6">
                {activeChat?.messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full min-h-64 animate-fade-in">
                    <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                      <Icon name="Sparkles" size={22} className="text-gray-400" />
                    </div>
                    <p className="text-gray-400 text-sm text-center">
                      Начните диалог — задайте любой вопрос<br />
                      или спросите <span className="font-medium text-gray-600">«ТН ВЭД для [товара]»</span>
                    </p>
                  </div>
                )}

                {activeChat?.messages.map((msg, i) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 animate-fade-in ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                    style={{ animationDelay: `${i * 0.02}s` }}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-semibold ${
                        msg.role === "user" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {msg.role === "user" ? "Вы" : <Icon name="Sparkles" size={14} />}
                    </div>
                    <div className={`flex flex-col gap-1 max-w-[82%] ${msg.role === "user" ? "items-end" : ""}`}>
                      <div
                        className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-gray-900 text-white rounded-tr-sm"
                            : "bg-gray-50 text-gray-800 border border-gray-100 rounded-tl-sm"
                        }`}
                      >
                        {msg.content}
                        {msg.tnved && <TnvedCard data={msg.tnved} />}
                      </div>
                      <span className="text-[11px] text-gray-300 px-1">{formatTime(msg.timestamp)}</span>
                    </div>
                  </div>
                ))}

                {isTyping && (
                  <div className="flex gap-3 animate-fade-in">
                    <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Icon name="Sparkles" size={14} className="text-gray-500" />
                    </div>
                    <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-gray-50 border border-gray-100">
                      <div className="flex gap-1 items-center h-5">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce"
                            style={{ animationDelay: `${i * 0.15}s` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="px-6 pb-6 pt-2">
              <div className="max-w-2xl mx-auto">
                <div className="flex items-end gap-3 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus-within:border-gray-400 focus-within:bg-white transition-all">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={input}
                    onChange={(e) => { setInput(e.target.value); adjustTextarea(); }}
                    onKeyDown={handleKeyDown}
                    placeholder="Напишите сообщение или «ТН ВЭД для [товара]»..."
                    className="flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none leading-relaxed min-h-[24px] max-h-[160px] font-sans"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() || isTyping}
                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex-shrink-0 mb-0.5"
                  >
                    <Icon name="ArrowUp" size={15} />
                  </button>
                </div>
                <p className="text-center text-[11px] text-gray-300 mt-2">
                  Enter — отправить · Shift+Enter — новая строка
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
