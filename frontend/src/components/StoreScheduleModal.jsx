import React, { useState, useRef, useEffect } from 'react';
import { MdClose, MdSchedule } from 'react-icons/md';

// --- TIME FORMATTING HELPERS ---
const hoursArray = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
const minutesArray = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
const ampmArray = ['AM', 'PM'];

const parse24 = (time24) => {
  let [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  let hr = h % 12 || 12;
  return { h: hr.toString().padStart(2, '0'), m: m.toString().padStart(2, '0'), ampm };
};

const format24 = (h, m, ampm) => {
  let hr = parseInt(h, 10);
  if (ampm === 'PM' && hr < 12) hr += 12;
  if (ampm === 'AM' && hr === 12) hr = 0;
  return `${hr.toString().padStart(2, '0')}:${m}`;
};

const formatTo12Hour = (time24) => {
  const { h, m, ampm } = parse24(time24);
  return `${h}:${m} ${ampm}`;
};

// --- CUSTOM DRUM WHEEL COLUMN ---
const DrumColumn = ({ options, value, onChange }) => {
  const containerRef = useRef(null);
  const itemHeight = 40;
  const scrollTimeout = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      const index = options.indexOf(value);
      if (index !== -1) {
        containerRef.current.scrollTop = index * itemHeight;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const handleScroll = (e) => {
    const scrollTop = e.target.scrollTop;
    const index = Math.round(scrollTop / itemHeight);
    
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      if (options[index] && options[index] !== value) {
        onChange(options[index]);
      }
    }, 100); 
  };

  const handleItemClick = (opt, index) => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: index * itemHeight,
        behavior: 'smooth'
      });
    }
    onChange(opt);
  };

  return (
    <div 
      ref={containerRef}
      onScroll={handleScroll}
      className="drum-scroll"
      style={{ 
        height: '200px', 
        overflowY: 'scroll', 
        scrollSnapType: 'y mandatory', 
        width: '60px', 
        textAlign: 'center',
        position: 'relative', 
        zIndex: 10            
      }}
    >
      <div style={{ height: '80px' }}></div>
      {options.map((opt, index) => (
        <div 
          key={opt} 
          onClick={() => handleItemClick(opt, index)} 
          style={{ 
            height: '40px', 
            lineHeight: '40px', 
            scrollSnapAlign: 'center', 
            fontSize: opt === value ? '18px' : '15px', 
            color: opt === value ? 'var(--brand-primary)' : 'var(--text-muted)', 
            fontWeight: opt === value ? '900' : '500', 
            transition: 'all 0.15s ease',
            userSelect: 'none',
            cursor: 'pointer' 
          }}
        >
          {opt}
        </div>
      ))}
      <div style={{ height: '80px' }}></div>
    </div>
  );
};

// --- DRUM PICKER OVERLAY MODAL ---
const TimeWheelModal = ({ initialValue, onClose, onSave }) => {
  const [h, setH] = useState(parse24(initialValue).h);
  const [m, setM] = useState(parse24(initialValue).m);
  const [ampm, setAmpm] = useState(parse24(initialValue).ampm);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div style={{ backgroundColor: 'var(--surface-color)', padding: '20px', borderRadius: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', width: '280px', border: '1px solid var(--border-color)' }} onClick={e => e.stopPropagation()}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', alignItems: 'center' }}>
           <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-main)', fontWeight: '800' }}>Select Time</h3>
           <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'20px', color: 'var(--text-muted)', cursor:'pointer' }}><MdClose/></button>
        </div>
        
        <div style={{ position: 'relative', height: '200px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px' }}>
           
           <div style={{ 
             position: 'absolute', 
             top: '80px', 
             left: '10px', 
             right: '10px', 
             height: '40px', 
             backgroundColor: 'var(--surface-hover)', 
             border: '1px solid var(--border-color)', 
             borderRadius: '10px', 
             pointerEvents: 'none', 
             zIndex: 0 
           }} />
           
           {/* The Wheels */}
           <DrumColumn options={hoursArray} value={h} onChange={setH} />
           <div style={{ fontWeight: '900', fontSize: '18px', color: 'var(--brand-primary)', zIndex: 10, position: 'relative', paddingBottom: '3px', userSelect: 'none' }}>:</div>
           <DrumColumn options={minutesArray} value={m} onChange={setM} />
           <div style={{ width: '10px' }} />
           <DrumColumn options={ampmArray} value={ampm} onChange={setAmpm} />
        </div>

        <button onClick={() => onSave(format24(h, m, ampm))} style={{ width: '100%', padding: '14px', marginTop: '15px', backgroundColor: 'var(--brand-primary)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' }}>
          Done
        </button>
      </div>
    </div>
  );
};


