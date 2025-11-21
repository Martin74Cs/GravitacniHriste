import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  GRAVITATIONAL_CONSTANT,
  POINT_RADIUS,
  WALL_PADDING, // New: Import WALL_PADDING
  DEFAULT_TRAIL_LENGTH,
  MIN_TRAIL_LENGTH,
  MAX_TRAIL_LENGTH,
  BASE_TIME_STEP, // Changed from TIME_STEP
  MIN_SIMULATION_SPEED,
  MAX_SIMULATION_SPEED,
  DEFAULT_SIMULATION_SPEED,
  INITIAL_MASS_RANGE,
  MASS_EDIT_RANGE,
  INITIAL_VELOCITY_RANGE,
  DEFAULT_INITIAL_VELOCITY,
  COLORS,
  MIN_DISTANCE_SQUARED,
  MAX_POINTS,
} from './constants';
import { Point } from './types';

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  // Ref to track collision state across frames without triggering re-renders during calculation
  const collisionRef = useRef<boolean>(false);
  
  const [points, setPoints] = useState<Point[]>([]);
  // Store initial state of points before simulation starts for restarting
  const [savedPoints, setSavedPoints] = useState<Point[]>([]);
  
  const [clicks, setClicks] = useState<number>(0);
  const [isSimulationRunning, setIsSimulationRunning] = useState<boolean>(false);
  const [canvasDimensions, setCanvasDimensions] = useState<{ width: number; height: number }>({
    width: 800,
    height: 600,
  });

  // State for point editing feature (mass and velocity)
  const [editingPointId, setEditingPointId] = useState<string | null>(null);
  const [editingPointX, setEditingPointX] = useState<number>(0);
  const [editingPointY, setEditingPointY] = useState<number>(0);
  const [editingPointMass, setEditingPointMass] = useState<number>(0);
  const [editingPointVx, setEditingPointVx] = useState<number>(0);
  const [editingPointVy, setEditingPointVy] = useState<number>(0);
  // New state for multi-point editing
  const [showAllPointsEditor, setShowAllPointsEditor] = useState<boolean>(false);

  // State for trail controls
  const [showTrails, setShowTrails] = useState<boolean>(true);
  const [trailLength, setTrailLength] = useState<number>(DEFAULT_TRAIL_LENGTH);

  // State for simulation speed
  const [simulationSpeed, setSimulationSpeed] = useState<number>(DEFAULT_SIMULATION_SPEED);

  // Handle window resize to make canvas responsive
  useEffect(() => {
    const updateCanvasDimensions = () => {
      const container = document.getElementById('canvas-container');
      if (container) {
        setCanvasDimensions({
          width: container.offsetWidth,
          height: container.offsetHeight,
        });
      }
    };

    updateCanvasDimensions();
    window.addEventListener('resize', updateCanvasDimensions);
    return () => window.removeEventListener('resize', updateCanvasDimensions);
  }, []);

  // Effect for drawing points and trails on the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas for each frame

    points.forEach((point) => {
      // Draw path only if showTrails is true
      if (showTrails) {
        ctx.beginPath();
        if (point.path.length > 0) {
          ctx.moveTo(point.path[0].x, point.path[0].y);
          for (let i = 1; i < point.path.length; i++) {
            ctx.lineTo(point.path[i].x, point.path[i].y);
          }
        }
        ctx.strokeStyle = point.color;
        ctx.lineWidth = 1;
        ctx.stroke();
      }


      // Draw point
      ctx.beginPath();
      ctx.arc(point.x, point.y, POINT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = point.color;
      ctx.fill();
      ctx.strokeStyle = editingPointId === point.id ? 'yellow' : 'rgba(255, 255, 255, 0.7)'; // Highlight edited point
      ctx.lineWidth = editingPointId === point.id ? 3 : 0.5;
      ctx.stroke();
    });
  }, [points, canvasDimensions, editingPointId, showTrails]); // Redraw whenever points, canvas dimensions, or editing state change

  // Simulation logic that updates the state of points
  const simulateFrame = useCallback(() => {
    // Check if we need to stop due to collision in previous frame
    if (collisionRef.current) {
      setIsSimulationRunning(false);
      collisionRef.current = false;
      return;
    }

    const effectiveTimeStep = BASE_TIME_STEP * simulationSpeed;

    setPoints((prevPoints) => {
      if (prevPoints.length === 0) return prevPoints; // Don't simulate if no points

      const newPoints: Point[] = prevPoints.map((p) => ({ ...p, path: [...p.path] })); // Deep copy for immutability
      let collisionDetected = false;

      for (let i = 0; i < newPoints.length; i++) {
        const p1 = newPoints[i];
        let totalFx = 0;
        let totalFy = 0;

        for (let j = 0; j < newPoints.length; j++) {
          if (i === j) continue;
          const p2 = newPoints[j];

          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const distanceSquared = dx * dx + dy * dy;

          // Avoid division by zero and extremely strong forces at close range
          const effectiveDistanceSquared = Math.max(distanceSquared, MIN_DISTANCE_SQUARED);
          const distance = Math.sqrt(effectiveDistanceSquared);

          const forceMagnitude = GRAVITATIONAL_CONSTANT * p1.mass * p2.mass / effectiveDistanceSquared;

          totalFx += forceMagnitude * (dx / distance);
          totalFy += forceMagnitude * (dy / distance);
        }

        const ax = totalFx / p1.mass;
        const ay = totalFy / p1.mass;

        p1.vx += ax * effectiveTimeStep;
        p1.vy += ay * effectiveTimeStep;

        p1.x += p1.vx * effectiveTimeStep;
        p1.y += p1.vy * effectiveTimeStep;

        // Boundary collision detection (Stop on impact)
        const minX = POINT_RADIUS + WALL_PADDING;
        const maxX = canvasDimensions.width - (POINT_RADIUS + WALL_PADDING);
        const minY = POINT_RADIUS + WALL_PADDING;
        const maxY = canvasDimensions.height - (POINT_RADIUS + WALL_PADDING);

        // Check X boundaries
        if (p1.x < minX) {
          p1.x = minX; // Clamp to boundary
          collisionDetected = true;
        } else if (p1.x > maxX) {
          p1.x = maxX; // Clamp to boundary
          collisionDetected = true;
        }

        // Check Y boundaries
        if (p1.y < minY) {
          p1.y = minY; // Clamp to boundary
          collisionDetected = true;
        } else if (p1.y > maxY) {
          p1.y = maxY; // Clamp to boundary
          collisionDetected = true;
        }

        // Update path
        p1.path.push({ x: p1.x, y: p1.y });
        if (p1.path.length > trailLength) { // Use dynamic trailLength
          p1.path.shift();
        }
      }

      if (collisionDetected) {
        collisionRef.current = true;
      }

      return newPoints;
    });

    animationFrameIdRef.current = requestAnimationFrame(simulateFrame);
  }, [canvasDimensions, trailLength, simulationSpeed]); // Re-create if canvas dimensions, trailLength, or simulationSpeed change

  // Effect for managing the animation frame loop
  useEffect(() => {
    if (!isSimulationRunning || points.length === 0) {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      return;
    }

    animationFrameIdRef.current = requestAnimationFrame(simulateFrame);

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSimulationRunning, simulateFrame]); // `simulateFrame` is stable due to useCallback

  const closePointEditor = useCallback(() => { // Now closes both single and all points editors
    setEditingPointId(null);
    setEditingPointX(0);
    setEditingPointY(0);
    setEditingPointMass(0);
    setEditingPointVx(0);
    setEditingPointVy(0);
    setShowAllPointsEditor(false); // Also close the "Edit all points" editor
  }, []);

  // New: Unified handler for changing mass, vx, or vy for a given point ID
  const handlePointPropertyChange = useCallback((pointId: string, property: 'mass' | 'vx' | 'vy', value: number) => {
    setPoints(prevPoints =>
      prevPoints.map(p =>
        p.id === pointId ? { ...p, [property]: value } : p
      )
    );
    // If the changed point is the one currently in the single-point editor, update its local state too
    if (editingPointId === pointId) {
      if (property === 'mass') setEditingPointMass(value);
      else if (property === 'vx') setEditingPointVx(value);
      else if (property === 'vy') setEditingPointVy(value);
    }
  }, [editingPointId]);


  const handleMassChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newMass = parseFloat(event.target.value);
    if (editingPointId) handlePointPropertyChange(editingPointId, 'mass', newMass);
  }, [editingPointId, handlePointPropertyChange]);

  // Handler for Vx change
  const handleVxChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newVx = parseFloat(event.target.value);
    if (editingPointId) handlePointPropertyChange(editingPointId, 'vx', newVx);
  }, [editingPointId, handlePointPropertyChange]);

  // Handler for Vy change
  const handleVyChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newVy = parseFloat(event.target.value);
    if (editingPointId) handlePointPropertyChange(editingPointId, 'vy', newVy);
  }, [editingPointId, handlePointPropertyChange]);

  const handleTrailVisibilityToggle = useCallback(() => {
    setShowTrails((prev) => !prev);
  }, []);

  const handleTrailLengthChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newLength = parseInt(event.target.value, 10);
    setTrailLength(newLength);
    // When trail length changes, re-trim existing trails to prevent unexpected behavior
    setPoints((prevPoints) =>
      prevPoints.map((p) => ({
        ...p,
        path: p.path.slice(Math.max(0, p.path.length - newLength)),
      }))
    );
  }, []);

  // Handler for simulation speed change
  const handleSimulationSpeedChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newSpeed = parseFloat(event.target.value);
    setSimulationSpeed(newSpeed);
  }, []);

  // New: Function to open the "Edit all points" editor
  const openAllPointsEditor = useCallback(() => {
    closePointEditor(); // Close single point editor if open
    setShowAllPointsEditor(true);
  }, [closePointEditor]);


  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    // If simulation is running, always close any editor and prevent interaction
    if (isSimulationRunning) {
      closePointEditor(); // Ensure all editors are closed
      return;
    }

    // If "Edit all points" editor is open, close it on canvas click outside
    if (showAllPointsEditor) {
      closePointEditor();
      return;
    }

    // Check if an existing point was clicked for individual editing
    const clickedPoint = points.find(p => {
        const distance = Math.sqrt(Math.pow(p.x - clickX, 2) + Math.pow(p.y - clickY, 2));
        return distance <= POINT_RADIUS;
    });

    if (clickedPoint) {
        closePointEditor(); // Close any currently open editor (including another single point editor)
        setEditingPointId(clickedPoint.id);
        setEditingPointX(clickedPoint.x);
        setEditingPointY(clickedPoint.y);
        setEditingPointMass(clickedPoint.mass);
        setEditingPointVx(clickedPoint.vx);
        setEditingPointVy(clickedPoint.vy);
        return; // A point was clicked, handle editing instead of placing a new one
    }

    // If a single-point editor is open and the click was not on a point, close the editor
    if (editingPointId) {
        closePointEditor();
        return;
    }

    // If no point was clicked and no editor is open, proceed to place a new point
    if (clicks >= MAX_POINTS) return;

    const newPoint: Point = {
      id: `point-${clicks}`,
      x: clickX,
      y: clickY,
      vx: DEFAULT_INITIAL_VELOCITY,
      vy: DEFAULT_INITIAL_VELOCITY,
      mass: INITIAL_MASS_RANGE.min + Math.random() * (INITIAL_MASS_RANGE.max - INITIAL_MASS_RANGE.min),
      color: COLORS[clicks % COLORS.length],
      path: [{ x: clickX, y: clickY }],
    };

    setPoints((prevPoints) => [...prevPoints, newPoint]);
    setClicks((prevClicks) => prevClicks + 1);
  };

  const startSimulation = () => {
    if (points.length > 0) {
      // Save current state of points (positions and velocities) before simulation starts
      setSavedPoints(JSON.parse(JSON.stringify(points)));
      setIsSimulationRunning(true);
      closePointEditor(); // Close any editor when simulation starts
    }
  };

  const handleRestart = () => {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    setIsSimulationRunning(false);
    closePointEditor();

    if (savedPoints.length > 0) {
      // Restore points from the saved state
      const restoredPoints = savedPoints.map(p => ({
        ...p,
        path: [{ x: p.x, y: p.y }] // Reset path to starting position
      }));
      setPoints(restoredPoints);
    } else {
        // Fallback if no saved state exists (e.g. restart before start), just clear paths
        setPoints(prev => prev.map(p => ({...p, path: [{x: p.x, y: p.y}]})));
    }
  };

  const handleClear = () => {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    setPoints([]);
    setSavedPoints([]); // Clear saved points as well
    setClicks(0);
    setIsSimulationRunning(false);
    closePointEditor(); // Close any editor on reset
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-2rem)] w-full max-w-4xl mx-auto p-4 bg-gray-800 rounded-lg shadow-xl">
      <h1 className="text-4xl font-extrabold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-green-300">
        Gravitační Hřiště
      </h1>

      {/* Trail and Speed Controls */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-6 p-3 bg-gray-700 rounded-lg shadow-inner w-full max-w-2xl">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="show-trails"
            checked={showTrails}
            onChange={handleTrailVisibilityToggle}
            className="h-4 w-4 text-blue-600 bg-gray-600 border-gray-500 rounded focus:ring-blue-500"
            aria-label="Toggle trail visibility"
          />
          <label htmlFor="show-trails" className="text-gray-300">stopy</label>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="trail-length" className="text-gray-300 whitespace-nowrap">Délka stopy: {trailLength}</label>
          <input
            type="range"
            id="trail-length"
            min={MIN_TRAIL_LENGTH}
            max={MAX_TRAIL_LENGTH}
            value={trailLength}
            onChange={handleTrailLengthChange}
            className="w-32 accent-blue-500"
            aria-valuenow={trailLength}
            aria-valuemin={MIN_TRAIL_LENGTH}
            aria-valuemax={MAX_TRAIL_LENGTH}
            aria-label="Adjust trail length"
            disabled={!showTrails}
          />
        </div>
        {/* Simulation Speed Control */}
        <div className="flex items-center gap-2">
          <label htmlFor="simulation-speed" className="text-gray-300 whitespace-nowrap">Rychlost simulace: {simulationSpeed.toFixed(1)}x</label>
          <input
            type="range"
            id="simulation-speed"
            min={MIN_SIMULATION_SPEED}
            max={MAX_SIMULATION_SPEED}
            step={0.1}
            value={simulationSpeed}
            onChange={handleSimulationSpeedChange}
            className="w-32 accent-green-500"
            aria-valuenow={simulationSpeed}
            aria-valuemin={MIN_SIMULATION_SPEED}
            aria-valuemax={MAX_SIMULATION_SPEED}
            aria-label="Adjust simulation speed"
          />
        </div>
      </div>


      <div className="mb-4 text-center" role="status" aria-live="polite">
        {!isSimulationRunning && (
          <p className="text-lg text-gray-300">
            Kliknutím přidávejte body. Aktuální počet: {points.length}.
            {points.length > 1 && <span className="ml-2 text-green-400">Připraveno ke spuštění.</span>}
          </p>
        )}
        {isSimulationRunning && (
          <p className="text-lg text-blue-300">Simulace běží... ({points.length} bodů)</p>
        )}
      </div>

      <div
        id="canvas-container"
        className="relative bg-gray-950 border border-blue-500 rounded-lg overflow-hidden mb-6 w-full max-w-3xl aspect-video"
      >
        <canvas
          ref={canvasRef}
          width={canvasDimensions.width}
          height={canvasDimensions.height}
          onClick={handleCanvasClick}
          className="block cursor-crosshair"
          aria-label="Gravitational simulation canvas"
        ></canvas>

        {/* Mass and Velocity editor UI for single point */}
        {editingPointId && !isSimulationRunning && (
          <div
            className="absolute p-3 bg-gray-700 rounded-lg shadow-lg flex flex-col items-center z-10 space-y-2"
            style={{
              left: editingPointX,
              top: editingPointY + POINT_RADIUS * 2, // Position below the point
              transform: 'translateX(-50%)', // Center horizontally
            }}
            onClick={(e) => e.stopPropagation()} // Prevent click on editor from propagating to canvas
            role="dialog"
            aria-modal="true"
            aria-labelledby="point-editor-label"
          >
            <h3 id="point-editor-label" className="text-md font-semibold text-gray-200">Upravit bod</h3>
            {/* Mass control */}
            <div className="flex flex-col items-center w-full">
              <label htmlFor="mass-slider" className="text-sm text-gray-300 mb-1">
                Hmotnost: {editingPointMass.toFixed(0)}
              </label>
              <input
                type="range"
                id="mass-slider"
                min={MASS_EDIT_RANGE.min}
                max={MASS_EDIT_RANGE.max}
                value={editingPointMass}
                onChange={handleMassChange}
                className="w-32 accent-blue-500"
                aria-valuenow={editingPointMass}
                aria-valuemin={MASS_EDIT_RANGE.min}
                aria-valuemax={MASS_EDIT_RANGE.max}
                aria-label="Upravit hmotnost bodu"
              />
            </div>

            {/* Velocity X control */}
            <div className="flex flex-col items-center w-full">
              <label htmlFor="vx-slider" className="text-sm text-gray-300 mb-1">
                Počáteční Vx: {editingPointVx.toFixed(1)}
              </label>
              <input
                type="range"
                id="vx-slider"
                min={INITIAL_VELOCITY_RANGE.min}
                max={INITIAL_VELOCITY_RANGE.max}
                step={0.1}
                value={editingPointVx}
                onChange={handleVxChange}
                className="w-32 accent-blue-500"
                aria-valuenow={editingPointVx}
                aria-valuemin={INITIAL_VELOCITY_RANGE.min}
                aria-valuemax={INITIAL_VELOCITY_RANGE.max}
                aria-label="Upravit počáteční rychlost X"
              />
            </div>

            {/* Velocity Y control */}
            <div className="flex flex-col items-center w-full">
              <label htmlFor="vy-slider" className="text-sm text-gray-300 mb-1">
                Počáteční Vy: {editingPointVy.toFixed(1)}
              </label>
              <input
                type="range"
                id="vy-slider"
                min={INITIAL_VELOCITY_RANGE.min}
                max={INITIAL_VELOCITY_RANGE.max}
                step={0.1}
                value={editingPointVy}
                onChange={handleVyChange}
                className="w-32 accent-blue-500"
                aria-valuenow={editingPointVy}
                aria-valuemin={INITIAL_VELOCITY_RANGE.min}
                aria-valuemax={INITIAL_VELOCITY_RANGE.max}
                aria-label="Upravit počáteční rychlost Y"
              />
            </div>

            <button
              onClick={closePointEditor}
              className="mt-3 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-md text-white text-sm"
            >
              Hotovo
            </button>
          </div>
        )}

        {/* Overlay for point placement / simulation waiting */}
        {!isSimulationRunning && !editingPointId && !showAllPointsEditor && points.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-70 text-white text-xl font-bold p-4 pointer-events-none">
            Začněte kliknutím na plátno.
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-4 mb-6">
        <button
          onClick={startSimulation}
          disabled={points.length === 0 || isSimulationRunning}
          className={`px-8 py-3 rounded-full font-semibold text-lg transition duration-300 ease-in-out
                      ${points.length === 0 || isSimulationRunning
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white shadow-lg'
                      }`}
          aria-disabled={points.length === 0 || isSimulationRunning}
        >
          Spustit
        </button>
        
        <button
          onClick={handleRestart}
          disabled={points.length === 0}
          className={`px-8 py-3 rounded-full font-semibold text-lg transition duration-300 ease-in-out shadow-lg
            ${points.length === 0 ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-700 text-white'}`}
        >
          Restartovat
        </button>

        <button
          onClick={handleClear}
          className="px-8 py-3 rounded-full font-semibold text-lg bg-red-600 hover:bg-red-700 text-white transition duration-300 ease-in-out shadow-lg"
        >
          Vymazat
        </button>

        <button
          onClick={openAllPointsEditor}
          disabled={isSimulationRunning || points.length === 0}
          className={`px-8 py-3 rounded-full font-semibold text-lg transition duration-300 ease-in-out
                      ${isSimulationRunning || points.length === 0
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          : 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg'
                      }`}
          aria-disabled={isSimulationRunning || points.length === 0}
        >
          Upravit všechny body
        </button>
      </div>

      {/* New: Edit All Points Modal */}
      {showAllPointsEditor && !isSimulationRunning && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="edit-all-points-label">
          <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 id="edit-all-points-label" className="text-2xl font-bold text-gray-100 mb-4 text-center">Upravit všechny body</h2>
            <div className="space-y-6">
              {points.map((point, index) => (
                <div key={point.id} className="bg-gray-700 p-4 rounded-md shadow-inner">
                  <h3 className="text-lg font-semibold mb-2" style={{ color: point.color }}>
                    Bod {index + 1}
                  </h3>
                  {/* Mass control */}
                  <div className="mb-3">
                    <label htmlFor={`mass-${point.id}`} className="block text-sm text-gray-300 mb-1">
                      Hmotnost: {point.mass.toFixed(0)}
                    </label>
                    <input
                      type="range"
                      id={`mass-${point.id}`}
                      min={MASS_EDIT_RANGE.min}
                      max={MASS_EDIT_RANGE.max}
                      value={point.mass}
                      onChange={(e) => handlePointPropertyChange(point.id, 'mass', parseFloat(e.target.value))}
                      className="w-full accent-blue-500"
                      aria-label={`Upravit hmotnost bodu ${index + 1}`}
                    />
                  </div>
                  {/* Vx control */}
                  <div className="mb-3">
                    <label htmlFor={`vx-${point.id}`} className="block text-sm text-gray-300 mb-1">
                      Počáteční Vx: {point.vx.toFixed(1)}
                    </label>
                    <input
                      type="range"
                      id={`vx-${point.id}`}
                      min={INITIAL_VELOCITY_RANGE.min}
                      max={INITIAL_VELOCITY_RANGE.max}
                      step={0.1}
                      value={point.vx}
                      onChange={(e) => handlePointPropertyChange(point.id, 'vx', parseFloat(e.target.value))}
                      className="w-full accent-blue-500"
                      aria-label={`Upravit počáteční rychlost X bodu ${index + 1}`}
                    />
                  </div>
                  {/* Vy control */}
                  <div>
                    <label htmlFor={`vy-${point.id}`} className="block text-sm text-gray-300 mb-1">
                      Počáteční Vy: {point.vy.toFixed(1)}
                    </label>
                    <input
                      type="range"
                      id={`vy-${point.id}`}
                      min={INITIAL_VELOCITY_RANGE.min}
                      max={INITIAL_VELOCITY_RANGE.max}
                      step={0.1}
                      value={point.vy}
                      onChange={(e) => handlePointPropertyChange(point.id, 'vy', parseFloat(e.target.value))}
                      className="w-full accent-blue-500"
                      aria-label={`Upravit počáteční rychlost Y bodu ${index + 1}`}
                    />
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={closePointEditor}
              className="mt-6 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-white text-lg font-semibold"
            >
              Zavřít
            </button>
          </div>
        </div>
      )}

      <p className="mt-8 text-sm text-gray-500 text-center">
        Simulace je zjednodušená a nemusí přesně odpovídat reálné fyzice.
      </p>
    </div>
  );
};

export default App;