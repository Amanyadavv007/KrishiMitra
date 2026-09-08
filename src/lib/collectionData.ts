// ============================================================
// Collection-point pooling data layer — the customer-facing
// supply chain. Customers always browse POOLED stock at a
// collection point, never one farmer's private stock.
//
// Every function tries Supabase first (anon key, RLS allow-all,
// same demo model as supabaseData.ts) and falls back to
// localStorage so the dashboard works before the migration runs.
// ============================================================
import { supabase, isSupabaseConfigured } from "./supabaseClient";

// ---- Types ------------------------------------------------

export interface CollectionPoint {
  id: string;
  name: string;
  region: string;
  address: string;
  village: string;
  district: string;
  state: string;
  coordinatorId: string;
  coordinatorName: string;
  coordinatorPhone: string;
  photoUrl: string;
  verified: boolean;
  rating: number;
  contributingFarmerCount: number;
}

export interface CollectionPointInventoryRow {
  id: string;
  collection_point_id: string;
  crop_name: string;
  quantity_kg: number;
  reserved_kg: number;
  grade: string;
  season: string;
  harvest_date: string | null;
  ready_from_date: string | null;
  price_per_kg: number;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface FarmerContributionRow {
  id: string;
  collection_point_id: string;
  inventory_id: string;
  farmer_id: string;
  farmer_name: string;
  crop_name: string;
  quantity_kg: number;
  source_inventory_id: string | null;
  channel: string;
  payout_share: number;
  payout_amount: number;
  payout_status: string;
  created_at?: string;
}

export interface CustomerOrderRow {
  id?: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_id: string;
  collection_point_id: string;
  inventory_id: string | null;
  crop_name: string;
  quantity_kg: number;
  price_per_kg: number;
  total_amount: number;
  payment_status: string; // held_in_escrow | released | refunded
  escrow_released_at?: string | null;
  fulfilment_mode: string; // pickup | scheduled_slot
  pickup_point: string;
  slot_date: string | null;
  slot_label: string;
  ready_date: string | null;
  pooled_batch_id: string;
  status: string; // pending | confirmed | in_transit | ready | delivered | cancelled
  items: unknown;
  created_at?: string;
  updated_at?: string;
}

export interface CustomerSubscriptionRow {
  id?: string;
  customer_name: string;
  customer_phone: string;
  customer_id: string;
  collection_point_id: string;
  frequency: string; // weekly | fortnightly
  box_size_kg: number;
  next_delivery_date: string | null;
  status: string; // active | paused | cancelled
  created_at?: string;
  updated_at?: string;
}

// ---- tiny helpers -----------------------------------------

function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLS(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors in demo mode
  }
}

export function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

export function daysAheadStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---- Demo seed (localStorage fallback) ---------------------
// Realistic Odisha-coast demo cluster so the dashboard is never
// empty before the migration is run.

const SEED_POINTS: CollectionPoint[] = [
  {
    id: "cp-demo-1",
    name: "Nimapara FPO Collection Center",
    region: "Nimapara Cluster, Puri",
    address: "Main Road, near block office, Nimapara",
    village: "Nimapara",
    district: "Puri",
    state: "Odisha",
    coordinatorId: "farmer-demo-1",
    coordinatorName: "Ramesh Kumar",
    coordinatorPhone: "9876500001",
    photoUrl: "https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=800&auto=format&fit=crop&q=80",
    verified: true,
    rating: 4.7,
    contributingFarmerCount: 34,
  },
  {
    id: "cp-demo-2",
    name: "Salepur Aggregation Point",
    region: "Salepur Cluster, Cuttack",
    address: "NH-916 market yard, Salepur",
    village: "Salepur",
    district: "Cuttack",
    state: "Odisha",
    coordinatorId: "farmer-demo-2",
    coordinatorName: "Suresh Patil",
    coordinatorPhone: "9876500002",
    photoUrl: "https://images.unsplash.com/photo-1500937386664-56d1dfef4854?w=800&auto=format&fit=crop&q=80",
    verified: true,
    rating: 4.5,
    contributingFarmerCount: 21,
  },
  {
    id: "cp-demo-3",
    name: "Begunbari Village Pool",
    region: "Begunbari Cluster, Khordha",
    address: "Panchayat building courtyard, Begunbari",
    village: "Begunbari",
    district: "Khordha",
    state: "Odisha",
    coordinatorId: "farmer-demo-3",
    coordinatorName: "Anita Reddy",
    coordinatorPhone: "9876500003",
    photoUrl: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800&auto=format&fit=crop&q=80",
    verified: false,
    rating: 4.2,
    contributingFarmerCount: 12,
  },
];

