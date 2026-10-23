export default function Stars({ value = 0, onChange }) {
  return (
    <div className={`stars ${onChange ? 'editable' : ''}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={n <= value ? 'on' : ''}
          onClick={() => onChange?.(n === value ? 0 : n)}
          disabled={!onChange}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