// --- MAIN SCHEDULE COMPONENT ---
export default function StoreScheduleModal({ store, onClose, onSave, getAuthHeaders, API_BASE_URL }) {
  const defaultSchedule = {
    Monday: { isOpen: true, open: '09:00', close: '17:00' },
    Tuesday: { isOpen: true, open: '09:00', close: '17:00' },
    Wednesday: { isOpen: true, open: '09:00', close: '17:00' },
    Thursday: { isOpen: true, open: '09:00', close: '17:00' },
    Friday: { isOpen: true, open: '09:00', close: '17:00' },
    Saturday: { isOpen: false, open: '09:00', close: '17:00' },
    Sunday: { isOpen: false, open: '09:00', close: '17:00' }
  };

  const [autoEnabled, setAutoEnabled] = useState(store?.auto_schedule_enabled || false);
  const [schedule, setSchedule] = useState(store?.operating_hours || defaultSchedule);
  const [isSaving, setIsSaving] = useState(false);
  const [activePicker, setActivePicker] = useState(null); 

  const handleDayToggle = (day) => setSchedule(prev => ({ ...prev, [day]: { ...prev[day], isOpen: !prev[day].isOpen } }));
  const handleTimeChange = (day, field, value) => setSchedule(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/stores/${store.id}/schedule`, {
        method: 'PATCH',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ auto_schedule_enabled: autoEnabled, operating_hours: schedule })
      });
      if (!response.ok) throw new Error("Failed to save schedule settings.");
      onSave(await response.json()); 
      onClose();
    } catch (error) { alert(error.message); } finally { setIsSaving(false); }
  };

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '15px' }}>
      
      <style>{`
        .drum-scroll::-webkit-scrollbar { display: none; }
        .drum-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {activePicker && (
        <TimeWheelModal 
          initialValue={activePicker.value}
          onClose={() => setActivePicker(null)}
          onSave={(newTime24) => {
            handleTimeChange(activePicker.day, activePicker.field, newTime24);
            setActivePicker(null);
          }}
        />
      )}

      <div style={{ backgroundColor: 'var(--surface-color)', padding: '25px', borderRadius: '20px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', border: '1px solid var(--border-color)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--text-main)', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}><MdSchedule color="var(--brand-primary)" /> Operating Hours</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '24px', cursor: 'pointer', lineHeight: '1' }}><MdClose /></button>
        </div>

        <div style={{ backgroundColor: 'var(--surface-hover)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '15px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', color: 'var(--text-main)', fontSize: '15px', fontWeight: '700' }}>Automatic Scheduling</h3>
            <p style={{ margin: 0, color: 'var(--brand-primary)', fontSize: '12px' }}>System will auto-flip your open/close status.</p>
          </div>
          <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '24px', flexShrink: 0 }}>
            <input type="checkbox" checked={autoEnabled} onChange={(e) => setAutoEnabled(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
            <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: autoEnabled ? 'var(--brand-primary)' : 'var(--border-color)', borderRadius: '24px', transition: '.4s' }}>
              <span style={{ position: 'absolute', content: '""', height: '18px', width: '18px', left: autoEnabled ? '26px' : '3px', bottom: '3px', backgroundColor: 'white', borderRadius: '50%', transition: '.4s' }} />
            </span>
          </label>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '25px' }}>
            {days.map(day => {
              const dayData = schedule[day] || defaultSchedule[day];
              return (
                <div key={day} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '12px 15px', border: '1px solid var(--border-color)', borderRadius: '10px', backgroundColor: dayData.isOpen ? 'var(--surface-color)' : 'var(--bg-color)', opacity: autoEnabled ? 1 : 0.6, transition: 'all 0.2s' }}>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '110px' }}>
                    <input type="checkbox" checked={dayData.isOpen} onChange={() => handleDayToggle(day)} disabled={!autoEnabled} style={{ cursor: autoEnabled ? 'pointer' : 'not-allowed', width: '16px', height: '16px', accentColor: 'var(--brand-primary)' }} />
                    <span style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '14px' }}>{day}</span>
                  </div>
                  
                  {dayData.isOpen ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <button 
                        type="button"
                        onClick={() => setActivePicker({ day, field: 'open', value: dayData.open })}
                        disabled={!autoEnabled} 
                        style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '13px', fontWeight: '700', color: 'var(--text-main)', backgroundColor: 'var(--surface-hover)', width: '100px', cursor: autoEnabled ? 'pointer' : 'not-allowed' }} 
                      >
                        {formatTo12Hour(dayData.open)}
                      </button>
                      
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '800' }}>TO</span>
                      
                      <button 
                        type="button"
                        onClick={() => setActivePicker({ day, field: 'close', value: dayData.close })}
                        disabled={!autoEnabled} 
                        style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '13px', fontWeight: '700', color: 'var(--text-main)', backgroundColor: 'var(--surface-hover)', width: '100px', cursor: autoEnabled ? 'pointer' : 'not-allowed' }} 
                      >
                        {formatTo12Hour(dayData.close)}
                      </button>
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600', flexGrow: 1, textAlign: 'right' }}>Closed All Day</div>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '14px', backgroundColor: 'var(--surface-hover)', color: 'var(--text-main)', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
            <button type="submit" disabled={isSaving} style={{ flex: 1, padding: '14px', backgroundColor: 'var(--brand-primary)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: isSaving ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
              {isSaving ? 'Saving...' : 'Save Schedule'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}