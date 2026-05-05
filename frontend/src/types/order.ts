// Type definitions for Order management

export interface OrderItem {
  id: string;
  name: string;
  emoji?: string;
  quantity: number;
  unit: string;
  price: number;
  farmerName: string;
}

export interface DeliveryAddress {
  street: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
}

export interface Order {
  _id: string;
  userId: string;
  orderNumber: string;
  customerName?: string;        // ADD THIS
  customerEmail?: string;       // ADD THIS
  items: OrderItem[];
  deliveryAddress: DeliveryAddress;
  orderStatus: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'out-for-delivery' | 'delivered' | 'cancelled' | 'returned';
  paymentStatus: 'pending' | 'paid' | 'refunded';
  paymentMethod?: string;
  finalAmount: number;
  invoiceAmount?: number;
  trackingNumber?: string;
  estimatedDelivery?: string;
  createdAt: string;
  updatedAt: string;
  cancellationReason?: string;
}

export interface TrackingEntry {
  status: string;
  message: string;
  timestamp: string;
}

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  deliveryAddress: DeliveryAddress;
  items: OrderItem[];
  subtotal: number;
  discountAmount: number;
  deliveryCharge: number;
  gstPercent: number;
  gstAmount: number;
  invoiceAmount: number;
  paymentStatus: 'pending' | 'paid' | 'refunded';
  paidAt?: string;
}