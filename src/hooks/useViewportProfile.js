import { useState, useEffect } from 'react';
import { markPerfOnce } from '../utils/performanceMarks';

const getViewportProfile = () => {
    if (typeof window === 'undefined') return { isMobile: false, isNarrowDesktop: false };
    const width = window.innerWidth;
    return {
        isMobile: width <= 767,
        isNarrowDesktop: width >= 768 && width <= 1099,
    };
};

export const useViewportProfile = () => {
    const [viewportProfile, setViewportProfile] = useState(getViewportProfile);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        markPerfOnce('aetheria:app-mounted');
        const onResize = () => setViewportProfile(getViewportProfile());
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    return viewportProfile;
};
