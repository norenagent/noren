export function Backdrop() {
  return (
    <div aria-hidden className="backdrop">
      <video src="/media/day.mp4" autoPlay loop muted playsInline preload="auto" />
      <div className="backdrop-scrim" />
      <style>{`
        .backdrop { position: fixed; inset: 0; z-index: 0; overflow: hidden; background: #07130b; pointer-events: none; }
        .backdrop video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .backdrop-scrim { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(4,10,6,0.62), rgba(4,10,6,0.5) 50%, rgba(4,10,6,0.66)); }
      `}</style>
    </div>
  );
}
