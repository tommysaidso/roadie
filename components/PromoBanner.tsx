// Full-width promo poster banner - the GPT-designed marketing art, used as
// page dressing. Rounded, subtle border, capped height so it decorates
// without eating the page. Plain <img>: assets live in /public/promo.
export default function PromoBanner({ src, alt, maxH = 260 }: { src: string; alt: string; maxH?: number }) {
  return (
    <div className="card overflow-hidden p-0 mb-4">
      <img
        src={src}
        alt={alt}
        className="w-full object-cover"
        style={{ maxHeight: maxH, objectPosition: "center 35%" }}
        loading="lazy"
      />
    </div>
  );
}
