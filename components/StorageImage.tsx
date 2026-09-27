import Image from "next/image";

// Photos and avatars uploaded to our Supabase storage go through next/image
// (resized and cached; see images in next.config.ts). Anything else, like an
// outside link in demo data, falls back to a plain <img> rather than making
// next/image throw for an unlisted host.
const STORAGE_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`;

type Props = { src: string; alt: string; className?: string } & (
  | { width: number; height: number; fill?: never; sizes?: never }
  | { fill: true; sizes: string; width?: never; height?: never }
);

export function StorageImage({ src, alt, className, ...size }: Props) {
  if (src.startsWith(STORAGE_PREFIX)) {
    return size.fill ? (
      <Image src={src} alt={alt} fill sizes={size.sizes} className={className} />
    ) : (
      <Image src={src} alt={alt} width={size.width} height={size.height} className={className} />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={size.fill ? `absolute inset-0 w-full h-full ${className ?? ""}` : className}
    />
  );
}
