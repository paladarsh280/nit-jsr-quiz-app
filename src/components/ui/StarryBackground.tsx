"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";

export function StarryBackground() {
    const { resolvedTheme } = useTheme();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted || resolvedTheme !== "dark") return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let animationFrameId: number;
        let particles: Particle[] = [];

        // Interactivity with mouse
        let mouse = { x: -1000, y: -1000 };

        const handleMouseMove = (e: MouseEvent) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        };

        const handleMouseLeave = () => {
            mouse.x = -1000;
            mouse.y = -1000;
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseout", handleMouseLeave);

        const setCanvasSize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            initParticles();
        };

        class Particle {
            x: number;
            y: number;
            vx: number;
            vy: number;
            radius: number;

            constructor() {
                this.x = Math.random() * canvas!.width;
                this.y = Math.random() * canvas!.height;
                this.vx = (Math.random() - 0.5) * 0.7; // Gentle speed
                this.vy = (Math.random() - 0.5) * 0.7;
                this.radius = Math.random() * 2 + 1.5; // Slightly larger atoms
            }

            draw() {
                if (!ctx) return;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(100, 160, 255, 0.8)";
                ctx.fill();
                
                // Add a glowing effect to the atom
                ctx.shadowBlur = 10;
                ctx.shadowColor = "rgba(100, 160, 255, 0.5)";
            }

            update() {
                if (this.x < 0 || this.x > canvas!.width) this.vx = -this.vx;
                if (this.y < 0 || this.y > canvas!.height) this.vy = -this.vy;
                this.x += this.vx;
                this.y += this.vy;

                // Move slightly away from mouse
                const dx = mouse.x - this.x;
                const dy = mouse.y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < 150) {
                    this.x -= dx * 0.02;
                    this.y -= dy * 0.02;
                }
            }
        }

        const initParticles = () => {
            particles = [];
            // Calculate optimal number of particles based on screen size
            const numParticles = Math.floor((canvas!.width * canvas!.height) / 12000); 
            for (let i = 0; i < Math.min(numParticles, 150); i++) { // cap at 150 for performance
                particles.push(new Particle());
            }
        };

        const drawLines = () => {
            if (!ctx) return;
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < 130) {
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        // Opacity reduces as distance increases
                        ctx.strokeStyle = `rgba(100, 160, 255, ${(1 - distance / 130) * 0.4})`;
                        ctx.lineWidth = 1;
                        ctx.stroke();
                    }
                }
                
                // Connect particles to mouse
                const mouseDx = particles[i].x - mouse.x;
                const mouseDy = particles[i].y - mouse.y;
                const mouseDistance = Math.sqrt(mouseDx * mouseDx + mouseDy * mouseDy);
                
                if (mouseDistance < 180) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(mouse.x, mouse.y);
                    ctx.strokeStyle = `rgba(100, 160, 255, ${(1 - mouseDistance / 180) * 0.3})`;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }
        };

        const animate = () => {
            if (!ctx) return;
            ctx.clearRect(0, 0, canvas!.width, canvas!.height);
            
            ctx.shadowBlur = 0; // Reset shadow for lines
            drawLines();

            particles.forEach((p) => {
                p.update();
                p.draw();
            });

            animationFrameId = requestAnimationFrame(animate);
        };

        setCanvasSize();
        animate();

        window.addEventListener("resize", setCanvasSize);

        return () => {
            window.removeEventListener("resize", setCanvasSize);
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseout", handleMouseLeave);
            cancelAnimationFrame(animationFrameId);
        };
    }, [mounted, resolvedTheme]);

    if (!mounted) return null;
    if (resolvedTheme !== "dark") return null;

    return (
        <div className="fixed inset-0 z-[-1] overflow-hidden bg-black pointer-events-none">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(15,23,42,0.8),_rgba(0,0,0,1))] pointer-events-none" />
            <canvas ref={canvasRef} className="absolute inset-0" />
        </div>
    );
}
