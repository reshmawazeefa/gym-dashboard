import { Fragment, useState, useEffect, useRef } from "react";
import { Copy, Dumbbell, Image, Edit, Plus, Search, Trash, Upload, X } from "lucide-react";
import toast from "react-hot-toast";
import { createExercise, updateExercise, deleteExercise, forkExercise, getExercise, uploadExerciseMedia, getExerciseMedia, deleteExerciseMedia, getApiError } from "../services/api";
import { normalizeRole } from "../utils/rbac";
import TablePagination from "./TablePagination";

function idOf(item) { return item?.id || item?._id || item?.uuid || item?.userId || ""; }
function nameOf(item) { return item?.name || item?.fullName || item?.title || item?.email || idOf(item) || "-"; }
function emptyExercise() { return { name: "", muscleGroup: "", exerciseType: "STRENGTH", instructions: "", thumbnailUrl: "", videoUrl: "", calories: "" }; }
const exerciseTypes = ["STRENGTH", "BODYWEIGHT", "CARDIO"];
function titleCase(value) { return String(value || "").toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }

const inputClass = "h-8 w-full rounded-md border border-gray-300 bg-white px-3 text-xs text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-500";
const textareaClass = "min-h-16 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const primaryButtonClass = "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[#0D8252] px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43] disabled:cursor-not-allowed disabled:opacity-60 w-full";
const iconButtonClass = "inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40";

const muscleGroupOptions = ["CHEST", "BACK", "LEGS", "SHOULDERS", "ARMS", "CORE", "FULL_BODY"];
const EXERCISE_PAGE_SIZE = 10;

function Card({ children, className = "" }) {
  return <section className={`rounded-lg bg-white shadow-sm ring-1 ring-gray-200 ${className}`}>{children}</section>;
}

function Field({ label, children, className = "" }) {
  return (
    <label className={`grid gap-1 text-xs font-semibold uppercase text-gray-500 ${className}`}>
      {label}
      {children}
    </label>
  );
}

export default function WorkoutExercises({ user, canManage, canEdit, canDelete, exercises, setExercises, exerciseSearch, setExerciseSearch, muscleFilter, setMuscleFilter, exerciseTypeFilter, setExerciseTypeFilter, exercisePage, setExercisePage, exercisePagination, exercisesLoading, exerciseLoadError, filteredExercises = exercises, loadExercises }) {
  const [editingExerciseId, setEditingExerciseId] = useState("");
  const [editingExerciseOriginal, setEditingExerciseOriginal] = useState(null);
  const [exerciseForm, setExerciseForm] = useState(emptyExercise);
  const [showExerciseForm, setShowExerciseForm] = useState(false);
  const [expandedExerciseId, setExpandedExerciseId] = useState("");
  const [exerciseDetails, setExerciseDetails] = useState({});
  const [exerciseDetailLoading, setExerciseDetailLoading] = useState({});
  const [savingExercise, setSavingExercise] = useState(false);
  const [mediaItems, setMediaItems] = useState({});
  const [mediaLoading, setMediaLoading] = useState({});
  const [mediaUploadForm, setMediaUploadForm] = useState({ file: null, mediaType: "IMAGE", url: "", caption: "", orderIndex: 1 });
  const fileInputRef = useRef(null);
  const isPlatformAdmin = normalizeRole(user?.role) === "platform_admin" || normalizeRole(user?.loginType) === "platform_admin";
  const currentGymId = user?.gymId || user?.gym?.id || user?.gym?._id || user?.tenantId || user?.tenant?.id || "";
  const canCreateExercise = canManage;
  const canManageExercise = (exercise) => {
    if (!exercise) return false;
    if (isPlatformAdmin) return exercise?.gymId == null;
    return Boolean(currentGymId && exercise?.gymId != null && String(exercise.gymId) === String(currentGymId));
  };

  useEffect(() => {
    if (!showExerciseForm) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [showExerciseForm]);

  const loadExerciseDetails = async (exerciseId) => {
    if (!exerciseId) return null;
    if (exerciseDetails[exerciseId]) return exerciseDetails[exerciseId];
    setExerciseDetailLoading((current) => ({ ...current, [exerciseId]: true }));
    try {
      const response = await getExercise(exerciseId, user?.token);
      const detail = response?.data?.data || response?.data || response;
      setExerciseDetails((current) => ({ ...current, [exerciseId]: detail }));
      return detail;
    } catch (error) {
      toast.error(getApiError(error, "Unable to load exercise details"));
      return null;
    } finally {
      setExerciseDetailLoading((current) => ({ ...current, [exerciseId]: false }));
    }
  };

  const editExercise = async (exercise) => {
    if (!canEdit || !canManageExercise(exercise)) return;
    const detail = await loadExerciseDetails(idOf(exercise));
    if (!detail) return;
    setEditingExerciseId(idOf(detail));
    setEditingExerciseOriginal(detail);
    setExerciseForm({
      name: detail.name || "",
      muscleGroup: detail.muscleGroup || "",
      exerciseType: detail.exerciseType || "STRENGTH",
      instructions: detail.instructions || "",
      thumbnailUrl: detail.thumbnailUrl || "",
      videoUrl: detail.videoUrl || "",
      calories: detail.calories ?? detail.caloriesBurned ?? "",
    });
    setShowExerciseForm(true);
  };

  const resetForm = () => {
    setExerciseForm(emptyExercise());
    setEditingExerciseId("");
    setEditingExerciseOriginal(null);
    setShowExerciseForm(false);
  };

  const handleSaveExercise = async (event) => {
    event.preventDefault();
    const isEditing = Boolean(editingExerciseId);
    const hasWritePermission = isEditing
      ? canEdit && canManageExercise(editingExerciseOriginal)
      : canCreateExercise;
    if (!hasWritePermission) {
      toast.error("You do not have permission to save this exercise");
      return;
    }
    if (!exerciseForm.name.trim() || !exerciseForm.muscleGroup) {
      toast.error("Exercise name and muscle group are required");
      return;
    }

    const values = {
      name: exerciseForm.name.trim(),
      muscleGroup: exerciseForm.muscleGroup,
      exerciseType: exerciseForm.exerciseType || "STRENGTH",
      instructions: exerciseForm.instructions.trim(),
      videoUrl: exerciseForm.videoUrl.trim(),
      thumbnailUrl: exerciseForm.thumbnailUrl.trim(),
      calories: exerciseForm.calories === "" ? "" : Number(exerciseForm.calories),
    };

    try {
      setSavingExercise(true);
      if (isEditing) {
        const originalValues = {
          name: editingExerciseOriginal?.name || "",
          muscleGroup: editingExerciseOriginal?.muscleGroup || "",
          exerciseType: editingExerciseOriginal?.exerciseType || "STRENGTH",
          instructions: editingExerciseOriginal?.instructions || "",
          videoUrl: editingExerciseOriginal?.videoUrl || "",
          thumbnailUrl: editingExerciseOriginal?.thumbnailUrl || "",
          calories: editingExerciseOriginal?.calories ?? editingExerciseOriginal?.caloriesBurned ?? "",
        };
        const payload = Object.fromEntries(
          Object.entries(values)
            .filter(([field, value]) => value !== originalValues[field])
            .map(([field, value]) => [field, field === "calories" && value === "" ? null : value])
        );
        if (!Object.keys(payload).length) {
          toast.success("No changes to save");
          resetForm();
          return;
        }
        await updateExercise(editingExerciseId, payload, user?.token);
        setExercises((current) => current.map((item) => idOf(item) === editingExerciseId ? { ...item, ...payload } : item));
        setExerciseDetails((current) => {
          const next = { ...current };
          delete next[editingExerciseId];
          return next;
        });
        toast.success("Exercise updated");
      } else {
        await createExercise({
          ...values,
          calories: values.calories === "" ? undefined : values.calories,
        }, user?.token);
        toast.success("Exercise created");
        setExerciseSearch("");
        setMuscleFilter("");
        setExerciseTypeFilter("");
        setExercisePage(1);
        resetForm();
        await loadExercises({ page: 1, search: "", muscleGroup: "", exerciseType: "" });
        return;
      }
      resetForm();
      await loadExercises();
    } catch (error) {
      toast.error(getApiError(error, "Unable to save exercise"));
    } finally {
      setSavingExercise(false);
    }
  };

  const handleDeleteExercise = async (exercise) => {
    if (!canDelete || !canManageExercise(exercise)) {
      toast.error("You do not have permission to delete this exercise");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this exercise?")) return;
    try {
      const exerciseId = idOf(exercise);
      await deleteExercise(exerciseId, user?.token);
      setExercises((current) => current.filter((item) => idOf(item) !== exerciseId));
      toast.success("Exercise deleted");
      const nextPage = filteredExercises.length === 1 && exercisePage > 1 ? exercisePage - 1 : exercisePage;
      if (nextPage !== exercisePage) setExercisePage(nextPage);
      await loadExercises({ page: nextPage });
    } catch (error) {
      toast.error(getApiError(error, "Unable to delete exercise"));
    }
  };

  const handleToggleExpand = async (exerciseId) => {
    if (expandedExerciseId === exerciseId) {
      setExpandedExerciseId("");
      return;
    }
    setExpandedExerciseId(exerciseId);
    await Promise.all([loadExerciseDetails(exerciseId), loadMedia(exerciseId)]);
  };

  const loadMedia = async (exerciseId) => {
    if (mediaItems[exerciseId] !== undefined) return;
    setMediaLoading((prev) => ({ ...prev, [exerciseId]: true }));
    try {
      const response = await getExerciseMedia(exerciseId, user?.token);
      const list = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : Array.isArray(response?.media) ? response.media : [];
      setMediaItems((prev) => ({ ...prev, [exerciseId]: list }));
    } catch {
      setMediaItems((prev) => ({ ...prev, [exerciseId]: [] }));
    } finally {
      setMediaLoading((prev) => ({ ...prev, [exerciseId]: false }));
    }
  };

  const handleUploadMedia = async (exerciseId) => {
    if (!mediaUploadForm.file && !mediaUploadForm.url?.trim()) {
      toast.error("Select a file or provide a media URL");
      return;
    }

    try {
      if (mediaUploadForm.file) {
        const formData = new FormData();
        formData.append("file", mediaUploadForm.file);
        formData.append("mediaType", mediaUploadForm.mediaType);
        await uploadExerciseMedia(exerciseId, formData, user?.token);
      } else {
        const payload = {
          type: mediaUploadForm.mediaType,
          url: mediaUploadForm.url.trim(),
          caption: mediaUploadForm.caption.trim(),
          orderIndex: Number(mediaUploadForm.orderIndex || 0),
        };
        await uploadExerciseMedia(exerciseId, payload, user?.token);
      }

      toast.success("Media uploaded");
      setMediaUploadForm({ file: null, mediaType: "IMAGE", url: "", caption: "", orderIndex: 1 });
      if (fileInputRef.current) fileInputRef.current.value = "";
      setMediaItems((prev) => ({ ...prev, [exerciseId]: undefined }));
      await loadMedia(exerciseId);
    } catch (error) {
      toast.error(getApiError(error, "Unable to upload media"));
    }
  };

  const handleForkExercise = async (exercise) => {
    if (!canManage || isPlatformAdmin) {
      toast.error("Platform admins cannot fork exercises");
      return;
    }
    if (exercise?.gymId != null) {
      toast.error("Only global exercises can be forked");
      return;
    }
    try {
      await forkExercise(idOf(exercise), user?.token);
      toast.success("Exercise forked for your gym");
      setExerciseSearch("");
      setMuscleFilter("");
      setExerciseTypeFilter("");
      setExercisePage(1);
      await loadExercises({ page: 1, search: "", muscleGroup: "", exerciseType: "" });
    } catch (error) {
      toast.error(getApiError(error, "Unable to fork exercise"));
    }
  };

  const handleDeleteMedia = async (exerciseId, mediaId) => {
    if (!window.confirm("Are you sure you want to delete this media?")) return;
    try {
      await deleteExerciseMedia(mediaId, user?.token);
      toast.success("Media deleted");
      setMediaItems((prev) => ({
        ...prev,
        [exerciseId]: (prev[exerciseId] || []).filter((m) => idOf(m) !== mediaId),
      }));
    } catch (error) {
      toast.error(getApiError(error, "Unable to delete media"));
    }
  };

  const exerciseTotalPages = Math.max(1, Number(exercisePagination?.totalPages) || 1);
  const currentExercisePage = Math.min(exercisePage, exerciseTotalPages);
  const paginatedExercises = filteredExercises;
  const exerciseTotal = Number(exercisePagination?.total ?? filteredExercises.length);
  const exerciseRangeStart = exerciseTotal ? (currentExercisePage - 1) * (exercisePagination?.limit || EXERCISE_PAGE_SIZE) + 1 : 0;
  const exerciseRangeEnd = Math.min((currentExercisePage - 1) * (exercisePagination?.limit || EXERCISE_PAGE_SIZE) + paginatedExercises.length, exerciseTotal);

  return (
    <section className="space-y-4">
      <Card className="overflow-hidden rounded-xl border border-[#E5EAF0] shadow-[0_1px_4px_rgba(15,23,42,0.06)] ring-0">
        <div className="grid gap-2 border-b border-[#EEF2F4] p-3 sm:grid-cols-[minmax(0,1fr)_16rem_11rem_auto] sm:items-center">
          <div className="flex items-center gap-2 rounded-md border border-gray-200 px-3">
            <Search size={17} className="text-gray-400" />
            <input className="h-8 min-w-0 flex-1 text-xs outline-none" value={exerciseSearch} onChange={(event) => { setExerciseSearch(event.target.value); setExercisePage(1); }} placeholder="Search exercises..." />
          </div>
          <label htmlFor="exercise-muscle-filter" className="flex min-w-0 items-center gap-2 text-xs font-medium text-[#334155]">
            Muscle Group
            <select id="exercise-muscle-filter" className={`${inputClass} min-w-0 flex-1`} value={muscleFilter} onChange={(event) => { setMuscleFilter(event.target.value); setExercisePage(1); }}>
              <option value="">All</option>
              {muscleGroupOptions.map((group) => <option key={group} value={group}>{titleCase(group)}</option>)}
            </select>
          </label>
          <label htmlFor="exercise-type-filter" className="flex min-w-0 items-center gap-2 text-xs font-medium text-[#334155]">
            Exercise
            <select id="exercise-type-filter" className={`${inputClass} min-w-0 flex-1`} value={exerciseTypeFilter} onChange={(event) => { setExerciseTypeFilter(event.target.value); setExercisePage(1); }}>
              <option value="">All</option>
              {exerciseTypes.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}
            </select>
          </label>
          {canCreateExercise && <button type="button" onClick={() => { resetForm(); setShowExerciseForm(true); }} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[#0D8252] px-3 text-xs font-semibold text-white transition hover:bg-[#086B43]"><Plus size={14} /> Add Exercise</button>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="bg-[#FBFCFD] text-[10px] font-bold uppercase tracking-wide text-[#64748B]">
              <tr>
                <th className="min-w-[14rem] px-4 py-3">Exercise</th>
                <th className="min-w-[12rem] px-4 py-3">Muscle Group</th>
                <th className="px-4 py-3">Calories</th>
                <th className="px-4 py-3">Instructions</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedExercises.map((exercise) => {
                const exerciseId = idOf(exercise);
                const isExpanded = expandedExerciseId === exerciseId;
                const detail = exerciseDetails[exerciseId] || exercise;
                const canFork = canManage && !isPlatformAdmin && exercise.gymId == null;
                const canEditRow = canEdit && canManageExercise(exercise);
                const canDeleteRow = canDelete && canManageExercise(exercise);

                return (
                  <Fragment key={exerciseId}>
                    <tr className="border-t border-[#EEF2F4] text-xs text-[#475569] transition hover:bg-[#FBFCFD]">
                      <td className="min-w-[14rem] px-4 py-3 font-semibold text-[#0F172A]">
                        <button type="button" onClick={() => handleToggleExpand(exerciseId)} className="block max-w-full text-left font-semibold text-[#0F172A]">{nameOf(exercise)}</button>
                        <div className="mt-1 flex flex-nowrap items-center gap-1.5">
                          <span className={`inline-flex h-5 whitespace-nowrap items-center rounded-md px-1.5 text-[10px] font-semibold ${exercise.gymId ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                            {exercise.gymId ? "Gym Custom" : "Global"}
                          </span>
                          {exercise.parentExerciseId && <span className="inline-flex h-5 whitespace-nowrap items-center rounded-md bg-violet-50 px-1.5 text-[10px] font-semibold text-violet-700">Forked</span>}
                        </div>
                      </td>
                      <td className="min-w-[12rem] px-4 py-3">
                        <div className="flex flex-nowrap items-center gap-1">
                          <span className="inline-flex h-5 whitespace-nowrap items-center justify-center rounded-md bg-blue-50 px-2 text-[10px] font-semibold text-blue-700">{titleCase(exercise.muscleGroup || "")}</span>
                          {exercise.exerciseType && <span className="inline-flex h-5 whitespace-nowrap items-center justify-center rounded-md bg-purple-50 px-2 text-[10px] font-semibold text-purple-700">{titleCase(exercise.exerciseType)}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[10px] font-semibold text-[#334155]">{exercise.calories || exercise.caloriesBurned || "-"}</td>
                      <td className="px-4 py-3 text-[10px] font-normal leading-4 text-[#64748B]">{exercise.instructions || "-"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {canFork && exercise.gymId == null && exercise.parentExerciseId == null && (
                            <button type="button" onClick={() => handleForkExercise(exercise)} className={iconButtonClass} aria-label="Fork exercise" title="Fork exercise">
                              <Copy size={15} />
                            </button>
                          )}
                          {canEditRow && (
                            <button type="button" onClick={() => editExercise(exercise)} className={iconButtonClass} aria-label="Edit exercise">
                              <Edit size={15} />
                            </button>
                          )}
                          {canDeleteRow && (
                            <button type="button" onClick={() => handleDeleteExercise(exercise)} className={iconButtonClass} aria-label="Delete exercise">
                              <Trash size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-t border-gray-100 bg-gray-50">
                        <td colSpan={5} className="px-4 py-3">
                          {exerciseDetailLoading[exerciseId] && <p className="mb-3 text-xs text-gray-500">Loading exercise details...</p>}
                          {detail.parentExercise && <p className="mb-3 text-xs text-gray-500">Forked from {nameOf(detail.parentExercise)}</p>}
                          <div className="grid gap-4 lg:grid-cols-2">
                            <div>
                              <p className="text-xs font-semibold uppercase text-gray-500">Instructions</p>
                              <p className="mt-1 text-sm leading-6 text-gray-600">{detail.instructions || "No instructions provided."}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase text-gray-500">Media</p>
                              {detail.thumbnailUrl ? (
                                <img src={detail.thumbnailUrl} alt={`${detail.name || "Exercise"} thumbnail`} className="mt-2 h-24 w-24 rounded-md object-cover ring-1 ring-gray-200" />
                              ) : (
                                <div className="mt-2 flex h-24 w-24 items-center justify-center rounded-md bg-gray-100 ring-1 ring-gray-200">
                                  <Image size={20} className="text-gray-400" />
                                </div>
                              )}
                              {detail.videoUrl ? (
                                <a href={detail.videoUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline">
                                  {detail.videoUrl}
                                </a>
                              ) : (
                                <p className="mt-2 text-sm text-gray-500">No video URL.</p>
                              )}
                              {(detail._count?.childForks || detail._count?.exercises) ? (
                                <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                                  {detail._count?.childForks !== undefined && <span>Forked by {detail._count.childForks} gym(s)</span>}
                                  {detail._count?.exercises !== undefined && <span>Used in {detail._count.exercises} plan(s)</span>}
                                </div>
                              ) : null}
                            </div>
                          </div>
                          <div className="mt-4 border-t border-gray-200 pt-4">
                            <p className="text-xs font-semibold uppercase text-gray-500">Exercise Media</p>
                            {mediaLoading[exerciseId] ? (
                              <p className="mt-2 text-sm text-gray-500">Loading media...</p>
                            ) : (mediaItems[exerciseId] || []).length > 0 ? (
                              <div className="mt-2 flex flex-wrap gap-3">
                                {(mediaItems[exerciseId] || []).map((media) => {
                                  const mediaId = idOf(media);
                                  const mediaUrl = media.url || media.fileUrl || media.filePath || "";
                                  const mediaType = media.mediaType || media.type || "IMAGE";
                                  return (
                                    <div key={mediaId} className="relative group">
                                      {mediaType === "VIDEO" && mediaUrl ? (
                                        <video src={mediaUrl} className="h-24 w-24 rounded-md object-cover ring-1 ring-gray-200" controls={false} muted />
                                      ) : mediaUrl ? (
                                        <img src={mediaUrl} alt={media.name || "Exercise media"} className="h-24 w-24 rounded-md object-cover ring-1 ring-gray-200" />
                                      ) : (
                                        <div className="flex h-24 w-24 items-center justify-center rounded-md bg-gray-100 ring-1 ring-gray-200">
                                          <Image size={20} className="text-gray-400" />
                                        </div>
                                      )}
                                      <p className="mt-1 max-w-[6rem] truncate text-xs text-gray-500">{mediaType}</p>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteMedia(exerciseId, mediaId)}
                                        className="absolute -top-1.5 -right-1.5 hidden h-5 w-5 items-center justify-center rounded-lg bg-red-500 text-white group-hover:inline-flex"
                                        aria-label="Delete media"
                                      >
                                        <X size={12} />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="mt-2 text-sm text-gray-500">No media uploaded.</p>
                            )}
                            {canManage && (
                              <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1.1fr_0.8fr_0.7fr]">
                                <div className="min-w-0">
                                  <select
                                    className={inputClass}
                                    value={mediaUploadForm.mediaType}
                                    onChange={(event) => setMediaUploadForm({ ...mediaUploadForm, mediaType: event.target.value })}
                                  >
                                    <option value="IMAGE">Image</option>
                                    <option value="VIDEO">Video</option>
                                    <option value="GIF">GIF</option>
                                  </select>
                                </div>
                                <div className="min-w-0">
                                  <input
                                    className={inputClass}
                                    type="url"
                                    value={mediaUploadForm.url}
                                    onChange={(event) => setMediaUploadForm({ ...mediaUploadForm, url: event.target.value })}
                                    placeholder="https://example.com/media.jpg"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <input
                                    className={inputClass}
                                    type="text"
                                    value={mediaUploadForm.caption}
                                    onChange={(event) => setMediaUploadForm({ ...mediaUploadForm, caption: event.target.value })}
                                    placeholder="Caption"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept={mediaUploadForm.mediaType === "VIDEO" ? "video/*" : mediaUploadForm.mediaType === "IMAGE" ? "image/*" : "image/gif"}
                                    className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none file:mr-2 file:rounded-md file:border-0 file:bg-blue-50 file:px-2 file:text-xs file:font-medium file:text-blue-700 hover:file:bg-blue-100"
                                    onChange={(event) => setMediaUploadForm({ ...mediaUploadForm, file: event.target.files?.[0] || null })}
                                  />
                                </div>
                                <div className="lg:col-span-4">
                                  <div className="flex flex-wrap items-end gap-3">
                                    <div className="min-w-0 flex-1">
                                      <input
                                        className={inputClass}
                                        type="number"
                                        min="0"
                                        value={mediaUploadForm.orderIndex}
                                        onChange={(event) => setMediaUploadForm({ ...mediaUploadForm, orderIndex: event.target.value })}
                                        placeholder="Order"
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleUploadMedia(exerciseId)}
                                      className={primaryButtonClass}
                                      disabled={!mediaUploadForm.file && !mediaUploadForm.url?.trim()}
                                    >
                                      <Upload size={16} />
                                      Upload
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {!paginatedExercises.length && (
                <tr>
                  <td colSpan={5} role={exerciseLoadError ? "alert" : undefined} className="px-4 py-10 text-center text-xs text-gray-500">
                    {exercisesLoading ? "Loading exercises..." : exerciseLoadError || "No exercises found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-[#EEF2F4] px-4 py-3 text-xs text-[#64748B] sm:flex-row sm:items-center sm:justify-between">
          <p>Page {currentExercisePage} of {exerciseTotalPages} <span className="mx-2 text-[#CBD5E1]">|</span> Showing {exerciseRangeStart} to {exerciseRangeEnd} of {exerciseTotal} records</p>
            <TablePagination page={currentExercisePage} totalPages={exerciseTotalPages} onPageChange={setExercisePage} previousLabel="Prev" disabled={exercisesLoading} />
        </div>
      </Card>

      {showExerciseForm && (canCreateExercise || (editingExerciseId && canEdit && canManageExercise(editingExerciseOriginal))) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/35 p-3 sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && resetForm()}>
          <div role="dialog" aria-modal="true" aria-labelledby="exercise-form-title" className="my-auto w-full max-w-md overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-[0_20px_50px_rgba(15,23,42,0.18)]" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-[#EEF2F4] px-4 py-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#CFEFDB] bg-[#EAFBF3] text-[#0D8252]"><Dumbbell size={15} /></div>
                <div className="min-w-0">
                  <h2 id="exercise-form-title" className="text-base font-bold text-[#0F172A]">{editingExerciseId ? "Edit Exercise" : "Add Exercise"}</h2>
                  <p className="mt-0.5 text-xs text-[#64748B]">{editingExerciseId ? "Update exercise details" : "Create a new exercise"}</p>
                </div>
              </div>
              <button type="button" onClick={resetForm} className="rounded p-1 text-[#94A3B8] hover:bg-[#F1F5F9]" aria-label="Close exercise form"><X size={14} /></button>
            </div>
            <form id="exercise-form" onSubmit={handleSaveExercise} className="grid gap-3 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Exercise Name"><input className={inputClass} value={exerciseForm.name} onChange={(event) => setExerciseForm({ ...exerciseForm, name: event.target.value })} placeholder="Bench Press" /></Field>
                <Field label="Muscle Group"><select className={inputClass} value={exerciseForm.muscleGroup} onChange={(event) => setExerciseForm({ ...exerciseForm, muscleGroup: event.target.value })}><option value="">Select muscle group</option>{muscleGroupOptions.map((group) => <option key={group} value={group}>{titleCase(group)}</option>)}</select></Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Exercise Type"><select className={inputClass} value={exerciseForm.exerciseType} onChange={(event) => setExerciseForm({ ...exerciseForm, exerciseType: event.target.value })}>{exerciseTypes.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}</select></Field>
                <Field label="Calories"><input className={inputClass} type="number" min="0" value={exerciseForm.calories} onChange={(event) => setExerciseForm({ ...exerciseForm, calories: event.target.value })} placeholder="150" /></Field>
              </div>
              <Field label="Instructions"><textarea className={textareaClass} value={exerciseForm.instructions} onChange={(event) => setExerciseForm({ ...exerciseForm, instructions: event.target.value })} placeholder="Step-by-step instructions..." /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Thumbnail URL"><input className={inputClass} type="url" value={exerciseForm.thumbnailUrl} onChange={(event) => setExerciseForm({ ...exerciseForm, thumbnailUrl: event.target.value })} placeholder="https://example.com/thumb.jpg" /></Field>
                <Field label="Video URL"><input className={inputClass} type="url" value={exerciseForm.videoUrl} onChange={(event) => setExerciseForm({ ...exerciseForm, videoUrl: event.target.value })} placeholder="https://youtube.com/watch?v=..." /></Field>
              </div>
            </form>
            <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] bg-white px-5 py-4">
              <button type="button" onClick={resetForm} disabled={savingExercise} className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50">Cancel</button>
              <button type="submit" form="exercise-form" disabled={savingExercise || (editingExerciseId ? !canEdit || !canManageExercise(editingExerciseOriginal) : !canCreateExercise)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D8252] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#086B43] disabled:cursor-not-allowed disabled:opacity-50">
                {savingExercise ? "Saving..." : editingExerciseId ? "Update Exercise" : "Add Exercise"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
