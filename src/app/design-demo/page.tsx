'use client';

import { SidebarLayout } from '@/components/layout/SidebarLayout';
import { Button, Card, StatCard, EmptyState, LoadingSkeleton } from '@/components/ui';

export default function DesignSystemDemo() {
  return (
    <SidebarLayout>
      <div style={{ padding: 'var(--space-6)' }}>
        <h1 style={{ marginBottom: 'var(--space-6)' }}>
          WhatsApp Hub - Design System Demo
        </h1>

        {/* Stats Section */}
        <section style={{ marginBottom: 'var(--space-10)' }}>
          <h2 style={{ marginBottom: 'var(--space-4)' }}>Stat Cards</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--space-4)' }}>
            <StatCard
              icon="📊"
              value="12,450"
              label="Total Messages"
              trend={{ value: 12, direction: 'up' }}
            />
            <StatCard
              icon="✅"
              value="11,890"
              label="Delivered"
              trend={{ value: 8.5, direction: 'up' }}
            />
            <StatCard
              icon="👁️"
              value="9,234"
              label="Read"
              trend={{ value: 15, direction: 'up' }}
            />
            <StatCard
              icon="💬"
              value="234"
              label="Active Conversations"
              trend={{ value: 23, direction: 'up' }}
            />
          </div>
        </section>

        {/* Buttons Section */}
        <section style={{ marginBottom: 'var(--space-10)' }}>
          <h2 style={{ marginBottom: 'var(--space-4)' }}>Buttons</h2>
          <Card>
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
              <Button variant="primary">Primary Button</Button>
              <Button variant="secondary">Secondary Button</Button>
              <Button variant="ghost">Ghost Button</Button>
              <Button variant="danger">Danger Button</Button>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <Button variant="primary" size="sm">Small</Button>
              <Button variant="primary" size="md">Medium</Button>
              <Button variant="primary" size="lg">Large</Button>
            </div>
          </Card>
        </section>

        {/* Cards Section */}
        <section style={{ marginBottom: 'var(--space-10)' }}>
          <h2 style={{ marginBottom: 'var(--space-4)' }}>Cards</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
            <Card>
              <h3>Default Card</h3>
              <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-2)' }}>
                This is a default card with standard styling.
              </p>
            </Card>
            <Card variant="elevated">
              <h3>Elevated Card</h3>
              <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-2)' }}>
                This card has elevation with a shadow effect.
              </p>
            </Card>
            <Card variant="glass">
              <h3>Glass Card</h3>
              <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-2)' }}>
                This card has a glassmorphism effect.
              </p>
            </Card>
          </div>
        </section>

        {/* Loading Skeletons */}
        <section style={{ marginBottom: 'var(--space-10)' }}>
          <h2 style={{ marginBottom: 'var(--space-4)' }}>Loading Skeletons</h2>
          <Card>
            <LoadingSkeleton type="title" />
            <LoadingSkeleton type="text" count={3} />
            <div style={{ marginTop: 'var(--space-4)' }}>
              <LoadingSkeleton type="card" />
            </div>
          </Card>
        </section>

        {/* Empty State */}
        <section style={{ marginBottom: 'var(--space-10)' }}>
          <h2 style={{ marginBottom: 'var(--space-4)' }}>Empty State</h2>
          <Card>
            <EmptyState
              icon="📭"
              title="No Messages Yet"
              description="When customers message you, they'll appear here. Start by connecting your WhatsApp account."
              primaryAction={{
                label: 'Connect WhatsApp',
                onClick: () => console.log('Connect WhatsApp'),
              }}
              secondaryAction={{
                label: 'Learn More',
                onClick: () => console.log('Learn More'),
              }}
            />
          </Card>
        </section>

        {/* Badges */}
        <section style={{ marginBottom: 'var(--space-10)' }}>
          <h2 style={{ marginBottom: 'var(--space-4)' }}>Badges</h2>
          <Card>
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <span className="badge badge--success">Delivered</span>
              <span className="badge badge--warning">Pending</span>
              <span className="badge badge--error">Failed</span>
              <span className="badge badge--info">Sending</span>
              <span className="badge badge--neutral">Draft</span>
            </div>
          </Card>
        </section>
      </div>
    </SidebarLayout>
  );
}
