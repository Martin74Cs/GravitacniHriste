import { Point } from './types';

export const GRAVITATIONAL_CONSTANT = 0.5; // Adjusted for visual effect, not real physics
export const POINT_RADIUS = 8;
export const WALL_PADDING = 5; // New: Minimum padding from the canvas edges for points
export const DEFAULT_TRAIL_LENGTH = 500; // Number of points in the trail, adjusted to 5x the previous default
export const MIN_TRAIL_LENGTH = 10;
export const MAX_TRAIL_LENGTH = 2500; // Increased to 5 times the previous maximum (5 * 500 = 2500)
export const BASE_TIME_STEP = 0.05; // Base simulation time step per frame
export const MIN_SIMULATION_SPEED = 1;
export const MAX_SIMULATION_SPEED = 20; // Increased to allow speeds up to 20x
export const DEFAULT_SIMULATION_SPEED = 10;
export const INITIAL_MASS_RANGE = { min: 50, max: 150 };
export const MASS_EDIT_RANGE = { min: 10, max: 500 }; // Range for mass editing
export const INITIAL_VELOCITY_RANGE = { min: -10, max: 10 }; // Range for initial velocity editing
export const DEFAULT_INITIAL_VELOCITY = 0;
export const COLORS = ['#FF6347', '#4682B4', '#3CB371', '#FFD700', '#BA55D3']; // Tomato, SteelBlue, MediumSeaGreen, Gold, MediumOrchid
export const MIN_DISTANCE_SQUARED = Math.pow(POINT_RADIUS * 2, 2); // Squared min distance to prevent extreme forces
export const MAX_POINTS = 50; // Increased limit to allow arbitrary number of points (practically)