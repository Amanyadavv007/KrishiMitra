export type NotificationCategory =
  | "all"
  | "weather"
  | "mandi"
  | "disease"
  | "scheme"
  | "marketplace"
  | "system";

export type NotificationPriority = "critical" | "warning" | "info" | "success";

export interface AppNotification {
  id: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  message: string;
  timestamp: string; // ISO date string or human readable
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
  iconType?: "cloud-rain" | "trending-up" | "bug" | "landmark" | "shopping-bag" | "shield-alert" | "sparkles";
  meta?: {
    crop?: string;
    mandiName?: string;
    priceDelta?: string;
    temperature?: string;
    schemeName?: string;
    orderId?: string;
    district?: string;
  };
}
