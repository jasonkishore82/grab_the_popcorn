import { useEffect, useState } from 'react';
import Lanyard from './Lanyard.jsx';

// Draw the photo onto a 4:5 face that fades to dark at the bottom, with the name and handle over the fade.
function composeFace(url, person) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const W = 480;
      const H = 600;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      const scale = Math.max(W / img.width, H / img.height);
      ctx.drawImage(img, (W - img.width * scale) / 2, (H - img.height * scale) / 2, img.width * scale, img.height * scale);
      const fade = ctx.createLinearGradient(0, H * 0.45, 0, H);
      fade.addColorStop(0, 'rgba(10, 12, 10, 0)');
      fade.addColorStop(1, 'rgba(10, 12, 10, 0.96)');
      ctx.fillStyle = fade;
      ctx.fillRect(0, H * 0.45, W, H * 0.55);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      if (person?.name) {
        ctx.font = '600 38px Inter, system-ui, sans-serif';
        ctx.fillText(person.name, W / 2, H - 62, W - 48);
      }
      if (person?.handle) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '400 26px Inter, system-ui, sans-serif';
        ctx.fillText(`@${person.handle}`, W / 2, H - 24, W - 48);
      }
      try {
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      } catch {
        resolve(url); // a cross-origin picture cannot be re-drawn; show it as it is
      }
    };
    img.onerror = () => resolve(url);
    img.src = url;
  });
}

// Hanging ID card for a user's profile: their picture on the front, fading down into their name.
// Give it a parent with an explicit width and height.
export default function ProfileLanyard({ person, ...props }) {
  const [face, setFace] = useState();
  useEffect(() => {
    let live = true;
    if (!person?.avatar) {
      setFace(undefined);
      return undefined;
    }
    composeFace(person.avatar, person).then((url) => live && setFace(url));
    return () => {
      live = false;
    };
  }, [person?.avatar, person?.name, person?.handle]);
  return <Lanyard frontImage={face} {...props} />;
}
