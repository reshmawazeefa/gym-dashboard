import { Fragment, useState, useEffect, useRef } from "react";
import { ChevronDown, Image, Pencil, Plus, Search, Trash, Upload, X } from "lucide-react";
import toast from "react-hot-toast";
import { createExercise, updateExercise, deleteExercise, createSubstitution, getSubstitutions, deleteSubstitution, uploadExerciseMedia, getExerciseMedia, deleteExerciseMedia, getApiError } from "../services/api";

function idOf(item) { return item?.id || item?._id || item?.uuid || item?.userId || ""; }
function nameOf(item) { return item?.name || item?.fullName || item?.title || item?.email || idOf(item) || "-"; }
function emptyExercise() { return { name: "", muscleGroup: "", instructions: "", videoUrl: "", calories: "" }; }
function titleCase(value) { return String(value || "").toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }

const inputClass = "h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-500";
const textareaClass = "min-h-24 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const buttonClass = "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60";
const primaryButtonClass = "inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const iconButtonClass = "inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40";

const muscleGroupOptions = ["CHEST", "BACK", "LEGS", "SHOULDERS", "ARMS", "CORE", "FULL_BODY"];

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

function unwrapSubstitutions(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.substitutions)) return response.substitutions;
  if (Array.isArray(response?.exercises)) return response.exercises;
  return [];
}

