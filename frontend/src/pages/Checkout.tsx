import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Cart, CartSummary } from '../types/cart';
import { apiService } from '../services/api';
import { useAuth } from '../hooks/useAuth';

// ── Generate a random UPI QR code URL using a free QR API ──
const generateUpiQR = (amount: number) => {
  const upiId = 'farmdirect@upi';
  const upiString = `upi://pay?pa=${upiId}&pn=FarmDirect&am=${amount}&cu=INR&tn=FarmDirect Order`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiString)}`;
};

const upiApps = [
  { id: 'gpay', name: 'Google Pay', color: '#4285F4', emoji: '🔵' },
  { id: 'phonepe', name: 'PhonePe', color: '#5F259F', emoji: '🟣' },
  { id: 'paytm', name: 'Paytm', color: '#00BAF2', emoji: '🔷' },
  { id: 'amazonpay', name: 'Amazon Pay', color: '#FF9900', emoji: '🟠' },
  { id: 'bhim', name: 'BHIM UPI', color: '#1a237e', emoji: '🏦' },
];

const banks = [
  'State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank',
  'Kotak Bank', 'Punjab National Bank', 'Bank of Baroda', 'Canara Bank',
];

const Checkout = () => {
  const [cart, setCart] = useState<Cart | null>(null);
  const [summary, setSummary] = useState<CartSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [error, setError] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentTab, setPaymentTab] = useState<'upi' | 'card' | 'netbanking' | 'cod'>('upi');
  const [selectedUpiApp, setSelectedUpiApp] = useState('');
  const [upiId, setUpiId] = useState('');
  const [upiVerified, setUpiVerified] = useState(false);
  const [verifyingUpi, setVerifyingUpi] = useState(false);
  const [cardData, setCardData] = useState({ number: '', name: '', expiry: '', cvv: '' });
  const [selectedBank, setSelectedBank] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cod');

  const [deliveryAddress, setDeliveryAddress] = useState({
    street: '', city: '', state: '', pincode: '', landmark: ''
  });
  const [notes, setNotes] = useState('');

  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) fetchCartData();
    else setLoading(false);
  }, [user]);

  const fetchCartData = async () => {
    try {
      setLoading(true);
      const [cartRes, summaryRes] = await Promise.all([apiService.getCart(), apiService.getCartSummary()]);
      setCart((cartRes as any).cart);
      setSummary((summaryRes as any).summary);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch cart');
    } finally {
      setLoading(false);
    }
  };

  const validateAddress = () => {
    if (!deliveryAddress.street.trim()) { setError('Please enter street address'); return false; }
    if (!deliveryAddress.city.trim()) { setError('Please enter city'); return false; }
    if (!deliveryAddress.state.trim()) { setError('Please enter state'); return false; }
    if (!deliveryAddress.pincode.trim()) { setError('Please enter pincode'); return false; }
    if (!/^\d{6}$/.test(deliveryAddress.pincode)) { setError('Please enter a valid 6-digit pincode'); return false; }
    return true;
  };

  const handleProceedToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAddress()) return;
    setError('');
    setShowPaymentModal(true);
  };

  const handleVerifyUpi = async () => {
    if (!upiId.includes('@')) { setError('Please enter a valid UPI ID (e.g. name@upi)'); return; }
    setVerifyingUpi(true);
    await new Promise(r => setTimeout(r, 1500));
    setUpiVerified(true);
    setVerifyingUpi(false);
  };

  const simulatePayment = async () => {
    setProcessingPayment(true);
    await new Promise(r => setTimeout(r, 2500));
    setProcessingPayment(false);
    setPaymentSuccess(true);
    await new Promise(r => setTimeout(r, 1500));
    await placeOrder('online');
  };

  const placeOrder = async (method: string) => {
    if (!cart || !summary) return;
    try {
      setPlacingOrder(true);
      const orderData = {
        items: cart.items.map(item => ({ product: item.product._id, quantity: item.quantity })),
        deliveryAddress,
        paymentMethod: method,
        notes: notes.trim() || undefined
      };
      const response = await apiService.createCODOrder(orderData);
      navigate('/order-success', { state: { order: (response as any).order, message: 'Order placed successfully!' } });
    } catch (err: any) {
      setError(err.message || 'Failed to place order');
      setShowPaymentModal(false);
    } finally {
      setPlacingOrder(false);
    }
  };

  const formatCard = (val: string) => val.replace(/\D/g, '').replace(/(\d{4})/g, '$1 ').trim().slice(0, 19);
  const formatExpiry = (val: string) => val.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1/$2').slice(0, 5);

  if (!user) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">Please Login to Checkout</h2>
        <Link to="/login" className="bg-green-600 text-white px-6 py-3 rounded-lg">Login</Link>
      </div>
    </div>
  );

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
    </div>
  );

  if (!cart?.items?.length) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4">🛒</div>
        <h2 className="text-2xl font-bold mb-4">Your cart is empty</h2>
        <Link to="/products" className="bg-green-600 text-white px-6 py-3 rounded-lg">Shop Now</Link>
      </div>
    </div>
  );

  const totalAmount = summary?.totalAmount || 0;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
          <p className="text-gray-500 mt-1">Complete your order details below</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleProceedToPayment} className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── LEFT COLUMN ── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Delivery Address */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
                <span className="w-7 h-7 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                Delivery Address
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Street Address *</label>
                  <input type="text" name="street" value={deliveryAddress.street}
                    onChange={e => setDeliveryAddress(p => ({ ...p, street: e.target.value }))}
                    placeholder="123 Main Street, Apartment 4B"
                    className="w-full border border-gray-300 px-3 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                  <input type="text" name="city" value={deliveryAddress.city}
                    onChange={e => setDeliveryAddress(p => ({ ...p, city: e.target.value }))}
                    placeholder="Mumbai"
                    className="w-full border border-gray-300 px-3 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                  <input type="text" name="state" value={deliveryAddress.state}
                    onChange={e => setDeliveryAddress(p => ({ ...p, state: e.target.value }))}
                    placeholder="Maharashtra"
                    className="w-full border border-gray-300 px-3 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pincode *</label>
                  <input type="text" name="pincode" value={deliveryAddress.pincode} maxLength={6}
                    onChange={e => setDeliveryAddress(p => ({ ...p, pincode: e.target.value.replace(/\D/g, '') }))}
                    placeholder="400001"
                    className="w-full border border-gray-300 px-3 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Landmark (Optional)</label>
                  <input type="text" name="landmark" value={deliveryAddress.landmark}
                    onChange={e => setDeliveryAddress(p => ({ ...p, landmark: e.target.value }))}
                    placeholder="Near City Hospital"
                    className="w-full border border-gray-300 px-3 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>
            </div>

            {/* Order Notes */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-7 h-7 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                Order Notes (Optional)
              </h2>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="Any special instructions for delivery..."
                className="w-full border border-gray-300 px-3 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>

            {/* Payment selection preview */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-7 h-7 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                Payment Method
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'upi', label: '📱 UPI / QR Code', desc: 'GPay, PhonePe, Paytm' },
                  { id: 'card', label: '💳 Credit / Debit Card', desc: 'Visa, Mastercard, Rupay' },
                  { id: 'netbanking', label: '🏦 Net Banking', desc: 'All major banks' },
                  { id: 'cod', label: '💵 Cash on Delivery', desc: 'Pay when delivered' },
                ].map(opt => (
                  <label key={opt.id} onClick={() => setPaymentMethod(opt.id)}
                    className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${paymentMethod === opt.id ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="payment" value={opt.id} checked={paymentMethod === opt.id}
                      onChange={() => setPaymentMethod(opt.id)} className="mt-1 accent-green-600" />
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">{opt.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6 sticky top-4">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Order Summary</h2>

              <div className="max-h-48 overflow-y-auto space-y-2 mb-4">
                {cart.items.map((item, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b last:border-b-0">
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="text-sm font-medium text-gray-900 truncate">{item.product.name}</div>
                      <div className="text-xs text-gray-400">{item.quantity} × ₹{item.product.discountPrice || item.product.price}</div>
                    </div>
                    <div className="text-sm font-semibold text-gray-900 flex-shrink-0">
                      ₹{((item.product.discountPrice || item.product.price) * item.quantity).toFixed(0)}
                    </div>
                  </div>
                ))}
              </div>

              {summary && (
                <div className="space-y-2 border-t pt-4">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Subtotal ({summary.totalItems} items)</span>
                    <span>₹{summary.subtotal?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Delivery</span>
                    <span className={summary.deliveryCharge === 0 ? 'text-green-600 font-medium' : ''}>
                      {summary.deliveryCharge === 0 ? 'FREE' : `₹${summary.deliveryCharge?.toFixed(2)}`}
                    </span>
                  </div>
                  {summary.deliveryCharge === 0 && (
                    <div className="text-xs text-green-600">🎉 Free delivery on orders above ₹500</div>
                  )}
                  <div className="flex justify-between font-bold text-gray-900 text-lg border-t pt-3 mt-2">
                    <span>Total</span>
                    <span>₹{summary.totalAmount?.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                <div className="font-medium">📦 Estimated Delivery</div>
                <div className="text-xs mt-0.5">3-5 business days</div>
              </div>

              <button type="submit" disabled={placingOrder}
                className="w-full bg-green-600 text-white py-3.5 mt-5 rounded-xl hover:bg-green-700 disabled:opacity-50 font-bold text-base transition-colors">
                {placingOrder ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Placing...</span>
                  </span>
                ) : `Proceed to Pay ₹${totalAmount.toFixed(2)}`}
              </button>

              <div className="mt-3 text-center text-xs text-gray-400 flex items-center justify-center gap-1">
                🔒 100% Secure Checkout
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* ══════════════════════════════════════
          PAYMENT MODAL
      ══════════════════════════════════════ */}
      {showPaymentModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 32px 80px rgba(0,0,0,0.3)' }}>

            {/* Payment Success Animation */}
            {paymentSuccess && (
              <div style={{ padding: '48px', textAlign: 'center' }}>
                <div style={{ fontSize: '72px', marginBottom: '16px' }}>✅</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#166534', marginBottom: '8px' }}>Payment Successful!</div>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>Placing your order...</div>
                <div style={{ marginTop: '16px' }}>
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                </div>
              </div>
            )}

            {/* Processing Animation */}
            {processingPayment && !paymentSuccess && (
              <div style={{ padding: '48px', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#111', marginBottom: '8px' }}>Processing Payment...</div>
                <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '24px' }}>Please do not close this window</div>
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mx-auto"></div>
              </div>
            )}

            {/* Main Payment UI */}
            {!processingPayment && !paymentSuccess && (
              <>
                {/* Modal Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#111' }}>Complete Payment</div>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>Amount: <strong style={{ color: '#16a34a' }}>₹{totalAmount.toFixed(2)}</strong></div>
                  </div>
                  <button onClick={() => setShowPaymentModal(false)}
                    style={{ width: '36px', height: '36px', borderRadius: '50%', border: 'none', background: '#f3f4f6', cursor: 'pointer', fontSize: '20px' }}>
                    ×
                  </button>
                </div>

                {/* Payment Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid #f3f4f6', padding: '0 24px' }}>
                  {[
                    { id: 'upi', label: '📱 UPI' },
                    { id: 'card', label: '💳 Card' },
                    { id: 'netbanking', label: '🏦 Net Banking' },
                    { id: 'cod', label: '💵 COD' },
                  ].map(tab => (
                    <button key={tab.id} onClick={() => setPaymentTab(tab.id as any)}
                      style={{
                        padding: '14px 16px', fontSize: '13px', fontWeight: 600, border: 'none', background: 'transparent', cursor: 'pointer',
                        borderBottom: paymentTab === tab.id ? '2px solid #16a34a' : '2px solid transparent',
                        color: paymentTab === tab.id ? '#16a34a' : '#6b7280'
                      }}>
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div style={{ padding: '24px' }}>

                  {/* ── UPI TAB ── */}
                  {paymentTab === 'upi' && (
                    <div>
                      {/* QR Code */}
                      <div style={{ textAlign: 'center', marginBottom: '24px', padding: '20px', background: '#f9fafb', borderRadius: '16px', border: '1px solid #e5e7eb' }}>
                        <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px', fontWeight: 500 }}>Scan QR Code to Pay</div>
                        <img
                          src={generateUpiQR(totalAmount)}
                          alt="UPI QR Code"
                          style={{ width: '180px', height: '180px', margin: '0 auto', display: 'block', borderRadius: '8px' }}
                        />
                        <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '12px' }}>UPI ID: <strong style={{ color: '#374151' }}>farmdirect@upi</strong></div>
                        <div style={{ fontSize: '11px', color: '#d97706', marginTop: '4px' }}>⚡ QR valid for 10 minutes</div>
                      </div>

                      {/* Divider */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
                        <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 500 }}>OR PAY WITH UPI APP</span>
                        <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
                      </div>

                      {/* UPI Apps */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginBottom: '20px' }}>
                        {upiApps.map(app => (
                          <button key={app.id} onClick={() => setSelectedUpiApp(app.id)}
                            style={{
                              padding: '10px 4px', borderRadius: '10px', border: `2px solid ${selectedUpiApp === app.id ? app.color : '#e5e7eb'}`,
                              background: selectedUpiApp === app.id ? `${app.color}15` : '#fff',
                              cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center'
                            }}>
                            <div style={{ fontSize: '20px', marginBottom: '4px' }}>{app.emoji}</div>
                            <div style={{ fontSize: '9px', color: '#374151', fontWeight: 600, lineHeight: 1.2 }}>{app.name.split(' ')[0]}</div>
                          </button>
                        ))}
                      </div>

                      {/* UPI ID Input */}
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
                          Enter UPI ID
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input type="text" value={upiId} onChange={e => { setUpiId(e.target.value); setUpiVerified(false); }}
                            placeholder="yourname@upi"
                            style={{ flex: 1, border: `1.5px solid ${upiVerified ? '#16a34a' : '#d1d5db'}`, borderRadius: '8px', padding: '10px 12px', fontSize: '14px', outline: 'none' }} />
                          <button type="button" onClick={handleVerifyUpi} disabled={verifyingUpi || !upiId}
                            style={{ padding: '10px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap', opacity: !upiId ? 0.5 : 1 }}>
                            {verifyingUpi ? '...' : upiVerified ? '✓ Verified' : 'Verify'}
                          </button>
                        </div>
                        {upiVerified && <div style={{ fontSize: '12px', color: '#16a34a', marginTop: '4px' }}>✅ UPI ID verified successfully</div>}
                      </div>

                      <button onClick={simulatePayment} disabled={!upiVerified && !selectedUpiApp}
                        style={{
                          width: '100%', padding: '14px', background: (!upiVerified && !selectedUpiApp) ? '#d1d5db' : '#16a34a',
                          color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '16px', cursor: (!upiVerified && !selectedUpiApp) ? 'not-allowed' : 'pointer'
                        }}>
                        Pay ₹{totalAmount.toFixed(2)} via UPI
                      </button>
                    </div>
                  )}

                  {/* ── CARD TAB ── */}
                  {paymentTab === 'card' && (
                    <div>
                      {/* Card Preview */}
                      <div style={{
                        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
                        borderRadius: '16px', padding: '24px', marginBottom: '24px', color: '#fff', position: 'relative', overflow: 'hidden'
                      }}>
                        <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
                        <div style={{ position: 'absolute', bottom: '-40px', left: '-20px', width: '150px', height: '150px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                          <div style={{ fontSize: '18px', fontWeight: 700 }}>💳 BANK CARD</div>
                          <div style={{ fontSize: '24px' }}>
                            {cardData.number.startsWith('4') ? '💙' : cardData.number.startsWith('5') ? '🔴' : '⬜'}
                          </div>
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '3px', marginBottom: '20px', fontFamily: 'monospace' }}>
                          {cardData.number || '•••• •••• •••• ••••'}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontSize: '10px', opacity: 0.7, marginBottom: '2px' }}>CARD HOLDER</div>
                            <div style={{ fontSize: '14px', fontWeight: 600 }}>{cardData.name || 'YOUR NAME'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '10px', opacity: 0.7, marginBottom: '2px' }}>EXPIRES</div>
                            <div style={{ fontSize: '14px', fontWeight: 600 }}>{cardData.expiry || 'MM/YY'}</div>
                          </div>
                        </div>
                      </div>

                      {/* Card Form */}
                      <div style={{ space: '16px' } as any} className="space-y-4">
                        <div>
                          <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Card Number</label>
                          <input type="text" value={cardData.number}
                            onChange={e => setCardData(p => ({ ...p, number: formatCard(e.target.value) }))}
                            placeholder="1234 5678 9012 3456" maxLength={19}
                            style={{ width: '100%', border: '1.5px solid #d1d5db', borderRadius: '8px', padding: '10px 12px', fontSize: '15px', outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Cardholder Name</label>
                          <input type="text" value={cardData.name}
                            onChange={e => setCardData(p => ({ ...p, name: e.target.value.toUpperCase() }))}
                            placeholder="RAHUL SHARMA"
                            style={{ width: '100%', border: '1.5px solid #d1d5db', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div>
                            <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Expiry Date</label>
                            <input type="text" value={cardData.expiry}
                              onChange={e => setCardData(p => ({ ...p, expiry: formatExpiry(e.target.value) }))}
                              placeholder="MM/YY" maxLength={5}
                              style={{ width: '100%', border: '1.5px solid #d1d5db', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                          </div>
                          <div>
                            <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>CVV</label>
                            <input type="password" value={cardData.cvv}
                              onChange={e => setCardData(p => ({ ...p, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                              placeholder="•••"
                              style={{ width: '100%', border: '1.5px solid #d1d5db', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                          </div>
                        </div>
                      </div>

                      <button onClick={simulatePayment}
                        disabled={!cardData.number || !cardData.name || !cardData.expiry || !cardData.cvv}
                        style={{
                          width: '100%', padding: '14px', marginTop: '20px',
                          background: (!cardData.number || !cardData.name || !cardData.expiry || !cardData.cvv) ? '#d1d5db' : '#16a34a',
                          color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '16px',
                          cursor: (!cardData.number || !cardData.name || !cardData.expiry || !cardData.cvv) ? 'not-allowed' : 'pointer'
                        }}>
                        Pay ₹{totalAmount.toFixed(2)} Securely
                      </button>

                      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '12px' }}>
                        {['🔐 256-bit SSL', '✓ PCI DSS Secure', '🛡️ Fraud Protection'].map(t => (
                          <span key={t} style={{ fontSize: '10px', color: '#9ca3af' }}>{t}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── NET BANKING TAB ── */}
                  {paymentTab === 'netbanking' && (
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '12px' }}>Select Your Bank</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
                        {banks.map(bank => (
                          <button key={bank} onClick={() => setSelectedBank(bank)}
                            style={{
                              padding: '10px 12px', borderRadius: '8px', textAlign: 'left', fontSize: '12px', fontWeight: 500,
                              border: `1.5px solid ${selectedBank === bank ? '#16a34a' : '#e5e7eb'}`,
                              background: selectedBank === bank ? '#f0fdf4' : '#fff',
                              color: selectedBank === bank ? '#15803d' : '#374151', cursor: 'pointer', transition: 'all 0.2s'
                            }}>
                            🏦 {bank}
                          </button>
                        ))}
                      </div>

                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Or enter bank name</label>
                        <input type="text" value={selectedBank} onChange={e => setSelectedBank(e.target.value)}
                          placeholder="Enter your bank name"
                          style={{ width: '100%', border: '1.5px solid #d1d5db', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                      </div>

                      <button onClick={simulatePayment} disabled={!selectedBank}
                        style={{
                          width: '100%', padding: '14px',
                          background: !selectedBank ? '#d1d5db' : '#16a34a',
                          color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '16px',
                          cursor: !selectedBank ? 'not-allowed' : 'pointer'
                        }}>
                        Pay ₹{totalAmount.toFixed(2)} via Net Banking
                      </button>
                    </div>
                  )}

                  {/* ── COD TAB ── */}
                  {paymentTab === 'cod' && (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                      <div style={{ fontSize: '64px', marginBottom: '16px' }}>💵</div>
                      <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#111', marginBottom: '8px' }}>Cash on Delivery</h3>
                      <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.7, marginBottom: '24px', maxWidth: '300px', margin: '0 auto 24px' }}>
                        Pay in cash when your order arrives at your doorstep. No advance payment needed.
                      </p>
                      <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: '10px', padding: '12px 16px', marginBottom: '24px', fontSize: '13px', color: '#854d0e' }}>
                        ⚠️ Please keep exact change ready for faster delivery
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px', textAlign: 'left' }}>
                        {['✅ No online payment needed', '✅ Pay only after receiving order', '✅ 100% secure delivery', '✅ Easy returns & refunds'].map(f => (
                          <div key={f} style={{ fontSize: '14px', color: '#374151' }}>{f}</div>
                        ))}
                      </div>
                      <button onClick={() => placeOrder('cod')} disabled={placingOrder}
                        style={{ width: '100%', padding: '14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '16px', cursor: 'pointer' }}>
                        {placingOrder ? 'Placing Order...' : `Place COD Order - ₹${totalAmount.toFixed(2)}`}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Checkout;
