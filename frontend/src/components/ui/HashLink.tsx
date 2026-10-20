import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Returns a click handler that smoothly scrolls to a section by id.
 * Works from any route: navigates home first when needed, then scrolls.
 */
export function useHashNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, hash: string) => {
      e.preventDefault();

      if (!hash) return;

      if (location.pathname !== '/') {
        navigate('/', { state: { scrollTo: hash } });
        return;
      }

      const el = document.getElementById(hash);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.history.replaceState(null, '', `#${hash}`);
      }
    },
    [location.pathname, navigate]
  );
}

/**
 * Anchor that scrolls to a section on the current page. Falls back to a
 * normal navigation if the section is not present.
 */
export function HashLink({
  hash,
  children,
  className,
  ...rest
}: {
  hash: string;
  children: React.ReactNode;
  className?: string;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  const handleClick = useHashNavigation();

  return (
    <a
      href={`/#${hash}`}
      onClick={(e) => handleClick(e, hash)}
      className={className}
      {...rest}
    >
      {children}
    </a>
  );
}
