export default function FloatingDecor() {
  return (
    <div className="floating-decor" aria-hidden="true">
      <span className="floating-decor__shape floating-decor__shape--1" />
      <span className="floating-decor__shape floating-decor__shape--2" />
      <span className="floating-decor__shape floating-decor__shape--3" />
      <svg className="floating-decor__sprout floating-decor__sprout--1" viewBox="0 0 40 34">
        <path d="M20 33C20 33 20 20 8 14 2 11 0 4 0 4c0 0 9-2 15 4 5 5 5 12 5 12" />
        <path d="M20 33C20 33 20 18 32 12 38 9 40 2 40 2c0 0-9-2-15 4-5 5-5 12-5 12" />
      </svg>
      <svg className="floating-decor__sprout floating-decor__sprout--2" viewBox="0 0 40 34">
        <path d="M20 33C20 33 20 20 8 14 2 11 0 4 0 4c0 0 9-2 15 4 5 5 5 12 5 12" />
        <path d="M20 33C20 33 20 18 32 12 38 9 40 2 40 2c0 0-9-2-15 4-5 5-5 12-5 12" />
      </svg>
    </div>
  )
}
