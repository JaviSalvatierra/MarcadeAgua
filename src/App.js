import React, { useState, useRef, useEffect, useCallback } from 'react';
// Importa los iconos de Lucide React
import { FileUp, ImagePlus, RotateCcw, Download, SlidersHorizontal, Trash2 } from 'lucide-react';

// Componente principal de la aplicación
const App = () => {
    // Estados para las imágenes y sus propiedades
    const [baseImageSrc, setBaseImageSrc] = useState(null); // URL de la imagen base
    const [baseImageName, setBaseImageName] = useState(null); // Nombre del archivo de la imagen base (ya no se muestra, pero se mantiene si es útil internamente)
    const [watermarks, setWatermarks] = useState([]); // [{ id, src, obj, x, y, scale, name }]
    const [nextWatermarkId, setNextWatermarkId] = useState(0); // Para generar IDs únicos para las marcas de agua
    const [activeWatermarkId, setActiveWatermarkId] = useState(null); // ID de la marca de agua actualmente seleccionada
    const [loading, setLoading] = useState(false); // Estado de carga
    const [error, setError] = useState(null); // Estado de error
    const [showAdjustmentPanel, setShowAdjustmentPanel] = useState(false); // Controla la visibilidad del panel de ajustes

    // Estados para la funcionalidad de arrastre
    const [isDragging, setIsDragging] = useState(false);
    const [dragStartX, setDragStartX] = useState(0);
    // FIX: Corrected the useState declaration for dragStartY
    const [dragStartY, setDragStartY] = useState(0);
    const [initialWatermarkX, setInitialWatermarkX] = useState(0);
    const [initialWatermarkY, setInitialWatermarkY] = useState(0);

    // Referencias al elemento canvas y a los inputs de archivo
    const canvasRef = useRef(null);
    const baseImageInputRef = useRef(null); // Referencia para el input de la imagen base
    const watermarkInputRef = useRef(null); // Referencia para el input de la marca de agua

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
    const drawImagesOnCanvas = useCallback(async (drawSelectionBorder = true) => {
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

                // *** Lógica de redimensionamiento de la imagen base para ajustarse al canvas ***
                const canvasContainer = canvas.parentElement;
                const containerWidth = canvasContainer.clientWidth;
                const containerHeight = canvasContainer.clientHeight;

                let scale = 1;
                if (baseImage.width > containerWidth || baseImage.height > containerHeight) {
                    scale = Math.min(containerWidth / baseImage.width, containerHeight / baseImage.height);
                }

                const scaledWidth = baseImage.width * scale;
                const scaledHeight = baseImage.height * scale;

                canvas.width = scaledWidth;
                canvas.height = scaledHeight;

                // Centrar la imagen en el canvas si es más pequeña que el contenedor
                const offsetX = (containerWidth - scaledWidth) / 2;
                const offsetY = (containerHeight - scaledHeight) / 2;

                ctx.drawImage(baseImage, 0, 0, scaledWidth, scaledHeight); // Dibujar la imagen base
            } else {
                // Tamaño predeterminado del canvas si no hay imagen base
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

                    // Dibujar un borde si esta es la marca de agua activa Y si se debe dibujar el borde de selección
                    if (drawSelectionBorder && activeWatermarkId === watermark.id) {
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

    // Efecto para manejar el redimensionamiento del canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const resizeCanvas = () => {
            // Redibujar el contenido cuando el tamaño del canvas cambie
            drawImagesOnCanvas();
        };

        // Usar ResizeObserver para un redimensionamiento más eficiente del canvas
        const resizeObserver = new ResizeObserver(resizeCanvas);
        resizeObserver.observe(canvas);

        return () => {
            resizeObserver.unobserve(canvas);
        };
    }, [drawImagesOnCanvas]);


    // Función para manejar la carga de la imagen base
    const handleBaseImageUpload = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setBaseImageSrc(reader.result);
                setBaseImageName(file.name); // Guardar el nombre del archivo (no se muestra, pero se mantiene si es útil internamente)
                setWatermarks([]); // Limpiar marcas de agua al cargar nueva imagen base
                setActiveWatermarkId(null);
                setNextWatermarkId(0);
                setError(null); // Limpiar errores anteriores
                // REMOVIDO: setShowAdjustmentPanel(false); // No ocultar/mostrar aquí
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
                        name: file.name, // Guardar el nombre del archivo de la marca de agua
                    };
                    setWatermarks(prev => [...prev, newWatermark]);
                    setActiveWatermarkId(newWatermark.id); // Seleccionar la marca de agua recién añadida
                    setNextWatermarkId(prev => prev + 1);
                    setError(null);
                    // REMOVIDO: setShowAdjustmentPanel(true); // No mostrar aquí, solo con el botón de ajustes
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

    // Función para obtener las coordenadas del evento (ratón o toque) escaladas al tamaño interno del canvas
    const getEventCoords = (event) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect(); // Dimensiones del canvas en la pantalla (CSS)

        let clientX, clientY;
        if (event.touches && event.touches.length > 0) {
            clientX = event.touches[0].clientX;
            clientY = event.touches[0].clientY;
        } else {
            clientX = event.clientX;
            clientY = event.clientY;
        }

        // Calcular las coordenadas relativas al canvas (en píxeles CSS)
        const xCss = clientX - rect.left;
        const yCss = clientY - rect.top;

        // Calcular el factor de escala entre el tamaño CSS del canvas y su tamaño interno (HTML attributes)
        // Usamos offsetWidth/offsetHeight para obtener el tamaño renderizado del canvas
        const scaleX = canvas.width / canvas.offsetWidth;
        const scaleY = canvas.height / canvas.offsetHeight;

        // Escalar las coordenadas CSS a las coordenadas internas del canvas
        return {
            x: xCss * scaleX,
            y: yCss * scaleY,
        };
    };

    const handleInteractionStart = (event) => {
        const { x, y } = getEventCoords(event);
        const canvas = canvasRef.current;
        if (!canvas || !baseImageSrc) return; // Solo permitir interacción si la imagen base está cargada

        let clickedWatermarkId = null;
        // Iterar las marcas de agua en orden inverso para seleccionar la superior si se superponen
        // Usamos Array.from(Map.entries()) para poder iterar en orden inverso
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
            setDragStartX(x); // Guardar coordenadas escaladas
            setDragStartY(y); // Guardar coordenadas escaladas
            const activeWatermark = watermarks.find(w => w.id === clickedWatermarkId);
            if (activeWatermark) {
                setInitialWatermarkX(activeWatermark.x);
                setInitialWatermarkY(activeWatermark.y);
            }
            event.preventDefault(); // Prevenir el desplazamiento en dispositivos táctiles
            // REMOVIDO: setShowAdjustmentPanel(true); // No mostrar aquí, solo con el botón de ajustes
        } else {
            // Si no se hizo clic en ninguna marca de agua, deseleccionar cualquier marca de agua activa
            setActiveWatermarkId(null);
            setShowAdjustmentPanel(false); // Ocultar panel de ajustes si no hay nada seleccionado
        }
    };

    const handleInteractionMove = (event) => {
        if (!isDragging || activeWatermarkId === null) return;
        event.preventDefault(); // Prevenir el desplazamiento en dispositivos táctiles

        const { x, y } = getEventCoords(event); // Obtener coordenadas escaladas
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
            setShowAdjustmentPanel(false); // Ocultar panel de ajustes
        }
    };

    // Obtener la marca de agua activa para mostrar sus propiedades en los controles
    const activeWatermark = watermarks.find(wm => wm.id === activeWatermarkId);

    // Función para descargar la imagen combinada
    const downloadImage = () => {
        const canvas = canvasRef.current;
        if (!canvas || !baseImageSrc) {
            setError("Sube una imagen base antes de descargar.");
            return;
        }

        // Crear un canvas temporal para el guardado sin el borde de selección
        const tempCanvas = document.createElement('canvas');
        // Asegurarse de que el canvas temporal tenga las dimensiones originales de la imagen base
        const originalBaseImage = new Image();
        originalBaseImage.onload = () => {
            tempCanvas.width = originalBaseImage.width;
            tempCanvas.height = originalBaseImage.height;
            const tempCtx = tempCanvas.getContext('2d');

            // Dibujar la imagen base original en el canvas temporal
            tempCtx.drawImage(originalBaseImage, 0, 0);

            // Redibujar las marcas de agua con sus posiciones y escalas relativas a la imagen base original
            for (const watermark of watermarks) {
                if (watermark.obj) {
                    // Calcular la escala actual del canvas con respecto a la imagen base original
                    const currentCanvasScaleX = canvas.width / originalBaseImage.width;
                    const currentCanvasScaleY = canvas.height / originalBaseImage.height;

                    // Ajustar las posiciones y escalas de las marcas de agua a las dimensiones originales
                    const originalWatermarkX = watermark.x / currentCanvasScaleX;
                    const originalWatermarkY = watermark.y / currentCanvasScaleY;
                    const originalWatermarkWidth = watermark.obj.width * watermark.scale / currentCanvasScaleX;
                    const originalWatermarkHeight = watermark.obj.height * watermark.scale / currentCanvasScaleY;

                    tempCtx.drawImage(watermark.obj, originalWatermarkX, originalWatermarkY, originalWatermarkWidth, originalWatermarkHeight);
                }
            }

            // Descargar la imagen del canvas temporal
            const link = document.createElement('a');
            link.download = 'imagen_con_marcas_de_agua.png';
            link.href = tempCanvas.toDataURL('image/png');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setError(null); // Limpiar cualquier error anterior
        };
        originalBaseImage.onerror = () => {
            setError("Error al cargar la imagen base original para la descarga.");
        };
        originalBaseImage.src = baseImageSrc;
    };

    // Función para reiniciar la aplicación a su estado inicial
    const handleReset = () => {
        setBaseImageSrc(null);
        setBaseImageName(null);
        setWatermarks([]);
        setNextWatermarkId(0);
        setActiveWatermarkId(null);
        setLoading(false);
        setError(null);
        setShowAdjustmentPanel(false); // Ocultar panel de ajustes
        // Opcional: Limpiar los inputs de archivo si es necesario, aunque key={nextWatermarkId} ya ayuda
        if (baseImageInputRef.current) baseImageInputRef.current.value = '';
        if (watermarkInputRef.current) watermarkInputRef.current.value = '';
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 p-4 sm:p-6 flex flex-col items-center font-sans relative">
            {/* Tailwind CSS y Google Fonts ya están en public/index.html */}
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
                .icon-button {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    width: 56px; /* Tamaño del botón */
                    height: 56px; /* Tamaño del botón */
                    border-radius: 50%;
                    background-color: #6366f1; /* Indigo 500 */
                    color: white;
                    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
                    transition: background-color 0.3s ease, transform 0.2s ease;
                    cursor: pointer;
                }
                .icon-button:hover {
                    background-color: #4f46e5; /* Indigo 600 */
                    transform: scale(1.05);
                }
                .icon-button:active {
                    transform: scale(0.95);
                }
                `}
            </style>

            {/* Título de la aplicación - Tamaño de fuente disminuido */}
            <h1 className="text-2xl sm:text-3xl font-bold text-indigo-800 mb-2 text-center">
                Editor de Imágenes con Marca de Agua
            </h1>
            <p className="text-lg text-indigo-600 mb-6 text-center">
                Por: Javier Valverde Salvatierra
            </p>

            {/* Contenedor principal de la aplicación - solo para el canvas */}
            <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-4xl flex justify-center items-center overflow-hidden border border-gray-300 min-h-[400px]">
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

            {/* Panel de Acciones Flotante */}
            {/* En móvil (sm:), será una fila horizontal en la parte inferior. En md y superior, será una columna vertical a la derecha. */}
            <div className="fixed bottom-4 right-4 z-50 flex flex-row sm:flex-col gap-3 p-2 bg-white bg-opacity-90 rounded-xl shadow-lg">
                {/* Botón para Seleccionar Imagen Base */}
                <button
                    onClick={() => baseImageInputRef.current.click()}
                    className="icon-button"
                    title="Seleccionar Imagen Base"
                >
                    <FileUp size={24} />
                </button>
                <input
                    type="file"
                    id="baseImage"
                    accept="image/*"
                    onChange={handleBaseImageUpload}
                    className="hidden"
                    ref={baseImageInputRef}
                />

                {/* Botón para Añadir Marca de Agua */}
                <button
                    onClick={() => watermarkInputRef.current.click()}
                    className="icon-button"
                    title="Añadir Marca de Agua"
                >
                    <ImagePlus size={24} />
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

                {/* Nuevo Botón para Activar/Desactivar Panel de Ajustes */}
                <button
                    onClick={() => setShowAdjustmentPanel(prev => !prev)}
                    className="icon-button bg-blue-500 hover:bg-blue-600"
                    title="Ajustar Marca de Agua"
                >
                    <SlidersHorizontal size={24} />
                </button>

                {/* Botón para Reiniciar */}
                <button
                    onClick={handleReset}
                    className="icon-button bg-gray-500 hover:bg-gray-600"
                    title="Reiniciar"
                >
                    <RotateCcw size={24} />
                </button>

                {/* Botón para Descargar Imagen */}
                <button
                    onClick={downloadImage}
                    className="icon-button bg-green-500 hover:bg-green-600"
                    title="Descargar Imagen"
                >
                    <Download size={24} />
                </button>
            </div>

            {/* Panel de Ajustes de Marca de Agua Flotante (condicional) */}
            {/* Se muestra solo si showAdjustmentPanel es true Y hay una marca de agua activa */}
            {showAdjustmentPanel && activeWatermark && (
                <div className="fixed top-4 right-4 z-50 bg-white p-4 rounded-xl shadow-lg flex flex-col gap-2 w-72">
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Ajustar Marca de Agua</h3>
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
                    <button
                        onClick={handleRemoveWatermark}
                        className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-full shadow-md
                                   transition duration-300 ease-in-out transform hover:scale-105 flex items-center justify-center gap-2"
                    >
                        <Trash2 size={18} /> Eliminar Marca de Agua
                    </button>
                    <p className="text-sm text-gray-600 mt-2">
                        Arrastra la marca de agua en la imagen para moverla.
                    </p>
                </div>
            )}

            {/* Mensajes de carga y error (pueden aparecer en una posición fija o relativa) */}
            {loading && (
                <p className="fixed bottom-4 left-4 z-50 text-indigo-500 bg-white p-2 rounded-lg shadow-md">Cargando...</p>
            )}
            {error && (
                <p className="fixed bottom-4 left-4 z-50 text-red-500 bg-white p-2 rounded-lg shadow-md">{error}</p>
            )}
        </div>
    );
};

export default App;






