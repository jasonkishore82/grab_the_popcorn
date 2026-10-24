import TitleCard from './TitleCard';

export default function Row({ title, subtitle, items }) {
  return (
    <section className="row">
      <div className="section-head">
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="row-scroll">
        {items.map((t, i) => (
          <TitleCard key={t.id} title={t} index={i} />
        ))}
      </div>
    </section>
  );
}
