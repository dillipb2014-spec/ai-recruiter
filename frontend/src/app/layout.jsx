export const metadata = { title: "JUSPAY AI", description: "AI-Powered Recruitment Control Center" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap"
          rel="stylesheet"
        />
        <style>{`
          @keyframes spin  { to { transform: rotate(360deg); } }
          @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
          * { box-sizing: border-box; }
          input[type=range] { -webkit-appearance: none; appearance: none; height: 4px; border-radius: 999px; }
          input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #818cf8; cursor: pointer; }
          select option { background: #1e1b4b; color: #fff; }
        `}</style>
      </head>
      <body style={{
        margin: 0,
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        background: "#f9fafb",
        WebkitFontSmoothing: "antialiased",
      }}>
        {children}
      </body>
    </html>
  );
}
