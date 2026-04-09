import { useState, useEffect, useRef } from "react";

const RAW_API_BASE = import.meta.env.VITE_API_BASE_URL?.trim();
const API_BASE = (RAW_API_BASE || "http://127.0.0.1:8000").replace(/\/+$/, "");

const AGENT_CONFIG = {
  orchestrator: { name: "Orchestrator", icon: "◈", color: "#6C5CE7" },
  planning: { name: "Planning Agent", icon: "◇", color: "#00B894" },
  flight: { name: "Flight Agent", icon: "△", color: "#0984E3" },
  hotel: { name: "Hotel Agent", icon: "□", color: "#E17055" },
  climate: { name: "Climate Agent", icon: "○", color: "#FDCB6E" },
};

function calcNights(dep, ret) {
  if (!dep || !ret) return 0;
  const d1 = new Date(dep);
  const d2 = new Date(ret);
  const diff = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d;
}

function AgentBadge({ agent, small }) {
  const cfg = AGENT_CONFIG[agent];
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: small ? 4 : 6,
        background: cfg.color + "18",
        border: `1px solid ${cfg.color}40`,
        borderRadius: 20,
        padding: small ? "2px 8px" : "4px 12px",
        fontSize: small ? 10 : 11,
        fontWeight: 600,
        color: cfg.color,
        letterSpacing: "0.03em",
        textTransform: "uppercase",
      }}
    >
      <span style={{ fontSize: small ? 10 : 13 }}>{cfg.icon}</span>
      {cfg.name}
    </div>
  );
}

function LogEntry({ agent, message, timestamp }) {
  const cfg = AGENT_CONFIG[agent];
  return (
    <div
      style={{
        borderLeft: `3px solid ${cfg.color}`,
        padding: "12px 16px",
        margin: "8px 0",
        background: cfg.color + "08",
        borderRadius: "0 8px 8px 0",
        animation: "fadeSlide 0.4s ease",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <AgentBadge agent={agent} small />
        <span style={{ fontSize: 10, color: "#888", fontFamily: "monospace" }}>
          {timestamp}
        </span>
      </div>
      <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5 }}>
        {message}
      </div>
    </div>
  );
}

function BookButton({ href, label, color }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 16px",
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 700,
        background: color,
        color: "#fff",
        textDecoration: "none",
        cursor: "pointer",
        border: "none",
        transition: "opacity 0.2s",
        letterSpacing: "0.02em",
      }}
    >
      {label} →
    </a>
  );
}

