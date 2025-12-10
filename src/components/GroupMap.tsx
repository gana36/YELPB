import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import { motion, AnimatePresence } from 'motion/react';
import { Map, Users, Crosshair, ChevronDown, ChevronUp, AlertTriangle, CheckCircle } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface UserLocation {
    id: string;
    name: string;
    color: string;
    latitude: number;
    longitude: number;
    isCurrentUser?: boolean;
}

interface UserWithDistance extends UserLocation {
    distanceFromCenter: number;
    isWithinRadius: boolean;
}

interface GroupMapProps {
    users: UserLocation[];
    currentUserLocation?: { latitude: number; longitude: number };
    distanceRadius?: number; // in miles
    onCenterCalculated?: (center: { lat: number; lng: number }) => void;
    onFairnessUpdate?: (data: {
        allWithinRadius: boolean;
        usersOutside: UserWithDistance[];
        suggestedRadius: number
    }) => void;
}

// Haversine formula to calculate distance between two coordinates in miles
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3958.8; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Custom colored marker icons
const createUserIcon = (color: string, isCurrentUser: boolean, isOutsideRadius: boolean) => {
    const opacity = isOutsideRadius ? '0.5' : '1';
    const borderStyle = isOutsideRadius ? 'border: 3px dashed #ff6b6b;' : 'border: 3px solid white;';

    return L.divIcon({
        className: 'custom-marker',
        html: `
      <div style="
        width: ${isCurrentUser ? '32px' : '24px'};
        height: ${isCurrentUser ? '32px' : '24px'};
        border-radius: 50%;
        background: ${color};
        ${borderStyle}
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: ${opacity};
        ${isCurrentUser ? 'animation: pulse 2s infinite;' : ''}
        ${isOutsideRadius ? 'animation: warning-pulse 1.5s infinite;' : ''}
      ">
        ${isCurrentUser ? '<div style="width: 8px; height: 8px; background: white; border-radius: 50%;"></div>' : ''}
      </div>
    `,
        iconSize: [isCurrentUser ? 32 : 24, isCurrentUser ? 32 : 24],
        iconAnchor: [isCurrentUser ? 16 : 12, isCurrentUser ? 16 : 12],
    });
};

// Component to recenter map when center changes
function RecenterMap({ center }: { center: [number, number] }) {
    const map = useMap();
    useEffect(() => {
        map.setView(center, map.getZoom());
    }, [center, map]);
    return null;
}

