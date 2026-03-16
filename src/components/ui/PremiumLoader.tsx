export function PremiumLoader({ text = "Loading..." }: { text?: string }) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] w-full gap-6"
            style={{ fontFamily: "'Syne', sans-serif" }}>

            {/* Ring Loader */}
            <div className="relative w-[72px] h-[72px]">
                <svg viewBox="0 0 72 72" className="absolute inset-0 w-full h-full">
                    <circle cx="36" cy="36" r="30" fill="none"
                        stroke="#e0e7ff" strokeWidth="2.5" />
                    <circle cx="36" cy="36" r="30" fill="none"
                        stroke="#a5b4fc" strokeWidth="2.5" strokeLinecap="round"
                        strokeDasharray="40 230"
                        style={{
                            transformOrigin: "36px 36px",
                            animation: "spin 1.8s cubic-bezier(0.4,0,0.2,1) infinite reverse"
                        }} />
                    <circle cx="36" cy="36" r="30" fill="none"
                        stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round"
                        strokeDasharray="72 200"
                        style={{
                            transformOrigin: "36px 36px",
                            animation: "spin 1.3s cubic-bezier(0.4,0,0.2,1) infinite"
                        }} />
                </svg>
                <div className="absolute top-1/2 left-1/2 w-[5px] h-[5px] rounded-full -translate-x-1/2 -translate-y-1/2"
                    style={{ background: "#6366f1", animation: "dotPulse 1.3s ease-in-out infinite" }} />
            </div>

            {/* Text */}
            <span className="text-[20px] font-extrabold tracking-tight"
                style={{ color: "#1e1b4b", animation: "textFade 2.2s ease-in-out infinite" }}>
                {text}
            </span>

            {/* Shimmer bar */}
            <div className="w-[160px] h-[2px] rounded-full overflow-hidden" style={{ background: "#e0e7ff" }}>
                <div className="h-full w-1/2 rounded-full"
                    style={{
                        background: "linear-gradient(90deg, transparent, #6366f1, transparent)",
                        animation: "shimmer 1.5s ease-in-out infinite"
                    }} />
            </div>

            <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes dotPulse {
          0%, 100% { opacity: 0.3; transform: translate(-50%, -50%) scale(0.7); }
          50% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes textFade {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 1; }
        }
        @keyframes shimmer {
          0% { transform: translateX(-130%); }
          100% { transform: translateX(260%); }
        }
      `}</style>
        </div>
    );
}