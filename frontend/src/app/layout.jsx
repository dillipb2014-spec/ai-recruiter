export const metadata = { title: "JUSPAY AI", description: "AI-Powered Recruitment Control Center" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style>{`
          @keyframes spin  { to { transform: rotate(360deg); } }
          @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
          * { box-sizing: border-box; }
          input[type=range] { -webkit-appearance: none; appearance: none; height: 4px; border-radius: 999px; background: transparent; pointer-events: none; }
          input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #2563eb; cursor: pointer; border: 2px solid #fff; box-shadow: 0 0 0 1px #2563eb; pointer-events: auto; }
          input[type=range]::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; background: #2563eb; cursor: pointer; border: 2px solid #fff; box-shadow: 0 0 0 1px #2563eb; pointer-events: auto; }
          input[type=range]:disabled::-webkit-slider-thumb { background: #9ca3af; box-shadow: 0 0 0 1px #9ca3af; cursor: not-allowed; }
          input[type=range]:disabled::-moz-range-thumb { background: #9ca3af; box-shadow: 0 0 0 1px #9ca3af; cursor: not-allowed; }
          select option { background: #1e1b4b; color: #fff; }
        `}</style>
      </head>
      <body style={{
        margin: 0,
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        background: "#f9fafb",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
      }}>
        {children}
      </body>
    </html>
  );
}
