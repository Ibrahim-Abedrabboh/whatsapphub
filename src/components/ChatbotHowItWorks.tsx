"use client";
import { useEffect, useState } from "react";
import { Icon, type IconKey } from "@/components/icons";

// Auto-playing "How it works" slider for the /chatbots marketing page. Four
// steps, prev/next arrows + dots, pauses on hover, honours reduced-motion.
// Bilingual via the same data-lang spans the landing uses (CSS shows one).
type Bi = { en: string; ar: string };

const STEPS: { n: string; icon: IconKey; title: Bi; body: Bi }[] = [
  {
    n: "01", icon: "signal",
    title: { en: "Pick a trigger", ar: "اختر المُحفِّز" },
    body: {
      en: "Start your bot on a keyword, or when a customer messages outside business hours.",
      ar: "ابدأ البوت عند كلمة مفتاحية، أو عند مراسلة العميل خارج ساعات العمل.",
    },
  },
  {
    n: "02", icon: "repeat",
    title: { en: "Drag your steps", ar: "اسحب خطواتك" },
    body: {
      en: "Build the conversation by dragging blocks — send a message, ask a question, branch on the reply.",
      ar: "ابنِ المحادثة بسحب اللبنات — أرسِل رسالة، اطرح سؤالًا، تفرّع حسب الرد.",
    },
  },
  {
    n: "03", icon: "star",
    title: { en: "Add AI knowledge", ar: "أضِف معرفة الذكاء الاصطناعي" },
    body: {
      en: "Drop in an AI step that answers from your uploaded documents, or hand off to an autonomous AI agent.",
      ar: "أضِف خطوة ذكاء اصطناعي تُجيب من مستنداتك المرفوعة، أو سلّم لوكيل ذكاء اصطناعي مستقل.",
    },
  },
  {
    n: "04", icon: "shield",
    title: { en: "Publish & go live", ar: "انشر وابدأ التشغيل" },
    body: {
      en: "Save, assign it to a trigger, and your bot replies 24/7 across WhatsApp, Instagram, and Messenger.",
      ar: "احفظ، واربطه بمُحفِّز، ويردّ بوتك على مدار الساعة عبر واتساب وإنستغرام وماسنجر.",
    },
  },
];

function T({ en, ar }: Bi) {
  return (
    <>
      <span data-lang="en">{en}</span>
      <span data-lang="ar">{ar}</span>
    </>
  );
}

export default function ChatbotHowItWorks() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = STEPS.length;
  const go = (k: number) => setI(((k % n) + n) % n);

  useEffect(() => {
    if (paused) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((p) => (p + 1) % n), 4500);
    return () => clearInterval(t);
  }, [paused, n]);

  return (
    <div className="dk-steps" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="dk-steps__viewport">
        <div className="dk-steps__track" style={{ transform: `translateX(-${i * 100}%)` }}>
          {STEPS.map((s, k) => (
            <article className="dk-steps__slide" key={s.n} aria-hidden={k !== i}>
              <span className="dk-steps__n">{s.n}</span>
              <Icon name={s.icon} className="dk-steps__ic" width={30} height={30} />
              <h3 className="dk-steps__title"><T en={s.title.en} ar={s.title.ar} /></h3>
              <p className="dk-steps__body"><T en={s.body.en} ar={s.body.ar} /></p>
            </article>
          ))}
        </div>
      </div>
      <div className="dk-steps__nav">
        <button type="button" className="dk-steps__arrow" onClick={() => go(i - 1)} aria-label="Previous step">‹</button>
        <div className="dk-steps__dots">
          {STEPS.map((s, k) => (
            <button
              key={s.n} type="button" className="dk-dot"
              aria-current={k === i} aria-label={`Go to step ${k + 1}`}
              onClick={() => go(k)}
            />
          ))}
        </div>
        <button type="button" className="dk-steps__arrow" onClick={() => go(i + 1)} aria-label="Next step">›</button>
      </div>
    </div>
  );
}
