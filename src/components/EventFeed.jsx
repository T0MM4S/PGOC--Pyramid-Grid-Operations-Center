import { useState, useEffect } from "react";
import { getEventLog } from "../utils/dataLoader";

const LEVEL_COLOR = { warn: "#ffc040", ok: "#00ff88", info: "#4db8ff" };

export default function EventFeed({ max = 5 }) {
  const [events, setEvents] = useState(() => getEventLog().slice(0, max));

  useEffect(() => {
    const handler = (e) => {
      setEvents(prev => [e.detail, ...prev].slice(0, max));
    };
    window.addEventListener("cityEvent", handler);
    return () => window.removeEventListener("cityEvent", handler);
  }, [max]);

  if (events.length === 0) {
    return <div className="ef-empty">MONITORING · NO EVENTS YET</div>;
  }

  return (
    <div className="ef-list">
      {events.map(ev => (
        <div key={ev.id} className="ef-row">
          <span className="ef-dot" style={{ color: LEVEL_COLOR[ev.level] || "#4db8ff" }}>●</span>
          <span className="ef-msg">{ev.message}</span>
        </div>
      ))}
    </div>
  );
}