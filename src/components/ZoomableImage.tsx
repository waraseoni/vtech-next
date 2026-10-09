"use client";

import { useState } from "react";
import Image from "next/image";
import type { ImageProps } from "next/image";
import Lightbox from "./Lightbox";

type Props = Omit<ImageProps, "onClick" | "onDoubleClick"> & {
  /** Lightbox me Edit/Crop button. Flow ke dauran lightbox band → crop → wapas. */
  onEdit?: () => void | Promise<void>;
};

/**
 * next/image drop-in — click ya double-click par full-screen Lightbox khulta
 * hai (zoom in/out: +/−, wheel, pinch, double-click toggle; drag-pan; ESC).
 * Row/link ke click par stopPropagation — photo click = zoom, row click = nav.
 * onEdit diya ho to Edit button aata hai: lightbox band hokar caller ka crop
 * flow chalta hai, promise settle hone par updated photo ke saath wapas.
 */
export default function ZoomableImage({ className, alt, src, onEdit, ...rest }: Props) {
  const [open, setOpen] = useState(false);
  const href = typeof src === "string" ? src : null;

  return (
    <>
      <Image
        src={src}
        alt={alt}
        {...rest}
        className={`${className || ""} cursor-zoom-in`}
        onClick={(e) => {
          e.stopPropagation();
          if (href) setOpen(true);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (href) setOpen(true);
        }}
      />
      {open && href && (
        <Lightbox
          src={href}
          alt={alt}
          onClose={() => setOpen(false)}
          onEdit={
            onEdit
              ? () => {
                  setOpen(false);
                  void (async () => {
                    try {
                      await onEdit();
                    } finally {
                      setOpen(true);
                    }
                  })();
                }
              : undefined
          }
        />
      )}
    </>
  );
}
