
"use client";

import { APIProvider, AdvancedMarker, Map, Polygon } from "@vis.gl/react-google-maps";
import { Phone } from "lucide-react";
import MapDrawingController from "./MapDrawingController";
import type { SavedParcel } from "../../types/landlens";
import { Fragment, useEffect, useRef, useState } from "react";
import PhoneOtp from "../components/auth/PhoneOtp";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type MapWrapperProps = {
  className?: string;
  maxPrice: number;
  drawingActive: boolean;
  onBoundaryChange: (features: unknown[]) => void;
  parcels: SavedParcel[];
  userId: string | null;
  userRole: string | null;
  clearDrawingRequest: number;
  sidebarOpen: boolean;
  phoneNumber: string;
  phoneNumberVerified: boolean | null;
  onPhoneVerified: (idToken: string) => Promise<void>;
  onToggleSidebar: () => void;
  onStartDrawing: () => void;
  onFinishDrawing: () => void;
  onCancelDrawing: () => void;
  onParcelDeleted: (parcelId: string) => void;
};

export default function MapWrapper({
  className = "h-full w-full",
  maxPrice,
  drawingActive,
  onBoundaryChange,
  parcels,
  userId,
  userRole,
  clearDrawingRequest,
  sidebarOpen,
  phoneNumber,
  phoneNumberVerified,
  onPhoneVerified,
  onToggleSidebar,
  onStartDrawing,
  onFinishDrawing,
  onCancelDrawing,
  onParcelDeleted,
}: MapWrapperProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID!;

  const [selectedParcel, setSelectedParcel] = useState<SavedParcel | null>(null);
  const parcelDetailsRef = useRef<HTMLDivElement>(null);

  const [imageModel, setImageModel] = useState(false);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);

  const imageCount = (selectedParcel as SavedParcel & { images?: string[] })?.images?.length ?? 0;
  const [currentImageIndex, setCurrentImageIndex] = useState(0);


  useEffect(() => {
    if (!selectedParcel) return;

    const handlePointerDown = (event: PointerEvent) => {
      // Do not close selectedParcel if the image modal is currently open
      if (imageModel) return;

      if (
        event.target instanceof Node &&
        !parcelDetailsRef.current?.contains(event.target)
      ) {
        setSelectedParcel(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (imageModel) {
          setImageModel(false);
        } else {
          setSelectedParcel(null);
        }
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedParcel, imageModel]);


  console.log("Plot ID:", selectedParcel?._id,"\n","Owner ID:", selectedParcel?.ownerId);

  function handleStartDrawing() {
    if (phoneNumberVerified === null) return;

    if (phoneNumberVerified && phoneNumber.trim()) {
      onStartDrawing();
      return;
    }

    setPhoneModalOpen(true);
  }

  async function handleDeleteParcel(parcelId: string) {
    if (!userId) {
      console.error("User ID is not available. Cannot delete parcel.");
      return;
    }

    try {
      const response = await fetch(`/api/parcels/${parcelId}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(result.message ?? "Could not delete parcel");
      }

      onParcelDeleted(parcelId);
      setSelectedParcel(null);
      toast.success(result.message ?? "Parcel deleted successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete parcel"
      );
      console.error("Could not delete parcel:", error);
    }
  }

  return (
    <APIProvider apiKey={apiKey}>
      <div className={className}>
        <div className="absolute right-16 top-4 z-50 flex w-40 flex-col gap-2">
          {userRole === "admin" && (
            <span className="relative inline-flex w-fit self-end overflow-hidden rounded-full p-[4px] shadow-[0_0_16px_-3px_rgba(239,68,68,0.45)]">
              <span className="animate-border-spin absolute inset-[-100%] bg-[conic-gradient(from_90deg_at_50%_50%,transparent_0%,transparent_75%,#ef4444_100%)]" />
              <span className="relative p-6 inline-flex items-center gap-2 rounded-full bg-white/95 px-6 py-2 text-xs font-semibold tracking-wide text-red-700 backdrop-blur-xl dark:bg-zinc-950/90 dark:text-red-300">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75 [animation-duration:2.2s]" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500 shadow-[0_0_6px_#f87171]" />
                </span>
                Admin
              </span>
            </span>
          )}
        </div>
        <div className="absolute right-3 mt-12 top-3 z-50 flex w-40 flex-col gap-2">

          <Button
            type="button"
            aria-controls="landlens-sidebar"
            aria-expanded={sidebarOpen}
            className="w-full bg-slate-800 text-white shadow hover:bg-slate-700 active:bg-slate-900"
            onClick={onToggleSidebar}
          >
            {sidebarOpen ? "Hide filters" : "Show filters"}
          </Button>

          {!drawingActive ? (
            <Button 
              type="button"
              disabled={phoneNumberVerified === null}
              className="w-full bg-red-600 text-white hover:bg-red-700 active:bg-red-800 disabled:cursor-wait disabled:opacity-60"
              onClick={handleStartDrawing}
            >
              {"Add Property"}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                className="w-full bg-orange-600 text-white hover:bg-orange-700 active:bg-orange-800"
                onClick={onFinishDrawing}
              >
                Finish Boundary
              </Button>
              <Button
                type="button"
                className="w-full border-slate-500 bg-slate-800 text-slate-100 hover:bg-slate-700 active:bg-slate-900"
                onClick={onCancelDrawing}
              >
                Cancel Drawing
              </Button>
            </>
          )}

        </div>

        <Map
          style={{ width: "100%", height: "100%" }}
          defaultCenter={{ lat: 11.6643, lng: 78.1460 }}
          defaultZoom={13}
          gestureHandling="greedy"
          disableDefaultUI={false}
          mapId={mapId}
        >
          {parcels
            .filter(
              (property) =>
                property.pricePerSquareFoot != null &&
                property.pricePerSquareFoot <= maxPrice
            )
            .map((parcel) => {
              const ring = parcel.geometry.coordinates[0] ?? [];
              const points = ring.slice(0, -1); // omit the repeated closing point

              const markerPosition = points.length > 0 ? {
                lat: points.reduce((sum, [, lat]) => sum + lat, 0) / points.length,
                lng: points.reduce((sum, [lng]) => sum + lng, 0) / points.length,
              } : null;

              return (
                <Fragment key={parcel._id}>

                  <Polygon
                    paths={parcel.geometry.coordinates.map((polygonRing) =>
                      polygonRing.map(([lng, lat]) => ({ lat, lng }))
                    )}
                    fillColor="red"
                    fillOpacity={0.25}
                    strokeColor="red"
                    strokeWeight={2}
                    clickable
                    onClick={() => {
                      setSelectedParcel(parcel);
                      console.log("Parcel clicked:", parcel);
                    }}
                  />
                  {parcel.pricePerSquareFoot != null && markerPosition && (
                    <AdvancedMarker position={markerPosition}
                      onClick={() => {
                        setSelectedParcel(parcel);
                        console.log("Parcel clicked:", parcel);
                      }}
                    >
                      <div className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-white shadow-lg">
                        ₹{parcel.pricePerSquareFoot}/sqft
                      </div>
                    </AdvancedMarker>
                  )}
                </Fragment>
              );
            })}


          <MapDrawingController
            active={drawingActive}
            onBoundaryChange={onBoundaryChange}
            clearDrawingRequest={clearDrawingRequest}
          />
        </Map>

        {phoneModalOpen && (
          <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="phone-verification-title"
              className="w-full max-w-md rounded-xl bg-gray-900 p-6 text-white shadow-xl"
            >
              <h2
                id="phone-verification-title"
                className="mb-4 text-xl font-semibold"
              >
                Verify your phone number
              </h2>
              <PhoneOtp
                onVerified={async (idToken) => {
                  await onPhoneVerified(idToken);
                  setPhoneModalOpen(false);
                  onStartDrawing();
                }}
                onCancel={() => setPhoneModalOpen(false)}
              />
            </div>
          </div>
        )}

        {imageModel && (
          <div
            onClick={() => setImageModel(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          >
            <ul
              onClick={(e) => e.stopPropagation()}
              onScroll={(e) => {
                const container = e.currentTarget;
                if (container.clientWidth === 0 || imageCount === 0) return;

                const index = Math.round(container.scrollLeft / container.clientWidth);
                setCurrentImageIndex(Math.min(index, imageCount - 1));
              }}
              className="flex no-scrollbar h-[75vh] w-full max-w-4xl snap-x snap-mandatory overflow-x-auto rounded-lg bg-black shadow-2xl"
            >
              {(selectedParcel as (SavedParcel & { images?: string[] }) | null)?.images?.map((image, index) => (
                <li
                  key={index}
                  className="flex h-full w-full shrink-0 snap-center items-center justify-center"
                >
                  <img
                    src={image}
                    alt={`Land ${index + 1}`}
                    className="h-full w-full object-contain"
                  />
                </li>
              ))}
            </ul>
            <p
              aria-live="polite"
              className="fixed bottom-8 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-sm font-medium text-white"
            >
              {currentImageIndex + 1} / {imageCount}
            </p>
          </div>
        )}


        {selectedParcel && !imageModel && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-50 flex items-end justify-center p-3 sm:inset-x-auto sm:h-full  sm:bottom-4 sm:right-4 sm:justify-end sm:p-0">
            <div
              ref={parcelDetailsRef}
              role="dialog"
              aria-modal="false"
              aria-label="Land details"
              className="pointer-events-auto max-h-[80dvh] w-full max-w-sm overflow-y-auto rounded-lg bg-white p-4 text-gray-900 shadow-lg sm:max-h-[70dvh] sm:p-6"
            >
              <button
                type="button"
                aria-label="Close land details"
                onClick={() => setSelectedParcel(null)}
                className="float-right ml-4 text-gray-500 hover:text-gray-900"
              >
                ×
              </button>
              {/* <h3 className="mb-2 text-lg font-bold">Land Details</h3> */}

              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Property
                  </p>
                  <p className="truncate text-lg font-semibold">
                    {selectedParcel.name}
                  </p>
                </div>
                <span
                  aria-label={`${(selectedParcel as SavedParcel & { images?: string[] }).images?.length ?? 0} images`}
                  className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-green-100 px-2 text-xs font-semibold text-green-800"
                >
                  {(selectedParcel as SavedParcel & { images?: string[] }).images?.length ?? 0}
                </span>
              </div>

              <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Contact phone
                </p>
                {selectedParcel.phoneNumber ? (
                  <a
                    href={`tel:${selectedParcel.phoneNumber}`}
                    className="mt-1 flex items-center gap-2 text-sm font-semibold text-gray-900 hover:text-emerald-700"
                  >
                    <Phone size={16} aria-hidden="true" />
                    <span>{selectedParcel.phoneNumber}</span>
                  </a>
                ) : (
                  <p className="mt-1 text-sm text-gray-500">
                    Phone number not available
                  </p>
                )}
              </div>

              <ul className="my-2 no-scrollbar flex gap-2 overflow-x-auto pb-2">
                {(selectedParcel as SavedParcel & { images?: string[] }).images?.map((image, index) => (
                  <li key={index} className="w-28 shrink-0">
                    <img
                      src={image}
                      alt={`Land ${index + 1}`}
                      onClick={() => {
                        setCurrentImageIndex(0);
                        setImageModel(true);
                      }}
                      className="h-24 w-full rounded-lg object-cover"
                    />
                  </li>
                ))}
              </ul>

              <span>
                Price:{" "} {selectedParcel.pricePerSquareFoot != null
                  ? `₹${(
                    (selectedParcel.pricePerSquareFoot * selectedParcel.area.squareFeet) /
                    10_000_000
                  ).toFixed(2)} Cr`
                  : "Not available"
                }
              </span>
              <p>Area: {selectedParcel.area.squareFeet} sqft</p>

              <span className="text-xs text-red-500 font-bold ">
                Note: Land Prices are subject to change, <span className="block">These are approximate estimations</span>
              </span>

              {(selectedParcel.ownerId === userId || userRole === "admin") && (
                <button
                  type="button"
                  onClick={() => handleDeleteParcel(selectedParcel._id)}
                  className="w-full rounded-lg bg-red-500 p-2 text-center font-extrabold text-white cursor-pointer hover:bg-red-600 active:bg-red-700 mt-4"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </APIProvider>
  );
}
