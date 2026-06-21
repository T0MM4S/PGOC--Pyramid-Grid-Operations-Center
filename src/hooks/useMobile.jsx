import { useState, useEffect } from "react";
import { IS_MOBILE_DEMO } from "../config/mobileConfig";

export function useMobile() {
  const [isMobile, setIsMobile] = useState(
    IS_MOBILE_DEMO || window.innerWidth < 768
  );

  useEffect(() => {
    if (IS_MOBILE_DEMO) return; // force mobile if flag set

    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  return isMobile;
}