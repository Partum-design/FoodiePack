export default function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`logo ${compact ? 'logo--compact' : ''}`} aria-label="FoodiePack">
      <span className="logo__mark" aria-hidden="true"><i /><b /></span>
      <span className="logo__word"><b>Foodie</b><strong>Pack</strong></span>
    </div>
  )
}
