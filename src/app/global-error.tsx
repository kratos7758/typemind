"use client";

/**
 * Last-resort boundary when the root layout itself fails. It replaces the whole
 * document, so it cannot rely on the design system: minimal inline styles, bilingual.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1.5rem", maxWidth: 640, margin: "0 auto" }}>
        <h1>Une erreur est survenue · Something went wrong</h1>
        <p>Tes séances déjà enregistrées ne sont pas perdues. · Sessions you already saved are not lost.</p>
        <button type="button" onClick={reset} style={{ marginTop: 16, padding: "8px 16px" }}>
          Réessayer · Try again
        </button>
      </body>
    </html>
  );
}
