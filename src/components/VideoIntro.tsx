import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import logoUrl from "@/assets/cpu-logo.png";

/**
 * VideoIntro
 * Plays video.mp4 from /public full-screen WITH SOUND.
 * Browsers block autoplay with sound until the user interacts.
 * If blocked, a "click to play" prompt appears. Once clicked, the video
 * plays with audio. The fade-to-black hands off to the CPU logo animation.
 */
export default function VideoIntro({ onDone }: { onDone: () => void }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [fading, setFading] = useState(false);
    const [blocked, setBlocked] = useState(false); // autoplay was blocked
    const calledRef = useRef(false);

    const triggerEnd = () => {
        if (calledRef.current) return;
        calledRef.current = true;
        setFading(true);
        // Wait for the black-fade transition to finish, then hand off
        setTimeout(onDone, 900);
    };

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleTimeUpdate = () => {
            if (!video.duration || calledRef.current) return;
            const remaining = video.duration - video.currentTime;
            if (remaining <= 0.85) triggerEnd();
        };

        const handleEnded = () => triggerEnd();

        video.addEventListener("timeupdate", handleTimeUpdate);
        video.addEventListener("ended", handleEnded);

        // Try to autoplay WITH sound first
        video.play().catch(() => {
            // Browser blocked autoplay with sound — show the click overlay
            setBlocked(true);
        });

        return () => {
            video.removeEventListener("timeupdate", handleTimeUpdate);
            video.removeEventListener("ended", handleEnded);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleUserClick = () => {
        const video = videoRef.current;
        if (!video) return;
        setBlocked(false);
        video.play().catch(() => triggerEnd());
    };

    return (
        <div className="fixed inset-0 z-[200] bg-black overflow-hidden">
            {/* The video — NOT muted so sound plays */}
            <video
                ref={videoRef}
                src="/video.mp4"
                playsInline
                preload="auto"
                className="absolute inset-0 w-full h-full object-cover"
                style={{ pointerEvents: "none" }}
            />

            {/* Click-to-play overlay — shown only when browser blocked autoplay */}
            <AnimatePresence>
                {blocked && (
                    <motion.div
                        key="click-prompt"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4 }}
                        className="absolute inset-0 z-20 flex flex-col items-center justify-center cursor-pointer"
                        style={{ background: "rgba(5,5,8,0.85)" }}
                        onClick={handleUserClick}
                    >
                        {/* CPU Logo Pulse */}
                        <motion.div
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                            className="flex items-center justify-center mb-6"
                        >
                            <img
                                src={logoUrl}
                                alt="CPU Club Logo"
                                className="w-24 h-24 sm:w-32 sm:h-32 object-contain"
                                style={{
                                    filter: "drop-shadow(0 0 15px rgba(240,180,41,0.5))",
                                    mixBlendMode: "screen",
                                }}
                            />
                        </motion.div>
                        <p className="font-display text-sm tracking-[0.35em] uppercase"
                            style={{ color: "rgba(240,180,41,0.9)", textShadow: "0 0 12px rgba(240,180,41,0.6)" }}>
                            Click to begin
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Skip button */}
            {!blocked && (
                <button
                    onClick={triggerEnd}
                    className="absolute bottom-8 right-8 z-30 text-white/50 hover:text-white/90 text-sm font-display tracking-widest uppercase transition-all duration-300"
                    style={{ textShadow: "0 0 10px rgba(255,255,255,0.3)" }}
                >
                    skip ›
                </button>
            )}

            {/* Fade-to-black overlay */}
            <AnimatePresence>
                {fading && (
                    <motion.div
                        key="fade"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.85, ease: "easeIn" }}
                        className="absolute inset-0 z-20 bg-black"
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
