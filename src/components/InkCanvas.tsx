import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface InkCanvasProps {
    chapterKey: string;
    onExit: () => void;
    texture: 'parchment' | 'stone';
}

interface Point {
    x: number;
    y: number;
}

interface Line {
    points: Point[];
    color: string;
    width: number;
}

export const InkCanvas: React.FC<InkCanvasProps> = ({ chapterKey, onExit, texture }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [lines, setLines] = useState<Line[]>([]);
    const [currentLine, setCurrentLine] = useState<Point[]>([]);

    // Load saved ink for this chapter
    useEffect(() => {
        const saved = localStorage.getItem(`scribe_ink_${chapterKey}`);
        if (saved) {
            try {
                setLines(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to load ink data:", e);
            }
        } else {
            setLines([]);
        }
    }, [chapterKey]);

    // Save ink when lines change
    useEffect(() => {
        if (lines.length > 0) {
            localStorage.setItem(`scribe_ink_${chapterKey}`, JSON.stringify(lines));
        }
    }, [lines, chapterKey]);

    const redraw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        const drawLine = (line: Line) => {
            if (line.points.length < 2) return;
            ctx.beginPath();
            ctx.strokeStyle = line.color;
            ctx.lineWidth = line.width;
            ctx.moveTo(line.points[0].x, line.points[0].y);
            for (let i = 1; i < line.points.length; i++) {
                ctx.lineTo(line.points[i].x, line.points[i].y);
            }
            ctx.stroke();
        };

        lines.forEach(drawLine);
        if (currentLine.length > 1) {
            drawLine({ points: currentLine, color: texture === 'parchment' ? '#3e2723' : '#e0e0e0', width: 2 });
        }
    }, [lines, currentLine, texture]);

    useEffect(() => {
        const handleResize = () => {
            const canvas = canvasRef.current;
            if (canvas) {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
                redraw();
            }
        };
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, [redraw]);

    useEffect(() => {
        redraw();
    }, [redraw]);

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDrawing(true);
        const pos = getPos(e);
        setCurrentLine([pos]);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const pos = getPos(e);
        setCurrentLine(prev => [...prev, pos]);
    };

    const stopDrawing = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        if (currentLine.length > 1) {
            setLines(prev => [...prev, {
                points: currentLine,
                color: texture === 'parchment' ? '#3e2723' : '#e0e0e0',
                width: 2
            }]);
        }
        setCurrentLine([]);
    };

    const getPos = (e: React.MouseEvent | React.TouchEvent): Point => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const clearCanvas = () => {
        setLines([]);
        localStorage.removeItem(`scribe_ink_${chapterKey}`);
    };

    return (
        <div className="fixed inset-0 z-50 pointer-events-none">
            <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="absolute inset-0 pointer-events-auto cursor-crosshair"
            />

            {/* Hidden Exit Control - Double tap top right */}
            <div
                className="absolute top-0 right-0 w-24 h-24 pointer-events-auto z-[60] cursor-pointer"
                onDoubleClick={onExit}
                title="Double-click to exit Scribe Mode"
            />

            {/* Subtle Hint */}
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.3em] text-gray-400/30 font-bold pointer-events-none select-none">
                Ink directly on the page • Double-click top right to exit
            </div>

            {/* Clear Button - Bottom right ghost */}
            <button
                onClick={clearCanvas}
                className="absolute bottom-10 right-10 p-4 rounded-full bg-white/5 hover:bg-white/10 text-gray-400/20 hover:text-gray-400/80 transition-all pointer-events-auto"
                title="Clear Inking"
            >
                Clear
            </button>
        </div>
    );
};
