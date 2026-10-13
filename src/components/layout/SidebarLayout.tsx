'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SidebarLayoutProps {
  children: ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  labelAr: string;
  icon: string;
  badge?: number;
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', labelAr: 'لوحة التحكم', icon: '📊' },
  { href: '/inbox', label: 'Inbox', labelAr: 'صندوق الوارد', icon: '💬', badge: 12 },
  { href: '/contacts', label: 'Contacts', labelAr: 'جهات الاتصال', icon: '👥' },
  { href: '/broadcasts', label: 'Broadcasts', labelAr: 'البث', icon: '📢' },
  { href: '/templates', label: 'Templates', labelAr: 'القوالب', icon: '📄' },
  { href: '/campaigns', label: 'Campaigns', labelAr: 'الحملات', icon: '📅' },
  { href: '/analytics', label: 'Analytics', labelAr: 'التحليلات', icon: '📈' },
  { href: '/settings', label: 'Settings', labelAr: 'الإعدادات', icon: '⚙️' },
];

export function SidebarLayout({ children }: SidebarLayoutProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const isArabic = typeof document !== 'undefined' && document.documentElement.lang === 'ar';

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar__header">
          <Link href="/dashboard" className="nav__brand">
            <div className="nav__logo">🚀</div>
            <span>WhatsApp Hub</span>
          </Link>
        </div>

        <nav className="sidebar__nav">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}
                onClick={() => setIsOpen(false)}
              >
                <span className="sidebar__item-icon">{item.icon}</span>
                <span>{isArabic ? item.labelAr : item.label}</span>
                {item.badge && (
                  <span className="sidebar__item-badge">{item.badge}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar__footer">
          <div className="connection-status connection-status--online">
            <span className="connection-status__dot" />
            <span>{isArabic ? 'متصل' : 'Connected'}</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="layout__main">
        {/* Mobile Menu Button */}
        <button
          className="btn btn--ghost btn--icon"
          onClick={() => setIsOpen(!isOpen)}
          style={{ position: 'fixed', top: '16px', left: '16px', zIndex: 300 }}
          aria-label="Toggle menu"
        >
          ☰
        </button>

        <div className="layout__content">
          {children}
        </div>
      </main>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 150,
            display: 'none',
          }}
          className="mobile-overlay"
        />
      )}

      <style jsx>{`
        @media (max-width: 1024px) {
          .mobile-overlay {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}
