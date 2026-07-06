// Presentational adaptive poster/folder card. Shared by the public NUMTHONG
// gallery and (later) the protected NT ACADEMY gallery.
//
// PRESENTATIONAL ONLY: it receives a ready-to-use image URL via `src` and knows
// nothing about Google Drive, file IDs, tokens, sessions, or any security logic.
// The caller is responsible for building `src` (a public Drive thumbnail URL, or
// a protected proxy URL like /api/leader/image/<token>?size=thumb).
//
// Behavior:
//  - Fixed 4:5 outer shell so every card in a grid is the same size.
//  - Poster shown IN FULL via object-fit: contain (default) — no crop, no distortion.
//  - The letterbox area is filled by a blurred + darkened copy of the SAME image
//    URL (one network request; the browser reuses the cached image).
//  - Title sits BELOW the artwork, never covering it.
//  - Folder without a poster → same-size shell with a centered icon.
//  - Optional per-card override: fit ('contain' | 'cover') and object position.
export default function AdaptivePosterCard({
  src,
  title,
  alt,
  href,
  hasPoster,
  fit = 'contain',
  position = 'center',
  loading = 'lazy',
  folderIcon = '📁',
  className = '',
  onClick,
}) {
  const showPoster = (hasPoster ?? !!src) && !!src;

  const inner = (
    <>
      <div className="apc-shell">
        {showPoster ? (
          <>
            <div
              className="apc-bg"
              style={{ backgroundImage: `url("${src}")` }}
              aria-hidden="true"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="apc-poster"
              src={src}
              alt={alt || title || ''}
              loading={loading}
              style={{ objectFit: fit, objectPosition: position }}
              onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
            />
          </>
        ) : (
          <div className="apc-folder" aria-hidden="true">
            <span className="apc-icon">{folderIcon}</span>
          </div>
        )}
      </div>
      <div className="apc-title">{title}</div>

      <style jsx>{`
        .apc-shell {
          position: relative;
          aspect-ratio: 4 / 5;
          background: #141414;
          border: 1px solid rgba(201, 168, 76, 0.28);
          border-radius: 14px;
          overflow: hidden;
        }
        .apc-bg {
          position: absolute;
          inset: 0;
          z-index: 0;
          background-size: cover;
          background-position: center;
          /* Blurred + darkened backdrop from the same image; scale hides blur edge bleed. */
          filter: blur(20px) brightness(0.42);
          transform: scale(1.18);
        }
        .apc-poster {
          position: absolute;
          inset: 0;
          z-index: 1;
          width: 100%;
          height: 100%;
          display: block;
        }
        .apc-folder {
          position: absolute;
          inset: 0;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .apc-icon {
          font-size: 46px;
          line-height: 1;
          opacity: 0.92;
        }
        .apc-title {
          margin-top: 9px;
          text-align: center;
          font-size: 14px;
          font-weight: 600;
          color: #f0ece4;
          line-height: 1.4;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
        @media (prefers-reduced-motion: reduce) {
          .apc-card { transition: none; }
        }
      `}</style>
    </>
  );

  const commonProps = {
    className: `apc-card ${className}`.trim(),
    'aria-label': title || alt || undefined,
  };

  if (href) {
    return (
      <a {...commonProps} href={href} onClick={onClick}>
        {inner}
        <style jsx>{`
          .apc-card { display: block; text-decoration: none; color: inherit; cursor: pointer; }
          .apc-card :global(.apc-shell) { transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease; }
          .apc-card:hover :global(.apc-shell) { transform: translateY(-4px); border-color: #c9a84c; box-shadow: 0 16px 46px rgba(201,168,76,0.25); }
          .apc-card:focus-visible :global(.apc-shell) { outline: 2px solid #c9a84c; outline-offset: 2px; }
          @media (prefers-reduced-motion: reduce) { .apc-card:hover :global(.apc-shell) { transform: none; } }
        `}</style>
      </a>
    );
  }

  return (
    <button {...commonProps} type="button" onClick={onClick}>
      {inner}
      <style jsx>{`
        .apc-card { display: block; width: 100%; padding: 0; margin: 0; border: none; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
        .apc-card :global(.apc-shell) { transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease; }
        .apc-card:hover :global(.apc-shell) { transform: translateY(-4px); border-color: #c9a84c; box-shadow: 0 16px 46px rgba(201,168,76,0.25); }
        .apc-card:focus-visible :global(.apc-shell) { outline: 2px solid #c9a84c; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { .apc-card:hover :global(.apc-shell) { transform: none; } }
      `}</style>
    </button>
  );
}
