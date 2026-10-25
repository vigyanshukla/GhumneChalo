'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  XCircle,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Plane,
  MapPin,
  CloudRain,
  Sparkles,
  RefreshCw,
  Compass,
  AlertTriangle,
} from 'lucide-react';
import { ReminderItem, CreateReminderInput } from '@/lib/reminders/types';
import { ReminderStatus, ReminderType } from '@prisma/client';

export function ReminderManager({ tripId }: { tripId?: string }) {
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<'UPCOMING' | 'HISTORY'>('UPCOMING');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [editingReminder, setEditingReminder] = useState<ReminderItem | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState<string>('');
  const [formMessage, setFormMessage] = useState<string>('');
  const [formDate, setFormDate] = useState<string>('');
  const [formTime, setFormTime] = useState<string>('');
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchReminders = useCallback(async () => {
    try {
      setLoading(true);
      let url = `/api/reminders?limit=100`;
      if (tripId) url += `&tripId=${tripId}`;
      if (filterTab === 'UPCOMING') {
        url += `&upcoming=true`;
      } else {
        url += `&status=SENT`;
      }
      if (typeFilter !== 'ALL') {
        url += `&type=${typeFilter}`;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch reminders');
      const data = await res.json();
      if (data.success && data.data) {
        setReminders(data.data.reminders || []);
        setTotal(data.data.total || 0);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error fetching reminders');
    } finally {
      setLoading(false);
    }
  }, [tripId, filterTab, typeFilter]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        let url = `/api/reminders?limit=100`;
        if (tripId) url += `&tripId=${tripId}`;
        if (filterTab === 'UPCOMING') {
          url += `&upcoming=true`;
        } else {
          url += `&status=SENT`;
        }
        if (typeFilter !== 'ALL') {
          url += `&type=${typeFilter}`;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch reminders');
        const data = await res.json();
        if (!ignore && data.success && data.data) {
          setReminders(data.data.reminders || []);
          setTotal(data.data.total || 0);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Error fetching reminders');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [tripId, filterTab, typeFilter]);

  // Handle ESC key to dismiss modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (showCreateModal || editingReminder)) {
        setShowCreateModal(false);
        setEditingReminder(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCreateModal, editingReminder]);

  const handleOpenCreate = () => {
    const defaultDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    setFormTitle('');
    setFormMessage('');
    setFormDate(defaultDate.toISOString().split('T')[0]);
    setFormTime('09:00');
    setFormError(null);
    setShowCreateModal(true);
  };

  const handleOpenEdit = (reminder: ReminderItem) => {
    setEditingReminder(reminder);
    setFormTitle(reminder.title);
    setFormMessage(reminder.message);
    const d = new Date(reminder.scheduledAt);
    setFormDate(d.toISOString().split('T')[0]);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    setFormTime(`${hh}:${mm}`);
    setFormError(null);
  };

  const handleSaveReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('Title is required');
      return;
    }
    if (!formMessage.trim()) {
      setFormError('Message is required');
      return;
    }
    if (!formDate || !formTime) {
      setFormError('Date and time are required');
      return;
    }

    const scheduledAt = new Date(`${formDate}T${formTime}:00`);
    if (isNaN(scheduledAt.getTime())) {
      setFormError('Invalid date or time');
      return;
    }

    try {
      setFormSubmitting(true);
      setFormError(null);

      if (editingReminder) {
        // PATCH
        const res = await fetch(`/api/reminders/${editingReminder.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: formTitle.trim(),
            message: formMessage.trim(),
            scheduledAt: scheduledAt.toISOString(),
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error?.message || 'Failed to update reminder');
        setEditingReminder(null);
      } else {
        // POST
        const payload: CreateReminderInput = {
          title: formTitle.trim(),
          message: formMessage.trim(),
          scheduledAt: scheduledAt.toISOString(),
          type: ReminderType.CUSTOM,
          tripId: tripId || undefined,
        };
        const res = await fetch('/api/reminders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error?.message || 'Failed to create reminder');
        setShowCreateModal(false);
      }

      fetchReminders();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error saving reminder');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleCancelReminder = async (id: string) => {
    try {
      const res = await fetch(`/api/reminders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      if (res.ok) {
        setReminders((prev) =>
          prev.map((r) =>
            r.id === id ? { ...r, status: ReminderStatus.CANCELLED, deliveryState: 'CANCELLED' } : r
          )
        );
      }
    } catch {
      // ignore
    }
  };

  const handleDeleteReminder = async (id: string) => {
    if (!confirm('Are you sure you want to delete this reminder?')) return;
    try {
      const res = await fetch(`/api/reminders/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setReminders((prev) => prev.filter((r) => r.id !== id));
        setTotal((prev) => Math.max(0, prev - 1));
      }
    } catch {
      // ignore
    }
  };

  const getTypeIcon = (type: ReminderType) => {
    switch (type) {
      case 'TRANSPORT_DEPARTURE':
      case 'TRANSPORT_ARRIVAL':
        return <Plane className="w-4 h-4 text-sky-400" />;
      case 'ITINERARY_ACTIVITY':
        return <MapPin className="w-4 h-4 text-emerald-400" />;
      case 'WEATHER_ALERT':
        return <CloudRain className="w-4 h-4 text-amber-400" />;
      case 'TRIP_START':
        return <Compass className="w-4 h-4 text-indigo-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-purple-400" />;
    }
  };

  const getStatusBadge = (status: ReminderStatus) => {
    switch (status) {
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Clock className="w-3 h-3" /> Scheduled
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin" /> Processing
          </span>
        );
      case 'SENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Sent
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-500/10 text-neutral-400 border border-neutral-500/20">
            <XCircle className="w-3 h-3" /> Cancelled
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-3 h-3" /> Failed
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-full space-y-6 overflow-hidden">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-900/60 p-4 sm:p-5 rounded-2xl border border-neutral-800 backdrop-blur-xl w-full max-w-full overflow-hidden">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 truncate">
            <Clock className="w-5 h-5 text-indigo-400 flex-shrink-0" />
            <span className="truncate">Travel Reminders</span>
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1 line-clamp-2">
            Automated alerts for trip departures, flights, activities, and custom schedules.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={fetchReminders}
            disabled={loading}
            className="p-2.5 min-w-[44px] min-h-[44px] rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors flex items-center justify-center"
            title="Refresh reminders"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenCreate}
            className="px-3.5 sm:px-4 py-2.5 min-h-[44px] rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 shadow-lg shadow-indigo-500/25 transition-all"
          >
            <Plus className="w-4 h-4" />
            New Reminder
          </button>
        </div>
      </div>

      {/* Tabs & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 border-b border-neutral-800 pb-3 w-full max-w-full">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterTab('UPCOMING')}
            className={`px-4 py-2 min-h-[44px] rounded-xl text-sm font-medium transition-all ${
              filterTab === 'UPCOMING'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Upcoming ({filterTab === 'UPCOMING' ? total : ''})
          </button>
          <button
            onClick={() => setFilterTab('HISTORY')}
            className={`px-4 py-2 min-h-[44px] rounded-xl text-sm font-medium transition-all ${
              filterTab === 'HISTORY'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            History / Sent
          </button>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 min-h-[44px] text-xs text-neutral-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Types</option>
            <option value="TRIP_START">Trip Start</option>
            <option value="TRANSPORT_DEPARTURE">Transportation</option>
            <option value="ITINERARY_ACTIVITY">Itinerary</option>
            <option value="WEATHER_ALERT">Weather</option>
            <option value="CUSTOM">Custom</option>
          </select>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="py-12 flex flex-col items-center justify-center text-neutral-400 gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
          <p className="text-sm">Loading reminders...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && reminders.length === 0 && (
        <div className="py-16 text-center bg-neutral-900/30 rounded-2xl border border-neutral-800/60 p-8">
          <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto mb-3 text-indigo-400">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="text-base font-medium text-neutral-200">No {filterTab.toLowerCase()} reminders found</h3>
          <p className="text-sm text-neutral-500 mt-1 max-w-sm mx-auto">
            {filterTab === 'UPCOMING'
              ? 'Schedule custom travel alerts or create trip activities to see reminders here.'
              : 'Past triggered reminders will show up here after dispatch.'}
          </p>
          {filterTab === 'UPCOMING' && (
            <button
              onClick={handleOpenCreate}
              className="mt-4 px-4 py-2 min-h-[44px] rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm font-medium transition-colors"
            >
              Create Your First Reminder
            </button>
          )}
        </div>
      )}

      {/* Reminders List */}
      {!loading && reminders.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reminders.map((reminder) => {
            const schedDate = new Date(reminder.scheduledAt);
            const isCancelled = reminder.status === 'CANCELLED';
            const isSent = reminder.status === 'SENT';

            return (
              <div
                key={reminder.id}
                className={`p-4 rounded-xl border transition-all ${
                  isCancelled
                    ? 'bg-neutral-900/30 border-neutral-800/40 opacity-60'
                    : 'bg-neutral-900/80 border-neutral-800 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-neutral-800/80 border border-neutral-700/50 mt-0.5">
                      {getTypeIcon(reminder.type)}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white leading-snug">
                        {reminder.title}
                      </h4>
                      <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                        {reminder.message}
                      </p>
                    </div>
                  </div>

                  <div>{getStatusBadge(reminder.status)}</div>
                </div>

                <div className="mt-4 pt-3 border-t border-neutral-800/60 flex items-center justify-between text-xs text-neutral-400">
                  <div className="flex items-center gap-1.5 text-neutral-300">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    <span>
                      {schedDate.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}{' '}
                      at{' '}
                      {schedDate.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {!isSent && !isCancelled && (
                      <>
                        <button
                          onClick={() => handleOpenEdit(reminder)}
                          className="p-2 min-w-[36px] min-h-[36px] rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
                          title="Edit reminder"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleCancelReminder(reminder.id)}
                          className="p-2 min-w-[36px] min-h-[36px] rounded-lg hover:bg-neutral-800 text-amber-400/80 hover:text-amber-300 transition-colors"
                          title="Cancel reminder"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDeleteReminder(reminder.id)}
                      className="p-2 min-w-[36px] min-h-[36px] rounded-lg hover:bg-neutral-800 text-rose-400/80 hover:text-rose-300 transition-colors"
                      title="Delete reminder"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {(showCreateModal || editingReminder) && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reminder-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
        >
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h3 id="reminder-modal-title" className="text-lg font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-400" />
                {editingReminder ? 'Edit Reminder' : 'Create Custom Reminder'}
              </h3>
              <button
                type="button"
                aria-label="Close reminder dialog"
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingReminder(null);
                }}
                className="p-2 min-w-[44px] min-h-[44px] rounded-xl hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveReminder} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                  Title
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Check In For Flight"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  maxLength={150}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                  Message
                </label>
                <textarea
                  value={formMessage}
                  onChange={(e) => setFormMessage(e.target.value)}
                  placeholder="e.g. Ensure boarding pass is downloaded and luggage is ready."
                  rows={3}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                  maxLength={1000}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                    Date
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 min-h-[44px] text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                    Time
                  </label>
                  <input
                    type="time"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 min-h-[44px] text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingReminder(null);
                  }}
                  className="px-4 py-2.5 min-h-[44px] rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2.5 min-h-[44px] rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-sm font-semibold shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2"
                >
                  {formSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {editingReminder ? 'Save Changes' : 'Create Reminder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
