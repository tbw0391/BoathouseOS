import Image from "next/image";
import type { ReactNode } from "react";
import type { GuidePhoto } from "@/lib/guidePhotos";

// A guide photo with its required credit (author, license, source) under it.
// Children are drawn on top of the photo (e.g. numbered markers placed in %).
export function GuidePhotoFigure({
  photo,
  caption,
  children,
  className = "",
}: {
  photo: GuidePhoto;
  caption?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <figure className={className}>
      <div className="relative">
        <Image
          src={photo.src}
          width={photo.width}
          height={photo.height}
          alt={photo.alt}
          sizes="(max-width: 768px) 100vw, 768px"
          className="w-full h-auto rounded-lg"
        />
        {children}
      </div>
      {caption && <figcaption className="text-sm mt-1">{caption}</figcaption>}
      <p className="text-[11px] text-gray-500 mt-0.5">
        Credit:{" "}
        <a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
          {photo.author}
        </a>
        ,{" "}
        {photo.licenseUrl ? (
          <a href={photo.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline">
            {photo.license}
          </a>
        ) : (
          photo.license
        )}
        , via Wikimedia Commons
      </p>
    </figure>
  );
}

// A numbered marker on a photo, placed by percent of its width/height.
export function PhotoMarker({ n, x, y }: { n: number; x: number; y: number }) {
  return (
    <span
      className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[var(--color-primary)] text-white text-xs sm:text-sm font-bold flex items-center justify-center ring-2 ring-white shadow"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {n}
    </span>
  );
}