function SuggestionInput({
  label,
  value,
  placeholder,
  error,
  suggestions,
  showSuggestions,
  onChange,
  onFocus,
  onBlur,
  onSelect,
}) {
  return (
    <div style={{ position: "relative" }}>
      <label
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "var(--text-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 6,
          display: "block",
        }}
      >
        {label}
      </label>

      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--input-bg)",
          fontSize: 14,
          color: "var(--text-primary)",
          outline: "none",
        }}
      />

      {showSuggestions && suggestions.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            background: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            boxShadow: "0 10px 24px rgba(0,0,0,0.12)",
            zIndex: 20,
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {suggestions.map((item, idx) => (
            <button
              key={`${item.id || item.label}-${idx}`}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(item);
              }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 12px",
                border: "none",
                borderBottom: idx < suggestions.length - 1 ? "1px solid var(--border)" : "none",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                {item.display_name || item.label || item.name || item.city || "Unknown"}
              </div>
              {item.subtitle && (
                <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                  {item.subtitle}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div style={{ color: "#E17055", fontSize: 12, marginTop: 4 }}>
          {error}
        </div>
      )}
    </div>
  );
}

function FlightCard({ flight, selected, onSelect, redirectUrl }) {
  const dep = flight.dep ? new Date(flight.dep).toLocaleString() : "N/A";
  const arr = flight.arr ? new Date(flight.arr).toLocaleString() : "N/A";
  const displayPrice = flight.formattedPrice || `$${Number(flight.price || 0).toLocaleString()}`;

  return (
    <div
      onClick={onSelect}
      style={{
        border: selected ? "2px solid #0984E3" : "1px solid var(--border)",
        borderRadius: 10,
        padding: 14,
        cursor: "pointer",
        background: selected ? "#0984E310" : "var(--card-bg)",
        transition: "all 0.2s",
        marginBottom: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>
            {flight.airline || "Unknown Airline"}
          </div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
            {dep} → {arr}
          </div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
            {flight.durationText || flight.duration || ""} ·{" "}
            {flight.stops === 0 ? "Non-stop" : `${flight.stops} stop`}
          </div>
        </div>
        <div
          style={{
            textAlign: "right",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 6,
          }}
        >
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#0984E3" }}>
              {displayPrice}
            </div>
            <div style={{ fontSize: 10, color: "#888" }}>per person</div>
          </div>
          {selected && <BookButton href={redirectUrl} label="Continue to Google Flights" color="#0984E3" />}
        </div>
      </div>
    </div>
  );
}

function HotelCard({ hotel, selected, onSelect, redirectUrl, nights }) {
  const priceValue = Number(hotel.price || 0);
  const displayPrice = hotel.formattedPrice || `${hotel.currency || "USD"} ${priceValue.toLocaleString()}`;
  const amenities = hotel.amenities || [];

  return (
    <div
      onClick={onSelect}
      style={{
        border: selected ? "2px solid #E17055" : "1px solid var(--border)",
        borderRadius: 10,
        padding: 14,
        cursor: "pointer",
        background: selected ? "#E1705510" : "var(--card-bg)",
        transition: "all 0.2s",
        marginBottom: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>
            {hotel.name || "Unknown Hotel"}
          </div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
            {hotel.rating ? `★ ${hotel.rating}` : "No rating"} · {hotel.area || "City area"}
          </div>
          {amenities.length > 0 && (
            <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
              {amenities.slice(0, 5).map((a) => (
                <span
                  key={a}
                  style={{
                    fontSize: 9,
                    background: "#E1705515",
                    color: "#E17055",
                    padding: "2px 6px",
                    borderRadius: 4,
                    fontWeight: 600,
                  }}
                >
                  {a}
                </span>
              ))}
            </div>
          )}
        </div>
        <div
          style={{
            textAlign: "right",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 6,
          }}
        >
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#E17055" }}>
              {displayPrice}
            </div>
            <div style={{ fontSize: 10, color: "#888" }}>
              per night
              {nights > 0 ? ` · ${hotel.currency || "USD"} ${(priceValue * nights).toLocaleString()} total` : ""}
            </div>
          </div>
          {selected && <BookButton href={redirectUrl} label="Continue to Booking.com" color="#E17055" />}
        </div>
      </div>
    </div>
  );
}

function ClimateCard({ climate }) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #FDCB6E20, #00B89410)",
        border: "1px solid #FDCB6E40",
        borderRadius: 12,
        padding: 20,
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {[
          { label: "Temperature", value: climate.temp, icon: "◎" },
          { label: "Humidity", value: climate.humidity, icon: "◉" },
          { label: "Condition", value: climate.condition, icon: "◐" },
          { label: "Rain chance", value: climate.rain, icon: "◑" },
        ].map((item) => (
          <div key={item.label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{item.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>
              {item.value || "N/A"}
            </div>
            <div
              style={{
                fontSize: 10,
                color: "#888",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {item.label}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 16,
          padding: "10px 14px",
          background: "#FDCB6E20",
          borderRadius: 8,
          fontSize: 12,
          color: "#B7950B",
          fontWeight: 600,
          textAlign: "center",
        }}
      >
        Advisory: {climate.advisory || "Check live conditions before departure"}
      </div>
    </div>
  );
}

function ItineraryCard({ form, nights, climate }) {
  const activities = {
    arrival: ["Check into hotel", "Rest & freshen up", "Explore nearby area", "Dinner at local restaurant"],
    explore: ["Visit top attractions", "Local cuisine tasting", "Shopping & souvenirs", "Cultural experience"],
    adventure: ["Day trip / excursion", "Adventure activities", "Photography spots", "Evening entertainment"],
    departure: ["Late checkout", "Last-minute shopping", "Head to airport", "Departure"],
  };

  const days = [];
  for (let i = 0; i < nights + 1; i++) {
    const date = addDays(form.date, i);
    const dateStr = date.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });

    let type;
    let label;

    if (i === 0) {
      type = "arrival";
      label = "Arrival day";
    } else if (i === nights) {
      type = "departure";
      label = "Departure day";
    } else if (i % 2 === 1) {
      type = "explore";
      label = "Explore & discover";
    } else {
      type = "adventure";
      label = "Adventure day";
    }

    days.push({ day: i + 1, date: dateStr, type, label, activities: activities[type] });
  }

  const colors = {
    arrival: "#00B894",
    explore: "#0984E3",
    adventure: "#6C5CE7",
    departure: "#E17055",
  };

  return (
    <div
      style={{
        background: "var(--card-bg)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: 20,
        marginBottom: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AgentBadge agent="planning" />
          <span style={{ fontSize: 14, fontWeight: 700 }}>Itinerary</span>
        </div>
        <div
          style={{
            background: "#6C5CE715",
            border: "1px solid #6C5CE730",
            borderRadius: 8,
            padding: "4px 10px",
            fontSize: 11,
            fontWeight: 700,
            color: "#6C5CE7",
          }}
        >
          {nights} nights · {nights + 1} days
        </div>
      </div>

      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16 }}>
        {formatDate(form.date)} → {formatDate(form.returnDate)}
      </div>

      {days.map((day, idx) => (
        <div key={idx} style={{ display: "flex", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 24, flexShrink: 0 }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: colors[day.type],
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                color: "#fff",
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              {day.day}
            </div>
            {idx < days.length - 1 && <div style={{ width: 2, flex: 1, background: "var(--border)", minHeight: 40 }} />}
          </div>

          <div style={{ flex: 1, paddingBottom: idx < days.length - 1 ? 16 : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>{day.label}</span>
              <span style={{ fontSize: 10, color: "#888", fontFamily: "monospace" }}>{day.date}</span>
            </div>

            {climate && idx === 0 && (
              <div
                style={{
                  fontSize: 10,
                  color: "#B7950B",
                  background: "#FDCB6E18",
                  padding: "3px 8px",
                  borderRadius: 4,
                  marginBottom: 6,
                  display: "inline-block",
                  fontWeight: 600,
                }}
              >
                {climate.condition} · {climate.temp}
              </div>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {day.activities.map((act, j) => (
                <span
                  key={j}
                  style={{
                    fontSize: 10,
                    padding: "3px 8px",
                    borderRadius: 4,
                    background: colors[day.type] + "12",
                    color: colors[day.type],
                    fontWeight: 500,
                    border: `1px solid ${colors[day.type]}25`,
                  }}
                >
                  {act}
                </span>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PipelineStatus({ steps, current }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, margin: "20px 0", overflowX: "auto", paddingBottom: 4 }}>
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        const cfg = AGENT_CONFIG[step.agent];

        return (
          <div key={i} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: done ? cfg.color : active ? cfg.color + "30" : "var(--card-bg)",
                border: `2px solid ${done || active ? cfg.color : "var(--border)"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                color: done ? "#fff" : active ? cfg.color : "#888",
                fontWeight: 700,
                flexShrink: 0,
                animation: active ? "pulse 1.5s ease infinite" : "none",
              }}
            >
              {done ? "✓" : cfg.icon}
            </div>
            {i < steps.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  minWidth: 20,
                  background: done ? cfg.color : "var(--border)",
                  transition: "background 0.5s",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function validateForm(form) {
  const errors = {};
  const allowedTripTypes = ["oneway", "roundtrip"];
  const allowedStops = ["nonstop", "1 stop", "any"];
  const allowedGenders = ["Male", "Female", "Mixed", "Prefer not to say"];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!form.from?.trim()) {
    errors.from = "From city is required";
  } else if (!/^[a-zA-Z\s]+$/.test(form.from.trim())) {
    errors.from = "From city should contain letters only";
  }

  if (!form.to?.trim()) {
    errors.to = "To city is required";
  } else if (!/^[a-zA-Z\s]+$/.test(form.to.trim())) {
    errors.to = "To city should contain letters only";
  }

  if (form.from?.trim().toLowerCase() === form.to?.trim().toLowerCase()) {
    errors.to = "From and To cannot be the same";
  }

  if (!form.date) {
    errors.date = "Departure date is required";
  } else {
    const depDate = new Date(form.date);
    depDate.setHours(0, 0, 0, 0);
    if (depDate < today) {
      errors.date = "Departure date cannot be in the past";
    }
  }

  if (!allowedTripTypes.includes(form.tripType)) {
    errors.tripType = "Invalid trip type";
  }

  if (form.tripType === "roundtrip") {
    if (!form.returnDate) {
      errors.returnDate = "Return date is required";
    } else {
      const depDate = new Date(form.date);
      const retDate = new Date(form.returnDate);
      depDate.setHours(0, 0, 0, 0);
      retDate.setHours(0, 0, 0, 0);

      if (retDate <= depDate) {
        errors.returnDate = "Return date must be after departure date";
      }
    }
  }

  if (!form.budget) {
    errors.budget = "Budget is required";
  } else if (isNaN(Number(form.budget)) || Number(form.budget) <= 0) {
    errors.budget = "Budget must be a positive number";
  }

  if (!form.travelers?.trim()) {
    errors.travelers = "At least one traveler is required";
  } else {
    const travelerList = form.travelers
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    if (travelerList.length === 0) {
      errors.travelers = "Enter at least one valid traveler";
    } else if (travelerList.length > 9) {
      errors.travelers = "Maximum 9 travelers allowed";
    } else if (travelerList.some((name) => !/^[a-zA-Z\s]+$/.test(name))) {
      errors.travelers = "Traveler names should contain letters only";
    }
  }

  if (form.gender && !allowedGenders.includes(form.gender)) {
    errors.gender = "Invalid gender value";
  }

  if (!allowedStops.includes(form.stops)) {
    errors.stops = "Invalid stops preference";
  }

  return errors;
}

export default function TravelAgentOrchestrator() {
  const [darkMode, setDarkMode] = useState(false);
  const [form, setForm] = useState({
    from: "",
    to: "",
    date: "",
    returnDate: "",
    budget: "",
    travelers: "",
    gender: "",
    stops: "nonstop",
    tripType: "roundtrip",
  });

  const [phase, setPhase] = useState("input");
  const [logs, setLogs] = useState([]);
  const [errors, setErrors] = useState({});
  const [pipelineStep, setPipelineStep] = useState(-1);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [flights, setFlights] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [climate, setClimate] = useState(null);
  const [plan, setPlan] = useState(null);
  const [fromSuggestions, setFromSuggestions] = useState([]);
  const [toSuggestions, setToSuggestions] = useState([]);
  const [showFromSuggestions, setShowFromSuggestions] = useState(false);
  const [showToSuggestions, setShowToSuggestions] = useState(false);

  const logsEndRef = useRef(null);
  const fromDebounceRef = useRef(null);
  const toDebounceRef = useRef(null);

  const nights = form.tripType === "oneway" ? 0 : calcNights(form.date, form.returnDate);

  const pipelineSteps = [
    { agent: "orchestrator", label: "Receive" },
    { agent: "planning", label: "Plan" },
    { agent: "orchestrator", label: "Dispatch" },
    { agent: "flight", label: "Flights" },
    { agent: "hotel", label: "Hotels" },
    { agent: "climate", label: "Climate" },
  ];

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = (agent, message, delay = 0) =>
    new Promise((resolve) =>
      setTimeout(() => {
        const ts = new Date().toLocaleTimeString();
        setLogs((prev) => [...prev, { agent, message, timestamp: ts }]);
        resolve();
      }, delay)
    );

  const travelerCount = Math.max(
    1,
    (form.travelers || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean).length || 1
  );

  const googleFlightsRedirect = `https://www.google.com/travel/flights`;
  const bookingRedirect = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(
    form.to
  )}&checkin=${encodeURIComponent(form.date || "")}&checkout=${encodeURIComponent(
    form.returnDate || ""
  )}&no_rooms=1&group_adults=${travelerCount}`;

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "", returnDate: key === "date" ? "" : prev.returnDate }));
  };

  const fetchAirportSuggestions = async (query, field) => {
    const value = query.trim();

    if (value.length < 2) {
      if (field === "from") {
        setFromSuggestions([]);
        setShowFromSuggestions(false);
      } else {
        setToSuggestions([]);
        setShowToSuggestions(false);
      }
      return;
    }

    try {
      const url = new URL("/api/airport-suggestions", `${API_BASE}/`);
      url.searchParams.set("q", value);

      const res = await fetch(url.toString());
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Suggestion lookup failed");
      }

      const suggestions = data.suggestions || [];

      if (field === "from") {
        setFromSuggestions(suggestions);
        setShowFromSuggestions(true);
      } else {
        setToSuggestions(suggestions);
        setShowToSuggestions(true);
      }
    } catch (err) {
      console.error(`${field} suggestions error:`, err);
      if (field === "from") {
        setFromSuggestions([]);
        setShowFromSuggestions(false);
      } else {
        setToSuggestions([]);
        setShowToSuggestions(false);
      }
    }
  };

  const handleAirportInputChange = (field, value) => {
    updateField(field, value);

    if (field === "from") {
      setShowFromSuggestions(true);
      if (fromDebounceRef.current) clearTimeout(fromDebounceRef.current);
      fromDebounceRef.current = setTimeout(() => {
        fetchAirportSuggestions(value, "from");
      }, 350);
    } else {
      setShowToSuggestions(true);
      if (toDebounceRef.current) clearTimeout(toDebounceRef.current);
      toDebounceRef.current = setTimeout(() => {
        fetchAirportSuggestions(value, "to");
      }, 350);
    }
  };

  const selectSuggestion = (field, suggestion) => {
    const inputValue =
      suggestion.city ||
      suggestion.name ||
      suggestion.display_name ||
      (suggestion.label ? suggestion.label.replace(/\s*\([A-Z0-9]{3,4}\)\s*$/, "") : "") ||
      "";

    updateField(field, inputValue.trim());

    if (field === "from") {
      setFromSuggestions([]);
      setShowFromSuggestions(false);
    } else {
      setToSuggestions([]);
      setShowToSuggestions(false);
    }
  };

  const resetTrip = () => {
    setPhase("input");
    setLogs([]);
    setErrors({});
    setPipelineStep(-1);
    setSelectedFlight(null);
    setSelectedHotel(null);
    setClimate(null);
    setPlan(null);
    setFlights([]);
    setHotels([]);
    setFromSuggestions([]);
    setToSuggestions([]);
    setShowFromSuggestions(false);
    setShowToSuggestions(false);
  };

  const confirmTrip = () => {
    setPhase("confirmed");
  };

  const runOrchestrator = async () => {
    const validationErrors = validateForm(form);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      await addLog("orchestrator", "Validation failed. Please correct the highlighted fields.", 0);
      return;
    }

    setPhase("running");
    setLogs([]);
    setPipelineStep(0);
    setSelectedFlight(null);
    setSelectedHotel(null);
    setFlights([]);
    setHotels([]);
    setClimate(null);
    setPlan(null);

    try {
      const isOneWay = form.tripType === "oneway";
      const budget = parseInt(form.budget || 100000, 10);
      const flightBudget = isOneWay ? Math.round(budget * 0.6) : Math.round(budget * 0.45);
      const hotelBudget = isOneWay ? Math.round(budget * 0.2) : Math.round(budget * 0.35);
      const miscBudget = Math.round(budget * 0.2);

      await addLog("orchestrator", `Received ${isOneWay ? "one-way" : "round-trip"} request: ${form.from} → ${form.to}`, 300);
      await addLog(
        "orchestrator",
        isOneWay
          ? `Departure: ${formatDate(form.date)}`
          : `Dates: ${formatDate(form.date)} → ${formatDate(form.returnDate)} (${nights} nights)`,
        300
      );
      await addLog("orchestrator", `Budget: $${budget.toLocaleString()} | Travelers: ${travelerCount}`, 300);
      await addLog("orchestrator", "Dispatching to Planning Agent...", 300);

      setPipelineStep(1);
      await addLog("planning", "Creating route plan and budget split...", 400);

      setPlan({
        route: `${form.from} → ${form.to}`,
        flightBudget,
        hotelBudget,
        miscBudget,
        travelers: form.travelers,
        date: form.date,
        nights,
        isOneWay,
      });

      await addLog(
        "planning",
        `Flights: $${flightBudget.toLocaleString()} | Hotels: $${hotelBudget.toLocaleString()} | Misc: $${miscBudget.toLocaleString()}`,
        350
      );
      await addLog("planning", "Travel plan built. Returning to Orchestrator.", 300);

      setPipelineStep(2);
      await addLog("orchestrator", "Calling live APIs for flights, hotels, and climate...", 350);

      setPipelineStep(3);
      const flightUrl = new URL("/api/flights", `${API_BASE}/`);
      flightUrl.searchParams.set("origin", form.from);
      flightUrl.searchParams.set("destination", form.to);
      flightUrl.searchParams.set("departure_date", form.date);
      flightUrl.searchParams.set("adults", travelerCount.toString());
      if (!isOneWay && form.returnDate) {
        flightUrl.searchParams.set("return_date", form.returnDate);
      }

      const flightRes = await fetch(flightUrl.toString());
      const flightData = await flightRes.json();

      if (!flightRes.ok) {
        throw new Error(flightData.detail || "Flight API failed");
      }

      setFlights(flightData.flights || []);
      await addLog("flight", `Loaded ${flightData.flights?.length || 0} live flights from Google Flights source`, 350);

      if (!isOneWay) {
        setPipelineStep(4);
        const hotelUrl = new URL("/api/hotels", `${API_BASE}/`);
        hotelUrl.searchParams.set("city", form.to);
        hotelUrl.searchParams.set("checkin", form.date);
        hotelUrl.searchParams.set("checkout", form.returnDate);
        hotelUrl.searchParams.set("adults", travelerCount.toString());

        const hotelRes = await fetch(hotelUrl.toString());
        const hotelData = await hotelRes.json();

        if (!hotelRes.ok) {
          throw new Error(hotelData.detail || "Hotel API failed");
        }

        setHotels(hotelData.hotels || []);
        await addLog("hotel", `Loaded ${hotelData.hotels?.length || 0} live hotels from Booking.com source`, 350);
      } else {
        await addLog("hotel", "One-way trip: hotel search skipped.", 250);
      }

      setPipelineStep(5);
      const climateUrl = new URL("/api/climate", `${API_BASE}/`);
      climateUrl.searchParams.set("city", form.to);

      const climateRes = await fetch(climateUrl.toString());
      const climateData = await climateRes.json();

      if (!climateRes.ok) {
        throw new Error(climateData.detail || "Climate API failed");
      }

      setClimate(climateData);
      await addLog("climate", `Weather loaded: ${climateData.condition}, ${climateData.temp}`, 350);

      await addLog("orchestrator", "All live data loaded successfully.", 250);
      setPhase("results");
    } catch (err) {
      console.error("Live API error:", err);
      await addLog("orchestrator", `Error: ${err.message}`, 200);
      setPhase("results");
    }
  };

  const theme = {
    "--bg": darkMode ? "#0D0D12" : "#F5F3EF",
    "--card-bg": darkMode ? "#1A1A24" : "#FFFFFF",
    "--text-primary": darkMode ? "#E8E6E1" : "#1A1A2E",
    "--text-secondary": darkMode ? "#888" : "#666",
    "--border": darkMode ? "#2A2A38" : "#E0DDD5",
    "--input-bg": darkMode ? "#14141E" : "#F9F8F5",
    "--accent": "#6C5CE7",
  };

  const selectedFlightData = selectedFlight !== null ? flights[selectedFlight] : null;
  const selectedHotelData = selectedHotel !== null ? hotels[selectedHotel] : null;

  const estimatedTotal = selectedFlightData
    ? Number(selectedFlightData.price || 0) +
      (form.tripType === "roundtrip" && selectedHotelData ? Number(selectedHotelData.price || 0) * nights : 0)
    : 0;

  return (
    <div
      style={{
        ...theme,
        fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
        background: "var(--bg)",
        color: "var(--text-primary)",
        minHeight: "100vh",
        padding: 0,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700;0,9..40,800;1,9..40,400&family=Space+Mono:wght@400;700&display=swap');
        @keyframes fadeSlide { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(108,92,231,0.3); } 50% { box-shadow: 0 0 0 8px rgba(108,92,231,0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input, select, button { font-family: inherit; }
        a:hover { opacity: 0.85; }
      `}</style>

      <div
        style={{
          background: "var(--card-bg)",
          borderBottom: "1px solid var(--border)",
          padding: "16px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "linear-gradient(135deg, #6C5CE7, #00B894)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              color: "#fff",
              fontWeight: 800,
            }}
          >
            ◈
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em" }}>
              Travel Agent Orchestrator
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "'Space Mono', monospace" }}>
              live APIs · deploy frontend + backend on Railway
            </div>
          </div>
        </div>

        <button
          onClick={() => setDarkMode(!darkMode)}
          style={{
            background: "var(--input-bg)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "6px 12px",
            fontSize: 12,
            cursor: "pointer",
            color: "var(--text-primary)",
            fontWeight: 600,
          }}
        >
          {darkMode ? "☀ Light" : "◑ Dark"}
        </button>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px" }}>
        {phase === "input" && (
          <div style={{ animation: "fadeSlide 0.5s ease" }}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 6 }}>
                Plan your trip
              </h2>
              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Enter your travel details and let the orchestrator fetch live flights, hotels, and weather.
              </p>
            </div>

            <div
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: 24,
              }}
            >
              <div style={{ marginBottom: 20 }}>
                <div
                  style={{
                    display: "inline-flex",
                    borderRadius: 10,
                    overflow: "hidden",
                    border: "1px solid var(--border)",
                    background: "var(--input-bg)",
                  }}
                >
                  {[
                    { key: "oneway", label: "One way", icon: "→" },
                    { key: "roundtrip", label: "Round trip", icon: "⇄" },
                  ].map(({ key, label, icon }) => (
                    <button
                      key={key}
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          tripType: key,
                          ...(key === "oneway" ? { returnDate: "" } : {}),
                        }))
                      }
                      style={{
                        padding: "10px 20px",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        border: "none",
                        background: form.tripType === key ? "#6C5CE7" : "transparent",
                        color: form.tripType === key ? "#fff" : "var(--text-secondary)",
                        transition: "all 0.2s",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span style={{ fontSize: 15 }}>{icon}</span> {label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <SuggestionInput
                  label="From"
                  value={form.from}
                  placeholder="Delhi"
                  error={errors.from}
                  suggestions={fromSuggestions}
                  showSuggestions={showFromSuggestions}
                  onChange={(value) => handleAirportInputChange("from", value)}
                  onFocus={() => {
                    if (fromSuggestions.length > 0) setShowFromSuggestions(true);
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowFromSuggestions(false), 150);
                  }}
                  onSelect={(item) => selectSuggestion("from", item)}
                />

                <SuggestionInput
                  label="To"
                  value={form.to}
                  placeholder="Paris"
                  error={errors.to}
                  suggestions={toSuggestions}
                  showSuggestions={showToSuggestions}
                  onChange={(value) => handleAirportInputChange("to", value)}
                  onFocus={() => {
                    if (toSuggestions.length > 0) setShowToSuggestions(true);
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowToSuggestions(false), 150);
                  }}
                  onSelect={(item) => selectSuggestion("to", item)}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {[
                  { key: "date", label: "Departure date", placeholder: "", type: "date" },
                  ...(form.tripType === "roundtrip"
                    ? [{ key: "returnDate", label: "Return date", placeholder: "", type: "date" }]
                    : []),
                  { key: "budget", label: "Total budget ($)", placeholder: "100000", type: "number" },
                  { key: "gender", label: "Gender", placeholder: "Male / Female / Mixed", type: "text" },
                ].map(({ key, label, placeholder, type }) => (
                  <div key={key}>
                    <label
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--text-secondary)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        marginBottom: 6,
                        display: "block",
                      }}
                    >
                      {label}
                    </label>
                    <input
                      type={type}
                      placeholder={placeholder}
                      value={form[key]}
                      onChange={(e) => updateField(key, e.target.value)}
                      min={key === "returnDate" ? form.date : undefined}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        background: "var(--input-bg)",
                        fontSize: 14,
                        color: "var(--text-primary)",
                        outline: "none",
                      }}
                    />

                    {errors[key] && (
                      <div style={{ color: "#E17055", fontSize: 12, marginTop: 4 }}>{errors[key]}</div>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 16 }}>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  Travelers (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="Manaswi, Priya, Rahul"
                  value={form.travelers}
                  onChange={(e) => updateField("travelers", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--input-bg)",
                    fontSize: 14,
                    color: "var(--text-primary)",
                    outline: "none",
                  }}
                />
                {errors.travelers && (
                  <div style={{ color: "#E17055", fontSize: 12, marginTop: 4 }}>{errors.travelers}</div>
                )}
              </div>

              {form.tripType === "roundtrip" && nights > 0 && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "10px 14px",
                    background: "#6C5CE710",
                    border: "1px solid #6C5CE725",
                    borderRadius: 8,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: 12,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#6C5CE7",
                    flexWrap: "wrap",
                  }}
                >
                  <span>{nights} nights</span>
                  <span style={{ color: "var(--border)" }}>·</span>
                  <span>{nights + 1} days</span>
                  <span style={{ color: "var(--border)" }}>·</span>
                  <span>
                    {formatDate(form.date)} → {formatDate(form.returnDate)}
                  </span>
                </div>
              )}

              <button
                onClick={runOrchestrator}
                style={{
                  width: "100%",
                  marginTop: 24,
                  padding: "14px",
                  background: "linear-gradient(135deg, #6C5CE7, #00B894)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: "pointer",
                  letterSpacing: "0.02em",
                }}
              >
                Launch agents ◈
              </button>
            </div>
          </div>
        )}

        {(phase === "running" || phase === "results") && (
          <div style={{ animation: "fadeSlide 0.5s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>
                {phase === "running" ? "Agents working..." : "Trip results"}
              </h2>

              {phase === "results" && (
                <button
                  onClick={resetTrip}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    border: "1px solid var(--border)",
                    background: "var(--input-bg)",
                    color: "var(--text-primary)",
                  }}
                >
                  New trip
                </button>
              )}
            </div>

            <PipelineStatus steps={pipelineSteps} current={pipelineStep} />

            <div
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: 16,
                marginBottom: 20,
                maxHeight: 340,
                overflowY: "auto",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 8,
                  fontFamily: "'Space Mono', monospace",
                }}
              >
                Agent log
              </div>

              {logs.map((log, i) => (
                <LogEntry key={i} agent={log.agent} message={log.message} timestamp={log.timestamp} />
              ))}

              {phase === "running" && (
                <div style={{ textAlign: "center", padding: 16 }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      border: "3px solid var(--border)",
                      borderTopColor: "#6C5CE7",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite",
                      margin: "0 auto",
                    }}
                  />
                </div>
              )}

              <div ref={logsEndRef} />
            </div>

            {phase === "results" && (
              <>
                {form.tripType === "roundtrip" && <ItineraryCard form={form} nights={nights} climate={climate} />}

                {plan && (
                  <div
                    style={{
                      background: "var(--card-bg)",
                      border: "1px solid var(--border)",
                      borderRadius: 14,
                      padding: 20,
                      marginBottom: 20,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                      <AgentBadge agent="planning" />
                      <span style={{ fontSize: 14, fontWeight: 700 }}>Budget allocation</span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 4,
                        height: 28,
                        borderRadius: 8,
                        overflow: "hidden",
                        marginBottom: 12,
                      }}
                    >
                      <div
                        style={{
                          flex: plan.isOneWay ? 60 : 45,
                          background: "#0984E3",
                          borderRadius: "8px 0 0 8px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10,
                          color: "#fff",
                          fontWeight: 700,
                        }}
                      >
                        Flights {plan.isOneWay ? "60" : "45"}%
                      </div>
                      <div
                        style={{
                          flex: plan.isOneWay ? 20 : 35,
                          background: "#E17055",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10,
                          color: "#fff",
                          fontWeight: 700,
                        }}
                      >
                        Hotels {plan.isOneWay ? "20" : "35"}%
                      </div>
                      <div
                        style={{
                          flex: 20,
                          background: "#00B894",
                          borderRadius: "0 8px 8px 0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10,
                          color: "#fff",
                          fontWeight: 700,
                        }}
                      >
                        Misc 20%
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, fontSize: 13 }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontWeight: 800, color: "#0984E3" }}>${plan.flightBudget.toLocaleString()}</div>
                        <div style={{ fontSize: 10, color: "#888" }}>Flight{plan.isOneWay ? "" : "s"}</div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontWeight: 800, color: "#E17055" }}>${plan.hotelBudget.toLocaleString()}</div>
                        <div style={{ fontSize: 10, color: "#888" }}>
                          {plan.isOneWay ? "Hotels later" : `Hotels (${nights} nights)`}
                        </div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontWeight: 800, color: "#00B894" }}>${plan.miscBudget.toLocaleString()}</div>
                        <div style={{ fontSize: 10, color: "#888" }}>Misc / Activities</div>
                      </div>
                    </div>
                  </div>
                )}

                <div
                  style={{
                    background: "var(--card-bg)",
                    border: "1px solid var(--border)",
                    borderRadius: 14,
                    padding: 20,
                    marginBottom: 20,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 16,
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <AgentBadge agent="flight" />
                      <span style={{ fontSize: 14, fontWeight: 700 }}>Available flights</span>
                    </div>
                    <BookButton href={googleFlightsRedirect} label="Open Google Flights" color="#0984E3" />
                  </div>

                  {flights.length === 0 ? (
                    <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>No flights returned.</div>
                  ) : (
                    flights.map((f, i) => (
                      <FlightCard
                        key={i}
                        flight={f}
                        selected={selectedFlight === i}
                        onSelect={() => setSelectedFlight(i)}
                        redirectUrl={googleFlightsRedirect}
                      />
                    ))
                  )}
                </div>

                {form.tripType === "roundtrip" ? (
                  <div
                    style={{
                      background: "var(--card-bg)",
                      border: "1px solid var(--border)",
                      borderRadius: 14,
                      padding: 20,
                      marginBottom: 20,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 16,
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <AgentBadge agent="hotel" />
                        <span style={{ fontSize: 14, fontWeight: 700 }}>Available hotels</span>
                      </div>
                      <BookButton href={bookingRedirect} label="Open Booking.com" color="#E17055" />
                    </div>

                    {hotels.length === 0 ? (
                      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>No hotels returned.</div>
                    ) : (
                      hotels.map((h, i) => (
                        <HotelCard
                          key={i}
                          hotel={h}
                          selected={selectedHotel === i}
                          onSelect={() => setSelectedHotel(i)}
                          redirectUrl={bookingRedirect}
                          nights={nights}
                        />
                      ))
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      background: "var(--card-bg)",
                      border: "1px solid var(--border)",
                      borderRadius: 14,
                      padding: 20,
                      marginBottom: 20,
                      textAlign: "center",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <AgentBadge agent="hotel" />
                      <span style={{ fontSize: 14, fontWeight: 700 }}>Hotels</span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
                      One-way trip — book your hotel separately once you know your stay duration.
                    </div>
                    <BookButton href={bookingRedirect} label={`Search hotels in ${form.to} on Booking.com`} color="#E17055" />
                  </div>
                )}

                {climate && (
                  <div
                    style={{
                      background: "var(--card-bg)",
                      border: "1px solid var(--border)",
                      borderRadius: 14,
                      padding: 20,
                      marginBottom: 20,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                      <AgentBadge agent="climate" />
                      <span style={{ fontSize: 14, fontWeight: 700 }}>Weather forecast</span>
                    </div>
                    <ClimateCard climate={climate} />
                  </div>
                )}

                {selectedFlightData && (form.tripType === "oneway" || selectedHotelData) && (
                  <div
                    style={{
                      background: "linear-gradient(135deg, #6C5CE720, #00B89420)",
                      border: "2px solid #6C5CE750",
                      borderRadius: 14,
                      padding: 24,
                      animation: "fadeSlide 0.5s ease",
                      marginBottom: 20,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 800,
                        marginBottom: 16,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 20 }}>◈</span> Trip summary
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 13 }}>
                      <div>
                        <div style={{ color: "#888", fontSize: 10, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
                          Route
                        </div>
                        <div style={{ fontWeight: 700 }}>{form.from} → {form.to}</div>
                      </div>

                      <div>
                        <div style={{ color: "#888", fontSize: 10, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
                          Trip type
                        </div>
                        <div style={{ fontWeight: 700 }}>
                          {form.tripType === "oneway" ? "One way" : `${nights} nights · ${nights + 1} days`}
                        </div>
                      </div>

                      <div>
                        <div style={{ color: "#888", fontSize: 10, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
                          Dates
                        </div>
                        <div style={{ fontWeight: 700 }}>
                          {form.tripType === "oneway"
                            ? formatDate(form.date)
                            : `${formatDate(form.date)} → ${formatDate(form.returnDate)}`}
                        </div>
                      </div>

                      <div>
                        <div style={{ color: "#888", fontSize: 10, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
                          Travelers
                        </div>
                        <div style={{ fontWeight: 700 }}>{form.travelers || "1 traveler"}</div>
                      </div>

                      <div>
                        <div style={{ color: "#888", fontSize: 10, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
                          Flight
                        </div>
                        <div style={{ fontWeight: 700, color: "#0984E3" }}>
                          {selectedFlightData.airline} ·{" "}
                          {selectedFlightData.formattedPrice || `$${Number(selectedFlightData.price || 0).toLocaleString()}`}
                        </div>
                      </div>

                      {form.tripType === "roundtrip" && selectedHotelData && (
                        <div>
                          <div style={{ color: "#888", fontSize: 10, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
                            Hotel
                          </div>
                          <div style={{ fontWeight: 700, color: "#E17055" }}>
                            {selectedHotelData.name} ·{" "}
                            {selectedHotelData.formattedPrice ||
                              `${selectedHotelData.currency || "USD"} ${Number(selectedHotelData.price || 0).toLocaleString()}`}
                          </div>
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        marginTop: 16,
                        padding: "14px",
                        background: "#00B89420",
                        borderRadius: 8,
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>Estimated total</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: "#00B894" }}>
                        ${estimatedTotal.toLocaleString()}
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 18,
                        display: "flex",
                        justifyContent: "center",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <BookButton href={googleFlightsRedirect} label="Book flight on Google Flights" color="#0984E3" />
                      {form.tripType === "roundtrip" && (
                        <BookButton href={bookingRedirect} label="Book hotel on Booking.com" color="#E17055" />
                      )}
                      <button
                        onClick={confirmTrip}
                        style={{
                          padding: "10px 20px",
                          borderRadius: 8,
                          border: "none",
                          background: "#00B894",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: "pointer",
                        }}
                      >
                        OK / Confirm Trip
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {phase === "confirmed" && (
          <div style={{ animation: "fadeSlide 0.5s ease" }}>
            <div
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
                borderRadius: 16,
                padding: 32,
                textAlign: "center",
                maxWidth: 700,
                margin: "0 auto",
              }}
            >
              <div style={{ fontSize: 42, marginBottom: 12 }}>✓</div>

              <h2
                style={{
                  fontSize: 26,
                  fontWeight: 800,
                  marginBottom: 10,
                  color: "var(--text-primary)",
                }}
              >
                Thank you for choosing this website
              </h2>

              <p
                style={{
                  fontSize: 14,
                  color: "var(--text-secondary)",
                  marginBottom: 24,
                  lineHeight: 1.6,
                }}
              >
                Your selected trip summary is shown below. We hope you have a wonderful journey.
              </p>

              <div
                style={{
                  background: "var(--input-bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: 20,
                  textAlign: "left",
                  marginBottom: 24,
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>Selected Trip</div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, fontSize: 13 }}>
                  <div>
                    <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
                      Route
                    </div>
                    <div style={{ fontWeight: 700 }}>{form.from} → {form.to}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
                      Trip type
                    </div>
                    <div style={{ fontWeight: 700 }}>
                      {form.tripType === "oneway" ? "One way" : `${nights} nights · ${nights + 1} days`}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
                      Dates
                    </div>
                    <div style={{ fontWeight: 700 }}>
                      {form.tripType === "oneway"
                        ? formatDate(form.date)
                        : `${formatDate(form.date)} → ${formatDate(form.returnDate)}`}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
                      Travelers
                    </div>
                    <div style={{ fontWeight: 700 }}>{form.travelers || "1 traveler"}</div>
                  </div>

                  {selectedFlightData && (
                    <div>
                      <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
                        Flight
                      </div>
                      <div style={{ fontWeight: 700, color: "#0984E3" }}>
                        {selectedFlightData.airline} ·{" "}
                        {selectedFlightData.formattedPrice || `$${Number(selectedFlightData.price || 0).toLocaleString()}`}
                      </div>
                    </div>
                  )}

                  {selectedHotelData && (
                    <div>
                      <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
                        Hotel
                      </div>
                      <div style={{ fontWeight: 700, color: "#E17055" }}>
                        {selectedHotelData.name} ·{" "}
                        {selectedHotelData.formattedPrice ||
                          `${selectedHotelData.currency || "USD"} ${Number(selectedHotelData.price || 0).toLocaleString()}`}
                      </div>
                    </div>
                  )}
                </div>

                <div
                  style={{
                    marginTop: 16,
                    padding: "12px",
                    background: "#00B89420",
                    borderRadius: 8,
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>Estimated total</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#00B894" }}>
                    ${estimatedTotal.toLocaleString()}
                  </div>
                </div>
              </div>

              <button
                onClick={resetTrip}
                style={{
                  padding: "12px 24px",
                  borderRadius: 10,
                  border: "none",
                  background: "linear-gradient(135deg, #6C5CE7, #00B894)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Home Page
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
