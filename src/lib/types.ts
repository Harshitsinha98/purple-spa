export type AppRole = "customer" | "employee" | "admin";
export type ResourceKind = "bed" | "chair";
export type ServiceKind = "spa" | "salon";
export type Gender = "female" | "male" | "other";
export type GenderPref = "any" | "female" | "male";
export type PaymentMode = "full" | "partial" | "pay_at_spa";
export type BookingStatus =
  | "pending_payment"
  | "confirmed"
  | "assigned"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";
export type PaymentStatus = "unpaid" | "partial" | "paid" | "refunded";
export type PaymentMethod = "razorpay" | "cash" | "upi" | "card";

export interface Settings {
  id: 1;
  business_name: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  maps_query: string;
  instagram_url: string | null;
  timezone: string;
  open_time: string;
  close_time: string;
  slot_interval_min: number;
  buffer_min: number;
  booking_window_days: number;
  min_lead_min: number;
  bed_count: number;
  chair_count: number;
  allow_gender_preference: boolean;
  cancellation_hours: number;
  payment_modes: PaymentMode[];
  advance_percent: number;
  auto_assign: boolean;
  payment_hold_min: number;
}

export interface Category {
  id: string;
  slug: string;
  kind: ServiceKind;
  name_en: string;
  name_hi: string;
  description_en: string | null;
  description_hi: string | null;
  sort: number;
  is_active: boolean;
}

export interface Variant {
  id: string;
  service_id: string;
  duration_min: number;
  price: number;
  is_active: boolean;
}

export interface Service {
  id: string;
  category_id: string;
  slug: string;
  name_en: string;
  name_hi: string;
  description_en: string | null;
  description_hi: string | null;
  tag_en: string | null;
  tag_hi: string | null;
  resource: ResourceKind;
  commission_percent: number | null;
  sort: number;
  is_active: boolean;
  service_variants: Variant[];
}

export interface CatalogCategory extends Category {
  services: Service[];
}

export interface Catalog {
  categories: CatalogCategory[];
  settings: Settings;
  /** true when the database is not reachable yet and built-in menu data is shown */
  fallback: boolean;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: AppRole;
  whatsapp_opt_in: boolean;
}

export interface Employee {
  id: string;
  profile_id: string | null;
  email: string;
  full_name: string;
  phone: string | null;
  gender: Gender;
  title: string;
  commission_percent: number;
  weekly_off: number | null;
  is_active: boolean;
  created_at: string;
}

export interface BookingItem {
  id: string;
  booking_id: string;
  service_id: string | null;
  variant_id: string | null;
  name_en: string;
  name_hi: string;
  duration_min: number;
  price: number;
}

export interface Booking {
  id: string;
  code: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  start_at: string;
  end_at: string;
  resource: ResourceKind;
  status: BookingStatus;
  employee_id: string | null;
  employee_name: string | null;
  employee_gender: Gender | null;
  gender_preference: GenderPref;
  payment_mode: PaymentMode;
  total_amount: number;
  advance_amount: number;
  amount_paid: number;
  payment_status: PaymentStatus;
  commission_amount: number | null;
  hold_expires_at: string | null;
  notes: string | null;
  source: string;
  cancelled_at: string | null;
  cancel_reason: string | null;
  completed_at: string | null;
  created_at: string;
  booking_items?: BookingItem[];
}

export interface BookingEvent {
  id: number;
  booking_id: string;
  type: string;
  message: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  booking_id: string;
  method: PaymentMethod;
  amount: number;
  status: "created" | "captured" | "failed" | "refunded";
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  refund_id: string | null;
  note: string | null;
  created_at: string;
}

export interface MonthlyReport {
  month: string;
  summary: {
    bookings: number;
    completed: number;
    cancelled: number;
    no_show: number;
    upcoming: number;
    service_value: number;
    commission: number;
    outstanding: number;
  };
  collections: { total: number; refunded: number; by_method: Record<string, number> };
  daily: { day: string; bookings: number; revenue: number }[];
  services: { name: string; count: number; revenue: number }[];
  employees: { id: string; name: string; bookings: number; no_show: number; minutes: number; revenue: number; commission: number }[];
}