function seedInventory(): CollectionPointInventoryRow[] {
  return [
    {
      id: "cpi-demo-1",
      collection_point_id: "cp-demo-1",
      crop_name: "Paddy (Swarna)",
      quantity_kg: 4500,
      reserved_kg: 300,
      grade: "A",
      season: "Kharif 2026",
      harvest_date: daysAheadStr(-12),
      ready_from_date: daysAheadStr(3),
      price_per_kg: 24,
      status: "available",
    },
    {
      id: "cpi-demo-2",
      collection_point_id: "cp-demo-1",
      crop_name: "Tomato (Hybrid)",
      quantity_kg: 900,
      reserved_kg: 150,
      grade: "B",
      season: "Kharif 2026",
      harvest_date: daysAheadStr(-2),
      ready_from_date: daysAheadStr(1),
      price_per_kg: 19,
      status: "available",
    },
    {
      id: "cpi-demo-3",
      collection_point_id: "cp-demo-2",
      crop_name: "Mustard",
      quantity_kg: 1200,
      reserved_kg: 0,
      grade: "A",
      season: "Rabi 2026",
      harvest_date: daysAheadStr(-20),
      ready_from_date: daysAheadStr(5),
      price_per_kg: 56,
      status: "available",
    },
    {
      id: "cpi-demo-4",
      collection_point_id: "cp-demo-2",
      crop_name: "Brinjal (Round)",
      quantity_kg: 600,
      reserved_kg: 60,
      grade: "A",
      season: "Kharif 2026",
      harvest_date: daysAheadStr(-1),
      ready_from_date: daysAheadStr(2),
      price_per_kg: 26,
      status: "available",
    },
    {
      id: "cpi-demo-5",
      collection_point_id: "cp-demo-3",
      crop_name: "Maize",
      quantity_kg: 2000,
      reserved_kg: 0,
      grade: "B",
      season: "Kharif 2026",
      harvest_date: daysAheadStr(-6),
      ready_from_date: daysAheadStr(4),
      price_per_kg: 18,
      status: "available",
    },
  ];
}

function seedContributions(): FarmerContributionRow[] {
  return [
    {
      id: "fc-demo-1",
      collection_point_id: "cp-demo-1",
      inventory_id: "cpi-demo-1",
      farmer_id: "farmer-demo-1",
      farmer_name: "Ramesh Kumar",
      crop_name: "Paddy (Swarna)",
      quantity_kg: 1800,
      source_inventory_id: null,
      channel: "customer_pool",
      payout_share: 0.4,
      payout_amount: 0,
      payout_status: "pending",
    },
    {
      id: "fc-demo-2",
      collection_point_id: "cp-demo-1",
      inventory_id: "cpi-demo-1",
      farmer_id: "farmer-demo-2",
      farmer_name: "Suresh Patil",
      crop_name: "Paddy (Swarna)",
      quantity_kg: 1200,
      source_inventory_id: null,
      channel: "customer_pool",
      payout_share: 0.2667,
      payout_amount: 0,
      payout_status: "pending",
    },
    {
      id: "fc-demo-3",
      collection_point_id: "cp-demo-1",
      inventory_id: "cpi-demo-2",
      farmer_id: "farmer-demo-3",
      farmer_name: "Anita Reddy",
      crop_name: "Tomato (Hybrid)",
      quantity_kg: 900,
      source_inventory_id: null,
      channel: "customer_pool",
      payout_share: 1,
      payout_amount: 0,
      payout_status: "pending",
    },
  ];
}

