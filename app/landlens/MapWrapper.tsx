
"use client";

import { APIProvider, AdvancedMarker, Map, Polygon } from "@vis.gl/react-google-maps";
// import { Phone } from "lucide-react";
import MapDrawingController from "./MapDrawingController";
import type { LandMapType, SavedParcel } from "../../types/landlens";
import { Fragment, useEffect, useRef, useState } from "react";
import PhoneOtp from "../components/auth/PhoneOtp";
import { toast } from "sonner";

import { Pencil, PencilRuler } from 'lucide-react';
import { Phone, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageUp } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

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
  onParcelUpdated: (parcel: SavedParcel) => void;
  areaInSquareFeet: number;
  landtype: string;
  hasEnoughImages: boolean;
  isLandPriceValid: boolean;
  loading: boolean;
  setLandprice: (price: string) => void;
  setLandtype: (type: string) => void;
  setImages: (images: File[]) => void;
  onSaveParcel: () => Promise<void>;
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
  onParcelUpdated,

  areaInSquareFeet,
  landtype,
  hasEnoughImages,
  isLandPriceValid,
  loading,
  setLandprice,
  setLandtype,
  setImages,
  onSaveParcel,
}: MapWrapperProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID!;

  const [selectedParcel, setSelectedParcel] = useState<SavedParcel | null>(null);
  const parcelDetailsRef = useRef<HTMLDivElement>(null);
  const [landprice, setLandpriceInput] = useState("");
  const [pricePerSquareFootInput, setPricePerSquareFootInput] = useState("");
  const [isSavingPrice, setIsSavingPrice] = useState(false);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [draftImages, setDraftImages] = useState<string[]>([]);
  const imageUploadInputRef = useRef<HTMLInputElement>(null);

  const [imageModel, setImageModel] = useState(false);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);

  const imageCount = draftImages.length;
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // plot model editing state
  const [isEditing, setIsEditing] = useState(false);

  function selectParcel(parcel: SavedParcel) {
    setSelectedParcel(parcel);
    setDraftImages(parcel.images ?? []);
    setPendingImages([]);
    setIsEditing(false);
    setPricePerSquareFootInput(String(parcel.pricePerSquareFoot ?? ""));
    setCurrentImageIndex(0);
  }

  function discardParcelEdits() {
    if (!selectedParcel) return;

    setDraftImages(selectedParcel.images ?? []);
    setPendingImages([]);
    setPricePerSquareFootInput(
      String(selectedParcel.pricePerSquareFoot ?? "")
    );
    setIsEditing(false);
  }

  useEffect(() => {
    if (!selectedParcel) return;

    const handlePointerDown = (event: PointerEvent) => {
      // Do not close selectedParcel if the image modal is currently open
      if (imageModel) return;

      if (
        event.target instanceof Node &&
        !parcelDetailsRef.current?.contains(event.target)
      ) {
        setIsEditing(false); // Reset editing state when closing the details
        setPendingImages([]);
        setDraftImages([]);
        setSelectedParcel(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (imageModel) {
          setImageModel(false);
        } else {
          setIsEditing(false);
          setPendingImages([]);
          setDraftImages([]);
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

  async function handleSaveParcel() {
    if (!selectedParcel) return;

    if (draftImages.length + pendingImages.length < 3) {
      toast.error("A parcel must keep at least 3 images");
      return;
    }

    const pricePerSquareFoot = Number(pricePerSquareFootInput);
    if (!Number.isFinite(pricePerSquareFoot) || pricePerSquareFoot < 0.01) {
      toast.error("Price per square foot must be at least 0.01");
      return;
    }

    const deletedImageUrls = (selectedParcel.images ?? []).filter(
      (image) => !draftImages.includes(image)
    );

    setIsSavingPrice(true);
    try{
        let response: Response;
        if (pendingImages.length > 0 || deletedImageUrls.length > 0) {
          const formData = new FormData();
          formData.append("pricePerSquareFoot", String(pricePerSquareFoot));
          formData.append("deleteImageUrls", JSON.stringify(deletedImageUrls));
          pendingImages.forEach((file) => formData.append("images", file));
          response = await fetch(
            `/api/parcels/${selectedParcel._id}/images`,
            {
              method: "POST",
              credentials: "include",
              body: formData,
            }
          );
        } else {
          response = await fetch(`/api/parcels/${selectedParcel._id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({ pricePerSquareFoot }),
          });
        }

        const result = (await response.json()) as {
          message?: string;
          parcel?: SavedParcel;
        };
        if (!response.ok || !result.parcel) {
          throw new Error(result.message ?? "Could not update plot price");
        }

        setSelectedParcel(result.parcel);
        onParcelUpdated(result.parcel);
        setDraftImages(result.parcel.images ?? []);
        setPendingImages([]);
        setIsEditing(false);
        toast.success(
          (result.parcel.pricePerSquareFoot ?? 0) > maxPrice
            ? "Changes saved. This plot is hidden by the current max-price filter."
            : "Changes saved successfully"
        );
    } catch (error) {
      console.error("Error saving parcel:", error);
      toast.error(
        error instanceof Error ? error.message : "Could not update plot price"
      );
    } finally {
      setIsSavingPrice(false);
    }
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
      setPendingImages([]);
      setDraftImages([]);
      setIsEditing(false);
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
        <header className="absolute inset-x-0 top-0 z-50 flex h-16 items-center justify-between  px-3 text-white bg-slate-900 shadow-sm backdrop-blur sm:px-4">

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
          {sidebarOpen ? (
            <Button
              type="button"
              aria-controls="landlens-sidebar"
              aria-expanded={sidebarOpen}
              className=" w-12 bg-slate-800 text-white shadow hover:bg-slate-700 active:bg-slate-900"
              onClick={onToggleSidebar}
            >
              <X size={20} />
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    aria-controls="landlens-sidebar"
                    aria-expanded={sidebarOpen}
                    className=" w-12 bg-slate-800 text-white shadow hover:bg-slate-700 active:bg-slate-900"
                    onClick={onToggleSidebar}
                  >
                    <SlidersHorizontal size={20} />
                  </Button>
                }
              />
              <TooltipContent>
                <p>Show filter</p>
              </TooltipContent>
            </Tooltip>
          )}

          {!drawingActive ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    disabled={phoneNumberVerified === null}
                    className="w-12 bg-red-600 text-white hover:bg-red-700 active:bg-red-800 disabled:cursor-wait disabled:opacity-60"
                    onClick={handleStartDrawing}
                  >
                    <Pencil size={16} aria-hidden="true" />
                  </Button>
                }
              />
              <TooltipContent>
                <p>Add property</p>
              </TooltipContent>
            </Tooltip>
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
                      selectParcel(parcel);
                      console.log("Parcel clicked:", parcel);
                    }}
                  />
                  {parcel.pricePerSquareFoot != null && markerPosition && (
                    <AdvancedMarker position={markerPosition}
                      onClick={() => {
                        selectParcel(parcel);
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
              {draftImages.map((image, index) => (
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

            <div className={`mb-2 flex items-center justify-center gap-2`}>
              <h3 className="text-center text-lg font-bold">
                Posted by: <span className="text-emerald-600">{selectedParcel.name}</span>
              </h3>
              {(selectedParcel.ownerId === userId || userRole === "admin") && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        aria-label="Edit land details"
                        onClick={() => {
                          if (isEditing) {
                            discardParcelEdits();
                          } else if (!isEditing) {
                            setPricePerSquareFootInput(
                              String(selectedParcel.pricePerSquareFoot ?? "")
                            );
                            setIsEditing(true);
                          }
                        }}
                        className="group  bg-emerald-600 p-2 relative rounded-2xl flex items-center justify-center gap-2 text-sm font-semibold text-gray-900 hover:text-emerald-700"
                      >
                      <PencilRuler size={16} aria-hidden="true" />
                      </button>
                    }
                  />
                  <TooltipContent>
                    <p>Edit land details</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>



              <div className="mb-4 flex items-center justify-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-3">
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
                {draftImages.map((image, index) => (
                  <li key={image} className="relative w-28 shrink-0 cursor-pointer">
                    <img
                      src={image}
                      alt={`Land ${index + 1}`}
                      onClick={() => {
                        setCurrentImageIndex(index);
                        setImageModel(true);
                      }}
                      className="h-24 w-full rounded-lg object-cover"
                    />
                    {isEditing && <button
                      type="button"
                      aria-label={`Delete image ${index + 1}`}
                      disabled={imageCount <= 3 || isSavingPrice}
                      className="absolute top-0 right-0 cursor-pointer rounded-2xl bg-red-500 px-2 text-white hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDraftImages((current) =>
                          current.filter((url) => url !== image)
                        );
                        setCurrentImageIndex(0);
                      }}
                    >
                      x
                    </button>
                  }
                  </li>
                ))}
                <li className="h-24 w-24 shrink-0">
                  <button
                    type="button"
                    aria-label="Upload parcel images"
                    disabled={isSavingPrice}
                    onClick={() => imageUploadInputRef.current?.click()}
                    className="flex h-full w-full items-center justify-center rounded-2xl border-2 border-dashed border-black disabled:cursor-wait disabled:opacity-60"
                  >
                    <ImageUp className="h-6 w-6 shrink-0" />
                  </button>

                  <input
                    ref={imageUploadInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={isSavingPrice}
                    className="sr-only"
                    onChange={(event) => {
                      const files = Array.from(event.currentTarget.files ?? []);
                      event.currentTarget.value = "";
                      if (files.length === 0) return;
                      // if (!isEditing) {
                      //   setPricePerSquareFootInput(
                      //     String(selectedParcel.pricePerSquareFoot ?? "")
                      //   );
                      // }
                      setPendingImages((current) => [...current, ...files]);
                      setIsEditing(true);
                    }}
                  />
                </li>
              </ul>
              {pendingImages.length > 0 && (
                <p className="text-xs text-gray-600">
                  {pendingImages.length} new image{pendingImages.length === 1 ? "" : "s"} selected. Save changes to upload.
                </p>
              )}
                             
              <div className="flex justify-between items-center  gap-1 rounded-lg px-4 text-sm font-medium text-gray-700">
              { !isEditing ? (
                <span>
                    Price:{" "} {selectedParcel.pricePerSquareFoot != null
                    ? `₹${(
                      (selectedParcel.pricePerSquareFoot * selectedParcel.area.squareFeet) /
                      10_000_000
                    ).toFixed(2)} Cr`
                    : "Not available"
                    }
                  </span>
                ) : (
                  <span>
                    <label>Price per sqft:</label>
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      value={pricePerSquareFootInput}
                      onChange={(event) =>
                        setPricePerSquareFootInput(event.target.value)
                      }
                    />
                  </span>
                )
              }
                  <p
                  aria-label={`${imageCount} images`}
                  className="mx-auto  flex h-7 min-w-7 w-fit items-center justify-center rounded-full bg-green-100 px-2 text-xs font-semibold text-green-800"
                  >
                    {imageCount}
                  </p>
                  <span>Area: {selectedParcel.area.squareFeet} sqft</span>
                </div>

                {selectedParcel.ownerId !== userId && userRole !== "admin" && (
                  <p className="text-[0.55rem] p-2 bg-amber-50 border rounded-lg text-center border-amber-300  text-red-500 font-bold">
                    Note: Land Prices are subject to change These are approximate estimations
                  </p>
                )}

              {(selectedParcel.ownerId === userId || userRole === "admin") && (
                <div>                      
                  {!isEditing && <button
                    type="button"
                    onClick={() => handleDeleteParcel(selectedParcel._id)}
                    className="w-full rounded-lg bg-red-500 p-2 text-center font-extrabold text-white cursor-pointer hover:bg-red-600 active:bg-red-700 mt-4"
                  >
                    {'Delete'}
                  </button>}

                {isEditing && <button
                    type="button"
                    disabled={isSavingPrice}
                    onClick={handleSaveParcel}
                    className="w-full rounded-lg bg-green-500 p-2 text-center font-extrabold text-white cursor-pointer hover:bg-green-600 active:bg-green-700 mt-4"
                  >
                    {isSavingPrice ? "Saving..." : "Save Changes"}
                  </button>}

                </div>                
              )}
            </div>
          </div>
        )}
      </div>
    </APIProvider>
  );
}