export default function WorkoutExercises({ user, role, canManage, canEdit, canDelete, exercises, setExercises, exerciseSearch, setExerciseSearch, muscleFilter, setMuscleFilter, filteredExercises, loadExercises }) {
  const [editingExerciseId, setEditingExerciseId] = useState("");
  const [exerciseForm, setExerciseForm] = useState(emptyExercise);
  const [expandedExerciseId, setExpandedExerciseId] = useState("");
  const [substitutions, setSubstitutions] = useState({});
  const [substitutionsLoading, setSubstitutionsLoading] = useState({});
  const [substituteForm, setSubstituteForm] = useState({ substituteExerciseId: "", reason: "" });
  const [mediaItems, setMediaItems] = useState({});
  const [mediaLoading, setMediaLoading] = useState({});
  const [mediaUploadForm, setMediaUploadForm] = useState({ file: null, mediaType: "IMAGE" });
  const fileInputRef = useRef(null);

  useEffect(() => {
    void (async () => {
      try {
        await loadExercises();
      } catch (error) {
        toast.error(getApiError(error, "Unable to load exercises"));
      }
    })();
  }, []);

  const editExercise = (exercise) => {
    setEditingExerciseId(idOf(exercise));
    setExerciseForm({
      name: exercise.name || "",
      muscleGroup: exercise.muscleGroup || "",
      instructions: exercise.instructions || "",
      videoUrl: exercise.videoUrl || "",
      calories: exercise.calories || exercise.caloriesBurned || "",
    });
  };

  const resetForm = () => {
    setExerciseForm(emptyExercise());
    setEditingExerciseId("");
  };

  const handleSaveExercise = async (event) => {
    event.preventDefault();
    if (!canManage || !exerciseForm.name.trim() || !exerciseForm.muscleGroup) {
      toast.error("Exercise name and muscle group are required");
      return;
    }

    const payload = {
      ...exerciseForm,
      calories: exerciseForm.calories ? Number(exerciseForm.calories) : undefined,
    };

    try {
      if (editingExerciseId) {
        await updateExercise(editingExerciseId, payload, user?.token);
        toast.success("Exercise updated");
      } else {
        await createExercise(payload, user?.token);
        toast.success("Exercise created");
      }
      resetForm();
      await loadExercises();
    } catch (error) {
      toast.error(getApiError(error, "Unable to save exercise"));
    }
  };

  const handleDeleteExercise = async (exerciseId) => {
    if (!window.confirm("Are you sure you want to delete this exercise?")) return;
    try {
      await deleteExercise(exerciseId, user?.token);
      toast.success("Exercise deleted");
      await loadExercises();
    } catch (error) {
      toast.error(getApiError(error, "Unable to delete exercise"));
    }
  };

  const loadSubstitutions = async (exerciseId) => {
    if (substitutions[exerciseId] !== undefined) return;
    setSubstitutionsLoading((prev) => ({ ...prev, [exerciseId]: true }));
    try {
      const response = await getSubstitutions(exerciseId, user?.token);
      const list = unwrapSubstitutions(response);
      setSubstitutions((prev) => ({ ...prev, [exerciseId]: list }));
    } catch (error) {
      setSubstitutions((prev) => ({ ...prev, [exerciseId]: [] }));
      toast.error(getApiError(error, "Unable to load substitutions"));
    } finally {
      setSubstitutionsLoading((prev) => ({ ...prev, [exerciseId]: false }));
    }
  };

  const handleToggleExpand = async (exerciseId) => {
    if (expandedExerciseId === exerciseId) {
      setExpandedExerciseId("");
      return;
    }
    setExpandedExerciseId(exerciseId);
    setSubstituteForm({ substituteExerciseId: "", reason: "" });
    await Promise.all([loadSubstitutions(exerciseId), loadMedia(exerciseId)]);
  };

  const substituteExerciseName = (sub) => {
    return sub?.substituteExercise?.name || sub?.exercise?.name || sub?.substituteName || sub?.name || "-";
  };

  const handleAddSubstitute = async (exerciseId) => {
    if (!substituteForm.substituteExerciseId || !substituteForm.reason.trim()) {
      toast.error("Select an exercise and provide a reason");
      return;
    }
    try {
      await createSubstitution(exerciseId, { substituteExerciseId: substituteForm.substituteExerciseId, reason: substituteForm.reason.trim() }, user?.token);
      toast.success("Substitution added");
      setSubstituteForm({ substituteExerciseId: "", reason: "" });
      const response = await getSubstitutions(exerciseId, user?.token);
      setSubstitutions((prev) => ({ ...prev, [exerciseId]: unwrapSubstitutions(response) }));
    } catch (error) {
      toast.error(getApiError(error, "Unable to add substitution"));
    }
  };

  const handleDeleteSubstitution = async (exerciseId, substitutionId) => {
    if (!window.confirm("Are you sure you want to remove this substitution?")) return;
    try {
      await deleteSubstitution(substitutionId, user?.token);
      toast.success("Substitution removed");
      setSubstitutions((prev) => ({
        ...prev,
        [exerciseId]: (prev[exerciseId] || []).filter((sub) => idOf(sub) !== substitutionId),
      }));
    } catch (error) {
      toast.error(getApiError(error, "Unable to delete substitution"));
    }
  };

  const availableSubstituteExercises = (exerciseId) => {
    const existingSubIds = (substitutions[exerciseId] || []).map((sub) => idOf(sub?.substituteExercise || sub?.exercise || sub));
    return filteredExercises.filter((ex) => idOf(ex) !== exerciseId && !existingSubIds.includes(idOf(ex)));
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
    if (!mediaUploadForm.file) {
      toast.error("Select a file to upload");
      return;
    }
    const formData = new FormData();
    formData.append("file", mediaUploadForm.file);
    formData.append("mediaType", mediaUploadForm.mediaType);
    try {
      await uploadExerciseMedia(exerciseId, formData, user?.token);
      toast.success("Media uploaded");
      setMediaUploadForm({ file: null, mediaType: "IMAGE" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      setMediaItems((prev) => ({ ...prev, [exerciseId]: undefined }));
      await loadMedia(exerciseId);
    } catch (error) {
      toast.error(getApiError(error, "Unable to upload media"));
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

  return (
    <section className={canManage ? "grid gap-4 xl:grid-cols-[16rem_minmax(0,1fr)]" : "space-y-4"}>
      {canManage && (
        <Card className="self-start p-3">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-gray-950">{editingExerciseId ? "Edit Exercise" : "Add Exercise"}</h3>
              <p className="mt-1 text-xs leading-5 text-gray-500">{editingExerciseId ? "Update exercise details." : "Create a new exercise."}</p>
            </div>
            <Plus size={18} className="mt-0.5 text-gray-400" />
          </div>
          <form onSubmit={handleSaveExercise} className="grid gap-2">
            <Field label="Exercise Name">
              <input className={inputClass} value={exerciseForm.name} onChange={(event) => setExerciseForm({ ...exerciseForm, name: event.target.value })} placeholder="Bench Press" />
            </Field>
            <Field label="Muscle Group">
              <select className={inputClass} value={exerciseForm.muscleGroup} onChange={(event) => setExerciseForm({ ...exerciseForm, muscleGroup: event.target.value })}>
                <option value="">Select muscle group</option>
                {muscleGroupOptions.map((group) => <option key={group} value={group}>{titleCase(group)}</option>)}
              </select>
            </Field>
            <Field label="Instructions">
              <textarea className={textareaClass} value={exerciseForm.instructions} onChange={(event) => setExerciseForm({ ...exerciseForm, instructions: event.target.value })} placeholder="Step-by-step instructions..." />
            </Field>
            <Field label="Video URL">
              <input className={inputClass} type="url" value={exerciseForm.videoUrl} onChange={(event) => setExerciseForm({ ...exerciseForm, videoUrl: event.target.value })} placeholder="https://youtube.com/watch?v=..." />
            </Field>
            <Field label="Calories">
              <input className={inputClass} type="number" min="0" value={exerciseForm.calories} onChange={(event) => setExerciseForm({ ...exerciseForm, calories: event.target.value })} placeholder="150" />
            </Field>
            <button type="submit" className={primaryButtonClass} disabled={!canManage}>
              {editingExerciseId ? "Update Exercise" : "Create Exercise"}
            </button>
            {editingExerciseId && (
              <button type="button" onClick={resetForm} className={buttonClass}>
                Cancel
              </button>
            )}
          </form>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="grid gap-3 border-b border-gray-200 p-4 lg:grid-cols-[minmax(0,1fr)_12rem]">
          <div className="flex items-center gap-2 rounded-md border border-gray-200 px-3">
            <Search size={17} className="text-gray-400" />
            <input className="h-10 min-w-0 flex-1 text-sm outline-none" value={exerciseSearch} onChange={(event) => setExerciseSearch(event.target.value)} placeholder="Search exercises..." />
          </div>
          <select className={inputClass} value={muscleFilter} onChange={(event) => setMuscleFilter(event.target.value)}>
            <option value="">All Muscle Groups</option>
            {muscleGroupOptions.map((group) => <option key={group} value={group}>{titleCase(group)}</option>)}
          </select>
        </div>
        <div className="divide-y divide-gray-100">
          <div className="hidden gap-3 bg-gray-100 px-0 py-3 text-xs font-semibold uppercase text-gray-500 lg:grid lg:grid-cols-[2rem_minmax(12rem,1fr)_9rem_7rem_7rem] lg:items-center">
            <span aria-hidden="true"></span>
            <span>Exercise</span>
            <span className="text-center">Muscle Group</span>
            <span className="text-center">Calories</span>
            <span className="text-center">Actions</span>
          </div>
          {filteredExercises.map((exercise) => {
            const exerciseId = idOf(exercise);
            const isExpanded = expandedExerciseId === exerciseId;
            const exSubstitutions = substitutions[exerciseId];
            const exSubstitutionsLoading = substitutionsLoading[exerciseId];
            const availableSubs = availableSubstituteExercises(exerciseId);

            return (
              <div key={exerciseId} className="bg-white">
                <div className="grid gap-3 px-0 py-3 lg:grid-cols-[2rem_minmax(12rem,1fr)_9rem_7rem_7rem] lg:items-center">
                  <button
                    type="button"
                    onClick={() => handleToggleExpand(exerciseId)}
                    className={iconButtonClass}
                    aria-label={isExpanded ? "Collapse exercise" : "Expand exercise"}
                  >
                    <ChevronDown size={17} className={`transition ${isExpanded ? "rotate-180" : ""}`} />
                  </button>
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-gray-950">{exercise.name || "-"}</h3>
                  </div>
                  <span className="inline-flex h-7 items-center justify-center rounded-full bg-blue-50 px-3 text-xs font-semibold text-blue-700">{titleCase(exercise.muscleGroup || "")}</span>
                  <div className="text-sm text-center">
                    <span className="text-gray-500 lg:hidden">Calories: </span>
                    <span className="font-semibold text-gray-950">{exercise.calories || exercise.caloriesBurned || "-"}</span>
                  </div>
                  <div className="flex items-center justify-center gap-1">
                    {canEdit && (
                      <button type="button" onClick={() => editExercise(exercise)} className={iconButtonClass} aria-label="Edit exercise">
                        <Pencil size={15} />
                      </button>
                    )}
                    {canDelete && (
                      <button type="button" onClick={() => handleDeleteExercise(exerciseId)} className={iconButtonClass} aria-label="Delete exercise">
                        <Trash size={15} />
                      </button>
                    )}
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase text-gray-500">Instructions</p>
                        <p className="mt-1 text-sm leading-6 text-gray-600">{exercise.instructions || "No instructions provided."}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase text-gray-500">Video</p>
                        {exercise.videoUrl ? (
                          <a href={exercise.videoUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline">
                            {exercise.videoUrl}
                          </a>
                        ) : (
                          <p className="mt-1 text-sm text-gray-500">No video URL.</p>
                        )}
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
                                  className="absolute -top-1.5 -right-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white group-hover:inline-flex"
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
                        <div className="mt-3 flex flex-wrap items-end gap-3">
                          <div className="min-w-0 flex-1">
                            <select
                              className={inputClass}
                              value={mediaUploadForm.mediaType}
                              onChange={(event) => setMediaUploadForm({ ...mediaUploadForm, mediaType: event.target.value })}
                            >
                              <option value="IMAGE">Image</option>
                              <option value="VIDEO">Video</option>
                              <option value="DOCUMENT">Document</option>
                            </select>
                          </div>
                          <div className="min-w-0 flex-1">
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept={mediaUploadForm.mediaType === "VIDEO" ? "video/*" : mediaUploadForm.mediaType === "IMAGE" ? "image/*" : ".pdf,.doc,.docx"}
                              className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none file:mr-2 file:rounded-md file:border-0 file:bg-blue-50 file:px-2 file:text-xs file:font-medium file:text-blue-700 hover:file:bg-blue-100"
                              onChange={(event) => setMediaUploadForm({ ...mediaUploadForm, file: event.target.files?.[0] || null })}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUploadMedia(exerciseId)}
                            className={primaryButtonClass}
                            disabled={!mediaUploadForm.file}
                          >
                            <Upload size={16} />
                            Upload
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="mt-4 border-t border-gray-200 pt-4">
                      <p className="text-xs font-semibold uppercase text-gray-500">Substitutions</p>
                      {exSubstitutionsLoading ? (
                        <p className="mt-2 text-sm text-gray-500">Loading substitutions...</p>
                      ) : exSubstitutions && exSubstitutions.length > 0 ? (
                        <ul className="mt-2 space-y-2">
                          {exSubstitutions.map((sub) => {
                            const subId = idOf(sub);
                            return (
                              <li key={subId} className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-gray-200">
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-gray-900">{substituteExerciseName(sub)}</p>
                                  {sub.reason && <p className="mt-0.5 text-xs text-gray-500">{sub.reason}</p>}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSubstitution(exerciseId, subId)}
                                  className={iconButtonClass}
                                  aria-label="Remove substitution"
                                >
                                  <X size={14} />
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-gray-500">No substitutions added.</p>
                      )}
                      {canManage && (
                        <div className="mt-3 flex flex-wrap items-end gap-3">
                          <div className="min-w-0 flex-1">
                            <select
                              className={inputClass}
                              value={substituteForm.substituteExerciseId}
                              onChange={(event) => setSubstituteForm({ ...substituteForm, substituteExerciseId: event.target.value })}
                            >
                              <option value="">Select substitute exercise</option>
                              {availableSubs.map((ex) => (
                                <option key={idOf(ex)} value={idOf(ex)}>{ex.name || "-"}</option>
                              ))}
                            </select>
                          </div>
                          <div className="min-w-0 flex-1">
                            <input
                              className={inputClass}
                              type="text"
                              value={substituteForm.reason}
                              onChange={(event) => setSubstituteForm({ ...substituteForm, reason: event.target.value })}
                              placeholder="Reason for substitution"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddSubstitute(exerciseId)}
                            className={primaryButtonClass}
                            disabled={!substituteForm.substituteExerciseId || !substituteForm.reason.trim()}
                          >
                            <Plus size={16} />
                            Add
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {!filteredExercises.length && (
            <div className="p-8 text-center text-sm text-gray-500">
              No exercises found.
            </div>
          )}
        </div>
      </Card>
    </section>
  );
}
