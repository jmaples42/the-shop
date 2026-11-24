// Weekly data format. The scheduled roundup task writes one of these per week
// to public/data/<edition>.json and public/data/current.json.
// docs/DATA_FORMAT.md describes each field; scripts/validate-deals.mjs checks it.

export type PriceType = "sale" | "regular" | "none";

export interface Store {
  id: string; // stable slug, e.g. "sendiks"; used in favorites and saved lists
  name: string;
  location?: string;
  adStart?: string; // YYYY-MM-DD
  adEnd?: string; // YYYY-MM-DD, omitted when the ad doesn't state it
  dates: string; // human-readable dates as the ad states them
  priceType: PriceType; // "regular" = not a sale (e.g. Trader Joe's flyer)
  notes?: string[];
}

export interface Deal {
  id: string; // unique within the edition: "<storeId>-<slug>"
  storeId: string;
  department: string;
  name: string; // includes size when the ad gives one
  price: string; // as printed: "$2.99", "$1.29/lb", "2/$5", "BOGO"
  conditions?: string; // loyalty card, digital coupon, limit, owner price...
  regularPrice?: string;
  unverified?: boolean;
}

export interface Edition {
  schemaVersion: 1;
  edition: string; // YYYY-MM-DD of the roundup run
  title: string; // "Nov 18–26, 2026"
  area: string;
  summary?: string;
  generatedAt: string; // ISO timestamp
  sourceDoc?: string;
  stores: Store[];
  deals: Deal[];
  best: { dealId: string; note?: string }[];
  staples: { item: string; cheapestStoreId?: string; cheapest: string; others: string; traderJoes?: string }[];
  compare: { item: string; prices: Record<string, string>; conditions?: string }[];
  gaps: string[];
  sources: { label: string; url?: string }[];
}

// ---- User data (Firestore: users/{uid} and users/{uid}/lists/{listId})

export interface ListItem {
  key: string;
  name: string;
  checked: boolean;
  addedAt: number;
  // Present when the item came from a deal. Copied in, because deals expire each week.
  dealId?: string;
  edition?: string;
  areaId?: string; // area the deal came from; items saved before areas existed are West Bend
  storeId?: string;
  storeName?: string;
  price?: string;
  conditions?: string;
}

export interface ShopList {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  items: ListItem[];
}

export interface Profile {
  favoriteStores: string[];
}

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}
