"use client";

import Image from "next/image";
type Props = {
  src: string;
  alt: string;
  className?: string;
} & (
  | { fill: true; sizes?: string; width?: undefined; height?: undefined }
  | { width: number; height: number }
);

/** next/image wrap — double-click se global lightbox me zoom (server/public pages ke liye). */
export default function ZoomableImage({ src, alt, className, ...rest }: Props) {
  return (
    <Image
      src={src}
      alt={alt}
      {...rest}
      className={`${className || ""} cursor-zoom-in`}
      
    />
  );
}