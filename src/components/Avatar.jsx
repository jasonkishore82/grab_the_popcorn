export default function Avatar({ user, size = 40 }) {
  const hue = [...user.id].reduce((a, c) => a + c.charCodeAt(0) * 37, 0) % 360;
  const initials = user.name.split(' ').map((p) => p[0]).join('');
  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(140deg, hsl(${hue} 38% 46%), hsl(${(hue + 40) % 360} 42% 24%))`,
      }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}
