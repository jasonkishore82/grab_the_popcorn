export default function Scores({ title }) {
  return (
    <div className="scores">
      <span title="Critics score">🍅 {title.critics}%</span>
      <span title="Audience score">🍿 {title.audience}%</span>
    </div>
  );
}
