import Nav from "@/components/Nav";
import OrdersManager from "@/components/OrdersManager";

export const dynamic = "force-dynamic";

export default function OrdersPage() {
  return (
    <>
      <Nav />
      <main className="app">
        <h1>Orders</h1>
        <p className="note" style={{ marginBottom: 16 }}>
          Carts your customers place from the WhatsApp catalog. Moving an order forward messages the customer
          (when the 24-hour service window allows); cancellation is possible until it ships.
        </p>
        <OrdersManager />
      </main>
    </>
  );
}
