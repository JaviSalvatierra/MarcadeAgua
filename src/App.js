import React, { useState, useRef, useEffect, useCallback } from 'react';
// Importa los iconos de Lucide React, incluyendo HelpCircle para el botón de ayuda
import { FileUp, ImagePlus, RotateCcw, Download, SlidersHorizontal, Trash2, HelpCircle } from 'lucide-react';

// Componente principal de la aplicación
const App = () => {
    // Estados para las imágenes y sus propiedades
    const [baseImageSrc, setBaseImageSrc] = useState(null); // URL de la imagen base
    const [watermarks, setWatermarks] = useState([]); // [{ id, src, obj, x, y, scale, opacity, name }]
    const [nextWatermarkId, setNextWatermarkId] = useState(0); // Para generar IDs únicos para las marcas de agua
    const [activeWatermarkId, setActiveWatermarkId] = useState(null); // ID de la marca de agua actualmente seleccionada
    const [loading, setLoading] = useState(false); // Estado de carga
    const [error, setError] = useState(null); // Estado de error
    const [showAdjustmentPanel, setShowAdjustmentPanel] = useState(false); // Controla la visibilidad del panel de ajustes modal
    const [showHelpModal, setShowHelpModal] = useState(false); // Nuevo estado para controlar la visibilidad del modal de ayuda
    const [modalOpacity, setModalOpacity] = useState(1.0); // Nuevo estado para la opacidad del modal

    // Estados para la funcionalidad de arrastre
    const [isDragging, setIsDragging] = useState(false);
    const [dragStartX, setDragStartX] = useState(0);
    const [dragStartY, setDragStartY] = useState(0);
    const [initialWatermarkX, setInitialWatermarkX] = useState(0);
    const [initialWatermarkY, setInitialWatermarkY] = useState(0);

    // Referencias para el arrastre y la animación
    const currentDragOffsetRef = useRef({ dx: 0, dy: 0 }); // Almacena el desplazamiento actual durante el arrastre
    const animationFrameIdRef = useRef(null); // ID del requestAnimationFrame para cancelar
    const activeWatermarkRef = useRef(null); // Referencia a la marca de agua activa para manipulación directa durante el arrastre
    const loadedBaseImageRef = useRef(null); // Referencia para almacenar el objeto Image de la imagen base ya cargada

    // Referencias al elemento canvas y a los inputs de archivo
    const canvasRef = useRef(null);
    const baseImageInputRef = useRef(null); // Referencia para el input de la imagen base
    const watermarkInputRef = useRef(null); // Referencia para el input de la marca de agua

    // Referencia para el contenedor del canvas, que observaremos con ResizeObserver
    const canvasContainerRef = useRef(null);

    // Usamos un Map para almacenar los límites de cada marca de agua por su ID
    const allWatermarkBounds = useRef(new Map());

    // Función auxiliar para cargar una imagen
    const loadImage = useCallback((src) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }, []);

    // Función para dibujar las imágenes en el canvas
    // Ahora acepta un dragOffset opcional para dibujar la marca de agua activa en su posición temporal
    const drawImagesOnCanvas = useCallback(async (drawSelectionBorder = true, dragOffset = { dx: 0, dy: 0 }) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Limpiar el canvas

        try {
            const baseImage = loadedBaseImageRef.current;

            if (baseImage && baseImageSrc) {
                // Lógica para redimensionar la imagen base para ajustarse al canvas
                const { width, height } = canvas;
                let scale = 1;

                if (baseImage.width > width || baseImage.height > height) {
                    scale = Math.min(width / baseImage.width, height / baseImage.height);
                }

                const scaledWidth = baseImage.width * scale;
                const scaledHeight = baseImage.height * scale;
                const offsetX = (width - scaledWidth) / 2;
                const offsetY = (height - scaledHeight) / 2;

                ctx.drawImage(baseImage, offsetX, offsetY, scaledWidth, scaledHeight);
            } else {
                // Tamaño predeterminado si no hay imagen base
                ctx.fillStyle = '#f0f0f0';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#888';
                ctx.font = '20px Inter';
                ctx.textAlign = 'center';
                ctx.fillText('Sube una imagen base', canvas.width / 2, canvas.height / 2);
            }

            // Dibujar todas las marcas de agua
            for (const watermark of watermarks) {
                if (baseImage && watermark.obj) {
                    let currentX = watermark.x;
                    let currentY = watermark.y;

                    if (isDragging && activeWatermarkId === watermark.id && activeWatermarkRef.current) {
                        currentX = initialWatermarkX + dragOffset.dx;
                        currentY = initialWatermarkY + dragOffset.dy;
                    }

                    const scaledWatermarkWidth = watermark.obj.width * watermark.scale;
                    const scaledWatermarkHeight = watermark.obj.height * watermark.scale;

                    const actualX = Math.max(0, Math.min(currentX, canvas.width - scaledWatermarkWidth));
                    const actualY = Math.max(0, Math.min(currentY, canvas.height - scaledWatermarkHeight));

                    // Aplica la opacidad a la marca de agua antes de dibujarla
                    ctx.globalAlpha = watermark.opacity;

                    ctx.drawImage(watermark.obj, actualX, actualY, scaledWatermarkWidth, scaledWatermarkHeight);

                    // Restablece la opacidad del contexto a 1.0 para que otros elementos no se vean afectados
                    ctx.globalAlpha = 1.0;

                    allWatermarkBounds.current.set(watermark.id, {
                        x: actualX,
                        y: actualY,
                        width: scaledWatermarkWidth,
                        height: scaledWatermarkHeight,
                    });

                    if (drawSelectionBorder && activeWatermarkId === watermark.id) {
                        ctx.strokeStyle = '#6366f1';
                        ctx.lineWidth = 3;
                        ctx.strokeRect(actualX, actualY, scaledWatermarkWidth, scaledWatermarkHeight);
                    }
                }
            }

            if (!baseImageSrc && watermarks.length === 0) {
                 ctx.fillStyle = '#888';
                 ctx.font = '16px Inter';
                 ctx.textAlign = 'center';
                 ctx.fillText('Sube una imagen base y luego añade marcas de agua', canvas.width / 2, canvas.height / 2 + 30);
            } else if (baseImageSrc && watermarks.length === 0) {
                ctx.fillStyle = '#888';
                ctx.font = '16px Inter';
                ctx.textAlign = 'center';
                ctx.fillText('Haz clic en "Añadir Marca de Agua" para empezar', canvas.width / 2, canvas.height / 2 + 30);
            }


        } catch (err) {
            console.error("Error al dibujar en el canvas:", err);
        }
    }, [baseImageSrc, watermarks, activeWatermarkId, isDragging, initialWatermarkX, initialWatermarkY]);

    const animateDrag = useCallback(() => {
        drawImagesOnCanvas(true, currentDragOffsetRef.current);
        animationFrameIdRef.current = requestAnimationFrame(animateDrag);
    }, [drawImagesOnCanvas]);

    useEffect(() => {
        if (isDragging) {
            if (!animationFrameIdRef.current) {
                animationFrameIdRef.current = requestAnimationFrame(animateDrag);
            }
        } else {
            if (animationFrameIdRef.current) {
                cancelAnimationFrame(animationFrameIdRef.current);
                animationFrameIdRef.current = null;
            }
            drawImagesOnCanvas();
        }
        return () => {
            if (animationFrameIdRef.current) {
                cancelAnimationFrame(animationFrameIdRef.current);
                animationFrameIdRef.current = null;
            }
        };
    }, [isDragging, animateDrag, drawImagesOnCanvas]);


    useEffect(() => {
        const canvas = canvasRef.current;
        const container = canvasContainerRef.current;
        if (!canvas || !container) return;

        let animationFrameId = null;

        const resizeCanvas = () => {
            // Cancela cualquier frame pendiente para evitar múltiples llamadas en rápida sucesión
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }

            // Programa el redimensionamiento para el próximo frame de animación
            animationFrameId = requestAnimationFrame(() => {
                canvas.width = container.clientWidth;
                canvas.height = container.clientHeight;
                drawImagesOnCanvas();
            });
        };

        const resizeObserver = new ResizeObserver(resizeCanvas);
        resizeObserver.observe(container);

        // Limpieza: Desobservar el contenedor y cancelar el frame de animación pendiente
        return () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
            resizeObserver.unobserve(container);
        };
    }, [drawImagesOnCanvas]);


    const handleBaseImageUpload = (event) => {
        const file = event.target.files[0];
        if (file) {
            setLoading(true);
            setError(null);
            const reader = new FileReader();
            reader.onloadend = async () => {
                try {
                    const img = await loadImage(reader.result);
                    setBaseImageSrc(reader.result);
                    loadedBaseImageRef.current = img;
                    setWatermarks([]);
                    setActiveWatermarkId(null);
                    setNextWatermarkId(0);
                    setLoading(false);
                } catch (err) {
                    setError("Error al cargar la imagen base.");
                    setLoading(false);
                }
            };
            reader.onerror = () => {
                setError("Error al cargar la imagen base.");
                setLoading(false);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAddWatermark = (event) => {
        if (!baseImageSrc) {
            setError("Por favor, sube una imagen base antes de añadir una marca de agua.");
            event.target.value = '';
            return;
        }

        const file = event.target.files[0];
        if (file) {
            setLoading(true);
            setError(null);
            const reader = new FileReader();
            reader.onloadend = async () => {
                try {
                    const img = await loadImage(reader.result);
                    const newWatermark = {
                        id: nextWatermarkId,
                        src: reader.result,
                        obj: img,
                        x: 0,
                        y: 0,
                        scale: 0.3,
                        opacity: 1.0, // La opacidad por defecto es 1.0 (totalmente opaca)
                        name: file.name,
                    };
                    setWatermarks(prev => [...prev, newWatermark]);
                    setActiveWatermarkId(newWatermark.id);
                    setNextWatermarkId(prev => prev + 1);
                    setLoading(false);
                    setError(null);
                } catch (err) {
                    setError("Error al cargar la imagen de marca de agua.");
                    setLoading(false);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    // --- Funciones para arrastrar la marca de agua ---
    const getEventCoords = (event) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();

        let clientX, clientY;
        if (event.touches && event.touches.length > 0) {
            clientX = event.touches[0].clientX;
            clientY = event.touches[0].clientY;
        } else {
            clientX = event.clientX;
            clientY = event.clientY;
        }

        const xCss = clientX - rect.left;
        const yCss = clientY - rect.top;

        const scaleX = canvas.width / canvas.offsetWidth;
        const scaleY = canvas.height / canvas.offsetHeight;

        return {
            x: xCss * scaleX,
            y: yCss * scaleY,
        };
    };

    const handleInteractionStart = (event) => {
        const canvas = canvasRef.current;
        if (!canvas || !baseImageSrc) return;

        if (event.touches && event.touches.length > 0) {
            event.preventDefault();
        }

        const { x, y } = getEventCoords(event);
        let clickedWatermarkId = null;
        const watermarksArray = Array.from(allWatermarkBounds.current.entries());
        for (let i = watermarksArray.length - 1; i >= 0; i--) {
            const [id, bounds] = watermarksArray[i];
            if (x >= bounds.x &&
                x <= bounds.x + bounds.width &&
                y >= bounds.y &&
                y <= bounds.y + bounds.height) {
                clickedWatermarkId = id;
                break;
            }
        }

        if (clickedWatermarkId !== null) {
            setActiveWatermarkId(clickedWatermarkId);
            setIsDragging(true);
            setDragStartX(x);
            setDragStartY(y);
            const activeWatermark = watermarks.find(w => w.id === clickedWatermarkId);
            if (activeWatermark) {
                setInitialWatermarkX(activeWatermark.x);
                setInitialWatermarkY(activeWatermark.y);
                activeWatermarkRef.current = activeWatermark;
            }
            currentDragOffsetRef.current = { dx: 0, dy: 0 };
        } else {
            setActiveWatermarkId(null);
            activeWatermarkRef.current = null;
        }
    };

    const handleInteractionMove = (event) => {
        if (!isDragging || activeWatermarkId === null || !activeWatermarkRef.current) return;
        event.preventDefault();

        const { x, y } = getEventCoords(event);

        const dx = x - dragStartX;
        const dy = y - dragStartY;

        currentDragOffsetRef.current = { dx, dy };

        if (!animationFrameIdRef.current) {
            animationFrameIdRef.current = requestAnimationFrame(animateDrag);
        }
    };

    const handleInteractionEnd = () => {
        if (isDragging && activeWatermarkId !== null && activeWatermarkRef.current) {
            const finalX = initialWatermarkX + currentDragOffsetRef.current.dx;
            const finalY = initialWatermarkY + currentDragOffsetRef.current.dy;

            setWatermarks(prevWatermarks => {
                return prevWatermarks.map(wm => {
                    if (wm.id === activeWatermarkId) {
                        const scaledWatermarkWidth = wm.obj.width * wm.scale;
                        const scaledWatermarkHeight = wm.obj.height * wm.scale;

                        const boundedX = Math.max(0, Math.min(finalX, canvasRef.current.width - scaledWatermarkWidth));
                        const boundedY = Math.max(0, Math.min(finalY, canvasRef.current.height - scaledWatermarkHeight));

                        return { ...wm, x: boundedX, y: boundedY };
                    }
                    return wm;
                });
            });
        }

        setIsDragging(false);
        currentDragOffsetRef.current = { dx: 0, dy: 0 };
        activeWatermarkRef.current = null;
        if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
            animationFrameIdRef.current = null;
        }
        drawImagesOnCanvas();
    };

    // --- Fin de funciones para arrastrar la marca de agua ---

    // Función para manejar el cambio de escala
    const handleWatermarkScaleChange = (e) => {
        const newScale = Number(e.target.value);
        if (activeWatermarkId !== null) {
            setWatermarks(prevWatermarks => {
                return prevWatermarks.map(wm => {
                    if (wm.id === activeWatermarkId) {
                        return { ...wm, scale: newScale };
                    }
                    return wm;
                });
            });
        }
    };

    const handleWatermarkOpacityChange = (e) => {
        const newOpacity = Number(e.target.value);
        if (activeWatermarkId !== null) {
            setWatermarks(prevWatermarks => {
                return prevWatermarks.map(wm => {
                    if (wm.id === activeWatermarkId) {
                        return { ...wm, opacity: newOpacity };
                    }
                    return wm;
                });
            });
        }
    };

    const handleRemoveWatermark = () => {
        if (activeWatermarkId !== null) {
            setWatermarks(prevWatermarks => prevWatermarks.filter(wm => wm.id !== activeWatermarkId));
            setActiveWatermarkId(null);
            setShowAdjustmentPanel(false);
        }
    };

    const activeWatermark = watermarks.find(wm => wm.id === activeWatermarkId);

    const downloadImage = () => {
        const canvas = canvasRef.current;
        if (!canvas || !baseImageSrc) {
            setError("Sube una imagen base antes de descargar.");
            return;
        }

        const tempCanvas = document.createElement('canvas');
        const originalBaseImage = new Image();
        originalBaseImage.onload = () => {
            tempCanvas.width = originalBaseImage.width;
            tempCanvas.height = originalBaseImage.height;
            const tempCtx = tempCanvas.getContext('2d');

            tempCtx.drawImage(originalBaseImage, 0, 0);

            for (const watermark of watermarks) {
                if (watermark.obj) {
                    const currentCanvasScaleX = canvas.width / originalBaseImage.width;
                    const currentCanvasScaleY = canvas.height / originalBaseImage.height;

                    const originalWatermarkX = watermark.x / currentCanvasScaleX;
                    const originalWatermarkY = watermark.y / currentCanvasScaleY;
                    const originalWatermarkWidth = watermark.obj.width * watermark.scale / currentCanvasScaleX;
                    const originalWatermarkHeight = watermark.obj.height * watermark.scale / currentCanvasScaleY;

                    // La opacidad de la marca de agua es siempre 1.0 en el código actual, no es configurable
                    tempCtx.globalAlpha = watermark.opacity;
                    tempCtx.drawImage(watermark.obj, originalWatermarkX, originalWatermarkY, originalWatermarkWidth, originalWatermarkHeight);
                    tempCtx.globalAlpha = 1.0; // Restablece la opacidad
                }
            }

            const link = document.createElement('a');
            link.download = 'imagen_con_marcas_de_agua.png';
            link.href = tempCanvas.toDataURL('image/png');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setError(null);
        };
        originalBaseImage.onerror = () => {
            setError("Error al cargar la imagen base original para la descarga.");
        };
        originalBaseImage.src = baseImageSrc;
    };

    const handleReset = () => {
        setBaseImageSrc(null);
        loadedBaseImageRef.current = null;
        setWatermarks([]);
        setNextWatermarkId(0);
        setActiveWatermarkId(null);
        setLoading(false);
        setError(null);
        setShowAdjustmentPanel(false);
        setShowHelpModal(false);
        if (baseImageInputRef.current) baseImageInputRef.current.value = '';
        if (watermarkInputRef.current) watermarkInputRef.current.value = '';
    };

    useEffect(() => {
        const isModalOpen = showAdjustmentPanel || showHelpModal;

        const handlePopstate = (e) => {
            if (isModalOpen) {
                e.preventDefault();
                setShowAdjustmentPanel(false);
                setShowHelpModal(false);
            }
        };

        if (isModalOpen) {
            window.history.pushState(null, '', '#modal-open');
            window.addEventListener('popstate', handlePopstate);
        }

        return () => {
            if (isModalOpen) {
                window.removeEventListener('popstate', handlePopstate);
                if (window.location.hash === '#modal-open') {
                    window.history.back();
                }
            }
        };
    }, [showAdjustmentPanel, showHelpModal]);

    return (
        <div className="min-h-screen bg-gray-100 p-4 sm:p-6 flex flex-col items-center font-sans relative">
            <style>
                {`
                body {
                    font-family: 'Inter', sans-serif;
                    overscroll-behavior-y: contain;
                }
                input[type="range"]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: #6366f1;
                    cursor: pointer;
                    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.3);
                    transition: background .15s ease-in-out;
                }
                input[type="range"]::-moz-range-thumb {
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: #6366f1;
                    cursor: pointer;
                    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.3);
                    transition: background .15s ease-in-out;
                }
                input[type="range"]::-webkit-slider-runnable-track {
                    width: 100%;
                    height: 8px;
                    background: #e0e7ff;
                    border-radius: 4px;
                }
                input[type="range"]::-moz-range-track {
                    width: 100%;
                    height: 8px;
                    background: #e0e7ff;
                    border-radius: 4px;
                }
                .icon-button {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    background-color: #6366f1;
                    color: white;
                    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
                    transition: background-color 0.3s ease, transform 0.2s ease;
                    cursor: pointer;
                }
                .icon-button:hover {
                    background-color: #4f46e5;
                    transform: scale(1.05);
                }
                .icon-button:active {
                    transform: scale(0.95);
                }
                `}
            </style>

            <h1 className="text-xl sm:text-2xl font-bold text-indigo-800 mb-2 text-center">
                Editor de Imágenes con Marca de Agua
            </h1>
            <p className="text-lg text-indigo-600 mb-6 text-center">
                Por: Javier Valverde Salvatierra
            </p>

            <div
                ref={canvasContainerRef}
                className="bg-white p-6 rounded-xl shadow-lg w-full max-w-4xl flex justify-center items-center overflow-hidden border border-gray-300 flex-grow max-h-[70vh] min-h-[300px]"
            >
                <canvas
                    ref={canvasRef}
                    className="max-w-full h-auto rounded-lg"
                    onMouseDown={handleInteractionStart}
                    onMouseMove={handleInteractionMove}
                    onMouseUp={handleInteractionEnd}
                    onMouseLeave={handleInteractionEnd}
                    onTouchStart={handleInteractionStart}
                    onTouchMove={handleInteractionMove}
                    onTouchEnd={handleInteractionEnd}
                    onTouchCancel={handleInteractionEnd}
                ></canvas>
            </div>

            <div className="w-full max-w-4xl flex flex-wrap justify-center gap-2 mt-4 mb-8 p-2 bg-white rounded-xl shadow-lg">
                <button
                    onClick={() => baseImageInputRef.current.click()}
                    className="icon-button"
                    title="Seleccionar Imagen Base: Sube la imagen principal sobre la que trabajarás."
                >
                    <FileUp size={20} />
                </button>
                <input
                    type="file"
                    id="baseImage"
                    accept="image/*"
                    onChange={handleBaseImageUpload}
                    className="hidden"
                    ref={baseImageInputRef}
                />

                <button
                    onClick={() => watermarkInputRef.current.click()}
                    className={`icon-button ${!baseImageSrc ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title="Añadir Marca de Agua: Sube una imagen para usarla como marca de agua. Requiere una imagen base."
                    disabled={!baseImageSrc}
                >
                    <ImagePlus size={20} />
                </button>
                <input
                    type="file"
                    id="addWatermark"
                    accept="image/*"
                    onChange={handleAddWatermark}
                    className="hidden"
                    ref={watermarkInputRef}
                    key={nextWatermarkId}
                />

                <button
                    onClick={() => setShowAdjustmentPanel(prev => !prev)}
                    className="icon-button bg-blue-500 hover:bg-blue-600"
                    title="Ajustar Marca de Agua: Abre un panel para cambiar la escala o eliminar la marca de agua seleccionada."
                >
                    <SlidersHorizontal size={20} />
                </button>

                <button
                    onClick={handleReset}
                    className="icon-button bg-gray-500 hover:bg-gray-600"
                    title="Reiniciar: Borra todas las imágenes y marcas de agua, y restablece la aplicación."
                >
                    <RotateCcw size={20} />
                </button>

                <button
                    onClick={downloadImage}
                    className="icon-button bg-green-500 hover:bg-green-600"
                    title="Descargar Imagen: Guarda la imagen base con todas las marcas de agua aplicadas."
                >
                    <Download size={20} />
                </button>

                <button
                    onClick={() => setShowHelpModal(prev => !prev)}
                    className="icon-button bg-purple-500 hover:bg-purple-600"
                    title="Ayuda: Muestra información sobre el uso de cada botón."
                >
                    <HelpCircle size={20} />
                </button>
            </div>

            {showAdjustmentPanel && activeWatermark && (
                // Fondo semitransparente para el modal, ahora bg-black/50 para que sea más notable
                <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50"
                     onClick={() => setShowAdjustmentPanel(false)}>
                    {/* Panel de ajustes con la opacidad controlada por el estado modalOpacity */}
                    <div className="p-6 rounded-xl shadow-lg flex flex-col gap-4 w-11/12 max-w-sm"
                         style={{ backgroundColor: `rgba(255, 255, 255, ${modalOpacity})` }}
                         onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-semibold text-gray-700 mb-2">Ajustar Marca de Agua</h3>
                        <div className="mb-4">
                            <label htmlFor="watermarkScale" className="block text-gray-700 text-sm font-medium mb-2">
                                Escala: {(activeWatermark.scale * 100).toFixed(0)}%
                            </label>
                            <input
                                type="range"
                                id="watermarkScale"
                                min="0.05"
                                max="1.0"
                                step="0.01"
                                value={activeWatermark.scale}
                                onChange={handleWatermarkScaleChange}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                        {/* Nuevo control de opacidad para el panel modal */}
                        <div className="mb-4">
                            <label htmlFor="modalOpacity" className="block text-gray-700 text-sm font-medium mb-2">
                                Opacidad del Panel: {(modalOpacity * 100).toFixed(0)}%
                            </label>
                            <input
                                type="range"
                                id="modalOpacity"
                                min="0.1"
                                max="1.0"
                                step="0.01"
                                value={modalOpacity}
                                onChange={(e) => setModalOpacity(Number(e.target.value))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                        <button
                            onClick={handleRemoveWatermark}
                            className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-full shadow-md
                                       transition duration-300 ease-in-out transform hover:scale-105 flex items-center justify-center gap-2"
                        >
                            <Trash2 size={18} /> Eliminar Marca de Agua
                        </button>
                        <p className="text-sm text-gray-600 mt-2 text-center">
                            Arrastra la marca de agua en la imagen para moverla.
                        </p>
                    </div>
                </div>
            )}

            {showHelpModal && (
                // Fondo semitransparente para el modal de ayuda
                <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50"
                     onClick={() => setShowHelpModal(false)}>
                    {/* Contenido del modal de ayuda, con fondo blanco y opaco */}
                    <div className="bg-white p-6 rounded-xl shadow-lg flex flex-col gap-4 w-11/12 max-w-lg"
                         onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-semibold text-gray-700 mb-4 text-center">Ayuda de la Aplicación</h3>
                        <ul className="space-y-3 text-gray-700">
                            <li className="flex items-center gap-3">
                                <FileUp size={24} className="text-indigo-600 flex-shrink-0" />
                                <div>
                                    <strong className="font-semibold">Seleccionar Imagen Base:</strong> Sube la imagen principal sobre la que trabajarás.
                                </div>
                            </li>
                            <li className="flex items-center gap-3">
                                <ImagePlus size={24} className="text-indigo-600 flex-shrink-0" />
                                <div>
                                    <strong className="font-semibold">Añadir Marca de Agua:</strong> Sube una o **varias imágenes** para usarlas como marcas de agua. Este botón se activa después de subir una imagen base. **Puedes añadir múltiples marcas de agua y manipularlas individualmente.**
                                </div>
                            </li>
                            <li className="flex items-center gap-3">
                                <SlidersHorizontal size={24} className="text-blue-600 flex-shrink-0" />
                                <div>
                                    <strong className="font-semibold">Ajustar Marca de Agua:</strong> Abre un panel para cambiar la escala o la opacidad de la marca de agua seleccionada. Haz clic en una marca de agua en el lienzo para seleccionarla. **Puedes reubicar cualquier marca de agua arrastrándola directamente en la imagen.**
                                </div>
                            </li>
                            <li className="flex items-center gap-3">
                                <RotateCcw size={24} className="text-gray-600 flex-shrink-0" />
                                <div>
                                    <strong className="font-semibold">Reiniciar:</strong> Borra todas las imágenes y marcas de agua, y restablece la aplicación a su estado inicial.
                                </div>
                            </li>
                            <li className="flex items-center gap-3">
                                <Download size={24} className="text-green-600 flex-shrink-0" />
                                <div>
                                    <strong className="font-semibold">Descargar Imagen:</strong> Guarda la imagen base con todas las marcas de agua aplicadas en tu dispositivo.
                                </div>
                            </li>
                            <li className="flex items-center gap-3">
                                <HelpCircle size={24} className="text-purple-600 flex-shrink-0" />
                                <div>
                                    <strong className="font-semibold">Ayuda:</strong> Muestra esta ventana con información sobre el uso de cada botón.
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
            )}

            {loading && (
                <p className="fixed bottom-4 left-4 z-50 text-indigo-500 bg-white p-2 rounded-lg shadow-md">Cargando...</p>
            )}
            {error && (
                <p className="fixed bottom-4 left-4 z-50 text-red-500 bg-white p-2 rounded-lg shadow-md bg-red-100">{error}</p>
            )}
        </div>
    );
};

export default App;








