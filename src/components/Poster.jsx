export default function Poster({ title, size = 'md', onClick }) {
  const style = {
    background: `linear-gradient(160deg, hsl(${title.hue} 55% 42%), hsl(${(title.hue + 40) % 360} 45% 18%))`,
  };
  return (
    <div className={`poster poster-${size}`} style={style} onClick={onClick}>
      <span>{title.title}</span>
    </div>
  );
}
