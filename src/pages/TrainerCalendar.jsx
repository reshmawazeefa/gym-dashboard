import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import { useState, useEffect, useMemo } from "react";
import "react-big-calendar/lib/css/react-big-calendar.css";
import EventModal from "../components/EventModal";
import toast from "react-hot-toast";

const localizer = momentLocalizer(moment);

const getColor = (name) => {
  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"];
  const index = name?.charCodeAt(0) % colors.length;
  return colors[index];
};

function CalendarToolbar({ label, onNavigate, onView, view }) {
  const viewButtonClass = (targetView) =>
    `rounded-md px-3 py-2 text-sm font-semibold transition ${
      view === targetView
        ? "bg-blue-600 text-white"
        : "border border-gray-300 text-gray-700 hover:bg-gray-50"
    }`;

  return (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onNavigate("TODAY")}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => onNavigate("PREV")}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => onNavigate("NEXT")}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Next
        </button>
      </div>

      <h2 className="text-base font-bold text-gray-950 md:text-lg">{label}</h2>

      <div className="grid grid-cols-3 gap-2 sm:flex">
        <button type="button" onClick={() => onView("month")} className={viewButtonClass("month")}>
          Month
        </button>
        <button type="button" onClick={() => onView("week")} className={viewButtonClass("week")}>
          Week
        </button>
        <button type="button" onClick={() => onView("day")} className={viewButtonClass("day")}>
          Day
        </button>
      </div>
    </div>
  );
}

export default function TrainerCalendar() {
  const [events, setEvents] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState("week");

  const [slot, setSlot] = useState(null);
  const [editEvent, setEditEvent] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const savedEvents =
      JSON.parse(localStorage.getItem("calendarEvents")) || [];
    const savedTrainers =
      JSON.parse(localStorage.getItem("trainers")) || [];

    setEvents(
      savedEvents.map((event) => ({
        ...event,
        start: new Date(event.start),
        end: new Date(event.end),
      }))
    );
    setTrainers(savedTrainers);
  }, []);

  const calendarEvents = useMemo(
    () =>
      events.map((event) => ({
        ...event,
        start: new Date(event.start),
        end: new Date(event.end),
      })),
    [events]
  );

  const handleSelectSlot = (slotInfo) => {
    setSlot(slotInfo);
    setEditEvent(null);
    setIsOpen(true);
  };

  const handleSelectEvent = (event) => {
    setEditEvent(event);
    setIsOpen(true);
  };

  const handleSave = (data) => {
    let updated;

    if (events.find((e) => e.id === data.id)) {
      updated = events.map((e) =>
        e.id === data.id ? data : e
      );
      toast.success("Updated");
    } else {
      updated = [...events, data];
      toast.success("Added");
    }

    const normalized = updated.map((event) => ({
      ...event,
      start: new Date(event.start),
      end: new Date(event.end),
    }));

    setEvents(normalized);
    localStorage.setItem("calendarEvents", JSON.stringify(normalized));
  };

  const handleDelete = (id) => {
    const updated = events.filter((e) => e.id !== id);
    setEvents(updated);
    localStorage.setItem("calendarEvents", JSON.stringify(updated));
    toast.error("Deleted");
  };

  const eventStyleGetter = (event) => ({
    style: {
      backgroundColor: getColor(event.title),
      color: "#fff",
      borderRadius: "6px",
      border: "none",
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">
        Trainer Calendar
      </h1>

      <div className="bg-white p-4 rounded shadow h-[700px]">
        <Calendar
        localizer={localizer}
        events={calendarEvents}
        date={calendarDate}
        view={calendarView}
        onNavigate={(nextDate) => setCalendarDate(nextDate)}
        onView={(nextView) => setCalendarView(nextView)}
        selectable
        views={["month", "week", "day"]}
        toolbar={true}
        startAccessor="start"
        endAccessor="end"
        onSelectSlot={handleSelectSlot}
        onSelectEvent={handleSelectEvent}
        eventPropGetter={eventStyleGetter}
        components={{ toolbar: CalendarToolbar }}
        style={{ height: "100%" }}
        />
      </div>

      <EventModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSave={handleSave}
        onDelete={handleDelete}
        trainers={trainers}
        slot={slot}
        editEvent={editEvent}
      />
    </div>
  );
}
