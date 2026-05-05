import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Order, InvoiceData, TrackingEntry } from '../types/order';
import { apiService } from '../services/api';
import { useAuth } from '../hooks/useAuth';

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_TABS = ['all', 'pending', 'confirmed', 'processing', 'shipped', 'out-for-delivery', 'delivered', 'cancelled'];

const STATUS_COLORS: Record<string, string> = {
  pending:           'bg-yellow-100 text-yellow-800',
  confirmed:         'bg-blue-100 text-blue-800',
  processing:        'bg-purple-100 text-purple-800',
  shipped:           'bg-indigo-100 text-indigo-800',
  'out-for-delivery':'bg-orange-100 text-orange-800',
  delivered:         'bg-green-100 text-green-800',
  cancelled:         'bg-red-100 text-red-800',
  returned:          'bg-gray-100 text-gray-800',
};

const STATUS_ICONS: Record<string, string> = {
  pending:           '⏳',
  confirmed:         '✅',
  processing:        '🔄',
  shipped:           '📦',
  'out-for-delivery':'🚚',
  delivered:         '🎉',
  cancelled:         '❌',
  returned:          '↩️',
};

const TRACKER_STEPS = ['pending', 'confirmed', 'processing', 'shipped', 'out-for-delivery', 'delivered'];

