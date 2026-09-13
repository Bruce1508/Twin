/** The one visual idea this app is built around: a wrong span struck through
 *  in red pen, corrected in green pen. Every page that shows an error used to
 *  reimplement this with its own ad-hoc colors — this is the single source. */
export default function CorrectionMark({
  excerpt,
  correction,
}: {
  excerpt: string | null;
  correction: string;
}) {
  return (
    <p className="font-serif text-[0.95em] leading-relaxed">
      {excerpt && (
        <>
          <span className="text-correction-red line-through decoration-2">{excerpt}</span>
          <span className="text-ink-faint mx-1.5 not-italic font-sans">→</span>
        </>
      )}
      <span className="text-correction-green">{correction}</span>
    </p>
  );
}
