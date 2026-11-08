export function HighlightText({
  text,
  highlight,
  className = "text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400",
}: {
  text: string;
  highlight?: string;
  className?: string;
}) {
  if (!highlight || !text.includes(highlight)) return <>{text}</>;
  const index = text.indexOf(highlight);
  return (
    <>
      {text.slice(0, index)}
      <span className={className}>{highlight}</span>
      {text.slice(index + highlight.length)}
    </>
  );
}
