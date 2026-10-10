import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

interface LocationContextType {
  latitude: number | null;
  longitude: number | null;
  city: string;
  district: string;
  state: string;
  loading: boolean;
  error: string | null;
  refreshLocation: () => void;
}

const LocationContext = createContext<LocationContextType>({
  latitude: null,
  longitude: null,
  city: "Delhi",
  district: "New Delhi",
  state: "Delhi",
  loading: true,
  error: null,
  refreshLocation: () => {},
});

async function reverseGeocode(lat: number, lon: number): Promise<{ city: string; district: string; state: string }> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
      { headers: { "User-Agent": "AgriNexus-Agriculture-AI/1.0" } }
    );
    const data = await res.json();
    if (data && data.address) {
      const city = data.address.city || data.address.town || data.address.village || data.address.county || "";
      const district = data.address.state_district || data.address.county || data.address.city || "";
      const state = data.address.state || "";
      return { city, district, state };
    }
  } catch (err) {
    console.warn("Reverse geocode failed; keeping neutral location labels");
  }
  return { city: "Delhi", district: "New Delhi", state: "Delhi" };
}

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [city, setCity] = useState("Delhi");
  const [district, setDistrict] = useState("New Delhi");
  const [state, setState] = useState("Delhi");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshLocation = useCallback(() => {
    setLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      setLatitude(null);
      setLongitude(null);
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setLatitude(lat);
        setLongitude(lon);

        const loc = await reverseGeocode(lat, lon);
        setCity(loc.city || "Unknown City");
        setDistrict(loc.district || loc.city || "Unknown District");
        setState(loc.state || "");
        setLoading(false);
      },
      (err) => {
        console.warn("Geolocation permission denied; live location alerts are disabled:", err.message);
        // Keep labels for the rest of the UI, but leave coordinates null so the
        // notification service cannot generate an alert for an unrelated city.
        setLatitude(null);
        setLongitude(null);
        setCity("Location unavailable");
        setDistrict("Location unavailable");
        setState("");
        setError("Location permission is required for local weather alerts.");
        setLoading(false);
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  }, []);

  useEffect(() => {
    refreshLocation();
  }, [refreshLocation]);

  return (
    <LocationContext.Provider
      value={{
        latitude,
        longitude,
        city,
        district,
        state,
        loading,
        error,
        refreshLocation,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  return useContext(LocationContext);
}
