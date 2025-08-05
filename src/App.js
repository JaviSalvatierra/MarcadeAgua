import React, { useState, useRef, useEffect, useCallback } from 'react';

// Componente principal de la aplicación
const App = () => {
    // Estados para las imágenes y sus propiedades
    const [baseImageSrc, setBaseImageSrc] = useState(null); // URL de la imagen base
    const [watermarks, setWatermarks] = useState([]); // [{ id, src, obj, x, y, scale }]
    const [nextWatermarkId, setNextWatermarkId] = useState(0); // Para generar IDs únicos para las marcas de agua
    const [activeWatermarkId, setActiveWatermarkId] = useState(null); // ID de la marca de agua actualmente seleccionada
    const [loading, setLoading] = useState(false); // Estado de carga
    const [error, setError] = useState(null); // Estado de error

    // Estados para la funcionalidad de arrastre
    const [isDragging, setIsDragging] = useState(false);
    const [dragStartX, setDragStartX] = useState(0);
    const [dragStartY, setDragStartY] = useState(0);
    const [initialWatermarkX, setInitialWatermarkX] = useState(0);
    const [initialWatermarkY, setInitialWatermarkY] = useState(0);

    // Referencias al elemento canvas y a las dimensiones de las marcas de agua dibujadas
    const canvasRef = useRef(null);
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
    const drawImagesOnCanvas = useCallback(async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Limpiar el canvas

        setLoading(true);
        setError(null);
        allWatermarkBounds.current.clear(); // Limpiar los límites anteriores

        try {
            let baseImage = null;
            if (baseImageSrc) {
                baseImage = await loadImage(baseImageSrc);
                canvas.width = baseImage.width;
                canvas.height = baseImage.height;
                ctx.drawImage(baseImage, 0, 0); // Dibujar la imagen base
            } else {
                // Si no hay imagen base, establecer un tamaño predeterminado o un mensaje
                canvas.width = 600;
                canvas.height = 400;
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
                    const scaledWatermarkWidth = watermark.obj.width * watermark.scale;
                    const scaledWatermarkHeight = watermark.obj.height * watermark.scale;

                    // Asegurarse de que la marca de agua no se salga de los límites
                    const actualX = Math.max(0, Math.min(watermark.x, canvas.width - scaledWatermarkWidth));
                    const actualY = Math.max(0, Math.min(watermark.y, canvas.height - scaledWatermarkHeight));

                    ctx.drawImage(watermark.obj, actualX, actualY, scaledWatermarkWidth, scaledWatermarkHeight);

                    // Guardar los límites de esta marca de agua para la detección de arrastre
                    allWatermarkBounds.current.set(watermark.id, {
                        x: actualX,
                        y: actualY,
                        width: scaledWatermarkWidth,
                        height: scaledWatermarkHeight,
                    });

                    // Dibujar un borde si esta es la marca de agua activa
                    if (activeWatermarkId === watermark.id) {
                        ctx.strokeStyle = '#6366f1'; // Tailwind indigo-500
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
            setError("Error al procesar las imágenes. Asegúrate de que sean archivos de imagen válidos.");
        } finally {
            setLoading(false);
        }
    }, [baseImageSrc, watermarks, activeWatermarkId, loadImage]); // Dependencias para useCallback

    // Efecto para dibujar las imágenes en el canvas cada vez que cambian los estados relevantes
    useEffect(() => {
        drawImagesOnCanvas();
    }, [drawImagesOnCanvas]); // Dependencia del useCallback

    // Función para manejar la carga de la imagen base
    const handleBaseImageUpload = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setBaseImageSrc(reader.result);
                setWatermarks([]); // Limpiar marcas de agua al cargar nueva imagen base
                setActiveWatermarkId(null);
                setNextWatermarkId(0);
                setError(null); // Limpiar errores anteriores
            };
            reader.onerror = () => {
                setError("Error al cargar la imagen base.");
            };
            reader.readAsDataURL(file);
        }
    };

    // Función para añadir una nueva marca de agua
    const handleAddWatermark = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const img = new Image();
                img.onload = () => {
                    const newWatermark = {
                        id: nextWatermarkId,
                        src: reader.result,
                        obj: img,
                        x: 0, // Posición inicial
                        y: 0, // Posición inicial
                        scale: 0.3, // Escala inicial
                    };
                    setWatermarks(prev => [...prev, newWatermark]);
                    setActiveWatermarkId(newWatermark.id); // Seleccionar la marca de agua recién añadida
                    setNextWatermarkId(prev => prev + 1);
                    setError(null);
                };
                img.onerror = () => {
                    setError("Error al cargar la imagen de marca de agua.");
                };
                img.src = reader.result;
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

        return {
            x: clientX - rect.left,
            y: clientY - rect.top,
        };
    };

    const handleInteractionStart = (event) => {
        const { x, y } = getEventCoords(event);
        const canvas = canvasRef.current;
        if (!canvas || !baseImageSrc) return; // Solo permitir interacción si la imagen base está cargada

        let clickedWatermarkId = null;
        // Iterar las marcas de agua en orden inverso para seleccionar la superior si se superponen
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
            }
            event.preventDefault(); // Prevenir el desplazamiento en dispositivos táctiles
        } else {
            // Si no se hizo clic en ninguna marca de agua, deseleccionar cualquier marca de agua activa
            setActiveWatermarkId(null);
        }
    };

    const handleInteractionMove = (event) => {
        if (!isDragging || activeWatermarkId === null) return;
        event.preventDefault(); // Prevenir el desplazamiento en dispositivos táctiles

        const { x, y } = getEventCoords(event);
        const canvas = canvasRef.current;

        const dx = x - dragStartX;
        const dy = y - dragStartY;

        setWatermarks(prevWatermarks => {
            return prevWatermarks.map(wm => {
                if (wm.id === activeWatermarkId) {
                    let newX = initialWatermarkX + dx;
                    let newY = initialWatermarkY + dy;

                    // Limitar la posición de la marca de agua dentro del canvas
                    if (wm.obj) {
                        const scaledWatermarkWidth = wm.obj.width * wm.scale;
                        const scaledWatermarkHeight = wm.obj.height * wm.scale;

                        newX = Math.max(0, Math.min(newX, canvas.width - scaledWatermarkWidth));
                        newY = Math.max(0, Math.min(newY, canvas.height - scaledWatermarkHeight));
                    }
                    return { ...wm, x: newX, y: newY };
                }
                return wm;
            });
        });
    };

    const handleInteractionEnd = () => {
        setIsDragging(false);
    };

    // --- Fin de funciones para arrastrar la marca de agua ---

    // Función para manejar el cambio de escala de la marca de agua activa
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

    // Función para eliminar la marca de agua activa
    const handleRemoveWatermark = () => {
        if (activeWatermarkId !== null) {
            setWatermarks(prevWatermarks => prevWatermarks.filter(wm => wm.id !== activeWatermarkId));
            setActiveWatermarkId(null); // Deseleccionar después de eliminar
        }
    };

    // Obtener la marca de agua activa para mostrar sus propiedades en los controles
    const activeWatermark = watermarks.find(wm => wm.id === activeWatermarkId);

    // Función para descargar la imagen combinada
    const downloadImage = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const link = document.createElement('a');
            link.download = 'imagen_con_marcas_de_agua.png';
            link.href = canvas.toDataURL('image/png');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 p-4 sm:p-6 flex flex-col items-center font-sans">
            
            <style>
                {`
                body {
                    font-family: 'Inter', sans-serif;
                }
                input[type="range"]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: #6366f1; /* Indigo 500 */
                    cursor: pointer;
                    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.3);
                    transition: background .15s ease-in-out;
                }
                input[type="range"]::-moz-range-thumb {
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: #6366f1; /* Indigo 500 */
                    cursor: pointer;
                    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.3);
                    transition: background .15s ease-in-out;
                }
                input[type="range"]::-webkit-slider-runnable-track {
                    width: 100%;
                    height: 8px;
                    background: #e0e7ff; /* Indigo 100 */
                    border-radius: 4px;
                }
                input[type="range"]::-moz-range-track {
                    width: 100%;
                    height: 8px;
                    background: #e0e7ff; /* Indigo 100 */
                    border-radius: 4px;
                }
                `}
            </style>

            <h1 className="text-3xl sm:text-4xl font-bold text-indigo-800 mb-6 text-center">
                Editor de Imágenes con Marca de Agua
                <p className="text-xl text-gray-500 mt-1">
                            Por: Javier Valverde S.
                </p>
            </h1>

            {/* Contenedor principal de la aplicación */}
            <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-4xl flex flex-col lg:flex-row gap-6">

                {/* Sección de controles */}
                <div className="flex-1 flex flex-col gap-4">
                    <h2 className="text-xl font-semibold text-gray-700 mb-2">1. Sube tus imágenes</h2>

                    {/* Carga de imagen base */}
                    <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                        <label htmlFor="baseImage" className="block text-gray-700 text-sm font-medium mb-2">
                            Imagen Base:
                        </label>
                        <input
                            type="file"
                            id="baseImage"
                            accept="image/*"
                            onChange={handleBaseImageUpload}
                            className="block w-full text-sm text-gray-500
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-full file:border-0
                                file:text-sm file:font-semibold
                                file:bg-indigo-100 file:text-indigo-700
                                hover:file:bg-indigo-200"
                        />
                    </div>

                    {/* Carga de imagen de marca de agua */}
                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                        <label htmlFor="addWatermark" className="block text-gray-700 text-sm font-medium mb-2">
                            Añadir Marca de Agua:
                        </label>
                        <input
                            type="file"
                            id="addWatermark"
                            accept="image/*"
                            onChange={handleAddWatermark}
                            className="block w-full text-sm text-gray-500
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-full file:border-0
                                file:text-sm file:font-semibold
                                file:bg-purple-100 file:text-purple-700
                                hover:file:bg-purple-200"
                            key={nextWatermarkId} // Cambiar la clave para forzar la recreación del input y limpiar el valor
                        />
                         <p className="text-xs text-gray-500 mt-1">
                            Sube una imagen para añadirla como marca de agua.
                        </p>
                    </div>

                    <h2 className="text-xl font-semibold text-gray-700 mt-4 mb-2">2. Ajusta las Marcas de Agua</h2>

                    {/* Controles de escala */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        {activeWatermark ? (
                            <>
                                <div className="mb-4">
                                    <label htmlFor="watermarkScale" className="block text-gray-700 text-sm font-medium mb-2">
                                        Escala de la Marca de Agua Activa (ID: {activeWatermark.id}): {(activeWatermark.scale * 100).toFixed(0)}%
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
                                <button
                                    onClick={handleRemoveWatermark}
                                    className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-full shadow-md
                                               transition duration-300 ease-in-out transform hover:scale-105"
                                >
                                    Eliminar Marca de Agua Activa
                                </button>
                                <p className="text-sm text-gray-600 mt-2">
                                    Haz clic en una marca de agua en la imagen para seleccionarla y arrastrarla.
                                </p>
                            </>
                        ) : (
                            <p className="text-sm text-gray-600">
                                Selecciona una marca de agua en la imagen para ajustar su escala o eliminarla.
                            </p>
                        )}
                    </div>

                    {/* Botón de descarga */}
                    <button
                        onClick={downloadImage}
                        disabled={!baseImageSrc || loading}
                        className="mt-6 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-full shadow-md
                                   transition duration-300 ease-in-out transform hover:scale-105
                                   disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Procesando...
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                                Descargar Imagen
                            </>
                        )}
                    </button>
                    {error && (
                        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm text-center">
                            {error}
                        </div>
                    )}
                </div>

                {/* Sección de visualización del canvas */}
                <div className="flex-1 flex justify-center items-center bg-gray-100 rounded-xl shadow-inner p-2 overflow-hidden">
                    <canvas
                        ref={canvasRef}
                        className={`max-w-full h-auto rounded-lg border border-gray-300 shadow-md ${baseImageSrc && watermarks.length > 0 && !loading ? 'cursor-grab active:cursor-grabbing' : ''}`}
                        // Eventos para arrastrar la marca de agua
                        onMouseDown={handleInteractionStart}
                        onMouseMove={handleInteractionMove}
                        onMouseUp={handleInteractionEnd}
                        onMouseLeave={handleInteractionEnd}
                        onTouchStart={handleInteractionStart}
                        onTouchMove={handleInteractionMove}
                        onTouchEnd={handleInteractionEnd}
                        // Estilos iniciales, se ajustarán con JS
                        width="600"
                        height="400"
                    >
                        Tu navegador no soporta el elemento canvas.
                    </canvas>
                </div>
            </div>
        </div>
    );
};

export default App;