function ensureSeed() {
  if (!readLS<CollectionPoint[] | null>("agn_collection_points", null)) {
    writeLS("agn_collection_points", SEED_POINTS);
  }
  if (!readLS<CollectionPointInventoryRow[] | null>("agn_cp_inventory", null)) {
    writeLS("agn_cp_inventory", seedInventory());
  }
  if (!readLS<FarmerContributionRow[] | null>("agn_cp_contributions", null)) {
    writeLS("agn_cp_contributions", seedContributions());
  }
  if (!readLS<CustomerOrderRow[] | null>("agn_customer_orders", null)) {
    writeLS("agn_customer_orders", []);
  }
  if (!readLS<CustomerSubscriptionRow[] | null>("agn_subscriptions", null)) {
    writeLS("agn_subscriptions", []);
  }
}

// =============================================================
// COLLECTION POINTS
// =============================================================

export async function fetchCollectionPoints(): Promise<CollectionPoint[]> {
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from("collection_points")
        .select("*")
        .order("created_at", { ascending: true });
      if (!error && data && data.length > 0) {
        return data.map((r: any) => ({
          id: r.id,
          name: r.name || "",
          region: r.region || "",
          address: r.address || "",
          village: r.village || "",
          district: r.district || "",
          state: r.state || "",
          coordinatorId: r.coordinator_id || "",
          coordinatorName: r.coordinator_name || "",
          coordinatorPhone: r.coordinator_phone || "",
          photoUrl: r.photo_url || "",
          verified: !!r.verified,
          rating: Number(r.rating) || 4.5,
          contributingFarmerCount: Number(r.contributing_farmer_count) || 0,
        }));
      }
      // Table exists but empty → fall through to seed so the demo still works
    } catch {
      // fall through
    }
  }
  ensureSeed();
  return readLS<CollectionPoint[]>("agn_collection_points", SEED_POINTS);
}

export async function fetchCollectionPointInventory(
  collectionPointId?: string
): Promise<CollectionPointInventoryRow[]> {
  if (isSupabaseConfigured() && supabase) {
    try {
      let query = supabase
        .from("collection_point_inventory")
        .select("*")
        .order("created_at", { ascending: false });
      if (collectionPointId) query = query.eq("collection_point_id", collectionPointId);
      const { data, error } = await query;
      if (!error && data) return data as unknown as CollectionPointInventoryRow[];
    } catch {
      // fall through
    }
  }
  ensureSeed();
  const all = readLS<CollectionPointInventoryRow[]>("agn_cp_inventory", []);
  return collectionPointId ? all.filter((r) => r.collection_point_id === collectionPointId) : all;
}

// =============================================================
// FARMER CONTRIBUTIONS
// =============================================================

export async function fetchContributions(filter?: {
  collectionPointId?: string;
  inventoryId?: string;
  farmerId?: string;
}): Promise<FarmerContributionRow[]> {
  if (isSupabaseConfigured() && supabase) {
    try {
      let query = supabase.from("farmer_contributions").select("*").order("created_at", { ascending: false });
      if (filter?.collectionPointId) query = query.eq("collection_point_id", filter.collectionPointId);
      if (filter?.inventoryId) query = query.eq("inventory_id", filter.inventoryId);
      if (filter?.farmerId) query = query.eq("farmer_id", filter.farmerId);
      const { data, error } = await query;
      if (!error && data) return data as unknown as FarmerContributionRow[];
    } catch {
      // fall through
    }
  }
  ensureSeed();
  const all = readLS<FarmerContributionRow[]>("agn_cp_contributions", []);
  return all.filter(
    (r) =>
      (!filter?.collectionPointId || r.collection_point_id === filter.collectionPointId) &&
      (!filter?.inventoryId || r.inventory_id === filter.inventoryId) &&
      (!filter?.farmerId || r.farmer_id === filter.farmerId)
  );
}

