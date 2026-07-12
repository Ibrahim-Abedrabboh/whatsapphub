import Nav from "@/components/Nav";
import GrowthTools from "@/components/GrowthTools";

export const dynamic = "force-dynamic";

export default function GrowthPage() {
  return (
    <>
      <Nav />
      <main className="app">
        <h1>Growth</h1>
        <p className="note" style={{ marginBottom: 16 }}>
          Turn your WhatsApp number into ways for customers to reach you: a click-to-chat <strong>link</strong>, a
          printable <strong>QR code</strong>, and a copy-paste <strong>website button</strong>. Enter your number and
          (optionally) a first message they&apos;ll see pre-filled.
        </p>
        <GrowthTools />
      </main>
    </>
  );
}
