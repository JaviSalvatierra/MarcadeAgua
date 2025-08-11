import React, { useState, useRef, useEffect, useCallback } from 'react';
// Importa los iconos de Lucide React, incluyendo HelpCircle para el botón de ayuda y Type para el texto
import { FileUp, ImagePlus, RotateCcw, Download, SlidersHorizontal, Trash2, HelpCircle, Type } from 'lucide-react';

// Componente principal de la aplicación
const App = () => {
    // Estados para las imágenes y sus propiedades
    const [baseImageSrc, setBaseImageSrc] = useState(null); // URL de la imagen base
    const [watermarks, setWatermarks] = useState([]); // [{ id, src, obj, x, y, scale, opacity, name }]
    const [nextWatermarkId, setNextWatermarkId] = useState(0); // Para generar IDs únicos para las marcas de agua
    const [activeWatermarkId, setActiveWatermarkId] = useState(null); // ID de la marca de agua actualmente seleccionada

    // Estados para el texto
    const [texts, setTexts] = useState([]); // [{ id, content, x, y, fontSize, color, fontFamily, opacity }]
    const [nextTextId, setNextTextId] = useState(0);
    const [activeTextId, setActiveTextId] = useState(null);
    const [newTextContent, setNewTextContent] = useState(''); // Para el input de texto del modal

    const [loading, setLoading] = useState(false); // Estado de carga
    const [error, setError] = useState(null); // Estado de error
    const [showAdjustmentPanel, setShowAdjustmentPanel] = useState(false); // Controla la visibilidad del panel de ajustes modal
    const [showHelpModal, setShowHelpModal] = useState(false); // Nuevo estado para controlar la visibilidad del modal de ayuda
    const [showAddTextModal, setShowAddTextModal] = useState(false); // Nuevo estado para el modal de añadir texto
    const [modalOpacity, setModalOpacity] = useState(1.0); // Nuevo estado para la opacidad del modal

    // Estados para la funcionalidad de arrastre
    const [isDragging, setIsDragging] = useState(false);
    const [dragStartX, setDragStartX] = useState(0);
    const [dragStartY, setDragStartY] = useState(0);
    const [initialElementX, setInitialElementX] = useState(0);
    const [initialElementY, setInitialElementY] = useState(0);

    // Referencias para el arrastre y la animación
    const currentDragOffsetRef = useRef({ dx: 0, dy: 0 }); // Almacena el desplazamiento actual durante el arrastre
    const animationFrameIdRef = useRef(null); // ID del requestAnimationFrame para cancelar
    const activeElementRef = useRef(null); // Referencia al elemento activo (marca de agua o texto)
    const loadedBaseImageRef = useRef(null); // Referencia para almacenar el objeto Image de la imagen base ya cargada

    // Referencias al elemento canvas y a los inputs de archivo
    const canvasRef = useRef(null);
    const baseImageInputRef = useRef(null); // Referencia para el input de la imagen base
    const watermarkInputRef = useRef(null); // Referencia para el input de la marca de agua

    // Referencia para el contenedor del canvas, que observaremos con ResizeObserver
    const canvasContainerRef = useRef(null);

    // Usamos un Map para almacenar los límites de cada elemento (marca de agua o texto) por su ID
    const allElementBounds = useRef(new Map());

    // Lista de fuentes disponibles
    const FONT_OPTIONS = ['Inter', 'Arial', 'Verdana', 'Helvetica', 'Times New Roman', 'Georgia', 'Courier New', 'Lucida Console', 'Cursive', 'Fantasy', 'Monospace'];


    // Función auxiliar para cargar una imagen
    const loadImage = useCallback((src) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }, []);

    // Función para dibujar las imágenes y el texto en el canvas
    const drawImagesOnCanvas = useCallback(async (drawSelectionBorder = true, dragOffset = { dx: 0, dy: 0 }) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Limpiar el canvas

        try {
            const baseImage = loadedBaseImageRef.current;
            allElementBounds.current.clear(); // Limpiar los límites antes de redibujar

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

                    if (isDragging && activeWatermarkId === watermark.id && activeElementRef.current) {
                        currentX = initialElementX + dragOffset.dx;
                        currentY = initialElementY + dragOffset.dy;
                    }

                    const scaledWatermarkWidth = watermark.obj.width * watermark.scale;
                    const scaledWatermarkHeight = watermark.obj.height * watermark.scale;

                    const actualX = Math.max(0, Math.min(currentX, canvas.width - scaledWatermarkWidth));
                    const actualY = Math.max(0, Math.min(currentY, canvas.height - scaledWatermarkHeight));

                    ctx.globalAlpha = watermark.opacity;
                    ctx.drawImage(watermark.obj, actualX, actualY, scaledWatermarkWidth, scaledWatermarkHeight);
                    ctx.globalAlpha = 1.0;

                    allElementBounds.current.set(`watermark-${watermark.id}`, {
                        type: 'watermark',
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

            // Dibujar todos los elementos de texto
            for (const text of texts) {
                if (baseImage) {
                    let currentX = text.x;
                    let currentY = text.y;

                    if (isDragging && activeTextId === text.id && activeElementRef.current) {
                        currentX = initialElementX + dragOffset.dx;
                        currentY = initialElementY + dragOffset.dy;
                    }

                    ctx.font = `${text.fontSize}px '${text.fontFamily}'`; // Usa la fuente seleccionada
                    ctx.fillStyle = text.color;
                    ctx.globalAlpha = text.opacity;
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'top';

                    const textMetrics = ctx.measureText(text.content);
                    const textWidth = textMetrics.width;
                    const textHeight = text.fontSize * 1.2; // Altura aproximada

                    const actualX = Math.max(0, Math.min(currentX, canvas.width - textWidth));
                    const actualY = Math.max(0, Math.min(currentY, canvas.height - textHeight));

                    ctx.fillText(text.content, actualX, actualY);
                    ctx.globalAlpha = 1.0;

                    allElementBounds.current.set(`text-${text.id}`, {
                        type: 'text',
                        x: actualX,
                        y: actualY,
                        width: textWidth,
                        height: textHeight,
                    });

                    if (drawSelectionBorder && activeTextId === text.id) {
                        ctx.strokeStyle = '#f59e0b';
                        ctx.lineWidth = 3;
                        ctx.strokeRect(actualX, actualY, textWidth, textHeight);
                    }
                }
            }

            if (!baseImageSrc && watermarks.length === 0 && texts.length === 0) {
                 ctx.fillStyle = '#888';
                 ctx.font = '16px Inter';
                 ctx.textAlign = 'center';
                 ctx.fillText('Sube una imagen base y luego añade marcas de agua o texto', canvas.width / 2, canvas.height / 2 + 30);
            } else if (baseImageSrc && watermarks.length === 0 && texts.length === 0) {
                ctx.fillStyle = '#888';
                ctx.font = '16px Inter';
                ctx.textAlign = 'center';
                ctx.fillText('Añade una Marca de Agua o un Texto', canvas.width / 2, canvas.height / 2 + 30);
            }


        } catch (err) {
            console.error("Error al dibujar en el canvas:", err);
        }
    }, [baseImageSrc, watermarks, texts, activeWatermarkId, activeTextId, isDragging, initialElementX, initialElementY]);

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
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }

            animationFrameId = requestAnimationFrame(() => {
                canvas.width = container.clientWidth;
                canvas.height = container.clientHeight;
                drawImagesOnCanvas();
            });
        };

        const resizeObserver = new ResizeObserver(resizeCanvas);
        resizeObserver.observe(container);

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
                    setTexts([]);
                    setActiveWatermarkId(null);
                    setActiveTextId(null);
                    setNextWatermarkId(0);
                    setNextTextId(0);
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
                        opacity: 1.0,
                        name: file.name,
                    };
                    setWatermarks(prev => [...prev, newWatermark]);
                    setActiveWatermarkId(newWatermark.id);
                    setActiveTextId(null);
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

    const handleAddText = () => {
        if (!baseImageSrc) {
            setError("Por favor, sube una imagen base antes de añadir texto.");
            return;
        }
        setShowAddTextModal(true);
    };

    const handleCreateText = () => {
        if (newTextContent.trim() !== '') {
            const newText = {
                id: nextTextId,
                content: newTextContent,
                x: 50,
                y: 50,
                fontSize: 30,
                color: '#000000',
                opacity: 1.0,
                fontFamily: 'Inter', // Fuente predeterminada
            };
            setTexts(prev => [...prev, newText]);
            setActiveTextId(newText.id);
            setActiveWatermarkId(null);
            setNextTextId(prev => prev + 1);
            setNewTextContent('');
            setShowAddTextModal(false);
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
        let clickedElementId = null;
        let clickedElementType = null;
        const elementsArray = Array.from(allElementBounds.current.entries());

        for (let i = elementsArray.length - 1; i >= 0; i--) {
            const [id, bounds] = elementsArray[i];
            if (x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height) {
                clickedElementId = id;
                clickedElementType = bounds.type;
                break;
            }
        }

        if (clickedElementId !== null) {
            if (clickedElementType === 'watermark') {
                setActiveWatermarkId(Number(clickedElementId.split('-')[1]));
                setActiveTextId(null);
                activeElementRef.current = watermarks.find(w => w.id === Number(clickedElementId.split('-')[1]));
            } else if (clickedElementType === 'text') {
                setActiveTextId(Number(clickedElementId.split('-')[1]));
                setActiveWatermarkId(null);
                activeElementRef.current = texts.find(t => t.id === Number(clickedElementId.split('-')[1]));
            }

            setIsDragging(true);
            setDragStartX(x);
            setDragStartY(y);
            if (activeElementRef.current) {
                setInitialElementX(activeElementRef.current.x);
                setInitialElementY(activeElementRef.current.y);
            }
            currentDragOffsetRef.current = { dx: 0, dy: 0 };
        } else {
            setActiveWatermarkId(null);
            setActiveTextId(null);
            activeElementRef.current = null;
        }
    };

    const handleInteractionMove = (event) => {
        if (!isDragging || !activeElementRef.current) return;
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
        if (isDragging && activeElementRef.current) {
            const finalX = initialElementX + currentDragOffsetRef.current.dx;
            const finalY = initialElementY + currentDragOffsetRef.current.dy;

            if (activeWatermarkId !== null) {
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
            } else if (activeTextId !== null) {
                setTexts(prevTexts => {
                    return prevTexts.map(txt => {
                        if (txt.id === activeTextId) {
                             const boundedX = Math.max(0, Math.min(finalX, canvasRef.current.width - 100)); // Ancho aproximado
                             const boundedY = Math.max(0, Math.min(finalY, canvasRef.current.height - txt.fontSize));

                             return { ...txt, x: boundedX, y: boundedY };
                        }
                        return txt;
                    });
                });
            }
        }

        setIsDragging(false);
        currentDragOffsetRef.current = { dx: 0, dy: 0 };
        activeElementRef.current = null;
        if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
            animationFrameIdRef.current = null;
        }
        drawImagesOnCanvas();
    };

    // --- Fin de funciones para arrastrar ---

    // Funciones para ajustes
    const handleWatermarkScaleChange = (e) => {
        const newScale = Number(e.target.value);
        if (activeWatermarkId !== null) {
            setWatermarks(prevWatermarks => {
                return prevWatermarks.map(wm => (wm.id === activeWatermarkId) ? { ...wm, scale: newScale } : wm);
            });
        }
    };

    const handleWatermarkOpacityChange = (e) => {
        const newOpacity = Number(e.target.value);
        if (activeWatermarkId !== null) {
            setWatermarks(prevWatermarks => {
                return prevWatermarks.map(wm => (wm.id === activeWatermarkId) ? { ...wm, opacity: newOpacity } : wm);
            });
        }
    };

    const handleTextContentChange = (e) => {
        const newContent = e.target.value;
        if (activeTextId !== null) {
            setTexts(prevTexts => {
                return prevTexts.map(txt => (txt.id === activeTextId) ? { ...txt, content: newContent } : txt);
            });
        }
    };

    const handleTextFontSizeChange = (e) => {
        const newSize = Number(e.target.value);
        if (activeTextId !== null) {
            setTexts(prevTexts => {
                return prevTexts.map(txt => (txt.id === activeTextId) ? { ...txt, fontSize: newSize } : txt);
            });
        }
    };

    const handleTextFontChange = (e) => {
        const newFontFamily = e.target.value;
        if (activeTextId !== null) {
            setTexts(prevTexts => {
                return prevTexts.map(txt => (txt.id === activeTextId) ? { ...txt, fontFamily: newFontFamily } : txt);
            });
        }
    };

    const handleTextColorChange = (e) => {
        const newColor = e.target.value;
        if (activeTextId !== null) {
            setTexts(prevTexts => {
                return prevTexts.map(txt => (txt.id === activeTextId) ? { ...txt, color: newColor } : txt);
            });
        }
    };

    const handleTextOpacityChange = (e) => {
        const newOpacity = Number(e.target.value);
        if (activeTextId !== null) {
            setTexts(prevTexts => {
                return prevTexts.map(txt => (txt.id === activeTextId) ? { ...txt, opacity: newOpacity } : txt);
            });
        }
    };

    const handleRemoveElement = () => {
        if (activeWatermarkId !== null) {
            setWatermarks(prevWatermarks => prevWatermarks.filter(wm => wm.id !== activeWatermarkId));
            setActiveWatermarkId(null);
        } else if (activeTextId !== null) {
            setTexts(prevTexts => prevTexts.filter(txt => txt.id !== activeTextId));
            setActiveTextId(null);
        }
        setShowAdjustmentPanel(false);
    };

    const activeWatermark = watermarks.find(wm => wm.id === activeWatermarkId);
    const activeText = texts.find(txt => txt.id === activeTextId);

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

                    tempCtx.globalAlpha = watermark.opacity;
                    tempCtx.drawImage(watermark.obj, originalWatermarkX, originalWatermarkY, originalWatermarkWidth, originalWatermarkHeight);
                    tempCtx.globalAlpha = 1.0;
                }
            }

            for (const text of texts) {
                const currentCanvasScaleX = canvas.width / originalBaseImage.width;
                const currentCanvasScaleY = canvas.height / originalBaseImage.height;

                const originalTextX = text.x / currentCanvasScaleX;
                const originalTextY = text.y / currentCanvasScaleY;
                const originalFontSize = text.fontSize / currentCanvasScaleY;

                tempCtx.font = `${originalFontSize}px '${text.fontFamily}'`;
                tempCtx.fillStyle = text.color;
                tempCtx.globalAlpha = text.opacity;
                tempCtx.textAlign = 'left';
                tempCtx.textBaseline = 'top';
                tempCtx.fillText(text.content, originalTextX, originalTextY);
                tempCtx.globalAlpha = 1.0;
            }

            const link = document.createElement('a');
            link.download = 'imagen_editada.png';
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
        setTexts([]);
        setNextWatermarkId(0);
        setNextTextId(0);
        setActiveWatermarkId(null);
        setActiveTextId(null);
        setLoading(false);
        setError(null);
        setShowAdjustmentPanel(false);
        setShowHelpModal(false);
        setShowAddTextModal(false);
        if (baseImageInputRef.current) baseImageInputRef.current.value = '';
        if (watermarkInputRef.current) watermarkInputRef.current.value = '';
    };

    useEffect(() => {
        const isModalOpen = showAdjustmentPanel || showHelpModal || showAddTextModal;

        const handlePopstate = (e) => {
            if (isModalOpen) {
                e.preventDefault();
                setShowAdjustmentPanel(false);
                setShowHelpModal(false);
                setShowAddTextModal(false);
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
    }, [showAdjustmentPanel, showHelpModal, showAddTextModal]);

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
                Editor de Imágenes con Marca de Agua y Texto
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
                    onClick={handleAddText}
                    className={`icon-button bg-yellow-500 hover:bg-yellow-600 ${!baseImageSrc ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title="Añadir Texto: Agrega un nuevo texto a la imagen para personalizarla. Requiere una imagen base."
                    disabled={!baseImageSrc}
                >
                    <Type size={20} />
                </button>

                <button
                    onClick={() => setShowAdjustmentPanel(prev => !prev)}
                    className="icon-button bg-blue-500 hover:bg-blue-600"
                    title="Ajustar Elemento: Abre un panel para cambiar la escala, opacidad, o color del elemento seleccionado."
                >
                    <SlidersHorizontal size={20} />
                </button>

                <button
                    onClick={handleReset}
                    className="icon-button bg-gray-500 hover:bg-gray-600"
                    title="Reiniciar: Borra todas las imágenes y elementos, y restablece la aplicación."
                >
                    <RotateCcw size={20} />
                </button>

                <button
                    onClick={downloadImage}
                    className="icon-button bg-green-500 hover:bg-green-600"
                    title="Descargar Imagen: Guarda la imagen base con todas las marcas de agua y texto aplicados."
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

            {(showAdjustmentPanel && (activeWatermark || activeText)) && (
                <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50"
                     onClick={() => setShowAdjustmentPanel(false)}>
                    <div className="p-6 rounded-xl shadow-lg flex flex-col gap-4 w-11/12 max-w-sm"
                         style={{ backgroundColor: `rgba(255, 255, 255, ${modalOpacity})` }}
                         onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-semibold text-gray-700 mb-2">Ajustar Elemento</h3>
                        {activeWatermark && (
                            <>
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
                                <div className="mb-4">
                                    <label htmlFor="watermarkOpacity" className="block text-gray-700 text-sm font-medium mb-2">
                                        Opacidad de la Marca de Agua: {(activeWatermark.opacity * 100).toFixed(0)}%
                                    </label>
                                    <input
                                        type="range"
                                        id="watermarkOpacity"
                                        min="0.0"
                                        max="1.0"
                                        step="0.01"
                                        value={activeWatermark.opacity}
                                        onChange={handleWatermarkOpacityChange}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                            </>
                        )}
                        {activeText && (
                            <>
                                <div className="mb-4">
                                    <label htmlFor="textContent" className="block text-gray-700 text-sm font-medium mb-2">
                                        Contenido del Texto
                                    </label>
                                    <input
                                        type="text"
                                        id="textContent"
                                        value={activeText.content}
                                        onChange={handleTextContentChange}
                                        className="w-full p-2 border border-gray-300 rounded-md shadow-sm"
                                    />
                                </div>
                                <div className="mb-4">
                                    <label htmlFor="textFont" className="block text-gray-700 text-sm font-medium mb-2">
                                        Fuente
                                    </label>
                                    <select
                                        id="textFont"
                                        value={activeText.fontFamily}
                                        onChange={handleTextFontChange}
                                        className="w-full p-2 border border-gray-300 rounded-md shadow-sm"
                                    >
                                        {FONT_OPTIONS.map(font => (
                                            <option key={font} value={font}>
                                                {font}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="mb-4">
                                    <label htmlFor="textFontSize" className="block text-gray-700 text-sm font-medium mb-2">
                                        Tamaño de Fuente: {activeText.fontSize}px
                                    </label>
                                    <input
                                        type="range"
                                        id="textFontSize"
                                        min="10"
                                        max="100"
                                        step="1"
                                        value={activeText.fontSize}
                                        onChange={handleTextFontSizeChange}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                                <div className="mb-4">
                                    <label htmlFor="textColor" className="block text-gray-700 text-sm font-medium mb-2">
                                        Color de Texto
                                    </label>
                                    <input
                                        type="color"
                                        id="textColor"
                                        value={activeText.color}
                                        onChange={handleTextColorChange}
                                        className="w-full h-10 cursor-pointer"
                                    />
                                </div>
                                <div className="mb-4">
                                    <label htmlFor="textOpacity" className="block text-gray-700 text-sm font-medium mb-2">
                                        Opacidad del Texto: {(activeText.opacity * 100).toFixed(0)}%
                                    </label>
                                    <input
                                        type="range"
                                        id="textOpacity"
                                        min="0.0"
                                        max="1.0"
                                        step="0.01"
                                        value={activeText.opacity}
                                        onChange={handleTextOpacityChange}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                            </>
                        )}
                        {/* Control de opacidad para el panel modal */}
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
                            onClick={handleRemoveElement}
                            className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-full shadow-md
                                       transition duration-300 ease-in-out transform hover:scale-105 flex items-center justify-center gap-2"
                        >
                            <Trash2 size={18} /> Eliminar Elemento
                        </button>
                        <p className="text-sm text-gray-600 mt-2 text-center">
                            Arrastra el elemento en la imagen para moverlo.
                        </p>
                    </div>
                </div>
            )}

            {showAddTextModal && (
                <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50"
                     onClick={() => setShowAddTextModal(false)}>
                    <div className="bg-white p-6 rounded-xl shadow-lg flex flex-col gap-4 w-11/12 max-w-sm"
                         onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-semibold text-gray-700 mb-2">Añadir Texto</h3>
                        <input
                            type="text"
                            className="w-full p-2 border border-gray-300 rounded-md shadow-sm"
                            value={newTextContent}
                            onChange={(e) => setNewTextContent(e.target.value)}
                            placeholder="Introduce tu texto aquí..."
                        />
                        <button
                            onClick={handleCreateText}
                            className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded-full shadow-md"
                        >
                            Crear Texto
                        </button>
                        <button
                            onClick={() => setShowAddTextModal(false)}
                            className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-full shadow-md"
                        >
                            Cancelar
                        </button>
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
                                <Type size={24} className="text-yellow-600 flex-shrink-0" />
                                <div>
                                    <strong className="font-semibold">Añadir Texto:</strong> Agrega un texto a la imagen que puedes personalizar, mover y eliminar.
                                </div>
                            </li>
                            <li className="flex items-center gap-3">
                                <SlidersHorizontal size={24} className="text-blue-600 flex-shrink-0" />
                                <div>
                                    <strong className="font-semibold">Ajustar Elemento:</strong> Abre un panel para cambiar la escala, opacidad, tamaño o color del elemento (marca de agua o texto) seleccionado. Haz clic en un elemento en el lienzo para seleccionarlo. **Puedes reubicar cualquier elemento arrastrándolo directamente en la imagen.**
                                </div>
                            </li>
                            <li className="flex items-center gap-3">
                                <RotateCcw size={24} className="text-gray-600 flex-shrink-0" />
                                <div>
                                    <strong className="font-semibold">Reiniciar:</strong> Borra todas las imágenes y elementos, y restablece la aplicación a su estado inicial.
                                </div>
                            </li>
                            <li className="flex items-center gap-3">
                                <Download size={24} className="text-green-600 flex-shrink-0" />
                                <div>
                                    <strong className="font-semibold">Descargar Imagen:</strong> Guarda la imagen base con todas las marcas de agua y texto aplicados en tu dispositivo.
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








