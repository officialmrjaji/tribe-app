"use client";

import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { SafeStorageImage } from "@/components/media/safe-storage-image";

type ProfilePhotoGalleryProps = {
  children: ReactNode;
  label: string;
  photos: string[];
  initialIndex?: number;
};

export function ProfilePhotoGallery({
  children,
  initialIndex = 0,
  label,
  photos,
}: ProfilePhotoGalleryProps) {
  const visiblePhotos = useMemo(
    () => Array.from(new Set(photos.filter(Boolean))),
    [photos],
  );
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [isOpen, setIsOpen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const safeIndex = Math.min(activeIndex, Math.max(0, visiblePhotos.length - 1));
  const activePhoto = visiblePhotos[safeIndex];

  function openGallery() {
    if (visiblePhotos.length === 0) {
      return;
    }

    setActiveIndex(Math.min(initialIndex, visiblePhotos.length - 1));
    setIsZoomed(false);
    setIsOpen(true);
  }

  const closeGallery = useCallback(() => {
    setIsOpen(false);
    setIsZoomed(false);
  }, []);

  const goToNext = useCallback(() => {
    setIsZoomed(false);
    setActiveIndex((currentIndex) =>
      currentIndex + 1 >= visiblePhotos.length ? 0 : currentIndex + 1,
    );
  }, [visiblePhotos.length]);

  const goToPrevious = useCallback(() => {
    setIsZoomed(false);
    setActiveIndex((currentIndex) =>
      currentIndex - 1 < 0 ? visiblePhotos.length - 1 : currentIndex - 1,
    );
  }, [visiblePhotos.length]);

  function handleTouchEnd(touchEndX: number) {
    if (touchStartX === null) {
      return;
    }

    const delta = touchStartX - touchEndX;

    if (Math.abs(delta) > 40) {
      if (delta > 0) {
        goToNext();
      } else {
        goToPrevious();
      }
    }

    setTouchStartX(null);
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeGallery();
      }

      if (event.key === "ArrowRight" && visiblePhotos.length > 1) {
        goToNext();
      }

      if (event.key === "ArrowLeft" && visiblePhotos.length > 1) {
        goToPrevious();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeGallery, goToNext, goToPrevious, isOpen, visiblePhotos.length]);

  return (
    <>
      <button
        aria-label={label}
        className="group relative block overflow-hidden rounded-md text-left"
        onClick={(event) => {
          event.stopPropagation();
          openGallery();
        }}
        type="button"
      >
        {children}
        {visiblePhotos.length > 0 ? (
          <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md bg-black/45 text-white opacity-0 transition group-hover:opacity-100">
            <Maximize2 size={15} />
          </span>
        ) : null}
      </button>

      {isOpen && activePhoto ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-[90] flex flex-col bg-[#08110d]/95 text-white"
          role="dialog"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="text-sm font-semibold">
              {safeIndex + 1} of {visiblePhotos.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                aria-label={isZoomed ? "Zoom out" : "Zoom in"}
                className="flex h-10 w-10 items-center justify-center rounded-md border border-white/20 bg-white/10 transition hover:bg-white/20"
                onClick={() => setIsZoomed((value) => !value)}
                type="button"
              >
                {isZoomed ? <ZoomOut size={18} /> : <ZoomIn size={18} />}
              </button>
              <button
                aria-label="Close photo gallery"
                className="flex h-10 w-10 items-center justify-center rounded-md border border-white/20 bg-white/10 transition hover:bg-white/20"
                onClick={closeGallery}
                type="button"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div
            className="relative flex flex-1 items-center justify-center overflow-auto px-4 py-5"
            onTouchEnd={(event) =>
              handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)
            }
            onTouchStart={(event) =>
              setTouchStartX(event.touches[0]?.clientX ?? null)
            }
          >
            {visiblePhotos.length > 1 ? (
              <button
                aria-label="Previous photo"
                className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md border border-white/20 bg-white/10 transition hover:bg-white/20"
                onClick={goToPrevious}
                type="button"
              >
                <ChevronLeft size={22} />
              </button>
            ) : null}

            <div
              className={
                isZoomed
                  ? "relative h-[120vh] w-[120vw] max-w-none"
                  : "relative h-full max-h-[78vh] w-full max-w-5xl"
              }
            >
              <SafeStorageImage
                alt={label}
                className="object-contain"
                fill
                priority
                sizes="100vw"
                src={activePhoto}
              />
            </div>

            {visiblePhotos.length > 1 ? (
              <button
                aria-label="Next photo"
                className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md border border-white/20 bg-white/10 transition hover:bg-white/20"
                onClick={goToNext}
                type="button"
              >
                <ChevronRight size={22} />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
