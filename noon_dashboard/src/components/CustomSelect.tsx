import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  label: string;
  value: string | number;
}

interface CustomSelectProps {
  value: string | number;
  options: SelectOption[];
  onChange: (value: any) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
  title?: string;
}

export function CustomSelect({ value, options, onChange, disabled, style, className, title }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div 
      ref={containerRef}
      className={className}
      style={{ position: 'relative', userSelect: 'none', ...style }}
      title={title}
    >
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1rem',
          height: '100%',
          background: disabled ? 'rgba(255,255,255,0.02)' : 'var(--panel-bg)',
          border: isOpen ? '1px solid var(--primary)' : '1px solid var(--panel-border)',
          borderRadius: 'inherit',
          cursor: disabled ? 'not-allowed' : 'pointer',
          color: disabled ? 'var(--text-muted)' : 'white',
          opacity: disabled ? 0.6 : 1,
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          if (!disabled && !isOpen) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
        }}
        onMouseLeave={(e) => {
          if (!disabled && !isOpen) e.currentTarget.style.borderColor = 'var(--panel-border)';
        }}
      >
        <span style={{ fontSize: '0.9rem', marginRight: '0.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selectedOption?.label}
        </span>
        <ChevronDown size={16} style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: 'var(--text-muted)', flexShrink: 0 }} />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              width: '100%',
              minWidth: '130px',
              background: 'rgba(20, 23, 35, 0.95)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '0.4rem',
              zIndex: 50,
              boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(0,0,0,0.5)'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', maxHeight: '250px', overflowY: 'auto' }}>
              {options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <div
                    key={opt.value}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: isSelected ? 'rgba(96, 165, 250, 0.15)' : 'transparent',
                      color: isSelected ? '#60a5fa' : 'var(--text-main)',
                      fontSize: '0.85rem',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span style={{ whiteSpace: 'nowrap' }}>{opt.label}</span>
                    {isSelected && <Check size={14} strokeWidth={3} />}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