/**
 * Farmer sends part of an existing harvest record to the customer pool.
 * Reads the farmer's own inventory row, moves the chosen quantity into
 * collection-point inventory, and records the contribution for payout.
 */
export async function contributeToPool(
  farmerId: string,
  farmerName: string,
  source: { id: string; cropName: string; quantityKg: number },
  collectionPointId: string,
  quantityKg: number,
  pricePerKg: number,
  grade: string,
  season: string,
  readyFromDate: string
): Promise<{ ok: boolean; error?: string }> {
  if (quantityKg <= 0 || quantityKg > source.quantityKg) {
    return { ok: false, error: "Invalid quantity" };
  }

  if (isSupabaseConfigured() && supabase) {
    try {
      // 1. find or create the pooled inventory row for this crop+grade+CP
      const { data: existing } = await supabase
        .from("collection_point_inventory")
        .select("*")
        .eq("collection_point_id", collectionPointId)
        .eq("crop_name", source.cropName)
        .eq("grade", grade)
        .eq("status", "available")
        .maybeSingle();

      let inventoryId: string;
      if (existing) {
        inventoryId = existing.id;
        await supabase
          .from("collection_point_inventory")
          .update({ quantity_kg: Number(existing.quantity_kg) + quantityKg, updated_at: new Date().toISOString() })
          .eq("id", inventoryId);
      } else {
        const { data: created, error } = await supabase
          .from("collection_point_inventory")
          .insert({
            collection_point_id: collectionPointId,
            crop_name: source.cropName,
            quantity_kg: quantityKg,
            reserved_kg: 0,
            grade,
            season,
            ready_from_date: readyFromDate,
            price_per_kg: pricePerKg,
            status: "available",
          })
          .select()
          .single();
        if (error || !created) return { ok: false, error: error?.message || "Insert failed" };
        inventoryId = created.id;
      }

      // 2. contribution record (traceability + payout)
      const { error: cErr } = await supabase.from("farmer_contributions").insert({
        collection_point_id: collectionPointId,
        inventory_id: inventoryId,
        farmer_id: farmerId,
        farmer_name: farmerName,
        crop_name: source.cropName,
        quantity_kg: quantityKg,
        source_inventory_id: source.id,
        channel: "customer_pool",
        payout_share: 0,
        payout_amount: 0,
        payout_status: "pending",
      });
      if (cErr) return { ok: false, error: cErr.message };

      return { ok: true };
    } catch (e: any) {
      // fall through to localStorage path
    }
  }

  // localStorage path
  ensureSeed();
  const inv = readLS<CollectionPointInventoryRow[]>("agn_cp_inventory", []);
  const match = inv.find(
    (r) =>
      r.collection_point_id === collectionPointId &&
      r.crop_name === source.cropName &&
      r.grade === grade &&
      r.status === "available"
  );
  let inventoryId: string;
  if (match) {
    match.quantity_kg += quantityKg;
    match.updated_at = new Date().toISOString();
    inventoryId = match.id;
  } else {
    inventoryId = uid("cpi");
    inv.unshift({
      id: inventoryId,
      collection_point_id: collectionPointId,
      crop_name: source.cropName,
      quantity_kg: quantityKg,
      reserved_kg: 0,
      grade,
      season,
      harvest_date: todayStr(),
      ready_from_date: readyFromDate,
      price_per_kg: pricePerKg,
      status: "available",
    });
  }
  writeLS("agn_cp_inventory", inv);

  const contribs = readLS<FarmerContributionRow[]>("agn_cp_contributions", []);
  contribs.unshift({
    id: uid("fc"),
    collection_point_id: collectionPointId,
    inventory_id: inventoryId,
    farmer_id: farmerId,
    farmer_name: farmerName,
    crop_name: source.cropName,
    quantity_kg: quantityKg,
    source_inventory_id: source.id,
    channel: "customer_pool",
    payout_share: 0,
    payout_amount: 0,
    payout_status: "pending",
    created_at: new Date().toISOString(),
  });
  writeLS("agn_cp_contributions", contribs);
  return { ok: true };
}

