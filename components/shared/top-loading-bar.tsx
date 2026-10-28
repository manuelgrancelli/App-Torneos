"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function TopLoadingBarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const tricklingRef = useRef<NodeJS.Timeout | null>(null);

  // Detener la barra y completar al 100% cuando la ruta o searchParams cambian
  useEffect(() => {
    if (progress > 0) {
      setProgress(100);
      if (tricklingRef.current) clearInterval(tricklingRef.current);

      timerRef.current = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 300);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (tricklingRef.current) clearInterval(tricklingRef.current);
    };
  }, [pathname, searchParams]);

  const start = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (tricklingRef.current) clearInterval(tricklingRef.current);

    setVisible(true);
    setProgress(20);

    tricklingRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 85) {
          if (tricklingRef.current) clearInterval(tricklingRef.current);
          return 85;
        }
        // Simular progreso incremental gradual
        const diff = Math.max(1, (85 - prev) * 0.15);
        return Math.min(85, prev + diff);
      });
    }, 200);
  };

  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      // Ignorar si se pulsó con Ctrl, Cmd, Shift, Alt o botón no primario
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) {
        return;
      }

      // Buscar el enlace ancestro más cercano
      const target = (e.target as Element)?.closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href) return;

      // Ignorar enlaces externos, de descarga, anclas hash puras o javascript
      if (
        href.startsWith("#") ||
        href.startsWith("javascript:") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        target.getAttribute("target") === "_blank" ||
        target.hasAttribute("download")
      ) {
        return;
      }

      try {
        const url = new URL(href, window.location.href);
        // Ignorar si es un dominio externo
        if (url.origin !== window.location.origin) return;

        // Ignorar si es exactamente la misma URL actual (incluyendo hash)
        if (url.pathname === window.location.pathname && url.search === window.location.search) {
          return;
        }

        // Iniciar la barra de carga
        start();
      } catch {
        // Enlace no parseable, no hacer nada
      }
    };

    document.addEventListener("click", handleAnchorClick, true);

    return () => {
      document.removeEventListener("click", handleAnchorClick, true);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (tricklingRef.current) clearInterval(tricklingRef.current);
    };
  }, []);

  if (!visible && progress === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none h-[2.5px] bg-transparent"
    >
      <div
        className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 shadow-[0_0_12px_rgba(245,158,11,0.9)] transition-all ease-out"
        style={{
          width: `${progress}%`,
          transitionDuration: progress === 100 ? "200ms" : "300ms",
          opacity: visible ? 1 : 0,
        }}
      />
    </div>
  );
}

export function TopLoadingBar() {
  return (
    <Suspense fallback={null}>
      <TopLoadingBarInner />
    </Suspense>
  );
}

