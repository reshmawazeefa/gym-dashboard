import { useState, useEffect } from "react";
import moment from "moment";

export default function EventModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  trainers = [],
  slot,
  editEvent,
}) {
  const [form, setForm] = useState({
    trainer: "",
    duration: 60,
    startTime: "",
  });

  // Load edit data
  useEffect(() => {
    if (editEvent) {
      setForm({
        trainer: editEvent.title || "",
        duration:
          editEvent.start && editEvent.end
            ? Math.round(
                (new Date(editEvent.end) - new Date(editEvent.start)) / 60000
              )
            : 60,
        startTime: moment(editEvent.start).format("HH:mm"),
      });
    } else {
      setForm({
        trainer: "",
        duration: 60,
        startTime: "",
      });
    }
  }, [editEvent]);

  // Prevent scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "auto";
    return () => (document.body.style.overflow = "auto");
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!form.trainer || !form.duration || !form.startTime) return;

    let baseDate = editEvent
      ? new Date(editEvent.start)
      : slot?.start
      ? new Date(slot.start)
      : new Date();

    const [h, m] = form.startTime.split(":");

    baseDate.setHours(h);
    baseDate.setMinutes(m);

    const end = new Date(
      baseDate.getTime() + form.duration * 60000
    );

    onSave({
      id: editEvent?.id || Date.now(),
      title: form.trainer,
      start: baseDate,
      end,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-white p-6 rounded w-full max-w-md shadow-lg">

        <h2 className="text-lg font-bold mb-4">
          {editEvent ? "Edit Schedule" : "Add Schedule"}
        </h2>

        {/* Trainer */}
        <select
          className="w-full border p-2 mb-3 rounded"
          value={form.trainer}
          onChange={(e) =>
            setForm({ ...form, trainer: e.target.value })
          }
        >
          <option value="">Select Trainer</option>
          {trainers.map((t) => (
            <option key={t.id} value={t.name}>
              {t.name}
            </option>
          ))}
        </select>

        {/* Start Time */}
        <input
          type="time"
          className="w-full border p-2 mb-3 rounded"
          value={form.startTime}
          onChange={(e) =>
            setForm({ ...form, startTime: e.target.value })
          }
        />

        {/* Duration */}
        <input
          type="number"
          min="15"
          step="15"
          className="w-full border p-2 mb-4 rounded"
          value={form.duration}
          onChange={(e) =>
            setForm({
              ...form,
              duration: Number(e.target.value),
            })
          }
        />

        {/* Actions */}
        <div className="flex justify-between items-center">
          {editEvent && (
            <button
              onClick={() => {
                onDelete(editEvent.id);
                onClose();
              }}
              className="text-red-500"
            >
              Delete
            </button>
          )}

          <div className="ml-auto flex gap-2">
            <button onClick={onClose}>Cancel</button>
            <button
              onClick={handleSubmit}
              className="bg-blue-500 text-white px-4 py-1 rounded"
            >
              Save
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}