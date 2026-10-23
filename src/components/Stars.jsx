import { useState } from 'react';
import Icon from './Icon';

export const RATING_LABELS = ['', 'Not for me', 'It was okay', 'Good', 'Great', 'Loved it'];

export default function Stars({ value = 0, onChange, size = 15 }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  if (!onChange) {
    return (
      <div className="stars" aria-label={`${value} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={n <= shown ? 'on' : ''}>
            <Icon name="star" size={size} fill strokeWidth={0} />
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className="stars editable" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={n === value}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          className={n <= shown ? 'on' : ''}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(n === value ? 0 : n)}
        >
          <Icon name="star" size={size} fill strokeWidth={0} />
        </button>
      ))}
    </div>
  );
}
