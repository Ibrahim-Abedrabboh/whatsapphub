"use client";

import { useEffect, useState, type ReactNode } from "react";

interface Tab { id: string; label: string; content: ReactNode }

/**
 * Pill-style tabs for the settings page. Panels stay mounted (hidden, not
 * unmounted) so each manager keeps its fetched state when switching tabs.
 * The active tab is mirrored into the URL hash so it survives reload and
 * can be deep-linked (/settings#automation).
 */
export default function SettingsTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");

  useEffect(() => {
    const fromHash = window.location.hash.slice(1);
    if (tabs.some((t) => t.id === fromHash)) setActive(fromHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function select(id: string) {
    setActive(id);
    history.replaceState(null, "", `#${id}`);
  }

  return (
    <div>
      <div role="tablist" aria-label="Settings sections" style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0 20px" }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            data-test-id={`settings-tab-${t.id}`}
            aria-selected={active === t.id}
            className={`pill${active === t.id ? " is-active" : ""}`}
            onClick={() => select(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" hidden={active !== t.id}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
