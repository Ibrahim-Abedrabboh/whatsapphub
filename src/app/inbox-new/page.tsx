import { SidebarLayout } from "@/components/layout/SidebarLayout";
import InboxClientNew from "@/components/InboxClientNew";

export const dynamic = "force-dynamic";

export default function InboxNewPage() {
  return (
    <SidebarLayout>
      <div className="inbox-new">
        <div className="inbox-new__header">
          <div>
            <h1 className="inbox-new__title">
              <span data-lang="ar">صندوق الوارد</span>
              <span data-lang="en">Inbox</span>
            </h1>
            <p className="inbox-new__subtitle">
              <span data-lang="ar">محادثات ثنائية الاتجاه. رد خلال ٢٤ ساعة</span>
              <span data-lang="en">Two-way conversations. Reply within 24 hours</span>
            </p>
          </div>
        </div>
        <InboxClientNew />
      </div>
    </SidebarLayout>
  );
}
