import { useEffect, useRef, useState } from "react";

/*
  VideoEmbed: click-to-play YouTube embed (Nick, Oct 25,
  2026). The video's own final frame is the face, so the
  page carries no iframe weight until a visitor asks for
  the video. On click the IFrame API builds the player and
  sets the volume to half on ready, which desktop honors
  and mobile ignores by platform rule. If the API stalls,
  a plain autoplay iframe takes over so the click always
  ends in a playing video.
*/
let apiPromise = null;
function loadApi() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prev) prev();
        resolve(window.YT);
      };
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    });
  }
  return apiPromise;
}

export default function VideoEmbed({ videoId, poster, label, posterAlt }) {
  const [on, setOn] = useState(false);
  const mountRef = useRef(null);

  useEffect(() => {
    if (!on) return;
    let dead = false;
    let player = null;
    const fallbackTimer = setTimeout(() => {
      if (dead || player || !mountRef.current) return;
      mountRef.current.innerHTML = "";
      const f = document.createElement("iframe");
      f.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1`;
      f.allow = "autoplay; encrypted-media; picture-in-picture";
      f.allowFullscreen = true;
      f.className = "video-frame";
      mountRef.current.appendChild(f);
    }, 3000);
    loadApi().then((YT) => {
      if (dead || !mountRef.current) return;
      clearTimeout(fallbackTimer);
      player = new YT.Player(mountRef.current, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: { autoplay: 1, rel: 0, playsinline: 1 },
        events: {
          onReady: (e) => {
            e.target.setVolume(50);
            e.target.playVideo();
          },
        },
      });
    });
    return () => {
      dead = true;
      clearTimeout(fallbackTimer);
      if (player && player.destroy) player.destroy();
    };
  }, [on, videoId]);

  if (!on) {
    return (
      <button
        type="button"
        className="video-facade"
        onClick={() => setOn(true)}
        aria-label={label}
      >
        <img src={poster} alt={posterAlt} />
        <span className="video-play" aria-hidden="true">
          <span className="video-play-tri" />
        </span>
        <span className="video-facade-label">{label}</span>
      </button>
    );
  }
  return (
    <div className="video-shell">
      <div ref={mountRef} className="video-mount" />
    </div>
  );
}
