import React, { useEffect, useRef } from 'react';
import './InfiniteMenu.css';

export interface InfiniteMenuItem {
  image: string;
  link: string;
  title: string;
  description: string;
}

export interface InfiniteMenuProps {
  items: InfiniteMenuItem[];
}

export default function InfiniteMenu({ items }: InfiniteMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="infinite-menu-container">
      <div className="infinite-menu-grid">
        {items.concat(items).map((item, idx) => (
          <a
            key={`${item.title}-${idx}`}
            href={item.link}
            className="infinite-menu-card card"
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div className="infinite-menu-image-wrapper">
              <img src={item.image} alt={item.title} className="infinite-menu-image" />
            </div>
            <div className="infinite-menu-content">
              <h4 className="infinite-menu-title">{item.title}</h4>
              <p className="infinite-menu-description num">{item.description}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
