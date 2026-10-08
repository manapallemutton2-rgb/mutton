import { useCallback, useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

const POSTERS = ["/1poster.jpg", "/2poster.jpg"];

export function PosterPopup() {
  const [open, setOpen] = useState(true);
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);

  const close = useCallback(() => setOpen(false), []);
  const go = useCallback(
    (dir: 1 | -1) => setIndex((i) => (i + dir + POSTERS.length) % POSTERS.length),
    [],
  );

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close, go]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Offers and announcements"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-background shadow-2xl">
        <button
          onClick={close}
          aria-label="Close popup"
          className="absolute right-2 top-2 z-10 rounded-full bg-black/60 p-2 text-white transition hover:bg-black/80 active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>

        <div
          className="relative max-h-[75vh] w-full touch-pan-y select-none overflow-hidden bg-[#FFF8EC]"
          onTouchStart={(e) => {
            touchX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (dx < -40) go(1);
            else if (dx > 40) go(-1);
            touchX.current = null;
          }}
        >
          <img
            key={POSTERS[index]}
            src={POSTERS[index]}
            alt={index === 0 ? "Mana Palle Products launch offer" : "Why Mana Palle is different"}
            className="max-h-[75vh] w-full object-contain"
            draggable={false}
          />

          {POSTERS.length > 1 && (
            <>
              <button
                onClick={() => go(-1)}
                aria-label="Previous poster"
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white transition hover:bg-black/80 active:scale-95"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => go(1)}
                aria-label="Next poster"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white transition hover:bg-black/80 active:scale-95"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 bg-background px-4 pt-3">
          {POSTERS.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Go to poster ${i + 1}`}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === index ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
            />
          ))}
          <span className="ml-2 text-xs font-medium text-muted-foreground">
            {index + 1} / {POSTERS.length}
          </span>
        </div>

        <div className="bg-background p-4">
          <button
            onClick={close}
            className="w-full rounded-xl bg-primary py-3 text-base font-semibold text-primary-foreground transition hover:opacity-90 active:scale-[0.98]"
          >
            Start Shopping
          </button>
        </div>
      </div>
    </div>
  );
}
