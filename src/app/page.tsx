import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import LangToggle from "@/components/LangToggle";
import LeadForm from "@/components/LeadForm";
import { Icon, type IconKey } from "@/components/icons";

// Public marketing landing — "Dockit"-style docs layout in a WhatsApp-green
// palette. Bilingual EN/AR (CSS shows one based on <html lang>). Stays outside
// auth (middleware allows pathname === "/").
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
  { key: "menu", n: "01", lead: true, title: { en: "Send Menu", ar: "إرسال القائمة" },
    body: { en: "Send your menu as an approved template to one number or a whole list — the fastest way to get an order started.",
      ar: "أرسِل قائمة الطعام كرسالة قالب معتمدة لرقم أو قائمة أرقام — أسرع طريقة لبدء الطلب." } },
  { key: "star", n: "02", title: { en: "Request Feedback", ar: "طلب تقييم" },
    body: { en: "Ask for the customer's review after their order with a ready-made message.",
      ar: "اطلب رأي العميل بعد الطلب برسالة جاهزة." } },
  { key: "signal", n: "03", title: { en: "Delivery Status", ar: "حالة التسليم" },
    body: { en: "Track sent · delivered · read · clicked for every message, live.",
      ar: "تابِع: أُرسِلت · وصلت · قُرئت · نُقِر — لكل رسالة لحظيًا." } },
  { key: "log", n: "04", title: { en: "Message Log", ar: "سجل الإرسال" },
    body: { en: "Review every sent message with its timestamp and status.",
      ar: "راجِع كل رسالة مُرسَلة مع التوقيت والحالة." } },
  { key: "shield", n: "05", title: { en: "Consent Management", ar: "إدارة الموافقات" },
    body: { en: "Opted-in numbers only, with the opt-in date on record.",
      ar: "أرقام بموافقة مسبقة فقط، مع توثيق التاريخ." } },
  { key: "repeat", n: "06", title: { en: "Recurring Campaigns", ar: "حملات متكرّرة" },
    body: { en: "Schedule sends on a cron — the worker fans them out on time.",
      ar: "جدوِل الإرسال وفق توقيت محدّد، ويتولّى العامل التوزيع في موعده." } },
];

export default function Landing() {
  return (
    <main className="dk">
      <div className="dk-wrap">
        <header className="dk-nav reveal">
          <div className="brand">
            <span className="mark" aria-hidden />
            <span><span className="b1">whatsapp</span><span className="b2">hub</span></span>
          </div>
          <nav className="dk-nav__links">
            <a href="/tutorial.html"><T en="How it works" ar="كيف تعمل" /></a>
            <Link href="/dashboard"><T en="Dashboard" ar="لوحة التحكم" /></Link>
          </nav>
          <div className="dk-nav__right">
            <LangToggle />
            <ThemeToggle />
            <Link href="/login" className="dk-cta" data-test-id="landing-login"><T en="Log in" ar="تسجيل الدخول" /></Link>
          </div>
        </header>

        <section className="dk-hero">
          <h1 className="dk-h1 reveal d1">
            <span data-lang="en"><span className="em">WhatsApp</span> 💬 messaging<br /><span className="sub">your customers love</span></span>
            <span data-lang="ar">رسائل <span className="em">واتساب</span> 💬<br /><span className="sub">يحبّها عملاؤك</span></span>
          </h1>
          <p className="dk-lead reveal d2">
            <T
              en="Send menus and feedback requests to your customers, and track the status of every message — sent, delivered, read — from one place."
              ar="أرسِل قوائم الطعام وطلبات التقييم لعملائك، وتابِع حالة كل رسالة — أُرسِلت، وصلت، قُرئت — من مكان واحد."
            />
          </p>
          <div className="dk-actions reveal d3">
            <Link href="/login" className="dk-btn dk-btn--primary" data-test-id="landing-cta"><T en="Open the hub" ar="افتح المركز" /></Link>
            <a href="#features" className="dk-btn dk-btn--ghost"><T en="See features" ar="شاهد المزايا" /></a>
          </div>
          <div className="dk-pop reveal d4">
            <span><T en="Popular:" ar="الأكثر استخدامًا:" /></span>
            <a className="dk-chip" href="#features"><T en="Send menu" ar="إرسال القائمة" /></a>
            <a className="dk-chip" href="#features"><T en="Request feedback" ar="طلب تقييم" /></a>
            <a className="dk-chip" href="#features"><T en="Delivery status" ar="حالة التسليم" /></a>
            <a className="dk-chip" href="/login"><T en="Templates" ar="القوالب" /></a>
          </div>
        </section>

        <section id="features" className="dk-features">
          <div className="dk-features__head">
            <h2><T en="Everything you need" ar="كل ما تحتاجه" /> <span className="sub"><T en="on WhatsApp" ar="على واتساب" /></span></h2>
            <p><T en="From sending the menu to delivery receipts — managed from one place."
              ar="من إرسال القائمة حتى إيصالات التسليم — من مكان واحد." /></p>
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

        <section id="get-started" className="dk-getstarted">
          <div className="dk-features__head">
            <h2><T en="Get started" ar="ابدأ الآن" /> <span className="sub"><T en="in one message" ar="برسالة واحدة" /></span></h2>
            <p><T en="Leave your number and we'll message you on WhatsApp." ar="اترك رقمك وسنراسلك على واتساب." /></p>
          </div>
          <LeadForm />
        </section>

        <section className="dk-final">
          <h2><T en="Start sending from your WhatsApp Hub." ar="ابدأ الإرسال من مركز واتساب." /></h2>
          <Link href="/login" className="dk-btn dk-btn--primary"><T en="Open the hub" ar="افتح المركز" /></Link>
        </section>

        <footer className="dk-foot">
          <span><T en="© NazzilVideo · WhatsApp Hub" ar="© NazzilVideo · مركز واتساب" /></span>
          <span style={{ display: "inline-flex", gap: 18 }}>
            <a href="/tutorial.html"><T en="Tutorial" ar="الدليل التفاعلي" /></a>
            <Link href="/login"><T en="Log in" ar="تسجيل الدخول" /></Link>
          </span>
        </footer>
      </div>
    </main>
  );
}
