/**
 * Shared constants — travel estimates are spec-mandated:
 * walking 78 m/min, urban driving 25 km/h.
 */
export const WALK_METERS_PER_MINUTE = 78;
export const DRIVE_KMH = 25;
export const DRIVE_METERS_PER_MINUTE = (DRIVE_KMH * 1000) / 60; // 416.67 m/min

/** Nearby defaults / bounds */
export const NEARBY_DEFAULT_RADIUS_M = 3000;
export const NEARBY_MAX_RADIUS_M = 20000;
export const NEARBY_DEFAULT_LIMIT = 20;
export const NEARBY_MAX_LIMIT = 100;

/** Search defaults / bounds */
export const SEARCH_DEFAULT_LIMIT = 20;
export const SEARCH_MAX_LIMIT = 100;
export const SEARCH_MAX_DISTANCE_M = 20000;

/** Favorites / recent searches */
export const RECENT_SEARCHES_KEEP = 10;
export const RECENT_SEARCH_MAX_LENGTH = 120;

/** Reports */
export const REPORT_RECENT_LIST_LIMIT = 10;
export const REPORT_RECENT_LIST_MAX = 50;

/** Import validation: Egypt bounding box */
export const EGYPT_BOUNDS = {
  minLat: 22.0,
  maxLat: 31.7,
  minLng: 24.7,
  maxLng: 36.9,
} as const;