// =============================================================
// CUSTOMER ORDERS (escrow)
// =============================================================

export async function createCustomerOrder(
  data: Omit<CustomerOrderRow, "id" | "order_number" | "created_at" | "updated_at">
): Promise<CustomerOrderRow | null> {
  const orderNumber = `CUST-${Date.now().toString(36).toUpperCase()}`;

  if (isSupabaseConfigured() && supabase) {
    try {
      // reserve stock + place order in one go
      const { data: inv } = await supabase
        .from("collection_point_inventory")
        .select("quantity_kg, reserved_kg")
        .eq("id", data.inventory_id || "")
        .maybeSingle();
      if (inv) {
        await supabase
          .from("collection_point_inventory")
          .update({
            reserved_kg: Number(inv.reserved_kg) + data.quantity_kg,
            updated_at: new Date().toISOString(),
          })
          .eq("id", data.inventory_id);
      }
      const { data: created, error } = await supabase
        .from("customer_orders")
        .insert({ ...data, order_number: orderNumber })
        .select()
        .single();
      if (!error && created) return created as unknown as CustomerOrderRow;
    } catch {
      // fall through
    }
  }

  // localStorage path
  ensureSeed();
  const inv = readLS<CollectionPointInventoryRow[]>("agn_cp_inventory", []);
  const row = inv.find((r) => r.id === data.inventory_id);
  if (row) {
    row.reserved_kg += data.quantity_kg;
    writeLS("agn_cp_inventory", inv);
  }
  const order: CustomerOrderRow = {
    ...data,
    id: uid("co"),
    order_number: orderNumber,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const all = readLS<CustomerOrderRow[]>("agn_customer_orders", []);
  writeLS("agn_customer_orders", [order, ...all]);
  return order;
}

export async function fetchCustomerOrders(customerId?: string): Promise<CustomerOrderRow[]> {
  if (isSupabaseConfigured() && supabase) {
    try {
      let query = supabase.from("customer_orders").select("*").order("created_at", { ascending: false });
      if (customerId) query = query.eq("customer_id", customerId);
      const { data, error } = await query;
      if (!error && data) return data as unknown as CustomerOrderRow[];
    } catch {
      // fall through
    }
  }
  ensureSeed();
  const all = readLS<CustomerOrderRow[]>("agn_customer_orders", []);
  return customerId ? all.filter((o) => o.customer_id === customerId) : all;
}

/**
 * Escrow release: when delivery is confirmed, the held payment is
 * marked released for the collection point (which then distributes
 * to contributing farmers by their contribution share).
 */
export async function confirmDeliveryAndReleaseEscrow(orderId: string): Promise<boolean> {
  const now = new Date().toISOString();
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data: order } = await supabase
        .from("customer_orders")
        .select("*")
        .eq("id", orderId)
        .maybeSingle();
      if (!order) return false;

      await supabase
        .from("customer_orders")
        .update({
          status: "delivered",
          payment_status: "released",
          escrow_released_at: now,
          updated_at: now,
        })
        .eq("id", orderId);

      // distribute payout across the farmers who contributed to this batch
      if (order.inventory_id) {
        const { data: contribs } = await supabase
          .from("farmer_contributions")
          .select("*")
          .eq("inventory_id", order.inventory_id);
        const total = Number(order.total_amount) || 0;
        const sumKg = (contribs || []).reduce((s: number, c: any) => s + Number(c.quantity_kg), 0);
        for (const c of contribs || []) {
          const share = sumKg > 0 ? Number(c.quantity_kg) / sumKg : 0;
          const amount = Math.round(total * share * 100) / 100;
          await supabase
            .from("farmer_contributions")
            .update({ payout_amount: amount, payout_share: share, payout_status: "released" })
            .eq("id", c.id);
        }
      }
      return true;
    } catch {
      // fall through
    }
  }

  // localStorage path
  ensureSeed();
  const orders = readLS<CustomerOrderRow[]>("agn_customer_orders", []);
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx < 0) return false;
  orders[idx] = {
    ...orders[idx],
    status: "delivered",
    payment_status: "released",
    escrow_released_at: now,
    updated_at: now,
  };
  writeLS("agn_customer_orders", orders);

  const contribs = readLS<FarmerContributionRow[]>("agn_cp_contributions", []);
  const invId = orders[idx].inventory_id;
  const batch = contribs.filter((c) => c.inventory_id === invId);
  const total = Number(orders[idx].total_amount) || 0;
  const sumKg = batch.reduce((s, c) => s + c.quantity_kg, 0);
  for (const c of batch) {
    const share = sumKg > 0 ? c.quantity_kg / sumKg : 0;
    c.payout_share = share;
    c.payout_amount = Math.round(total * share * 100) / 100;
    c.payout_status = "released";
  }
  writeLS("agn_cp_contributions", contribs);
  return true;
}

