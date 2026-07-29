import React, { useRef } from 'react';
import './InfiniteMenu.css';

export interface InfiniteMenuItem {
  image?: string;
  link?: string;
  title: string;
  description: string;
  onClick?: () => void;
}

export interface InfiniteMenuProps {
  items: InfiniteMenuItem[];
  onSelect?: (item: InfiniteMenuItem) => void;
}

export function InfiniteMenu({ items, onSelect }: InfiniteMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  if (!items || items.length === 0) return null;

  return (
    <div ref={containerRef} className="infinite-menu-container">
      <div className="infinite-menu-grid">
        {items.map((item, idx) => (
          <div
            key={`${item.title}-${idx}`}
            className="infinite-menu-card"
            onClick={() => {
              if (item.onClick) item.onClick();
              if (onSelect) onSelect(item);
            }}
          >
            {item.image ? (
              <div className="infinite-menu-image-wrapper">
                <img src={item.image} alt={item.title} className="infinite-menu-image" />
              </div>
            ) : (
              <div className="infinite-menu-image-wrapper" style={{ background: 'var(--color-primary-dim)', color: 'var(--color-primary)' }}>
                <span style={{ fontSize: '2rem', fontWeight: 900 }}>🥗</span>
              </div>
            )}
            <div className="infinite-menu-content">
              <h4 className="infinite-menu-title">{item.title}</h4>
              <p className="infinite-menu-description num">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default InfiniteMenu;
