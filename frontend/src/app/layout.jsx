export const metadata = { title: "Juspay AI Recruiter", description: "Intelligent candidate screening and evaluation" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <style>{`
          @keyframes spin  { to { transform: rotate(360deg); } }
          @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
          * { box-sizing: border-box; }
          input[type=range] { -webkit-appearance: none; appearance: none; height: 4px; border-radius: 999px; background: transparent; pointer-events: none; }
          input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #2563eb; cursor: pointer; border: 2px solid #fff; box-shadow: 0 0 0 1px #2563eb; pointer-events: auto; }
          input[type=range]::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; background: #2563eb; cursor: pointer; border: 2px solid #fff; box-shadow: 0 0 0 1px #2563eb; pointer-events: auto; }
          input[type=range]:disabled::-webkit-slider-thumb { background: #9ca3af; box-shadow: 0 0 0 1px #9ca3af; cursor: not-allowed; }
          input[type=range]:disabled::-moz-range-thumb { background: #9ca3af; box-shadow: 0 0 0 1px #9ca3af; cursor: not-allowed; }
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
