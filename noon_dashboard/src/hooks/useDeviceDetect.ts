import { useState, useEffect } from 'react';

export function useDeviceDetect() {
  const checkIsMobile = (): boolean => {
    if (typeof window === 'undefined') return false;
    
    const width = window.innerWidth;
    const ua = navigator.userAgent || '';
    
    // 屏幕宽度小于 768px 或 UA 匹配移动端系统
    const isMobileWidth = width < 768;
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    
    return isMobileWidth || isMobileUA;
  };

  const [isMobile, setIsMobile] = useState<boolean>(checkIsMobile);

  useEffect(() => {
    let timeoutId: number;
    const handleResize = () => {
      // 150ms 防抖，避免旋转屏幕或拖拽窗口时的瞬时高频计算
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        setIsMobile(checkIsMobile());
      }, 150);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.clearTimeout(timeoutId);
    };
  }, []);

  return { isMobile };
}
