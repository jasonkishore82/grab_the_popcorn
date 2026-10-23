export default function Avatar({ user, size = 40 }) {
  const hue = [...user.id].reduce((a, c) => a + c.charCodeAt(0) * 37, 0) % 360;
  const initials = user.name.split(' ').map((p) => p[0]).join('');
  return (
    <div className="avatar" style={{ width: size, height: size, background: `hsl(${hue} 45% 40%)`, fontSize: size * 0.38 }}>
      {initials}
    </div>
  );
}
