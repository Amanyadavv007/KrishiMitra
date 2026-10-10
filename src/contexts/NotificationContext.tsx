import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { AppNotification, NotificationCategory } from "../types/notifications";
import { useLocation } from "./LocationContext";
import { fetchLiveWeatherAlerts } from "../services/realAlertsService";

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  activeFilter: NotificationCategory;
  setActiveFilter: (cat: NotificationCategory) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  clearAll: () => void;
  addNotification: (notif: Omit<AppNotification, "id" | "timestamp" | "read">) => void;
  bannerAlert: AppNotification | null;
  dismissBannerAlert: () => void;
  refreshRealTimeAlerts: () => Promise<void>;
  isLiveLoading: boolean;
}

// v3 intentionally starts with an empty feed. Older versions persisted demo
// thunderstorm/pest cards, so loading them would make the live feed look false.
const STORAGE_KEY = "km_notifications_v3";
const LEGACY_DEMO_IDS = new Set([
  "notif-weather-01",
  "notif-mandi-02",
  "notif-disease-03",
  "notif-scheme-04",
  "notif-market-05",
  "notif-soil-06",
  "notif-system-07",
]);

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { latitude, longitude, district, state, loading: locationLoading } = useLocation();
  const [activeFilter, setActiveFilter] = useState<NotificationCategory>("all");
  const [bannerAlert, setBannerAlert] = useState<AppNotification | null>(null);
  const [isLiveLoading, setIsLiveLoading] = useState(false);

  // Start empty. Notifications are added only by real data sources or explicit
  // application actions, never by the demo seed list.
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (notification) =>
              notification && typeof notification.id === "string" && !LEGACY_DEMO_IDS.has(notification.id)
          );
        }
      }
    } catch (error) {
      console.warn("Failed to load notifications from storage", error);
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    } catch (error) {
      console.warn("Failed to save notifications to storage", error);
    }
  }, [notifications]);

  // Never use a fallback city. A denied/pending permission must not create an
  // alert for Delhi (or any other unrelated location).
  const refreshRealTimeAlerts = useCallback(async () => {
    if (locationLoading || latitude === null || longitude === null) return;

    setIsLiveLoading(true);
    try {
      const liveAlerts = await fetchLiveWeatherAlerts(latitude, longitude, district, state);
      setNotifications((previous) => {
        // Remove the previous observation even when the new observation is clear.
        // This prevents a stale storm or heavy-rain card from remaining in the feed.
        const previousLive = new Map(
          previous.filter((notification) => notification.id.startsWith("real-")).map((notification) => [notification.id, notification])
        );
        const withoutLiveAlerts = previous.filter((notification) => !notification.id.startsWith("real-"));
        const refreshedAlerts = liveAlerts.map((alert) => ({
          ...alert,
          // Do not make a persistent condition unread again on every poll.
          read: previousLive.get(alert.id)?.read ?? false,
        }));
        return [...refreshedAlerts, ...withoutLiveAlerts];
      });

      // Live observations belong in the feed, not as repeated automatic toasts.
      setBannerAlert((current) => (current && !current.id.startsWith("real-") ? current : null));
    } catch (error) {
      console.warn("Error refreshing real-time alerts:", error);
    } finally {
      setIsLiveLoading(false);
    }
  }, [locationLoading, latitude, longitude, district, state]);

  useEffect(() => {
    refreshRealTimeAlerts();
  }, [refreshRealTimeAlerts]);

  // Refresh the current observation every 10 minutes. No future-day forecast is
  // promoted to a warning, and no alert is created without coordinates.
  useEffect(() => {
    if (locationLoading || latitude === null || longitude === null) return;
    const interval = setInterval(() => {
      refreshRealTimeAlerts();
    }, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [locationLoading, latitude, longitude, refreshRealTimeAlerts]);

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  const markAsRead = useCallback((id: string) => {
    setNotifications((previous) =>
      previous.map((notification) => (notification.id === id ? { ...notification, read: true } : notification))
    );
    setBannerAlert((current) => (current?.id === id ? null : current));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((previous) => previous.map((notification) => ({ ...notification, read: true })));
  }, []);

  const deleteNotification = useCallback((id: string) => {
    setNotifications((previous) => previous.filter((notification) => notification.id !== id));
    setBannerAlert((current) => (current?.id === id ? null : current));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setBannerAlert(null);
  }, []);

  // Retained for verified server/application events. The UI no longer exposes a
  // "simulate alert" path, so this cannot be used to seed false weather/pest data.
  const addNotification = useCallback((notif: Omit<AppNotification, "id" | "timestamp" | "read">) => {
    const newNotif: AppNotification = {
      ...notif,
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      read: false,
    };
    setNotifications((previous) => [newNotif, ...previous]);
    if (notif.priority === "critical") setBannerAlert(newNotif);
  }, []);

  const dismissBannerAlert = useCallback(() => setBannerAlert(null), []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        activeFilter,
        setActiveFilter,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAll,
        addNotification,
        bannerAlert,
        dismissBannerAlert,
        refreshRealTimeAlerts,
        isLiveLoading,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used within a NotificationProvider");
  return context;
}