// =============================================================
// SUBSCRIPTIONS
// =============================================================

export async function createSubscription(
  data: Omit<CustomerSubscriptionRow, "id" | "created_at" | "updated_at">
): Promise<CustomerSubscriptionRow | null> {
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data: created, error } = await supabase
        .from("customer_subscriptions")
        .insert(data)
        .select()
        .single();
      if (!error && created) return created as unknown as CustomerSubscriptionRow;
    } catch {
      // fall through
    }
  }
  ensureSeed();
  const row: CustomerSubscriptionRow = {
    ...data,
    id: uid("sub"),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const all = readLS<CustomerSubscriptionRow[]>("agn_subscriptions", []);
  writeLS("agn_subscriptions", [row, ...all]);
  return row;
}

export async function fetchSubscriptions(customerId?: string): Promise<CustomerSubscriptionRow[]> {
  if (isSupabaseConfigured() && supabase) {
    try {
      let query = supabase.from("customer_subscriptions").select("*").order("created_at", { ascending: false });
      if (customerId) query = query.eq("customer_id", customerId);
      const { data, error } = await query;
      if (!error && data) return data as unknown as CustomerSubscriptionRow[];
    } catch {
      // fall through
    }
  }
  ensureSeed();
  const all = readLS<CustomerSubscriptionRow[]>("agn_subscriptions", []);
  return customerId ? all.filter((s) => s.customer_id === customerId) : all;
}

// =============================================================
// PRICE TRANSPARENCY (mandi reference prices, ₹/kg)
// Typical wholesale (mandi) and retail (middleman) benchmarks
// used to compare against the platform's pool price.
// =============================================================

export const REFERENCE_PRICES: Record<string, { mandi: number; retail: number }> = {
  Paddy: { mandi: 21, retail: 30 },
  Tomato: { mandi: 16, retail: 28 },
  Mustard: { mandi: 52, retail: 72 },
  Potato: { mandi: 13, retail: 22 },
  Maize: { mandi: 16, retail: 24 },
  Brinjal: { mandi: 22, retail: 34 },
  Chilli: { mandi: 75, retail: 110 },
  Wheat: { mandi: 22, retail: 32 },
};

export function referenceFor(cropName: string): { mandi: number; retail: number } {
  const key = Object.keys(REFERENCE_PRICES).find((k) => cropName.toLowerCase().includes(k.toLowerCase()));
  return key ? REFERENCE_PRICES[key] : { mandi: 18, retail: 26 };
}