const UPI_APPS = [
  { id: 'phonepe',   name: 'PhonePe',    color: '#6739B7', emoji: '💜' },
  { id: 'gpay',      name: 'Google Pay', color: '#4285F4', emoji: '🔵' },
  { id: 'paytm',     name: 'Paytm',      color: '#00B9F1', emoji: '💙' },
  { id: 'amazonpay', name: 'Amazon Pay', color: '#FF9900', emoji: '🟠' },
  { id: 'bhim',      name: 'BHIM UPI',   color: '#183E6B', emoji: '🔷' },
  { id: 'other',     name: 'Other UPI',  color: '#4CAF50', emoji: '🟢' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

// ─── Sub-components ──────────────────────────────────────────────────────────

// Status tracker bar shown on each order card
function StatusTracker({ status }: { status: string }) {
  if (status === 'cancelled' || status === 'returned') return null;
  const cur = TRACKER_STEPS.indexOf(status);
  return (
    <div className="px-6 py-4 border-b bg-gray-50">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Order Progress</p>
      <div className="flex items-center">
        {TRACKER_STEPS.map((step, i) => (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold z-10
                ${i < cur  ? 'bg-green-500 text-white'
                : i === cur ? 'bg-blue-600 text-white'
                :             'bg-gray-200 text-gray-400'}`}>
                {i < cur ? '✓' : i + 1}
              </div>
              <span className={`text-[9px] mt-1 text-center leading-tight w-14
                ${i < cur  ? 'text-green-600 font-medium'
                : i === cur ? 'text-blue-600 font-semibold'
                :             'text-gray-400'}`}>
                {step.replace('-', ' ')}
              </span>
            </div>
            {i < TRACKER_STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mb-4 ${i < cur ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Modal wrapper
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center px-6 py-4 border-b sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ── View Details Modal ────────────────────────────────────────────────────────
function DetailsModal({ order, onClose, onOpenInvoice, onOpenPayment }: {
  order: Order;
  onClose: () => void;
  onOpenInvoice: () => void;
  onOpenPayment: () => void;
}) {
  const [tracking, setTracking] = useState<TrackingEntry[]>([]);

  useEffect(() => {
    apiService.getOrderTracking(order._id)
      .then((r: any) => setTracking(r.tracking?.history || []))
      .catch(() => {});
  }, [order._id]);

  return (
    <Modal title={`Order #${order.orderNumber}`} onClose={onClose}>
      {/* Summary grid */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {[
          ['Order Date',   formatDate(order.createdAt)],
          ['Status',       order.orderStatus.replace(/-/g, ' ')],
          ['Total',        `₹${order.invoiceAmount?.toFixed(2) ?? order.finalAmount.toFixed(2)}`],
          ['Payment',      order.paymentStatus],
          ['Pay Method',   order.paymentMethod || '—'],
          ['Items',        `${order.items.length} item${order.items.length > 1 ? 's' : ''}`],
        ].map(([label, val]) => (
          <div key={label} className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-0.5">{label}</p>
            <p className="text-sm font-semibold text-gray-800 capitalize">{val}</p>
          </div>
        ))}
      </div>

      {/* Tracking number */}
      {order.trackingNumber && (
        <div className="bg-blue-50 rounded-xl p-3 mb-4">
          <p className="text-xs text-blue-500">Tracking Number</p>
          <p className="text-sm font-semibold text-blue-800">{order.trackingNumber}</p>
        </div>
      )}

      {/* Cancellation reason */}
      {order.cancellationReason && (
        <div className="bg-red-50 rounded-xl p-3 mb-4">
          <p className="text-xs text-red-400">Cancellation Reason</p>
          <p className="text-sm font-medium text-red-700">{order.cancellationReason}</p>
        </div>
      )}

      {/* Items */}
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Items Ordered</p>
      <div className="space-y-2 mb-4">
        {order.items.map((item, i) => (
          <div key={i} className="flex items-center gap-3 p-2 rounded-lg border border-gray-100">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center text-xl flex-shrink-0">
              {item.emoji || '🌿'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
              <p className="text-xs text-gray-400">{item.quantity} {item.unit} × ₹{item.price.toFixed(2)}</p>
            </div>
            <p className="text-sm font-semibold text-gray-800">₹{(item.price * item.quantity).toFixed(2)}</p>
          </div>
        ))}
      </div>

      {/* Delivery address */}
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Delivery Address</p>
      <div className="bg-gray-50 rounded-xl p-3 mb-4 text-sm text-gray-700 leading-relaxed">
        {order.deliveryAddress.street}, {order.deliveryAddress.city},<br />
        {order.deliveryAddress.state} – {order.deliveryAddress.pincode}
        {order.deliveryAddress.landmark && <><br />Near: {order.deliveryAddress.landmark}</>}
      </div>

      {/* Tracking timeline */}
      {tracking.length > 0 && (
        <>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Timeline</p>
          <div className="space-y-2 mb-4">
            {[...tracking].reverse().map((entry, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0
                    ${i === 0 ? 'bg-green-500' : 'bg-gray-300'}`} />
                  {i < tracking.length - 1 && <div className="w-0.5 flex-1 bg-gray-200 mt-1" />}
                </div>
                <div className="pb-3">
                  <p className="text-xs font-semibold text-gray-700 capitalize">{entry.status.replace(/-/g, ' ')}</p>
                  <p className="text-xs text-gray-400">{entry.message}</p>
                  <p className="text-xs text-gray-300">{formatDate(entry.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap pt-2 border-t">
        <button onClick={onOpenInvoice}
          className="flex-1 bg-green-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-green-700 transition-colors">
          ⬇ Invoice
        </button>
        {order.paymentStatus === 'pending' && order.orderStatus !== 'cancelled' && (
          <button onClick={onOpenPayment}
            className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
            Pay Now
          </button>
        )}
      </div>
    </Modal>
  );
}

// ── Invoice Modal ─────────────────────────────────────────────────────────────
function InvoiceModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiService.getInvoice(orderId)
      .then((r: any) => setInvoice(r.invoiceData))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orderId]);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Invoice</title>
      <style>
        body{font-family:sans-serif;padding:24px;color:#111}
        table{width:100%;border-collapse:collapse;margin:12px 0}
        th,td{border:1px solid #ddd;padding:8px;font-size:12px}
        th{background:#f5f5f5}
        .total{font-weight:700;font-size:14px}
      </style></head>
      <body>${content}</body></html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <Modal title="Invoice" onClose={onClose}>
      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading invoice...</div>
      ) : !invoice ? (
        <div className="text-center py-8 text-red-400">Failed to load invoice.</div>
      ) : (
        <>
          <div ref={printRef}>
            {/* Invoice header */}
            <div className="flex items-center gap-2 mb-5">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-xl">🌿</div>
              <div>
                <p className="font-bold text-green-700 text-base">FarmDirect</p>
                <p className="text-xs text-gray-400">Fresh from Farm to You</p>
              </div>
            </div>

            <div className="flex justify-between mb-4">
              <div>
                <p className="text-xs text-gray-400">Invoice No.</p>
                <p className="text-sm font-semibold">{invoice.invoiceNumber || `INV-${invoice.orderNumber}`}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Date</p>
                <p className="text-sm font-semibold">{formatDate(invoice.invoiceDate)}</p>
              </div>
            </div>

            <hr className="my-3" />

            {/* Bill To */}
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Bill To</p>
              <p className="text-sm font-medium">{invoice.customerName}</p>
              <p className="text-xs text-gray-500">{invoice.customerEmail}</p>
              {invoice.customerPhone && <p className="text-xs text-gray-500">{invoice.customerPhone}</p>}
              <p className="text-xs text-gray-500 mt-1">
                {invoice.deliveryAddress.street}, {invoice.deliveryAddress.city},&nbsp;
                {invoice.deliveryAddress.state} – {invoice.deliveryAddress.pincode}
              </p>
            </div>

            {/* Items table */}
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Items</p>
            <table className="w-full text-xs mb-4 border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-2 border border-gray-200">Item</th>
                  <th className="p-2 border border-gray-200">Qty</th>
                  <th className="p-2 border border-gray-200">Rate</th>
                  <th className="text-right p-2 border border-gray-200">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="p-2 border border-gray-200">{item.emoji || ''} {item.name}</td>
                    <td className="p-2 border border-gray-200 text-center">{item.quantity} {item.unit}</td>
                    <td className="p-2 border border-gray-200 text-center">₹{item.price.toFixed(2)}</td>
                    <td className="p-2 border border-gray-200 text-right">₹{(item.price * item.quantity).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>₹{invoice.subtotal.toFixed(2)}</span></div>
              {invoice.discountAmount > 0 && (
                <div className="flex justify-between text-green-600"><span>Discount</span><span>−₹{invoice.discountAmount.toFixed(2)}</span></div>
              )}
              <div className="flex justify-between"><span className="text-gray-500">Delivery</span><span>{invoice.deliveryCharge === 0 ? 'Free' : `₹${invoice.deliveryCharge.toFixed(2)}`}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">GST ({invoice.gstPercent}%)</span><span>₹{invoice.gstAmount.toFixed(2)}</span></div>
              <div className="flex justify-between pt-2 border-t font-semibold text-base">
                <span>Total</span>
                <span className="text-green-700">₹{invoice.invoiceAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment status */}
            <div className="mt-4 p-3 rounded-xl border text-center">
              <p className="text-xs text-gray-400 mb-1">Payment Status</p>
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                invoice.paymentStatus === 'paid' ? 'bg-green-100 text-green-700'
                : invoice.paymentStatus === 'refunded' ? 'bg-blue-100 text-blue-700'
                : 'bg-yellow-100 text-yellow-700'
              }`}>
                {invoice.paymentStatus.toUpperCase()}
              </span>
              {invoice.paidAt && (
                <p className="text-xs text-gray-400 mt-1">Paid on {formatDate(invoice.paidAt)}</p>
              )}
            </div>

            <p className="text-center text-xs text-gray-400 mt-4">
              Thank you for shopping with FarmDirect 🌿<br />
              support@farmdirect.com
            </p>
          </div>

          {/* Buttons outside print area */}
          <div className="flex gap-2 mt-5 pt-4 border-t">
            <button onClick={handlePrint}
              className="flex-1 bg-green-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-green-700 transition-colors">
              🖨 Print / Save PDF
            </button>
            <button onClick={onClose}
              className="flex-1 border border-gray-200 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
              Close
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ── Payment Modal ─────────────────────────────────────────────────────────────
function PaymentModal({ order, onClose, onSuccess }: {
  order: Order;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [method, setMethod]       = useState<'cod' | 'upi' | null>(null);
  const [upiApp, setUpiApp]       = useState<string | null>(null);
  const [step, setStep]           = useState<'select' | 'success'>('select');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const amount = order.invoiceAmount ?? order.finalAmount;

  const handleCOD = async () => {
    try {
      setLoading(true); setError('');
      await apiService.updatePayment(order._id, 'cod');
      setStep('success'); setMethod('cod');
    } catch (e: any) {
      setError(e.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  const handleUpiPaid = async () => {
    if (!upiApp) return;
    try {
      setLoading(true); setError('');
      const txnId = `TXN${Date.now()}`;
      await apiService.updatePayment(order._id, 'upi', upiApp, txnId);
      setStep('success'); setMethod('upi');
    } catch (e: any) {
      setError(e.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'success') return (
    <Modal title="Payment" onClose={() => { onSuccess(); onClose(); }}>
      <div className="text-center py-6">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-4">
          {method === 'cod' ? '📦' : '✅'}
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {method === 'cod' ? 'Order Confirmed!' : 'Payment Successful!'}
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          {method === 'cod'
            ? 'Please keep exact change ready. Pay when your order arrives.'
            : 'Your payment has been received. Invoice is now available.'}
        </p>
        <button onClick={() => { onSuccess(); onClose(); }}
          className="w-full bg-green-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors">
          Done
        </button>
      </div>
    </Modal>
  );

  return (
    <Modal title="Complete Payment" onClose={onClose}>
      {/* Amount */}
      <div className="text-center bg-green-50 rounded-xl p-4 mb-5">
        <p className="text-xs text-gray-400 mb-1">Amount to Pay</p>
        <p className="text-3xl font-bold text-green-700">₹{amount.toFixed(2)}</p>
        <p className="text-xs text-gray-400 mt-1">Order #{order.orderNumber}</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg mb-4">{error}</div>
      )}

      {/* Method selection */}
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Choose Payment Method</p>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <button
          onClick={() => { setMethod('cod'); setUpiApp(null); }}
          className={`border-2 rounded-xl p-4 text-center transition-all
            ${method === 'cod' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
          <div className="text-3xl mb-1">💵</div>
          <p className="text-sm font-semibold">Cash on Delivery</p>
          <p className="text-xs text-gray-400 mt-0.5">Pay when delivered</p>
        </button>
        <button
          onClick={() => setMethod('upi')}
          className={`border-2 rounded-xl p-4 text-center transition-all
            ${method === 'upi' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
          <div className="text-3xl mb-1">⚡</div>
          <p className="text-sm font-semibold">Instant Pay</p>
          <p className="text-xs text-gray-400 mt-0.5">UPI, PhonePe, GPay</p>
        </button>
      </div>

      {/* COD confirm */}
      {method === 'cod' && (
        <div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm text-amber-800">
            Please keep exact change of <strong>₹{amount.toFixed(2)}</strong> ready. Our delivery person will collect payment on delivery.
          </div>
          <button onClick={handleCOD} disabled={loading}
            className="w-full bg-green-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-60">
            {loading ? 'Processing...' : 'Confirm Cash on Delivery'}
          </button>
        </div>
      )}

      {/* UPI app selection + QR */}
      {method === 'upi' && (
        <>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Select UPI App</p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {UPI_APPS.map(app => (
              <button key={app.id} onClick={() => setUpiApp(app.id)}
                className={`border-2 rounded-xl p-3 text-center transition-all
                  ${upiApp === app.id ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className="w-10 h-10 rounded-xl mx-auto mb-1 flex items-center justify-center text-2xl"
                  style={{ background: app.color + '22' }}>
                  {app.emoji}
                </div>
                <p className="text-xs font-medium">{app.name}</p>
              </button>
            ))}
          </div>

          {upiApp && (
            <>
              {/* QR box */}
              <div className="bg-gray-50 rounded-xl p-4 text-center mb-4">
                <p className="text-xs font-medium text-gray-500 mb-3">
                  Scan with {UPI_APPS.find(a => a.id === upiApp)?.name}
                </p>
                {/* Real QR: replace this div with <QRCode value={...} size={140} /> after: npm install qrcode.react */}
                <div className="w-36 h-36 bg-white border-2 border-dashed border-gray-300 rounded-xl mx-auto mb-3 flex flex-col items-center justify-center gap-1">
                  <span className="text-3xl">📱</span>
                  <span className="text-xs text-gray-400 text-center px-2">
                    Install qrcode.react<br />for real QR
                  </span>
                </div>
                {/* ↑ Replace above div with: */}
                {/* <QRCode value={`upi://pay?pa=farmdirect@upi&pn=FarmDirect&am=${amount.toFixed(2)}&tn=Order-${order.orderNumber}`} size={140} level="H" /> */}
                <p className="text-lg font-bold text-green-700">₹{amount.toFixed(2)}</p>
                <div className="mt-2 bg-white rounded-lg p-2 text-xs text-gray-500 inline-block">
                  UPI ID: <span className="font-semibold text-gray-800">farmdirect@upi</span>
                </div>
              </div>

              <button onClick={handleUpiPaid} disabled={loading}
                className="w-full bg-green-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-60">
                {loading ? 'Verifying...' : "I've Completed Payment"}
              </button>
            </>
          )}
        </>
      )}
    </Modal>
  );
}

// ─── Main Orders Page ─────────────────────────────────────────────────────────

const Orders = () => {
  const [orders, setOrders]           = useState<Order[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [cancelling, setCancelling]   = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal state
  const [detailOrder, setDetailOrder]   = useState<Order | null>(null);
  const [invoiceOrderId, setInvoiceOrderId] = useState<string | null>(null);
  const [payOrder, setPayOrder]         = useState<Order | null>(null);

  const { user } = useAuth();

  useEffect(() => {
    if (user) fetchOrders();
  }, [user]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await apiService.getCustomerOrders() as any;
      setOrders(response.orders || []);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!window.confirm('Are you sure you want to cancel this order?')) return;
    try {
      setCancelling(orderId);
      await apiService.cancelOrder(orderId, 'Cancelled by customer');
      await fetchOrders();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel order');
    } finally {
      setCancelling(null);
    }
  };

  // Filter locally by tab
  const filteredOrders = statusFilter === 'all'
    ? orders
    : orders.filter(o => o.orderStatus === statusFilter);

  // ── Not logged in ────────────────────────────────────────────
  if (!user) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Please Login to View Orders</h2>
        <Link to="/login" className="btn-primary">Login to Continue</Link>
      </div>
    </div>
  );

  // ── Loading ──────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
    </div>
  );

  // ── Main render ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
          <p className="text-gray-500 text-sm mt-1">Track and manage your orders</p>
        </div>

        {/* Status filter tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2 mb-6 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {STATUS_TABS.map(tab => (
              <button key={tab} onClick={() => setStatusFilter(tab)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap capitalize
                  ${statusFilter === tab
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'text-gray-500 hover:bg-gray-100'}`}>
                {tab === 'all' ? 'All Orders' : tab.replace(/-/g, ' ')}
                {tab !== 'all' && (
                  <span className="ml-1.5 text-[10px] opacity-70">
                    ({orders.filter(o => o.orderStatus === tab).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-5 text-sm">
            {error}
          </div>
        )}

        {/* Empty state */}
        {filteredOrders.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📦</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No Orders Found</h2>
            <p className="text-gray-500 text-sm mb-6">
              {statusFilter === 'all'
                ? "You haven't placed any orders yet."
                : `No "${statusFilter.replace(/-/g, ' ')}" orders found.`}
            </p>
            {statusFilter === 'all' && (
              <Link to="/products"
                className="inline-block bg-green-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors">
                Start Shopping
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map(order => (
              <div key={order._id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

                {/* Order header */}
                <div className="p-5 border-b border-gray-100">
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-sm font-bold text-gray-900">
                          Order #{order.orderNumber}
                        </h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[order.orderStatus]}`}>
                          {STATUS_ICONS[order.orderStatus]} {order.orderStatus.replace(/-/g, ' ')}
                        </span>
                        {order.paymentStatus === 'pending' && order.orderStatus !== 'cancelled' && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                            Payment Pending
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">Placed {formatDate(order.createdAt)}</p>
                      {order.estimatedDelivery && (
                        <p className="text-xs text-gray-400">
                          Est. delivery: {formatDate(order.estimatedDelivery)}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-base font-bold text-gray-900">
                        ₹{(order.invoiceAmount ?? order.finalAmount).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {order.items.length} item{order.items.length > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Status tracker */}
                <StatusTracker status={order.orderStatus} />

                {/* Items preview */}
                <div className="p-5 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Order Items</p>
                  <div className="space-y-2">
                    {order.items.map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center text-xl flex-shrink-0">
                          {item.emoji || '🌿'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                          <p className="text-xs text-gray-400">
                            {item.quantity} {item.unit} × ₹{item.price.toFixed(2)} — {item.farmerName}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-gray-800 flex-shrink-0">
                          ₹{(item.price * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Delivery address */}
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Delivery Address</p>
                  <p className="text-xs text-gray-600">
                    {order.deliveryAddress.street}, {order.deliveryAddress.city},&nbsp;
                    {order.deliveryAddress.state} – {order.deliveryAddress.pincode}
                  </p>
                </div>

                {/* Actions */}
                <div className="p-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => setDetailOrder(order)}
                    className="bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-green-700 transition-colors">
                    View Details
                  </button>

                  {['pending', 'confirmed'].includes(order.orderStatus) && (
                    <button
                      onClick={() => handleCancelOrder(order._id)}
                      disabled={cancelling === order._id}
                      className="border border-red-200 text-red-600 px-4 py-2 rounded-xl text-xs font-semibold hover:bg-red-50 transition-colors disabled:opacity-50">
                      {cancelling === order._id ? 'Cancelling...' : 'Cancel Order'}
                    </button>
                  )}

                  <button
                    onClick={() => setInvoiceOrderId(order._id)}
                    className="border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-xs font-semibold hover:bg-gray-50 transition-colors">
                    ⬇ Invoice
                  </button>

                  {order.paymentStatus === 'pending' && order.orderStatus !== 'cancelled' && (
                    <button
                      onClick={() => setPayOrder(order)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors">
                      Pay Now
                    </button>
                  )}

                  {order.orderStatus === 'delivered' && (
                    <button className="border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-xs font-semibold hover:bg-gray-50 transition-colors">
                      Return / Replace
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {detailOrder && (
        <DetailsModal
          order={detailOrder}
          onClose={() => setDetailOrder(null)}
          onOpenInvoice={() => { setInvoiceOrderId(detailOrder._id); setDetailOrder(null); }}
          onOpenPayment={() => { setPayOrder(detailOrder); setDetailOrder(null); }}
        />
      )}

      {invoiceOrderId && (
        <InvoiceModal
          orderId={invoiceOrderId}
          onClose={() => setInvoiceOrderId(null)}
        />
      )}

      {payOrder && (
        <PaymentModal
          order={payOrder}
          onClose={() => setPayOrder(null)}
          onSuccess={() => { fetchOrders(); setPayOrder(null); }}
        />
      )}
    </div>
  );
};

export default Orders;
