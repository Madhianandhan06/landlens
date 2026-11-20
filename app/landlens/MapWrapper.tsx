
"use client";

import { APIProvider, AdvancedMarker, Map, Polygon } from "@vis.gl/react-google-maps";
// import { Phone } from "lucide-react";
import MapDrawingController from "./MapDrawingController";
import type { LandMapType, SavedParcel } from "../../types/landlens";
import { Fragment, useEffect, useRef, useState } from "react";
import PhoneOtp from "../components/auth/PhoneOtp";
import { toast } from "sonner";

import { Pencil } from 'lucide-react';
import { Phone, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type MapWrapperProps = {
  className?: string;
  maxPrice: number;
  mapType: LandMapType;
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
  mapType,
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
        <header className="absolute inset-x-0 top-0 z-50 flex h-14 items-center justify-between  px-3 text-white bg-slate-900 shadow-sm backdrop-blur sm:px-4">

          <div>

            <div className="flex items-center justify-between gap-2">
              <h1 className="text-xl font-bold tracking-tight md:text-2xl">
                Land<span className="text-emerald-400">Lens</span>
              </h1>
            </div>

            <p className="text-xs text-gray-400">
              Transparent land intelligence
            </p>

          </div>

          <div className="flex min-w-0 items-center gap-2">

            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
              {userRole?.[0]?.toUpperCase() ?? "U"}
            </span>

            {userRole === "admin" && (
              <span className="ml-2 inline-flex shrink-0 items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                <span className="size-2 rounded-full bg-red-500" aria-hidden="true" />
                Admin
              </span>
            )}

          </div>
        </header>

        <div className="absolute right-3 top-14 mt-2 z-50 flex w-40 flex-col items-end gap-2">
          <Button
            type="button"
            aria-controls="landlens-sidebar"
            aria-expanded={sidebarOpen}
            className=" w-12 bg-slate-800 text-white shadow hover:bg-slate-700 active:bg-slate-900"
            onClick={onToggleSidebar}
          >
            {sidebarOpen ? <X size={20} /> : <SlidersHorizontal size={20} />}
          </Button>

          {!drawingActive ? (
            <Button 
              type="button"
              disabled={phoneNumberVerified === null}
              className="w-12 bg-red-600 text-white hover:bg-red-700 active:bg-red-800 disabled:cursor-wait disabled:opacity-60"
              onClick={handleStartDrawing}
            >
              <Pencil />
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
          mapTypeId={mapType}
          mapTypeControl={false}
          fullscreenControl={false}
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
          <div className="pointer-events-none absolute  inset-x-0 bottom-0 z-50 flex items-end justify-center p-3 sm:inset-x-auto sm:h-full sm:bottom-4 sm:right-4 sm:justify-end sm:p-0">
            <div
              ref={parcelDetailsRef}
              role="dialog"
              aria-modal="false"
              aria-label="Land details"
              className="pointer-events-auto space-y-2 max-h-[80dvh] w-full max-w-sm overflow-y-auto rounded-lg bg-white p-6 text-gray-900 shadow-lg sm:max-h-[70dvh] sm:p-6"
            >
              {/* <button
                type="button"
                aria-label="Close land details"
                onClick={() => setSelectedParcel(null)}
                className="float-right ml-4 text-gray-500 hover:text-gray-900"
              >
                ×
              </button> */}
              <h3 className=" text-center text-lg font-bold">Posted by: <span className="text-emerald-600 ">{selectedParcel.name}</span></h3>

              <div className="mb-4 flex items-center justify-center gap-1 rounded-lg borde border-gray-200 bg-gray-50 p-3">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Contact phone:
                </span>
                {selectedParcel.phoneNumber ? (
                  <a
                    href={`tel:${selectedParcel.phoneNumber}`}
                    className="flex items-center justify-center gap-2 text-sm font-semibold text-gray-900 hover:text-emerald-700"
                  >
                    <Phone size={16} aria-hidden="true" />
                    <span>{selectedParcel.phoneNumber}</span>
                  </a>
                ) : (
                  <p className="text-sm text-gray-500">
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

                {/* <p
                  aria-label={`${(selectedParcel as SavedParcel & { images?: string[] }).images?.length ?? 0} images`}
                  className="mx-auto flex h-7 min-w-7 w-fit items-center justify-center rounded-full bg-green-100 px-2 text-xs font-semibold text-green-800"
                >
                  {(selectedParcel as SavedParcel & { images?: string[] }).images?.length ?? 0}
                </p> */}

                <div className="mt-2 flex justify-center items-center  gap-1 rounded-lg p-2 text-sm font-medium text-gray-700">

                  <span>
                    Price:{" "} {selectedParcel.pricePerSquareFoot != null
                    ? `₹${(
                      (selectedParcel.pricePerSquareFoot * selectedParcel.area.squareFeet) /
                      10_000_000
                    ).toFixed(2)} Cr`
                    : "Not available"
                    }
                  </span>
                  <p
                  aria-label={`${(selectedParcel as SavedParcel & { images?: string[] }).images?.length ?? 0} images`}
                  className="mx-auto  flex h-7 min-w-7 w-fit items-center justify-center rounded-full bg-green-100 px-2 text-xs font-semibold text-green-800"
                  >
                    {(selectedParcel as SavedParcel & { images?: string[] }).images?.length ?? 0}
                  </p>
                  <span>Area: {selectedParcel.area.squareFeet} sqft</span>
                </div>

              <p className="text-[0.55rem] p-2 bg-amber-50 border rounded-lg text-center border-amber-300  text-red-500 font-bold">
                Note: Land Prices are subject to change These are approximate estimations
              </p>

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