export function GroupMap({
    users,
    currentUserLocation,
    distanceRadius = 2,
    onCenterCalculated,
    onFairnessUpdate
}: GroupMapProps) {
    const [isExpanded, setIsExpanded] = useState(true);

    // Calculate center point of all users
    const groupCenter = useMemo(() => {
        const allLocations = [...users];
        if (currentUserLocation) {
            allLocations.push({
                id: 'current',
                name: 'You',
                color: '#F97316',
                ...currentUserLocation,
                isCurrentUser: true
            });
        }

        if (allLocations.length === 0) {
            return { lat: 37.7749, lng: -122.4194 }; // Default to SF
        }

        const sumLat = allLocations.reduce((sum, u) => sum + u.latitude, 0);
        const sumLng = allLocations.reduce((sum, u) => sum + u.longitude, 0);

        return {
            lat: sumLat / allLocations.length,
            lng: sumLng / allLocations.length
        };
    }, [users, currentUserLocation]);

    // All users with distance calculations
    const usersWithDistance: UserWithDistance[] = useMemo(() => {
        const result = [...users];
        if (currentUserLocation) {
            result.push({
                id: 'current',
                name: 'You',
                color: '#F97316',
                ...currentUserLocation,
                isCurrentUser: true
            });
        }

        return result.map(user => {
            const dist = calculateDistance(
                groupCenter.lat, groupCenter.lng,
                user.latitude, user.longitude
            );
            return {
                ...user,
                distanceFromCenter: Math.round(dist * 10) / 10,
                isWithinRadius: dist <= distanceRadius
            };
        });
    }, [users, currentUserLocation, groupCenter, distanceRadius]);

    // Fairness analysis
    const fairnessData = useMemo(() => {
        const usersOutside = usersWithDistance.filter(u => !u.isWithinRadius);
        const allWithinRadius = usersOutside.length === 0;
        const maxDistance = Math.max(...usersWithDistance.map(u => u.distanceFromCenter));
        const suggestedRadius = Math.ceil(maxDistance * 2) / 2; // Round up to nearest 0.5

        return {
            allWithinRadius,
            usersOutside,
            usersInside: usersWithDistance.filter(u => u.isWithinRadius),
            suggestedRadius: Math.max(suggestedRadius, 0.5)
        };
    }, [usersWithDistance]);

    // Notify parent of calculated center and fairness data
    useEffect(() => {
        if (onCenterCalculated) {
            onCenterCalculated(groupCenter);
        }
    }, [groupCenter, onCenterCalculated]);

    useEffect(() => {
        if (onFairnessUpdate) {
            onFairnessUpdate(fairnessData);
        }
    }, [fairnessData, onFairnessUpdate]);

    // Convert miles to meters for circle radius
    const radiusInMeters = distanceRadius * 1609.34;

    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl"
        >
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-white/5"
            >
                <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${fairnessData.allWithinRadius ? 'from-green-500 to-emerald-600' : 'from-[#F97316] to-orange-600'
                        }`}>
                        <Map className="h-5 w-5 text-white" />
                    </div>
                    <div className="text-left">
                        <h3 className="text-sm font-semibold text-white">Group Location</h3>
                        <p className="text-xs text-gray-400">
                            {usersWithDistance.length} {usersWithDistance.length === 1 ? 'person' : 'people'} • {distanceRadius} mi radius
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Fairness indicator badge */}
                    {fairnessData.allWithinRadius ? (
                        <div className="flex items-center gap-1 rounded-full bg-green-500/20 px-2 py-1">
                            <CheckCircle className="h-3 w-3 text-green-400" />
                            <span className="text-xs text-green-400">All reachable</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1 rounded-full bg-orange-500/20 px-2 py-1">
                            <AlertTriangle className="h-3 w-3 text-orange-400" />
                            <span className="text-xs text-orange-400">{fairnessData.usersOutside.length} outside</span>
                        </div>
                    )}

                    {/* User avatars */}
                    <div className="flex -space-x-2">
                        {usersWithDistance.slice(0, 4).map((user) => (
                            <div
                                key={user.id}
                                className={`h-6 w-6 rounded-full border-2 ${user.isWithinRadius ? 'border-black' : 'border-red-500 border-dashed'
                                    }`}
                                style={{ backgroundColor: user.color, opacity: user.isWithinRadius ? 1 : 0.5 }}
                                title={`${user.name}: ${user.distanceFromCenter} mi`}
                            />
                        ))}
                    </div>

                    {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                </div>
            </button>

            {/* Map */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <MapContainer
                            center={[groupCenter.lat, groupCenter.lng]}
                            zoom={13}
                            style={{ height: '180px', width: '100%' }}
                            zoomControl={false}
                            attributionControl={false}
                        >
                            {/* Dark theme map tiles */}
                            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />

                            <RecenterMap center={[groupCenter.lat, groupCenter.lng]} />

                            {/* Search radius circle */}
                            <Circle
                                center={[groupCenter.lat, groupCenter.lng]}
                                radius={radiusInMeters}
                                pathOptions={{
                                    color: fairnessData.allWithinRadius ? '#22c55e' : '#F97316',
                                    fillColor: fairnessData.allWithinRadius ? '#22c55e' : '#F97316',
                                    fillOpacity: 0.1,
                                    weight: 2,
                                    dashArray: '5, 10'
                                }}
                            />

                            {/* Center point marker */}
                            <Marker
                                position={[groupCenter.lat, groupCenter.lng]}
                                icon={L.divIcon({
                                    className: 'center-marker',
                                    html: `
                    <div style="
                      width: 16px;
                      height: 16px;
                      background: ${fairnessData.allWithinRadius ? '#22c55e' : '#F97316'};
                      border: 2px solid white;
                      border-radius: 50%;
                      box-shadow: 0 0 15px ${fairnessData.allWithinRadius ? 'rgba(34,197,94,0.6)' : 'rgba(249,115,22,0.6)'};
                    "></div>
                  `,
                                    iconSize: [16, 16],
                                    iconAnchor: [8, 8],
                                })}
                            />

                            {/* User markers */}
                            {usersWithDistance.map((user) => (
                                <Marker
                                    key={user.id}
                                    position={[user.latitude, user.longitude]}
                                    icon={createUserIcon(user.color, user.isCurrentUser || false, !user.isWithinRadius)}
                                />
                            ))}
                        </MapContainer>

                        {/* Fairness Details Panel */}
                        <div className="border-t border-white/10 bg-black/60 px-4 py-3">
                            {fairnessData.allWithinRadius ? (
                                <div className="flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4 text-green-400" />
                                    <span className="text-sm text-green-400">
                                        Everyone is within {distanceRadius} mi of the meeting point!
                                    </span>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle className="h-4 w-4 text-orange-400 mt-0.5" />
                                        <div className="flex-1">
                                            <p className="text-sm text-orange-400">
                                                {fairnessData.usersOutside.length === 1 ? '1 person' : `${fairnessData.usersOutside.length} people`} would need to travel further
                                            </p>
                                            <div className="mt-1 flex flex-wrap gap-1">
                                                {fairnessData.usersOutside.map(user => (
                                                    <span
                                                        key={user.id}
                                                        className="inline-flex items-center gap-1 rounded-full bg-orange-500/20 px-2 py-0.5 text-xs"
                                                    >
                                                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: user.color }} />
                                                        <span className="text-orange-300">{user.name}: {user.distanceFromCenter} mi</span>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Suggestion */}
                                    <div className="mt-2 rounded-lg bg-orange-500/10 px-3 py-2">
                                        <p className="text-xs text-orange-300">
                                            💡 <strong>Suggestion:</strong> Increase radius to {fairnessData.suggestedRadius} mi to include everyone
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Animations */}
            <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
        @keyframes warning-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255, 107, 107, 0.4); }
          50% { box-shadow: 0 0 0 8px rgba(255, 107, 107, 0); }
        }
      `}</style>
        </motion.div>
    );
}
