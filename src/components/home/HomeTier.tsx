/** A quiet divider that says how the sections below it relate to the forecast above. */
export default function HomeTier({ label, note }: { label: string; note: string }) {
  return (
    <div className="home-tier" role="separator" aria-label={`${label}: ${note}`}>
      <span className="home-tier-label">{label}</span>
      <span className="home-tier-note">{note}</span>
    </div>
  )
}
