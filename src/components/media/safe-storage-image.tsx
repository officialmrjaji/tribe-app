"use client";

import { ImageOff } from "lucide-react";
import Image, { type ImageProps } from "next/image";
import { useState } from "react";

type SafeStorageImageProps = Omit<ImageProps, "alt" | "src"> & {
  alt: string;
  fallbackClassName?: string;
  src?: ImageProps["src"] | null;
};

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export function SafeStorageImage({
  alt,
  className,
  fallbackClassName,
  onError,
  src,
  unoptimized,
  ...props
}: SafeStorageImageProps) {
  const [failed, setFailed] = useState(false);
  const normalizedSrc = normalizeSrc(src);

  if (!normalizedSrc || failed) {
    return (
      <span
        aria-label={alt}
        className={cx(
          "flex items-center justify-center bg-[#e2e6dc] text-[#607265]",
          props.fill ? "absolute inset-0 h-full w-full" : undefined,
          fallbackClassName ?? className,
        )}
        role="img"
      >
        <ImageOff aria-hidden="true" size={22} />
      </span>
    );
  }

  return (
    <Image
      {...props}
      alt={alt}
      className={className}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
      src={normalizedSrc}
      unoptimized={unoptimized ?? isSupabaseStorageUrl(normalizedSrc)}
    />
  );
}

function normalizeSrc(src: SafeStorageImageProps["src"]) {
  if (typeof src === "string") {
    const trimmedSrc = src.trim();
    return trimmedSrc.length > 0 ? trimmedSrc : null;
  }

  return src ?? null;
}

function isSupabaseStorageUrl(src: ImageProps["src"]) {
  if (typeof src !== "string") {
    return false;
  }

  try {
    const url = new URL(src);
    return url.pathname.includes("/storage/v1/object/");
  } catch {
    return src.includes("/storage/v1/object/");
  }
}
