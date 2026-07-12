import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import LangToggle from "@/components/LangToggle";
import ChatbotHowItWorks from "@/components/ChatbotHowItWorks";
import { Icon, type IconKey } from "@/components/icons";

// Public marketing page for the no-code Chatbot builder — same "dk" landing
// theme, bilingual EN/AR (CSS shows one based on <html lang>). Stays outside
// auth (middleware allows pathname === "/chatbots"). The in-app builder lives
// at /chatbot (behind login).
export const dynamic = "force-static";

function T({ en, ar }: { en: string; ar: string }) {
  return (
    <>
      <span data-lang="en">{en}</span>
      <span data-lang="ar">{ar}</span>
    </>
  );
}

type Bi = { en: string; ar: string };

const FEATURES: { key: IconKey; n: string; lead?: boolean; title: Bi; body: Bi }[] = [
  { key: "repeat", n: "01", lead: true, title: { en: "Visual drag-and-drop", ar: "بناء بالسحب والإفلات" },
    body: { en: "Compose the whole flow from blocks — no code. Reorder steps by dragging, nest branches inside.",
      ar: "ابنِ المسار كاملًا من لبنات — بدون برمجة. أعِد الترتيب بالسحب، وضَع التفرّعات بالداخل." } },
  { key: "star", n: "02", title: { en: "AI answers from your docs", ar: "إجابات ذكاء من مستنداتك" },
    body: { en: "An AI step replies grounded in the documents you uploaded to AI Knowledge.",
      ar: "خطوة ذكاء اصطناعي تُجيب اعتمادًا على المستندات التي رفعتها إلى معرفة الذكاء." } },
  { key: "shield", n: "03", title: { en: "Autonomous AI agent", ar: "وكيل ذكاء اصطناعي مستقل" },
    body: { en: "Hand a conversation to an AI agent that answers follow-ups and knows when it's done.",
      ar: "سلّم المحادثة لوكيل ذكاء يُجيب عن الأسئلة المتابِعة ويعرف متى انتهى." } },
  { key: "signal", n: "04", title: { en: "Every inbox channel", ar: "كل قنوات الوارد" },
    body: { en: "One bot replies across WhatsApp, Instagram DM, and Messenger.",
      ar: "بوت واحد يردّ عبر واتساب وإنستغرام وماسنجر." } },
  { key: "menu", n: "05", title: { en: "Fires from automation", ar: "ينطلق من الأتمتة" },
    body: { en: "Assign a saved bot to a keyword or away-hours trigger — it launches itself.",
      ar: "اربط بوتًا محفوظًا بكلمة مفتاحية أو ساعات غياب — ويعمل تلقائيًا." } },
  { key: "log", n: "06", title: { en: "Replies 24/7", ar: "ردود على مدار الساعة" },
    body: { en: "Your bot keeps the conversation going even when your team is offline.",
      ar: "يُبقي بوتك المحادثة مستمرة حتى عندما يكون فريقك خارج الخدمة." } },
];

export default function ChatbotMarketing() {
  return (
    <main className="dk">
      <div className="dk-wrap">
        <header className="dk-nav reveal">
          <div className="brand">
            <span className="mark" aria-hidden />
            <span><span className="b1">whatsapp</span><span className="b2">hub</span></span>
          </div>
          <nav className="dk-nav__links">
            <a href="#how"><T en="How it works" ar="كيف تعمل" /></a>
            <a href="#features"><T en="Features" ar="المزايا" /></a>
            <Link href="/"><T en="Home" ar="الرئيسية" /></Link>
          </nav>
          <div className="dk-nav__right">
            <LangToggle />
            <ThemeToggle />
            <Link href="/chatbot" className="dk-cta" data-test-id="chatbot-cta"><T en="Open builder" ar="افتح المُنشئ" /></Link>
          </div>
        </header>

        <section className="dk-hero">
          <h1 className="dk-h1 reveal d1">
            <span data-lang="en">Build a <span className="em">WhatsApp chatbot</span> 🤖<br /><span className="sub">no code, just drag &amp; drop</span></span>
            <span data-lang="ar">أنشئ <span className="em">بوت واتساب</span> 🤖<br /><span className="sub">بدون برمجة، فقط بالسحب والإفلات</span></span>
          </h1>
          <p className="dk-lead reveal d2">
            <T
              en="Design a conversation from blocks, ground it in your own documents, and let it reply around the clock across every inbox channel."
              ar="صمّم محادثة من لبنات، وادعمها بمستنداتك الخاصة، ودعها تردّ على مدار الساعة عبر كل قنوات الوارد."
            />
          </p>
          <div className="dk-actions reveal d3">
            <Link href="/chatbot" className="dk-btn dk-btn--primary" data-test-id="chatbot-hero-cta"><T en="Start building" ar="ابدأ البناء" /></Link>
            <a href="#how" className="dk-btn dk-btn--ghost"><T en="See how it works" ar="شاهد كيف تعمل" /></a>
          </div>
          <div className="dk-pop reveal d4">
            <span><T en="Includes:" ar="يشمل:" /></span>
            <a className="dk-chip" href="#how"><T en="Drag & drop" ar="سحب وإفلات" /></a>
            <a className="dk-chip" href="#features"><T en="AI agent" ar="وكيل ذكاء" /></a>
            <a className="dk-chip" href="#features"><T en="All channels" ar="كل القنوات" /></a>
          </div>
        </section>

        <section id="how" className="dk-features">
          <div className="dk-features__head">
            <h2><T en="How it works" ar="كيف تعمل" /> <span className="sub"><T en="in four steps" ar="في أربع خطوات" /></span></h2>
            <p><T en="From trigger to live bot — no developer needed." ar="من المُحفِّز إلى بوت يعمل — دون الحاجة لمطوّر." /></p>
          </div>
          <ChatbotHowItWorks />
        </section>

        <section id="features" className="dk-features">
          <div className="dk-features__head">
            <h2><T en="Everything the bot can do" ar="كل ما يفعله البوت" /></h2>
            <p><T en="Blocks, AI, and automation — working together." ar="لبنات وذكاء اصطناعي وأتمتة — تعمل معًا." /></p>
          </div>
          <div className="dk-feats">
            {FEATURES.map((f) => (
              <article key={f.key} className={f.lead ? "dk-feat dk-feat--lead" : "dk-feat"}>
                <div className="dk-feat__head">
                  <span className="dk-feat__n">{f.n}</span>
                  <Icon name={f.key} className="dk-feat__ic" />
                </div>
                <h3><T en={f.title.en} ar={f.title.ar} /></h3>
                <p><T en={f.body.en} ar={f.body.ar} /></p>
              </article>
            ))}
          </div>
        </section>

        <section className="dk-final">
          <h2><T en="Build your first chatbot today." ar="أنشئ أول بوت لك اليوم." /></h2>
          <Link href="/chatbot" className="dk-btn dk-btn--primary"><T en="Open the builder" ar="افتح المُنشئ" /></Link>
        </section>

        <footer className="dk-foot">
          <span><T en="© NazzilVideo · WhatsApp Hub" ar="© NazzilVideo · مركز واتساب" /></span>
          <span style={{ display: "inline-flex", gap: 18 }}>
            <Link href="/"><T en="Home" ar="الرئيسية" /></Link>
            <Link href="/login"><T en="Log in" ar="تسجيل الدخول" /></Link>
          </span>
        </footer>
      </div>
    </main>
  );
}
